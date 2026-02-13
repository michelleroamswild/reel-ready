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
  duration_seconds: number | null;
  analysis: VideoAnalysis | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phraseText, targetDuration, phraseAnalysis, videos } =
      await req.json();

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
          error:
            "No analyzed videos available. Wait for video analysis to complete.",
          segments: [],
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const pa = phraseAnalysis as PhraseAnalysis | null;

    // Build video descriptions
    const videoDescriptions = analyzedVideos
      .map((v) => {
        const a = v.analysis!;
        let desc = `Video [videoId="${v.id}"] (file: ${v.filename}, duration: ${v.duration_seconds ?? "unknown"}s):
  Mood: ${a.mood}
  Energy: ${a.energy}
  Visuals: ${a.visuals}
  Tags: ${a.sceneTags.join(", ")}
  Summary: ${a.summary}`;

        if (a.moodScore != null)
          desc += `\n  Mood Score: ${a.moodScore} (scale: -5 to +5)`;
        if (a.energyScore != null)
          desc += `\n  Energy Score: ${a.energyScore} (scale: 1-10)`;
        if (a.pacing) desc += `\n  Pacing: ${a.pacing}`;
        if (a.colorPalette?.length)
          desc += `\n  Colors: ${a.colorPalette.join(", ")}`;
        if (a.shotTypes?.length)
          desc += `\n  Shot Types: ${a.shotTypes.join(", ")}`;
        if (a.dominantMotion) desc += `\n  Motion: ${a.dominantMotion}`;
        if (a.structure) desc += `\n  Structure: ${a.structure}`;
        if (a.audioNotes) desc += `\n  Audio: ${a.audioNotes}`;

        return desc;
      })
      .join("\n\n");

    // Phrase analysis context
    let phraseContext = "";
    if (pa) {
      phraseContext = `\n\nPhrase Analysis:
  Tone: ${pa.tone} (score: ${pa.toneScore})
  Energy Level: ${pa.energyLevel}/10
  Ideal Pacing: ${pa.idealPacing}
  Emotional Arc: ${pa.emotionalArc}
  Suggested Visuals: ${pa.suggestedVisuals.join(", ")}
  Keywords: ${pa.keywords.join(", ")}`;
    }

    // Suggest a good beat count based on duration and video count
    const suggestedBeats = Math.max(2, Math.min(
      analyzedVideos.length,
      Math.ceil(targetDuration / 5)
    ));

    const prompt = `You are a creative director building a reel storyboard for short-form social media (TikTok/Reels/Shorts). Your job is to pick visually dynamic video clips to stitch together behind a text overlay.

Target total duration: ${targetDuration} seconds.
${phraseContext}

PHRASE TEXT (shown as a single overlay across all clips):
"${phraseText}"

Available video clips (${analyzedVideos.length} total):
${videoDescriptions}

YOUR TASK — PICK ${suggestedBeats} TO ${suggestedBeats + 2} VIDEO CLIPS:
Select clips that look great together as a montage behind the phrase text. The FULL phrase text will be displayed on every clip — do NOT split or change the text.

CRITICAL RULES:
1. **MAXIMIZE VARIETY**: Use as many DIFFERENT videos as possible. NEVER repeat a video unless you have more segments than videos.
2. **MATCH VISUALS TO PHRASE**: Each clip should visually complement the mood/energy of the phrase.
3. **SMART TIMESTAMPS**: Pick the most visually interesting portion of each video. Don't always start at 0s.
4. **PACING**: Segments should be 3-8s each. Total should be close to ${targetDuration}s.
5. Each segment must be at least 2 seconds long.
6. startSeconds and endSeconds must be within the video's actual duration.
7. **sectionText MUST be the FULL phrase text for every segment** — copy it exactly as provided above.

Respond with a JSON array in this exact format:
[
  {
    "sectionIndex": 0,
    "sectionText": "${phraseText.replace(/"/g, '\\"')}",
    "videoId": "<MUST be the exact UUID from videoId= above>",
    "startSeconds": <number>,
    "endSeconds": <number>,
    "score": <0-100>,
    "reasoning": "<why this clip fits the phrase visually>"
  }
]

IMPORTANT: "videoId" must be the full UUID from the video listing (the value inside videoId="..."). Do NOT use a number or index.
IMPORTANT: "sectionText" must be the FULL phrase "${phraseText.replace(/"/g, '\\"')}" for EVERY segment. Never split or shorten it.

Return one entry per segment, in order. Only return the JSON array.`;

    const geminiResponse = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 4000,
          responseMimeType: "application/json",
        },
      }),
    });

    const data = await geminiResponse.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return new Response(
        JSON.stringify({ error: "Gemini returned no result", segments: [] }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const segments = JSON.parse(text);

    // Build a duration lookup for validation
    const durationMap = new Map<string, number>();
    for (const v of analyzedVideos) {
      if (v.duration_seconds != null) {
        durationMap.set(v.id, v.duration_seconds);
      }
    }

    // Validate and clamp timestamps
    for (const seg of segments) {
      const dur = durationMap.get(seg.videoId);
      if (dur != null) {
        seg.startSeconds = Math.max(0, Math.min(seg.startSeconds, dur));
        seg.endSeconds = Math.max(seg.startSeconds + 0.5, Math.min(seg.endSeconds, dur));
      }
      seg.startSeconds = Math.round(seg.startSeconds * 10) / 10;
      seg.endSeconds = Math.round(seg.endSeconds * 10) / 10;
    }

    return new Response(JSON.stringify({ segments }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message, segments: [] }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
