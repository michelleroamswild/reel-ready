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
    await getAuthUser(req);
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

    // Build a list of exact durations for the prompt
    const durationList = tmpl.segments
      .map(
        (s) =>
          `Segment ${s.index + 1}: EXACTLY ${s.durationSeconds.toFixed(1)}s (endSeconds - startSeconds MUST equal ${s.durationSeconds.toFixed(1)})`
      )
      .join("\n");

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

REQUIRED DURATIONS (THIS IS THE MOST IMPORTANT RULE):
${durationList}

AVAILABLE USER VIDEOS (${analyzedVideos.length} total):
${videoDescriptions}

YOUR TASK:
For each template segment, pick the best matching video clip from the user's library.

CRITICAL RULES — IN ORDER OF PRIORITY:
1. DURATION IS KING: Each segment's duration (endSeconds - startSeconds) MUST match the template segment's duration EXACTLY. This is the most important rule. For example, if the template says 3.5s, your clip MUST be 3.5s (e.g., startSeconds: 2.0, endSeconds: 5.5).
2. Create exactly ${tmpl.segmentCount} segments
3. startSeconds and endSeconds must be within the video's actual duration
4. Match mood and energy of each segment to the template
5. MAXIMIZE VARIETY — use as many different videos as possible. Never repeat a video unless you have more segments than videos.
6. Pick the most visually interesting portion of each video. Don't always start at 0s.
7. sectionText should be the text overlay from the template segment (or empty string if none)

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

    // Enforce template durations and clamp to video bounds
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const videoDur = durationMap.get(seg.videoId);
      const templateSeg = tmpl.segments[i];
      const targetDur = templateSeg?.durationSeconds ?? (seg.endSeconds - seg.startSeconds);

      // Clamp start to video bounds
      seg.startSeconds = Math.max(0, seg.startSeconds);
      if (videoDur != null) {
        seg.startSeconds = Math.min(seg.startSeconds, Math.max(0, videoDur - targetDur));
      }

      // Set end to match template duration exactly
      seg.endSeconds = seg.startSeconds + targetDur;

      // Clamp end to video duration
      if (videoDur != null && seg.endSeconds > videoDur) {
        seg.endSeconds = videoDur;
        // Shift start back to maintain duration
        seg.startSeconds = Math.max(0, seg.endSeconds - targetDur);
      }

      // Ensure minimum duration
      if (seg.endSeconds - seg.startSeconds < 0.5) {
        seg.endSeconds = seg.startSeconds + Math.max(0.5, targetDur);
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
