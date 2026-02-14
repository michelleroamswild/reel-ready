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

interface VideoInput {
  id: string;
  filename: string;
  duration_seconds: number | null;
  analysis: VideoAnalysis | null;
}

interface TemplateSegment {
  index: number;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  textOverlay: string | null;
  mood: string;
  energy: string;
  visualDescription: string;
}

interface ReelTemplate {
  totalDurationSeconds: number;
  segmentCount: number;
  segments: TemplateSegment[];
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
    const { template, videos } = await req.json();

    if (!template || !videos?.length) {
      return new Response(
        JSON.stringify({ error: "template and videos are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const tmpl = template as ReelTemplate;

    const analyzedVideos = (videos as VideoInput[]).filter(
      (v) => v.analysis !== null
    );

    if (analyzedVideos.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No analyzed videos available. Analyze at least one video first.",
          segments: [],
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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

        if (a.moodScore != null) desc += `\n  Mood Score: ${a.moodScore}`;
        if (a.energyScore != null) desc += `\n  Energy Score: ${a.energyScore}`;
        if (a.pacing) desc += `\n  Pacing: ${a.pacing}`;
        if (a.shotTypes?.length) desc += `\n  Shot Types: ${a.shotTypes.join(", ")}`;
        if (a.dominantMotion) desc += `\n  Motion: ${a.dominantMotion}`;

        return desc;
      })
      .join("\n\n");

    // Build template segment descriptions
    const segmentDescriptions = tmpl.segments
      .map(
        (s) => `Segment ${s.index + 1} (${s.durationSeconds.toFixed(1)}s):
  Mood: ${s.mood}
  Energy: ${s.energy}
  Visuals: ${s.visualDescription}
  Text overlay: ${s.textOverlay || "(none)"}`
      )
      .join("\n\n");

    const prompt = `You are a creative director recreating a reel's structure using a different video library. The original reel has been analyzed into a template — your job is to pick the best matching clip from the user's library for each segment.

ORIGINAL REEL TEMPLATE:
- Total duration: ${tmpl.totalDurationSeconds}s
- Segments: ${tmpl.segmentCount}
- Overall mood: ${tmpl.overallMood}
- Overall energy: ${tmpl.overallEnergy}
- Overall pacing: ${tmpl.overallPacing}
- Style notes: ${tmpl.visualStyleNotes}

SEGMENT BREAKDOWN:
${segmentDescriptions}

AVAILABLE USER VIDEOS (${analyzedVideos.length} total):
${videoDescriptions}

YOUR TASK:
For each template segment, pick the best matching video clip from the user's library.

CRITICAL RULES:
1. Create exactly ${tmpl.segmentCount} segments
2. Each segment's duration should closely match the template segment's duration
3. Match mood and energy of each segment to the template
4. MAXIMIZE VARIETY — use as many different videos as possible. Never repeat a video unless you have more segments than videos.
5. Pick the most visually interesting portion of each video. Don't always start at 0s.
6. Each segment must be at least 1 second long
7. startSeconds and endSeconds must be within the video's actual duration
8. sectionText should be the text overlay from the template segment (or empty string if none)

Respond with a JSON array in this exact format:
[
  {
    "sectionIndex": 0,
    "sectionText": "<text overlay from template, or empty string>",
    "videoId": "<MUST be the exact UUID from videoId= above>",
    "startSeconds": <number>,
    "endSeconds": <number>,
    "score": <0-100>,
    "reasoning": "<why this clip matches this template segment>"
  }
]

IMPORTANT: "videoId" must be the full UUID from the video listing (the value inside videoId="..."). Do NOT use a number or index.

Return one entry per segment, in order. Only return the JSON array.`;

    const geminiResponse = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
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
        seg.endSeconds = Math.max(
          seg.startSeconds + 0.5,
          Math.min(seg.endSeconds, dur)
        );
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
