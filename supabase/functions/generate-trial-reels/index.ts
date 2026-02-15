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

interface SegmentInput {
  section_text: string;
  video_id: string;
  start_seconds: number;
  end_seconds: number;
  section_index: number;
}

interface BaseReel {
  title: string;
  phraseText: string;
  targetDuration: number;
  segments: SegmentInput[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { baseReel, videos, generateText } = (await req.json()) as {
      baseReel: BaseReel;
      videos: VideoInput[];
      generateText?: boolean;
    };

    if (!baseReel?.segments?.length || !videos?.length) {
      return new Response(
        JSON.stringify({ error: "baseReel (with segments) and videos are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Filter to analyzed videos only
    const analyzedVideos = videos.filter((v) => v.analysis !== null);

    if (analyzedVideos.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No analyzed videos available. Wait for video analysis to complete.",
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

    // Describe the base reel segments
    const baseSegmentDescriptions = baseReel.segments
      .map((seg, i) => {
        const video = analyzedVideos.find((v) => v.id === seg.video_id);
        return `Segment ${i + 1}: videoId="${seg.video_id}" (${video?.filename ?? "unknown"}), ${seg.start_seconds}s–${seg.end_seconds}s, text: "${seg.section_text}"`;
      })
      .join("\n");

    const needsText = generateText || !baseReel.phraseText;

    const textInstruction = needsText
      ? `\n\nTEXT GENERATION: No text overlay has been provided yet. You must FIRST craft a compelling, short text overlay phrase (2-8 words, punchy, social-media style) based on the video content and mood. Use this generated text as the sectionText for every segment in every variant (except the "tone" variant which should shift the framing). Also return this text in a top-level "baseText" field so it can be applied to the base reel.`
      : "";

    const baseTextLine = needsText ? "" : `Phrase text: "${baseReel.phraseText}"`;

    const textRule = needsText
      ? "- Every segment needs sectionText — use your generated base text (except tone variant which shifts framing)"
      : "- Every segment needs section_text (copy from base reel unless variant type is \"tone\")";

    const responseFormat = needsText
      ? `{
  "baseText": "<the generated text overlay phrase>",
  "variants": [
    {
      "variantType": "hook",
      "variantLabel": "<short descriptive label>",
      "targetDuration": <number>,
      "segments": [
        {
          "sectionIndex": 0,
          "sectionText": "<text>",
          "videoId": "<exact UUID>",
          "startSeconds": <number>,
          "endSeconds": <number>
        }
      ]
    }
  ]
}`
      : `{
  "variants": [
    {
      "variantType": "hook",
      "variantLabel": "<short descriptive label>",
      "targetDuration": <number>,
      "segments": [
        {
          "sectionIndex": 0,
          "sectionText": "<text>",
          "videoId": "<exact UUID>",
          "startSeconds": <number>,
          "endSeconds": <number>
        }
      ]
    }
  ]
}`;

    const prompt = `You are a creative director helping A/B test short-form social media reels. Given a base reel and a pool of videos, generate 5 variant reels that each test ONE variable while keeping everything else the same.${textInstruction}

BASE REEL:
Title: "${baseReel.title}"
${baseTextLine}
Target duration: ${baseReel.targetDuration}s
Segments:
${baseSegmentDescriptions}

AVAILABLE VIDEO POOL (${analyzedVideos.length} videos):
${videoDescriptions}

Generate exactly 5 variants, one for each type:

1. **hook** — Change ONLY the first segment's video and/or timestamp to create a more attention-grabbing opening. Keep all other segments identical. Pick a video moment with high energy, dramatic motion, or visual impact.

2. **pacing** — Keep the SAME videos and SAME order, but change segment durations. Create a version with faster cuts (shorter segments) or slower holds (longer segments). Each segment must still be 2-8s. Total duration can differ from original.

3. **tone** — Keep the SAME videos and SAME timing, but change the section_text on each segment to shift the emotional framing. The overall meaning should stay similar but the vibe should be noticeably different (e.g., more confident, more vulnerable, more playful).

4. **structure** — Reorder the segments. Try peak-first (most impactful clip first), reverse order, or bookend (strong open + strong close). Keep the same videos and durations, just change the order.

5. **format** — Change the total duration. If the original is longer (15s+), create a punchier shorter version by dropping segments. If shorter (<15s), create an extended version by adding segments from the video pool. Minimum 2 segments.

CRITICAL RULES:
- videoId MUST be an exact UUID from the video pool above (the value inside videoId="...")
- startSeconds and endSeconds must be within each video's actual duration
- Each segment must be at least 2 seconds long
${textRule}
- Give each variant a short, descriptive label (e.g., "High-energy open", "Quick cuts", "Emotional reframe", "Peak-first order", "30s extended cut")

Respond with JSON in this exact format:
${responseFormat}

Return exactly 5 variants in the order: hook, pacing, tone, structure, format.
Only return the JSON object, nothing else.`;

    const geminiResponse = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8000,
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

    const result = JSON.parse(text);

    // Build a duration lookup for validation
    const durationMap = new Map<string, number>();
    for (const v of analyzedVideos) {
      if (v.duration_seconds != null) {
        durationMap.set(v.id, v.duration_seconds);
      }
    }

    // UUID validation regex
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Validate and clamp timestamps for each variant
    for (const variant of result.variants) {
      for (const seg of variant.segments) {
        // Validate video ID is a UUID
        if (!uuidRegex.test(seg.videoId)) {
          // Try to find closest matching video
          const match = analyzedVideos.find((v) =>
            v.id.startsWith(seg.videoId) || v.filename === seg.videoId
          );
          if (match) {
            seg.videoId = match.id;
          }
        }

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
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
