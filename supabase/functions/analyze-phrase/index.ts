import { getAuthUser } from "../_shared/auth.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PHRASE_ANALYSIS_PROMPT = `Analyze this phrase/text for use in short-form social media content (TikTok/Reels/Shorts). The goal is to understand its tone, energy, and what kind of video visuals would pair well with it.

Phrase: "{PHRASE_TEXT}"
{TAGS_LINE}
{NOTES_LINE}

Respond in this exact JSON format:
{
  "tone": "<e.g. inspirational, humorous, serious, sarcastic, romantic, motivational, nostalgic>",
  "toneScore": <number from -5 (dark/somber/heavy) to +5 (bright/uplifting/joyful) — this should align with video moodScore scale>,
  "energyLevel": <number from 1 (very calm/contemplative) to 10 (extremely high energy/hype) — this should align with video energyScore scale>,
  "idealPacing": "<one of: slow, medium, fast — what video pacing would best match this phrase>",
  "emotionalArc": "<e.g. steady, building, dramatic turn, reflective to hopeful — what emotional journey does this phrase take>",
  "suggestedVisuals": ["<visual1>", "<visual2>", ...],
  "keywords": ["<keyword1>", "<keyword2>", ...]
}

Field guidelines:
- toneScore: should be on the same -5 to +5 scale as video mood scoring for direct comparison
- energyLevel: should be on the same 1-10 scale as video energy scoring for direct comparison
- suggestedVisuals: 3-6 types of visuals that would complement this phrase (e.g. "nature scenery", "close-up faces", "urban streets", "dramatic lighting")
- keywords: 3-8 key content/theme words extracted from the phrase

Only return the JSON, nothing else.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await getAuthUser(req);
    const { phraseText, tags, notes } = await req.json();

    if (!phraseText) {
      return new Response(
        JSON.stringify({ error: "phraseText is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const prompt = PHRASE_ANALYSIS_PROMPT
      .replace("{PHRASE_TEXT}", phraseText)
      .replace(
        "{TAGS_LINE}",
        tags?.length > 0 ? `Tags: ${tags.join(", ")}` : ""
      )
      .replace(
        "{NOTES_LINE}",
        notes ? `Additional notes: ${notes}` : ""
      );

    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 500,
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

    const analysis = JSON.parse(text);

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("analyze-phrase error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
