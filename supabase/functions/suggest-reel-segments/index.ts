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
    const { sections, targetDuration, phraseAnalysis, videos } =
      await req.json();

    if (!sections?.length || !videos?.length) {
      return new Response(
        JSON.stringify({ error: "sections and videos are required" }),
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
      .map((v, i) => {
        const a = v.analysis!;
        let desc = `Video ${i + 1} (id: ${v.id}, file: ${v.filename}, duration: ${v.duration_seconds ?? "unknown"}s):
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

    // Build sections list
    const sectionsList = (sections as string[])
      .map((text: string, i: number) => `Section ${i + 1}: "${text}"`)
      .join("\n");

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

    const prompt = `You are a creative director building a reel storyboard for short-form social media (TikTok/Reels/Shorts). Your job is to create a VISUALLY DYNAMIC reel that keeps viewers engaged by using a VARIETY of clips.

Target total duration: ${targetDuration} seconds across ${sections.length} sections.
${phraseContext}

Sections of the phrase (split by line breaks):
${sectionsList}

Available video clips (${analyzedVideos.length} total):
${videoDescriptions}

CRITICAL RULES:
1. **MAXIMIZE VARIETY**: You MUST use as many DIFFERENT videos as possible. NEVER use the same video for more than one section unless there are fewer videos than sections. If there are ${analyzedVideos.length} videos and ${sections.length} sections, aim to use at least ${Math.min(analyzedVideos.length, sections.length)} different videos.
2. **SECTION-SPECIFIC MATCHING**: For each section, analyze the specific words and imagery they evoke. Match based on:
   - Literal visual matches (e.g. "sky" → aerial/sky footage, "smile" → close-up faces)
   - Emotional tone per line (a sad line needs somber footage, an energetic line needs dynamic footage)
   - Scene tags and visual content alignment with section keywords
   - Energy arc: if the phrase builds intensity, match clips that escalate in energy
3. **SMART TIMESTAMPS**: Pick the most visually interesting portion of each video. Avoid starting at 0s when the middle or end has better content. Consider the video's structure and pacing notes.
4. **PACING**: Distribute ${targetDuration}s across sections. Short punchy lines get 2-4s. Longer emotional lines get 4-8s. Climactic lines get the longest segments.
5. Each segment must be at least 2 seconds long.
6. startSeconds and endSeconds must be within the video's actual duration.

Think step by step:
- First, identify the key emotion/visual for EACH section independently
- Then, find the BEST unique video match for each section
- Finally, pick the most compelling timestamp range within that video

Respond with a JSON array in this exact format:
[
  {
    "sectionIndex": 0,
    "videoId": "<the video id>",
    "startSeconds": <number>,
    "endSeconds": <number>,
    "score": <0-100 how well this clip matches this section>,
    "reasoning": "<1-2 sentences: what specific visual/mood in this clip matches this specific section text>"
  }
]

Return one entry per section, in order. Only return the JSON array, nothing else.`;

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
