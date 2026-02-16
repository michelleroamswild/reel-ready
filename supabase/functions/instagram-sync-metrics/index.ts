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

async function refreshTokenIfNeeded(
  supabase: ReturnType<typeof createClient>,
  connection: Record<string, unknown>
): Promise<string> {
  const token = connection.access_token as string;
  const expiresAt = new Date(connection.token_expires_at as string);
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  if (expiresAt > sevenDaysFromNow) {
    return token;
  }

  // Refresh the long-lived token
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: INSTAGRAM_APP_ID,
    client_secret: INSTAGRAM_APP_SECRET,
    fb_exchange_token: token,
  });

  const res = await fetch(`${GRAPH_URL}/oauth/access_token?${params}`);
  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(
      `Token refresh failed: ${data.error?.message ?? "unknown error"}`
    );
  }

  const newToken = data.access_token;
  const expiresIn = data.expires_in ?? 5184000;
  const newExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

  await supabase
    .from("instagram_connections")
    .update({
      access_token: newToken,
      token_expires_at: newExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  return newToken;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId } = await getAuthUser(req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch connection
    const { data: connection, error: connError } = await supabase
      .from("instagram_connections")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: "No Instagram connection found. Connect your account first." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Refresh token if needed
    const accessToken = await refreshTokenIfNeeded(supabase, connection);
    const igUserId = connection.ig_user_id;

    // 1. Fetch profile
    const profileRes = await fetch(
      `${IG_GRAPH_URL}/${igUserId}?fields=followers_count,media_count&access_token=${accessToken}`
    );
    const profile = await profileRes.json();
    const followersCount = profile.followers_count ?? connection.followers_count ?? 0;

    // 2. Fetch recent media (last 50 posts)
    const mediaRes = await fetch(
      `${IG_GRAPH_URL}/${igUserId}/media?fields=id,media_type,timestamp,like_count,comments_count&limit=50&access_token=${accessToken}`
    );
    const mediaData = await mediaRes.json();
    const allMedia = (mediaData.data ?? []) as Array<{
      id: string;
      media_type: string;
      timestamp: string;
      like_count?: number;
      comments_count?: number;
    }>;

    // 3. Fetch insights for recent media (saves/shares)
    const mediaWithInsights = await Promise.all(
      allMedia.slice(0, 25).map(async (m) => {
        try {
          // Insights only available for non-story media
          if (m.media_type === "IMAGE" || m.media_type === "VIDEO" || m.media_type === "CAROUSEL_ALBUM") {
            const insightsRes = await fetch(
              `${IG_GRAPH_URL}/${m.id}/insights?metric=impressions,reach,saved,shares&access_token=${accessToken}`
            );
            const insightsData = await insightsRes.json();
            const metrics: Record<string, number> = {};
            for (const entry of insightsData.data ?? []) {
              metrics[entry.name] = entry.values?.[0]?.value ?? 0;
            }
            return { ...m, insights: metrics };
          }
        } catch {
          // Insights may not be available for all media
        }
        return { ...m, insights: {} as Record<string, number> };
      })
    );

    // 4. Fetch audience online times
    let topPostingHours: number[] = [];
    try {
      const audienceRes = await fetch(
        `${IG_GRAPH_URL}/${igUserId}/insights?metric=online_followers&period=lifetime&access_token=${accessToken}`
      );
      const audienceData = await audienceRes.json();
      const onlineFollowers = audienceData.data?.[0]?.values?.[0]?.value;
      if (onlineFollowers && typeof onlineFollowers === "object") {
        // onlineFollowers is { "0": count, "1": count, ... "23": count }
        const hourCounts = Object.entries(onlineFollowers)
          .map(([hour, count]) => ({ hour: parseInt(hour), count: count as number }))
          .sort((a, b) => b.count - a.count);
        topPostingHours = hourCounts.slice(0, 5).map((h) => h.hour);
      }
    } catch {
      // Audience insights may not be available for all accounts
    }

    // 5. Fetch audience demographics
    let audienceDemographics: Record<string, unknown> | null = null;
    try {
      const demoRes = await fetch(
        `${IG_GRAPH_URL}/${igUserId}/insights?metric=audience_city,audience_country,audience_gender_age&period=lifetime&access_token=${accessToken}`
      );
      const demoData = await demoRes.json();
      if (demoData.data?.length) {
        audienceDemographics = {};
        for (const entry of demoData.data) {
          audienceDemographics[entry.name] = entry.values?.[0]?.value;
        }
      }
    } catch {
      // Demographics may not be available
    }

    // 6. Compute derived metrics
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentMedia = allMedia.filter(
      (m) => new Date(m.timestamp) >= thirtyDaysAgo
    );
    const postsPerWeek =
      recentMedia.length > 0 ? recentMedia.length / 4.3 : 0;

    // Performance trend: compare last 10 vs previous 10
    let performanceTrend: "rising" | "stable" | "declining" = "stable";
    if (allMedia.length >= 10) {
      const recent10 = allMedia.slice(0, 10);
      const older10 = allMedia.slice(10, 20);

      const engagementRate = (m: typeof allMedia[0]) =>
        followersCount > 0
          ? ((m.like_count ?? 0) + (m.comments_count ?? 0)) / followersCount
          : 0;

      const recentAvg =
        recent10.reduce((s, m) => s + engagementRate(m), 0) / recent10.length;
      const olderAvg =
        older10.length > 0
          ? older10.reduce((s, m) => s + engagementRate(m), 0) / older10.length
          : recentAvg;

      if (olderAvg > 0) {
        const change = (recentAvg - olderAvg) / olderAvg;
        if (change > 0.15) performanceTrend = "rising";
        else if (change < -0.15) performanceTrend = "declining";
      }
    }

    // Average engagement rate
    const avgEngagementRate =
      mediaWithInsights.length > 0 && followersCount > 0
        ? mediaWithInsights.reduce((sum, m) => {
            const likes = m.like_count ?? 0;
            const comments = m.comments_count ?? 0;
            const saved = m.insights?.saved ?? 0;
            return sum + (likes + comments + saved) / followersCount;
          }, 0) / mediaWithInsights.length
        : null;

    // 7. Update instagram_connections
    await supabase
      .from("instagram_connections")
      .update({
        followers_count: followersCount,
        media_count: profile.media_count ?? connection.media_count,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);

    // 8. Upsert account_profiles
    const now = new Date().toISOString();
    const { error: profileError } = await supabase
      .from("account_profiles")
      .upsert(
        {
          user_id: userId,
          platform: "instagram",
          follower_count: followersCount,
          posts_per_week: Math.round(postsPerWeek * 10) / 10,
          performance_trend: performanceTrend,
          top_posting_hours: topPostingHours.length > 0 ? topPostingHours : null,
          audience_demographics: audienceDemographics,
          avg_engagement_rate:
            avgEngagementRate !== null
              ? Math.round(avgEngagementRate * 10000) / 10000
              : null,
          last_synced_at: now,
          updated_at: now,
        },
        { onConflict: "user_id,platform" }
      );

    if (profileError) {
      console.error("Profile upsert error:", profileError.message);
    }

    // 9. Return computed AccountState
    return new Response(
      JSON.stringify({
        platform: "instagram",
        followerCount: followersCount,
        postsPerWeek: Math.round(postsPerWeek * 10) / 10,
        performanceTrend,
        niche: "", // user fills in manually
        topPostingHours,
        avgEngagementRate:
          avgEngagementRate !== null
            ? Math.round(avgEngagementRate * 10000) / 10000
            : null,
        audienceDemographics,
        mediaCount: allMedia.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("instagram-sync-metrics error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
