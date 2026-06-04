import { createClient } from "npm:@supabase/supabase-js";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_GENERATE_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_UPLOAD_URL = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INLINE_MAX_BYTES = 20 * 1024 * 1024;

const ANALYSIS_PROMPT = `Analyze this video clip for use in short-form social media content (TikTok/Reels/Shorts).

IMPORTANT: This may be a screen recording of a TikTok, Reel, or Short. You MUST completely ignore ALL platform UI:
- EXCLUDE: "TikTok", "@username", any @mentions, hashtags (#), like/comment/share/bookmark buttons, follower counts, profile pictures, platform logos, "Original Sound" labels, caption text pinned to the bottom of the screen, and any other platform chrome.
- NONE of these should appear anywhere in your response — not in summary, textOverlays, segments, or any other field.
- ONLY include text that the creator intentionally placed as part of their video content (styled text overlays, titles, storytelling captions that are part of the creative edit — NOT the platform caption).

Respond in this exact JSON format:
{
  "mood": "<the overall mood/tone, e.g. calm, energetic, dramatic, playful, melancholic>",
  "energy": "<the energy level and pacing, e.g. slow and steady, fast-paced, building intensity>",
  "visuals": "<describe the key visual elements, colors, composition, camera work>",
  "sceneTags": ["<tag1>", "<tag2>", ...],
  "summary": "<1-2 sentence description of what the video shows and its overall vibe>",
  "textOverlays": ["<text1>", "<text2>", ...],
  "moodScore": <number from -5 (dark/somber) to +5 (bright/uplifting)>,
  "energyScore": <number from 1 (very calm/still) to 10 (extremely high energy)>,
  "pacing": "<one of: slow, medium, fast, variable>",
  "colorPalette": ["<color1>", "<color2>", "<color3>"],
  "shotTypes": ["<type1>", "<type2>", ...],
  "dominantMotion": "<e.g. static, slow pan, fast action, handheld shake, smooth tracking>",
  "structure": "<e.g. steady, builds intensity, peaks then calms, dramatic shift>",
  "audioNotes": "<e.g. no audio, ambient sounds, music, speech, sound effects>",
  "segments": [
    {
      "startSeconds": <number>,
      "endSeconds": <number>,
      "description": "<what happens in this segment>",
      "textOnScreen": "<creator text visible during this segment, or empty string>"
    }
  ]
}

Field guidelines:
- sceneTags: 3-8 short descriptive tags (nature, urban, close-up, aerial, golden-hour, etc.)
- textOverlays: list of all distinct creator text overlays seen in the video, in order of appearance. Empty array if none.
- moodScore: -5 = very dark/somber/tense, 0 = neutral, +5 = very bright/uplifting/joyful
- energyScore: 1 = very still/calm, 5 = moderate, 10 = extremely fast/intense
- pacing: how quickly scenes/shots change — slow, medium, fast, or variable if it shifts
- colorPalette: 2-5 dominant color descriptions (e.g. "warm orange", "cool blue", "muted earth tones")
- shotTypes: camera angles/movements used (close-up, wide, tracking, aerial, POV, handheld, etc.)
- dominantMotion: the primary motion characteristic of the video
- structure: how the energy/mood evolves over the duration of the clip
- audioNotes: describe any audio present — if no audio track, say "no audio"
- segments: break the video into its natural segments/scenes (by cuts, text changes, or mood shifts). Include timestamps and any creator text visible during each segment.

Only return the JSON, nothing else.`;

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function uploadToGeminiFileApi(
  videoBytes: Uint8Array,
  mimeType: string
): Promise<string> {
  const startRes = await fetch(GEMINI_UPLOAD_URL, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": videoBytes.byteLength.toString(),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { displayName: "video-for-analysis" } }),
  });

  const uploadUrl = startRes.headers.get("X-Goog-Upload-URL");
  if (!uploadUrl) throw new Error("Gemini File API did not return an upload URL");

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Length": videoBytes.byteLength.toString(),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: videoBytes,
  });

  const uploadData = await uploadRes.json();
  const fileUri = uploadData?.file?.uri;
  if (!fileUri) throw new Error(`Gemini File API upload failed: ${JSON.stringify(uploadData)}`);

  let state = uploadData.file.state;
  const fileUrl = fileUri + `?key=${GEMINI_API_KEY}`;
  for (let i = 0; i < 30 && state === "PROCESSING"; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const checkRes = await fetch(fileUrl);
    const checkData = await checkRes.json();
    state = checkData.state;
  }

  if (state !== "ACTIVE") throw new Error(`Gemini file not ready, state: ${state}`);
  return fileUri;
}

function stripPlatformText(analysis: Record<string, unknown>) {
  function clean(str: string): string {
    let out = str;
    out = out.replace(/@[\w.]+/g, "");
    out = out.replace(/#[\w]+/g, "");
    out = out.replace(/\bTikTok\b/gi, "");
    out = out.replace(/\bInstagram\b/gi, "");
    out = out.replace(/\bYouTube\s*Shorts?\b/gi, "");
    out = out.replace(/\bOriginal\s*Sound\b/gi, "");
    out = out.replace(/\bFYP\b/gi, "");
    out = out.replace(/\bFor\s*You\b/gi, "");
    out = out.replace(/\s{2,}/g, " ").trim();
    return out;
  }

  function walk(val: unknown): unknown {
    if (typeof val === "string") return clean(val);
    if (Array.isArray(val)) return val.map(walk).filter((v) => !(typeof v === "string" && v.length === 0));
    if (val !== null && typeof val === "object") {
      const obj = val as Record<string, unknown>;
      for (const k of Object.keys(obj)) obj[k] = walk(obj[k]);
    }
    return val;
  }

  walk(analysis);
}

async function analyzeOne(videoUrl: string, mimeType: string): Promise<Record<string, unknown>> {
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error(`Failed to download video: ${videoRes.status}`);

  const videoBytes = new Uint8Array(await videoRes.arrayBuffer());

  let videoPart: Record<string, unknown>;
  if (videoBytes.byteLength <= INLINE_MAX_BYTES) {
    const base64 = uint8ArrayToBase64(videoBytes);
    videoPart = { inlineData: { mimeType, data: base64 } };
  } else {
    const fileUri = await uploadToGeminiFileApi(videoBytes, mimeType);
    videoPart = { fileData: { mimeType, fileUri } };
  }

  const geminiRes = await fetch(GEMINI_GENERATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [videoPart, { text: ANALYSIS_PROMPT }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2000, responseMimeType: "application/json" },
    }),
  });

  const geminiData = await geminiRes.json();
  if (!geminiRes.ok) throw new Error(`Gemini error: ${JSON.stringify(geminiData)}`);

  const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`No result from Gemini: ${JSON.stringify(geminiData)}`);

  const analysis = JSON.parse(text);
  try { stripPlatformText(analysis); } catch {}
  return analysis;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { batchSize = 3 } = await req.json().catch(() => ({}));

    // Find videos without analysis
    const { data: videos, error } = await supabase
      .from("videos")
      .select("id, url, mime_type")
      .is("analysis", null)
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (error) throw error;
    if (!videos || videos.length === 0) {
      return new Response(
        JSON.stringify({ done: true, analyzed: 0, remaining: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Count total remaining
    const { count } = await supabase
      .from("videos")
      .select("id", { count: "exact", head: true })
      .is("analysis", null);

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const video of videos) {
      try {
        const analysis = await analyzeOne(video.url, video.mime_type || "video/mp4");
        await supabase.from("videos").update({ analysis }).eq("id", video.id);
        results.push({ id: video.id, success: true });
      } catch (err) {
        results.push({ id: video.id, success: false, error: err.message });
      }
    }

    const analyzed = results.filter((r) => r.success).length;
    const remaining = (count ?? 0) - analyzed;

    return new Response(
      JSON.stringify({ done: remaining <= 0, analyzed, remaining, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("batch-analyze error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
