import { getAuthUser } from "../_shared/auth.ts";

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

interface PhraseAnalysis {
  tone: string;
  toneScore: number;
  energyLevel: number;
  idealPacing: string;
  emotionalArc: string;
  suggestedVisuals: string[];
  keywords: string[];
}

interface VideoInput {
  id: string;
  filename: string;
  analysis: VideoAnalysis | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await getAuthUser(req);
    const { phraseText, phraseTags, phraseAnalysis, videos } = await req.json();

    if (!phraseText || !videos?.length) {
      return new Response(
        JSON.stringify({ error: "phraseText and videos are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Filter to only videos that have been analyzed
    const analyzedVideos = (videos as VideoInput[]).filter(
      (v) => v.analysis !== null
    );

    if (analyzedVideos.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No analyzed videos available. Wait for video analysis to complete.",
          suggestions: [],
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const pa = phraseAnalysis as PhraseAnalysis | null;

    // Build video descriptions with structured data
    const videoDescriptions = analyzedVideos
      .map((v, i) => {
        const a = v.analysis!;
        let desc = `Video ${i + 1} (id: ${v.id}, file: ${v.filename}):
  Mood: ${a.mood}
  Energy: ${a.energy}
  Visuals: ${a.visuals}
  Tags: ${a.sceneTags.join(", ")}
  Summary: ${a.summary}`;

        // Add structured fields if available
        if (a.moodScore != null) desc += `\n  Mood Score: ${a.moodScore} (scale: -5 to +5)`;
        if (a.energyScore != null) desc += `\n  Energy Score: ${a.energyScore} (scale: 1-10)`;
        if (a.pacing) desc += `\n  Pacing: ${a.pacing}`;
        if (a.colorPalette?.length) desc += `\n  Colors: ${a.colorPalette.join(", ")}`;
        if (a.shotTypes?.length) desc += `\n  Shot Types: ${a.shotTypes.join(", ")}`;
        if (a.dominantMotion) desc += `\n  Motion: ${a.dominantMotion}`;
        if (a.structure) desc += `\n  Structure: ${a.structure}`;
        if (a.audioNotes) desc += `\n  Audio: ${a.audioNotes}`;

        return desc;
      })
      .join("\n\n");

    // Build phrase section with structured analysis if available
    let phraseSection = `Phrase: "${phraseText}"`;
    if (phraseTags?.length > 0) {
      phraseSection += `\nPhrase tags: ${phraseTags.join(", ")}`;
    }
    if (pa) {
      phraseSection += `\n\nPhrase Analysis:
  Tone: ${pa.tone}
  Tone Score: ${pa.toneScore} (scale: -5 to +5, same as video moodScore)
  Energy Level: ${pa.energyLevel} (scale: 1-10, same as video energyScore)
  Ideal Pacing: ${pa.idealPacing}
  Emotional Arc: ${pa.emotionalArc}
  Suggested Visuals: ${pa.suggestedVisuals.join(", ")}
  Keywords: ${pa.keywords.join(", ")}`;
    }

    const prompt = `You are matching a phrase to video clips for short-form social media content (TikTok/Reels/Shorts).

${phraseSection}

Here are the available videos with their AI-generated analysis:

${videoDescriptions}

For EACH video, rate how well it matches the phrase from 0-100. Consider:
- Mood/tone alignment (compare moodScore vs toneScore if available — closer = better)
- Energy/pacing match (compare energyScore vs energyLevel if available — closer = better)
- Visual storytelling potential (do the visuals complement the phrase content?)
- Structural compatibility (does the video's emotional arc match the phrase's arc?)
- Color and atmosphere fit

Respond with a JSON array in this exact format:
[
  {
    "videoId": "<the video id>",
    "score": <number 0-100>,
    "reasoning": "<1-2 sentences explaining the match>",
    "moodMatch": "<how the moods align>",
    "energyMatch": "<how the energy levels align>",
    "visualNotes": "<how the visuals complement the phrase>"
  }
]

Be honest — score poor matches low. Sort by score descending. Only return the JSON array, nothing else.`;

    const geminiResponse = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2000,
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

    // Ensure sorted by score
    suggestions.sort(
      (a: { score: number }, b: { score: number }) => b.score - a.score
    );

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, suggestions: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
