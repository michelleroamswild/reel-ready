import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthUser } from "../_shared/auth.ts";

const INSTAGRAM_APP_ID = Deno.env.get("INSTAGRAM_APP_ID")!;
const INSTAGRAM_APP_SECRET = Deno.env.get("INSTAGRAM_APP_SECRET")!;
const GRAPH_URL = "https://graph.facebook.com/v21.0";
const IG_GRAPH_URL = "https://graph.instagram.com/v21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId } = await getAuthUser(req);
    const { code, redirectUri, token } = await req.json();

    let accessToken: string;
    let tokenExpiresAt: string;

    if (token) {
      // Manual token flow: user pasted a token from Graph API Explorer
      // Exchange it for a long-lived token (60 days)
      const longTokenParams = new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: INSTAGRAM_APP_ID,
        client_secret: INSTAGRAM_APP_SECRET,
        fb_exchange_token: token,
      });

      const longTokenRes = await fetch(
        `${GRAPH_URL}/oauth/access_token?${longTokenParams}`
      );
      const longTokenData = await longTokenRes.json();

      if (!longTokenRes.ok || longTokenData.error) {
        throw new Error(
          `Token exchange failed: ${longTokenData.error?.message ?? JSON.stringify(longTokenData)}`
        );
      }

      accessToken = longTokenData.access_token;
      const expiresIn = longTokenData.expires_in ?? 5184000;
      tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    } else if (code && redirectUri) {
      // OAuth flow: exchange code for short-lived token, then long-lived
      const tokenParams = new URLSearchParams({
        client_id: INSTAGRAM_APP_ID,
        client_secret: INSTAGRAM_APP_SECRET,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      });

      const shortTokenRes = await fetch(
        `${GRAPH_URL}/oauth/access_token?${tokenParams}`
      );
      const shortTokenData = await shortTokenRes.json();

      if (!shortTokenRes.ok || shortTokenData.error) {
        throw new Error(
          `Token exchange failed: ${shortTokenData.error?.message ?? JSON.stringify(shortTokenData)}`
        );
      }

      const shortLivedToken = shortTokenData.access_token;

      const longTokenParams = new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: INSTAGRAM_APP_ID,
        client_secret: INSTAGRAM_APP_SECRET,
        fb_exchange_token: shortLivedToken,
      });

      const longTokenRes = await fetch(
        `${GRAPH_URL}/oauth/access_token?${longTokenParams}`
      );
      const longTokenData = await longTokenRes.json();

      if (!longTokenRes.ok || longTokenData.error) {
        throw new Error(
          `Long-lived token exchange failed: ${longTokenData.error?.message ?? JSON.stringify(longTokenData)}`
        );
      }

      accessToken = longTokenData.access_token;
      const expiresIn = longTokenData.expires_in ?? 5184000;
      tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    } else {
      return new Response(
        JSON.stringify({ error: "Provide either a token or code + redirectUri" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Get Instagram user pages to find IG business account
    const pagesRes = await fetch(
      `${GRAPH_URL}/me/accounts?fields=id,instagram_business_account&access_token=${accessToken}`
    );
    const pagesData = await pagesRes.json();

    let igUserId: string | null = null;
    for (const page of pagesData.data ?? []) {
      if (page.instagram_business_account?.id) {
        igUserId = page.instagram_business_account.id;
        break;
      }
    }

    if (!igUserId) {
      throw new Error(
        "No Instagram Business or Creator account found. Make sure your Instagram account is linked to a Facebook Page and set to Business or Creator."
      );
    }

    // 4. Fetch IG profile
    const profileRes = await fetch(
      `${IG_GRAPH_URL}/${igUserId}?fields=id,username,name,followers_count,media_count&access_token=${accessToken}`
    );
    const profile = await profileRes.json();

    if (!profileRes.ok || profile.error) {
      throw new Error(
        `Failed to fetch Instagram profile: ${profile.error?.message ?? JSON.stringify(profile)}`
      );
    }

    // 5. Upsert into instagram_connections
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: upsertError } = await supabase
      .from("instagram_connections")
      .upsert(
        {
          user_id: userId,
          ig_user_id: profile.id,
          ig_username: profile.username ?? profile.name ?? "unknown",
          access_token: accessToken,
          token_expires_at: tokenExpiresAt,
          followers_count: profile.followers_count ?? 0,
          media_count: profile.media_count ?? 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      throw new Error(`Failed to save connection: ${upsertError.message}`);
    }

    return new Response(
      JSON.stringify({
        igUsername: profile.username ?? profile.name,
        followersCount: profile.followers_count ?? 0,
        mediaCount: profile.media_count ?? 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("instagram-exchange-token error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
