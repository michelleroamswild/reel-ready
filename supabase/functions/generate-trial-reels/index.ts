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

interface TrendingAudioInput {
  title: string;
  artist: string | null;
  genre: string | null;
  mood: string | null;
  usage_count: number | null;
}

interface ReferencePatterns {
  hookStyle: string;
  avgDuration: number;
  pacingNotes: string;
  textStyle: string;
  commonMoods: string[];
  structureNotes: string;
  audioNotes: string;
  summary: string;
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
    await getAuthUser(req);
    const { baseReel, videos, generateText, trendingAudio, referencePatterns, singleVariantType } = (await req.json()) as {
      baseReel: BaseReel;
      videos: VideoInput[];
      generateText?: boolean;
      trendingAudio?: TrendingAudioInput[];
      referencePatterns?: ReferencePatterns;
      singleVariantType?: "text" | "visual" | "audio";
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

    const textGenBlock = needsText
      ? `\n\nTEXT GENERATION: No text overlay has been provided yet. You must FIRST craft a compelling, short text overlay phrase (2-8 words, punchy, social-media style) based on the video content and mood. This is the "base text." Use it as the sectionText for visual and audio variants. For text variants, each one gets its own rewritten text. Also return the base text in a top-level "baseText" field.`
      : "";

    const baseTextLine = needsText ? "" : `Phrase text: "${baseReel.phraseText}"`;

    // Build trending audio section if provided
    let trendingAudioBlock = "";
    if (trendingAudio && trendingAudio.length > 0) {
      const trackLines = trendingAudio
        .map((t, i) => {
          let line = `${i + 1}. "${t.title}"`;
          if (t.artist) line += ` by ${t.artist}`;
          if (t.genre) line += ` (${t.genre})`;
          if (t.mood) line += ` — mood: ${t.mood}`;
          if (t.usage_count) line += ` — ${t.usage_count.toLocaleString()} uses`;
          return line;
        })
        .join("\n");
      trendingAudioBlock = `\n\nTRENDING AUDIO (current trending tracks on TikTok):\n${trackLines}\n\nFor audio variants: Reference a specific trending track from the list above when possible. Include the track title and artist in audioSuggestion.`;
    }

    // Build reference patterns section if provided
    let referencePatternsBlock = "";
    if (referencePatterns) {
      referencePatternsBlock = `\n\nREFERENCE REEL PATTERNS (extracted from trending reels the user analyzed):
Hook style: ${referencePatterns.hookStyle}
Pacing: ${referencePatterns.pacingNotes}
Text style: ${referencePatterns.textStyle}
Structure: ${referencePatterns.structureNotes}
Audio: ${referencePatterns.audioNotes}
Common moods: ${referencePatterns.commonMoods.join(", ")}

Use these patterns to guide your variants. Text variants should mirror the text style. Visual variants should follow the pacing and structure patterns. Audio variants should reference the audio patterns.`;
    }

    // Build variant instructions based on whether we're regenerating a single variant or generating all
    let variantInstructions: string;
    let countInstructions: string;

    if (singleVariantType === "text") {
      variantInstructions = `**"text" variant** — Change ONLY the text overlay. Keep the EXACT same videos, timestamps, segment order, and durations. Rewrite the sectionText on every segment to take a different angle. Pick ONE fresh approach from:
  - **Bold claim**: A confident, declarative statement
  - **Question**: Hook with a question that creates curiosity
  - **Emotional**: Tap into feelings — nostalgia, longing, pride, joy
  - **Curiosity / watch this**: Tease or challenge the viewer to keep watching
  - **Relatable / POV**: Frame it as a shared experience`;
      countInstructions = "Generate EXACTLY 1 text variant with a fresh, different angle from the base text.";
    } else if (singleVariantType === "visual") {
      variantInstructions = `**"visual" variant** — Change ONLY the visuals. Keep the SAME text on every segment (use base text${needsText ? " you generated" : ""}). Change which videos are used, their timestamps, segment order, or pacing (cut lengths). Pick different clips from the pool, try a different opening shot, reorder for impact, or change segment durations.`;
      countInstructions = "Generate EXACTLY 1 visual variant.";
    } else if (singleVariantType === "audio") {
      variantInstructions = `**"audio" variant** — Keep the SAME text AND the SAME visuals/timestamps as the base reel. This variant flags that the user should try different background audio. Include an "audioSuggestion" field describing what audio style/track to try (e.g., "Trending lo-fi beat", "Upbeat pop instrumental", "Cinematic bass drop for the hook").`;
      countInstructions = "Generate EXACTLY 1 audio variant with a fresh audio suggestion different from any previous suggestion.";
    } else {
      variantInstructions = `VARIANT TYPES — each variant changes EXACTLY ONE variable:

**"text" variants** — Change ONLY the text overlay. Keep the EXACT same videos, timestamps, segment order, and durations. Rewrite the sectionText on every segment to take a different angle. You MUST generate at least 3 text variants from these approaches (pick the ones that fit the content best):
  - **Bold claim**: A confident, declarative statement ("This changes everything", "The secret nobody talks about")
  - **Question**: Hook with a question that creates curiosity ("What if you could...?", "Ever wonder why...?")
  - **Emotional**: Tap into feelings — nostalgia, longing, pride, joy ("The moment it all clicked", "This feeling never gets old")
  - **Curiosity / watch this**: Tease or challenge the viewer to keep watching ("Wait for it", "Watch what happens next", "You won't believe this")
  - **Relatable / POV**: Frame it as a shared experience ("POV: you finally...", "That moment when...")

**"visual" variant** — Change ONLY the visuals. Keep the SAME text on every segment (use base text${needsText ? " you generated" : ""}). Change which videos are used, their timestamps, segment order, or pacing (cut lengths). Pick different clips from the pool, try a different opening shot, reorder for impact, or change segment durations. Maximum 1 visual variant.

**"audio" variant** — Keep the SAME text AND the SAME visuals/timestamps as the base reel. This variant flags that the user should try different background audio. Include an "audioSuggestion" field describing what audio style/track to try (e.g., "Trending lo-fi beat", "Upbeat pop instrumental", "Cinematic bass drop for the hook"). Maximum 1 audio variant.`;
      countInstructions = "DECIDE HOW MANY: Generate 3-5 variants total. You MUST include at least 3 text variants. Add a visual variant if the video pool has good alternative clips. Add an audio variant if the content would benefit from a different sound. Use your judgment — only include variants that would meaningfully test something different.";
    }

    const prompt = `You are a creative director helping A/B test short-form social media reels. Given a base reel and a pool of videos, generate variant reels that each isolate ONE variable. The goal is to learn what drives engagement.${textGenBlock}${trendingAudioBlock}${referencePatternsBlock}

BASE REEL:
Title: "${baseReel.title}"
${baseTextLine}
Target duration: ${baseReel.targetDuration}s
Segments:
${baseSegmentDescriptions}

AVAILABLE VIDEO POOL (${analyzedVideos.length} videos):
${videoDescriptions}

${variantInstructions}

${countInstructions}

CRITICAL RULES:
- variantType MUST be exactly "${singleVariantType || "text\", \"visual\", or \"audio"}"
- videoId MUST be an exact UUID from the video pool above (the value inside videoId="...")
- startSeconds and endSeconds must be within each video's actual duration
- Each segment must be at least 2 seconds long
- For "text" variants: SAME videos/timestamps/order as base, DIFFERENT sectionText
- For "visual" variant: SAME sectionText as base${needsText ? " (use your generated base text)" : ""}, DIFFERENT videos/timestamps/order
- For "audio" variant: SAME everything as base, just add audioSuggestion
- Give each variant a short, descriptive label (e.g., "Bold claim", "Question hook", "Emotional pull", "New opening shot", "Lo-fi chill beat")

Respond with JSON in this exact format:
{${needsText ? '\n  "baseText": "<the generated base text overlay phrase>",' : ""}
  "variants": [
    {
      "variantType": "${singleVariantType || "text\" | \"visual\" | \"audio"}",
      "variantLabel": "<short descriptive label>",
      "targetDuration": <number>,
      "audioSuggestion": "<only for audio variants, omit otherwise>",
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
}

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
