const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VideoInput {
  id: string;
  filename: string;
  analysis: {
    mood: string;
    energy: string;
    visuals: string;
    sceneTags: string[];
    summary: string;
  } | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phraseText, phraseTags, videos } = await req.json();

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

    // Build a single prompt with all video descriptions
    const videoDescriptions = analyzedVideos
      .map(
        (v, i) =>
          `Video ${i + 1} (id: ${v.id}, file: ${v.filename}):
  Mood: ${v.analysis!.mood}
  Energy: ${v.analysis!.energy}
  Visuals: ${v.analysis!.visuals}
  Tags: ${v.analysis!.sceneTags.join(", ")}
  Summary: ${v.analysis!.summary}`
      )
      .join("\n\n");

    const prompt = `You are matching a phrase to video clips for short-form social media content (TikTok/Reels/Shorts).

Phrase: "${phraseText}"
${phraseTags.length > 0 ? `Phrase tags: ${phraseTags.join(", ")}` : ""}

Here are the available videos with their AI-generated descriptions:

${videoDescriptions}

For EACH video, rate how well it matches the phrase from 0-100. Consider mood alignment, energy/pacing match, visual storytelling potential, and how the phrase would feel overlaid on this video.

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
