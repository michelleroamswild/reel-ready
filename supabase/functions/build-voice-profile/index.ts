import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthUser } from "../_shared/auth.ts";

const INSTAGRAM_APP_ID = Deno.env.get("INSTAGRAM_APP_ID")!;
const INSTAGRAM_APP_SECRET = Deno.env.get("INSTAGRAM_APP_SECRET")!;
const GRAPH_URL = "https://graph.facebook.com/v21.0";
const IG_GRAPH_URL = "https://graph.instagram.com/v21.0";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Mirror of instagram-sync-metrics: keep the long-lived token fresh.
async function refreshTokenIfNeeded(
  supabase: ReturnType<typeof createClient>,
  connection: Record<string, unknown>
): Promise<string> {
  const token = connection.access_token as string;
  const expiresAt = new Date(connection.token_expires_at as string);
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  if (expiresAt > sevenDaysFromNow) return token;

  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: INSTAGRAM_APP_ID,
    client_secret: INSTAGRAM_APP_SECRET,
    fb_exchange_token: token,
  });
  const res = await fetch(`${GRAPH_URL}/oauth/access_token?${params}`);
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Token refresh failed: ${data.error?.message ?? "unknown error"}`);
  }
  const newToken = data.access_token;
  const expiresIn = data.expires_in ?? 5184000;
  const newExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();
  await supabase
    .from("instagram_connections")
    .update({ access_token: newToken, token_expires_at: newExpiry, updated_at: new Date().toISOString() })
    .eq("id", connection.id);
  return newToken;
}

interface CaptionRow {
  text: string;
  engagement: number;
  timestamp?: string;
}

const MAX_PAGES = 12; // up to ~600 posts
const MAX_SAMPLE = 120; // captions fed to the distiller

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { userId } = await getAuthUser(req);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = (await req.json().catch(() => ({}))) as { captions?: string[] };
    const pasted = (body.captions ?? []).map((c) => (c ?? "").trim()).filter((c) => c.length >= 10);

    let captions: CaptionRow[] = [];
    let source: "instagram" | "paste" = "paste";

    if (pasted.length) {
      captions = pasted.map((t) => ({ text: t, engagement: 0 }));
    } else {
      source = "instagram";
      const { data: connection } = await supabase
        .from("instagram_connections")
        .select("*")
        .eq("user_id", userId)
        .single();
      if (!connection) {
        return json(
          { error: "No Instagram connection found. Connect your account, or paste a few captions to build a profile." },
          404
        );
      }
      const accessToken = await refreshTokenIfNeeded(supabase, connection);
      const igUserId = connection.ig_user_id;

      let url =
        `${IG_GRAPH_URL}/${igUserId}/media` +
        `?fields=caption,like_count,comments_count,timestamp,media_type&limit=50&access_token=${accessToken}`;
      let pages = 0;
      const items: Array<{ caption?: string; like_count?: number; comments_count?: number; timestamp?: string }> = [];
      while (url && pages < MAX_PAGES) {
        const res = await fetch(url);
        const data = await res.json();
        if (data.error) break;
        for (const m of data.data ?? []) items.push(m);
        url = data.paging?.next ?? "";
        pages++;
      }
      captions = items
        .filter((m) => (m.caption ?? "").trim().length >= 10)
        .map((m) => ({
          text: (m.caption as string).trim(),
          engagement: (m.like_count ?? 0) + 3 * (m.comments_count ?? 0),
          timestamp: m.timestamp,
        }));
    }

    if (!captions.length) {
      return json({ error: "No usable captions found to learn from." }, 400);
    }

    // Broad sample weighted to best: ~60% top performers + an even time-spread of the rest.
    let sample = captions;
    if (captions.length > MAX_SAMPLE) {
      const byEng = [...captions].sort((a, b) => b.engagement - a.engagement);
      const topCount = Math.round(MAX_SAMPLE * 0.6);
      const top = byEng.slice(0, topCount);
      const rest = byEng.slice(topCount);
      const spreadCount = MAX_SAMPLE - topCount;
      const step = Math.max(1, Math.floor(rest.length / spreadCount));
      const spread: CaptionRow[] = [];
      for (let i = 0; i < rest.length && spread.length < spreadCount; i += step) spread.push(rest[i]);
      sample = [...top, ...spread];
    }

    const captionList = sample
      .map((c, i) => `${i + 1}. ${c.text.replace(/\s+/g, " ")}`)
      .join("\n");

    const prompt = `You are analyzing a creator's real Instagram captions to build a reusable "voice profile". Another AI will use this profile to write brand-new captions that sound and feel exactly like this person.

CAPTIONS (${sample.length} real samples${source === "instagram" ? ", higher-engagement posts listed first" : ""}):
${captionList}

Write a detailed, specific guide describing how THIS person writes captions. Reference the actual patterns you observe (don't be generic). Cover:
- Overall voice & personality in 1-2 sentences
- Sentence length & rhythm; capitalization (do they write lowercase?); punctuation habits
- Emoji usage: how many, which ones, where they go (or none)
- Hashtag style: typical number per post, niche vs broad, and any branded/recurring hashtags they reuse — list the actual recurring ones you see
- Signature words, phrases, openers, closers, and calls-to-action they favor
- Their tone range and anything they clearly avoid

Write the guide as direct, usable instructions ("Write in lowercase.", "Open with...", "Avoid..."). Be concrete.

Return ONLY valid JSON in this exact shape:
{
  "profile": "<the full voice guide as one text block>",
  "signatureHashtags": ["hashtag", "without", "the", "pound", "sign"]
}`;

    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2000,
          responseMimeType: "application/json",
        },
      }),
    });
    const gdata = await geminiRes.json();
    const text = gdata?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return json({ error: "Voice analysis returned no result." }, 500);

    const parsed = JSON.parse(text) as { profile?: string; signatureHashtags?: string[] };
    const voiceProfile = {
      text: parsed.profile ?? "",
      signatureHashtags: (parsed.signatureHashtags ?? []).map((h) => h.replace(/^#/, "")),
      sampleCount: sample.length,
      totalCaptions: captions.length,
      source,
    };

    const now = new Date().toISOString();
    const { data: existing } = await supabase
      .from("account_profiles")
      .select("id")
      .eq("user_id", userId)
      .eq("platform", "instagram")
      .maybeSingle();

    if (existing) {
      await supabase
        .from("account_profiles")
        .update({ voice_profile: voiceProfile, voice_profile_updated_at: now, updated_at: now })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("account_profiles")
        .insert({ user_id: userId, platform: "instagram", voice_profile: voiceProfile, voice_profile_updated_at: now });
    }

    return json({ voiceProfile });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
