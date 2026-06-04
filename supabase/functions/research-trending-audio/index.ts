import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthUser } from "../_shared/auth.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { userId } = await getAuthUser(req);
    const { niche } = await req.json();

    if (!niche || typeof niche !== "string" || !niche.trim()) {
      return new Response(
        JSON.stringify({ error: "niche is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const prompt = `You are a social media trend analyst specializing in short-form video content (TikTok and Instagram Reels).

A content creator is making "${niche.trim()}" content and needs to know what audio/music is currently trending or works well for that niche.

Suggest 8 trending or recommended audio tracks that would work well for "${niche.trim()}" content. For each track, provide:

1. The actual song title (use real, well-known songs that are popular on TikTok/Instagram)
2. The artist name
3. The genre
4. The mood the track conveys (one or two words, e.g., energetic, chill, emotional, hype, dreamy)
5. The energy level: "low", "medium", or "high"

Focus on tracks that are:
- Actually trending or frequently used on TikTok/Instagram Reels
- Well-suited to the "${niche.trim()}" content niche
- A mix of popular hits and niche-specific audio

Return valid JSON in this exact format:
{
  "tracks": [
    {
      "title": "song name",
      "artist": "artist name",
      "genre": "genre",
      "mood": "mood descriptor",
      "energy": "low|medium|high"
    }
  ]
}

Only return the JSON, nothing else.`;

    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 3000,
          responseMimeType: "application/json",
        },
      }),
    });

    const geminiData = await geminiRes.json();

    if (!geminiRes.ok) {
      throw new Error(`Gemini error: ${JSON.stringify(geminiData)}`);
    }

    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error(`No result from Gemini: ${JSON.stringify(geminiData)}`);
    }

    const parsed = JSON.parse(text);
    const tracks = parsed.tracks ?? [];

    // Insert tracks, deduplicating against existing rows
    let insertedCount = 0;

    for (const track of tracks) {
      if (!track.title) continue;

      // Check for existing track with same title + artist
      const query = supabase
        .from("trending_audio")
        .select("id")
        .eq("title", track.title);

      if (track.artist) {
        query.eq("artist", track.artist);
      } else {
        query.is("artist", null);
      }

      const { data: existing } = await query.limit(1);

      if (existing && existing.length > 0) continue;

      const { error: insertError } = await supabase
        .from("trending_audio")
        .insert({
          title: track.title,
          artist: track.artist || null,
          platform: "tiktok",
          genre: track.genre || null,
          mood: track.mood || null,
          energy: track.energy || null,
          source: "ai_research",
          user_id: userId,
        });

      if (!insertError) insertedCount++;
    }

    return new Response(
      JSON.stringify({ tracks, count: insertedCount }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("research-trending-audio error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
