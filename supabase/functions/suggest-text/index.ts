import { selectTrendsForClip, type Trend } from "../_shared/trends.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VideoAnalysis {
  mood: string;
  energy: string;
  visuals: string;
  sceneTags: string[];
  summary: string;
  moodScore?: number;
  energyScore?: number;
  pacing?: string;
  colorPalette?: string[];
  shotTypes?: string[];
  dominantMotion?: string;
  structure?: string;
  audioNotes?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { analysis, filename, length } = await req.json();

    const wordLength = length || "short";

    if (!analysis) {
      return new Response(
        JSON.stringify({ error: "Video analysis is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const a = analysis as VideoAnalysis;

    // Select relevant trends using soft-weight scoring
    const matchedTrends = selectTrendsForClip({
      moodScore: a.moodScore ?? 0,
      energyScore: a.energyScore ?? 5,
      sceneTags: a.sceneTags,
      mood: a.mood,
    }, 10);

    // Format trends as reference examples for the prompt
    const trendExamples = matchedTrends
      .map(
        (t: Trend) =>
          `[${t.category}] "${t.template_text}" — ${t.usage_notes}`
      )
      .join("\n");

    const trendCategories = [
      ...new Set(matchedTrends.map((t: Trend) => t.category)),
    ].join(", ");

    let videoContext = `Video: ${filename || "untitled"}
Summary: ${a.summary}
Mood: ${a.mood}
Energy: ${a.energy}
Visuals: ${a.visuals}
Scene Tags: ${a.sceneTags.join(", ")}`;

    if (a.moodScore != null)
      videoContext += `\nMood Score: ${a.moodScore} (-5 dark to +5 uplifting)`;
    if (a.energyScore != null)
      videoContext += `\nEnergy Score: ${a.energyScore}/10`;
    if (a.pacing) videoContext += `\nPacing: ${a.pacing}`;
    if (a.colorPalette?.length)
      videoContext += `\nColors: ${a.colorPalette.join(", ")}`;
    if (a.shotTypes?.length)
      videoContext += `\nShot Types: ${a.shotTypes.join(", ")}`;
    if (a.dominantMotion) videoContext += `\nMotion: ${a.dominantMotion}`;
    if (a.structure) videoContext += `\nStructure: ${a.structure}`;
    if (a.audioNotes) videoContext += `\nAudio: ${a.audioNotes}`;

    const lengthGuide: Record<string, string> = {
      short:
        "Keep it punchy. MAX 8 WORDS per suggestion total. Fragment style, not full sentences.",
      medium: "Each suggestion is a short phrase, MAX 8 WORDS total across all lines.",
      long: "Short sentences allowed. MAX 8 WORDS per suggestion total.",
    };

    // Derive tone from video analysis
    const ms = a.moodScore ?? 0;
    const es = a.energyScore ?? 5;
    let derivedTone = "chill";
    if (ms <= -3) derivedTone = "dark/emotional";
    else if (ms <= -1) derivedTone = "moody/introspective";
    else if (ms >= 3 && es >= 7) derivedTone = "hype/energetic";
    else if (ms >= 3) derivedTone = "uplifting/warm";
    else if (es >= 7) derivedTone = "bold/intense";
    else if (es <= 3) derivedTone = "calm/peaceful";

    const prompt = `You write text overlays for Instagram Reels and TikTok. Be direct, modern, lowercase. No cringe, no generic motivational fluff. Write like a real person posting, not a brand.

${videoContext}

TONE (derived from video): ${derivedTone}. The video mood is "${a.mood}" with ${a.energy} energy. All suggestions must feel authentic to this vibe.

WORD LIMIT: ${lengthGuide[wordLength] || lengthGuide.short}
CRITICAL: Every suggestion MUST be 8 words or fewer. Count carefully. Shorter is better.

TREND REFERENCE — These are trending caption templates that match this clip (scored by AI for fit). Use them as INSPIRATION (riff on them, fill placeholders, remix the format) but don't copy them verbatim:

${trendExamples}

Best-fit categories for this clip: ${trendCategories}

STRUCTURE RULES:
- Most suggestions should be a SINGLE LINE. Only use 2 lines when there's a natural dramatic pause between two distinct phrases (e.g. "not for everyone\\nand that's the point"). NEVER split a single thought mid-sentence across lines.
- NEVER more than 2 lines. Most should be 1 line.
- Total word count must be 8 words or fewer.
- Line breaks (\\n) are pauses — only use them between COMPLETE phrases, never in the middle of a sentence.
- Fill any {placeholder} from templates with something specific to this video.
- BAD line break: "romanticizing my river reading\\nmoment" — this splits one phrase awkwardly.
- GOOD line break: "no thoughts\\njust the river" — two distinct phrases.

Generate 8 suggestions. At least half should be inspired by the trend templates above. The rest can be original but in the same categories (${trendCategories}).

For "confidence", rate how well each suggestion matches the video's vibe:
- 0.9-1.0 = perfect match
- 0.7-0.8 = good match
- 0.5-0.6 = decent match

Respond with a JSON array:
[
  {
    "text": "<1-2 lines, MAX 8 words total. Most should be 1 line.>",
    "category": "<category name from: ${trendCategories}>",
    "confidence": <0.5-1.0>
  }
]

Only return the JSON array.`;

    const geminiResponse = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 3000,
          responseMimeType: "application/json",
        },
      }),
    });

    const data = await geminiResponse.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return new Response(
        JSON.stringify({ error: "Gemini returned no result", suggestions: [] }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const suggestions = JSON.parse(text);

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message, suggestions: [] }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
