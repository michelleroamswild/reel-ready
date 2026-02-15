import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TIKTOK_COMMERCIAL_MUSIC_URL =
  "https://ads.tiktok.com/creative_radar_api/v1/popular_trend/sound/list";

interface TikTokTrack {
  title: string;
  author: string;
  usage_amount: number;
  rank: number;
  music_genre: string;
  sound_link: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    let tracks: Array<{
      title: string;
      artist: string | null;
      platform: string;
      usage_count: number | null;
      trend_rank: number;
      genre: string | null;
      mood: string | null;
      energy: string | null;
      duration_seconds: number | null;
      external_url: string | null;
    }> = [];

    // Try fetching from TikTok Creative Center API
    let fetchedFromApi = false;
    try {
      const response = await fetch(TIKTOK_COMMERCIAL_MUSIC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: 7,
          page: 1,
          limit: 20,
          country_code: "US",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const soundList = data?.data?.sound_list ?? data?.data?.music_list ?? [];

        if (soundList.length > 0) {
          tracks = soundList.map((track: TikTokTrack, index: number) => ({
            title: track.title || `Trending Track #${index + 1}`,
            artist: track.author || null,
            platform: "tiktok",
            usage_count: track.usage_amount ?? null,
            trend_rank: track.rank ?? index + 1,
            genre: track.music_genre || null,
            mood: null,
            energy: null,
            duration_seconds: null,
            external_url: track.sound_link || null,
          }));
          fetchedFromApi = true;
        }
      }
    } catch {
      // API unreachable — will fall back to cached data
    }

    if (fetchedFromApi && tracks.length > 0) {
      // Upsert into trending_audio (dedup on title+artist+platform)
      for (const track of tracks) {
        // Check if already exists
        const { data: existing } = await supabase
          .from("trending_audio")
          .select("id")
          .eq("title", track.title)
          .eq("platform", track.platform)
          .is("artist", track.artist === null ? null : undefined)
          .or(
            track.artist !== null
              ? `artist.eq.${track.artist}`
              : "artist.is.null"
          )
          .limit(1);

        if (existing && existing.length > 0) {
          // Update existing row
          await supabase
            .from("trending_audio")
            .update({
              usage_count: track.usage_count,
              trend_rank: track.trend_rank,
              genre: track.genre,
              external_url: track.external_url,
              fetched_at: new Date().toISOString(),
            })
            .eq("id", existing[0].id);
        } else {
          // Insert new row
          await supabase.from("trending_audio").insert({
            title: track.title,
            artist: track.artist,
            platform: track.platform,
            usage_count: track.usage_count,
            trend_rank: track.trend_rank,
            genre: track.genre,
            mood: track.mood,
            energy: track.energy,
            duration_seconds: track.duration_seconds,
            external_url: track.external_url,
          });
        }
      }
    }

    // Return fresh or cached data (within 7 days)
    const { data: audioList, error: fetchError } = await supabase
      .from("trending_audio")
      .select("*")
      .gte(
        "fetched_at",
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      )
      .order("trend_rank", { ascending: true })
      .limit(20);

    if (fetchError) throw fetchError;

    return new Response(
      JSON.stringify({ tracks: audioList ?? [], fromApi: fetchedFromApi }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("fetch-trending-audio error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
