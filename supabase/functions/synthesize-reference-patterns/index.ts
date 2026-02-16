import { getAuthUser } from "../_shared/auth.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ReelTemplate {
  totalDurationSeconds: number;
  segmentCount: number;
  segments: Array<{
    index: number;
    startSeconds: number;
    endSeconds: number;
    durationSeconds: number;
    textOverlay: string | null;
    mood: string;
    energy: string;
    visualDescription: string;
  }>;
  overallMood: string;
  overallEnergy: string;
  overallPacing: string;
  visualStyleNotes: string;
  textOverlayStyle: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await getAuthUser(req);
    const { templates } = (await req.json()) as {
      templates: ReelTemplate[];
    };

    if (!templates || templates.length === 0) {
      return new Response(
        JSON.stringify({ error: "templates array is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build template descriptions for the prompt
    const templateDescriptions = templates
      .map((t, i) => {
        const segmentSummary = t.segments
          .map(
            (s) =>
              `  Seg ${s.index + 1}: ${s.durationSeconds}s, mood: ${s.mood}, energy: ${s.energy}${s.textOverlay ? `, text: "${s.textOverlay}"` : ""}, visual: ${s.visualDescription}`
          )
          .join("\n");

        return `Reference Reel ${i + 1}:
Duration: ${t.totalDurationSeconds}s, ${t.segmentCount} segments
Overall: mood=${t.overallMood}, energy=${t.overallEnergy}, pacing=${t.overallPacing}
Visual style: ${t.visualStyleNotes}
Text style: ${t.textOverlayStyle || "none"}
Segments:
${segmentSummary}`;
      })
      .join("\n\n");

    const prompt = `Given these ${templates.length} reel templates extracted from trending content, synthesize the common patterns across all of them. Focus on what they share — the common hooks, pacing choices, text styles, structure, and audio.

${templateDescriptions}

Respond with JSON in this exact format:
{
  "hookStyle": "<how do most of these reels open? e.g. 'text-on-screen question hook', 'POV statement', 'dramatic visual'>",
  "avgDuration": <average total duration across all reels, as a number>,
  "pacingNotes": "<common pacing patterns, e.g. 'fast cuts 1-2s each, slow final hold'>",
  "textStyle": "<how is text presented? e.g. 'ALL CAPS, 3-5 words, centered', 'lowercase casual, multi-line'>",
  "commonMoods": ["<list of 2-4 moods that appear across multiple reels>"],
  "structureNotes": "<common narrative structure, e.g. 'problem → solution → CTA', 'hook → reveal → reaction'>",
  "audioNotes": "<audio patterns observed, e.g. 'trending lo-fi beats, bass drop at hook', 'voiceover with background music'>",
  "summary": "<2-3 sentence synthesis of what makes these reels work>"
}

Only return the JSON, nothing else.`;

    const geminiResponse = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 2000,
          responseMimeType: "application/json",
        },
      }),
    });

    const data = await geminiResponse.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return new Response(
        JSON.stringify({ error: "Gemini returned no result" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const patterns = JSON.parse(text);

    return new Response(JSON.stringify({ patterns }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("synthesize-reference-patterns error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
