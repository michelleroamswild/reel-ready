const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_GENERATE_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_UPLOAD_URL = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ANALYSIS_PROMPT = `Analyze this video clip for use in short-form social media content (TikTok/Reels/Shorts).

Respond in this exact JSON format:
{
  "mood": "<the overall mood/tone, e.g. calm, energetic, dramatic, playful, melancholic>",
  "energy": "<the energy level and pacing, e.g. slow and steady, fast-paced, building intensity>",
  "visuals": "<describe the key visual elements, colors, composition, camera work>",
  "sceneTags": ["<tag1>", "<tag2>", ...],
  "summary": "<1-2 sentence description of what the video shows and its overall vibe>",
  "moodScore": <number from -5 (dark/somber) to +5 (bright/uplifting)>,
  "energyScore": <number from 1 (very calm/still) to 10 (extremely high energy)>,
  "pacing": "<one of: slow, medium, fast, variable>",
  "colorPalette": ["<color1>", "<color2>", "<color3>"],
  "shotTypes": ["<type1>", "<type2>", ...],
  "dominantMotion": "<e.g. static, slow pan, fast action, handheld shake, smooth tracking>",
  "structure": "<e.g. steady, builds intensity, peaks then calms, dramatic shift>",
  "audioNotes": "<e.g. no audio, ambient sounds, music, speech, sound effects>"
}

Field guidelines:
- sceneTags: 3-8 short descriptive tags (nature, urban, close-up, aerial, golden-hour, etc.)
- moodScore: -5 = very dark/somber/tense, 0 = neutral, +5 = very bright/uplifting/joyful
- energyScore: 1 = very still/calm, 5 = moderate, 10 = extremely fast/intense
- pacing: how quickly scenes/shots change — slow, medium, fast, or variable if it shifts
- colorPalette: 2-5 dominant color descriptions (e.g. "warm orange", "cool blue", "muted earth tones")
- shotTypes: camera angles/movements used (close-up, wide, tracking, aerial, POV, handheld, etc.)
- dominantMotion: the primary motion characteristic of the video
- structure: how the energy/mood evolves over the duration of the clip
- audioNotes: describe any audio present — if no audio track, say "no audio"

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

const INLINE_MAX_BYTES = 20 * 1024 * 1024; // 20 MB

/** Upload a video to Gemini File API and return the file URI. */
async function uploadToGeminiFileApi(
  videoBytes: Uint8Array,
  mimeType: string
): Promise<string> {
  // Start resumable upload
  const startRes = await fetch(GEMINI_UPLOAD_URL, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": videoBytes.byteLength.toString(),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file: { displayName: "video-for-analysis" },
    }),
  });

  const uploadUrl = startRes.headers.get("X-Goog-Upload-URL");
  if (!uploadUrl) {
    throw new Error("Gemini File API did not return an upload URL");
  }

  // Upload the bytes
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
  if (!fileUri) {
    throw new Error(
      `Gemini File API upload failed: ${JSON.stringify(uploadData)}`
    );
  }

  // Wait for file to be ACTIVE (processing can take a moment)
  let state = uploadData.file.state;
  let fileUrl = fileUri + `?key=${GEMINI_API_KEY}`;
  for (let i = 0; i < 30 && state === "PROCESSING"; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const checkRes = await fetch(fileUrl);
    const checkData = await checkRes.json();
    state = checkData.state;
  }

  if (state !== "ACTIVE") {
    throw new Error(`Gemini file not ready, state: ${state}`);
  }

  return fileUri;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { videoUrl, mimeType } = await req.json();

    if (!videoUrl) {
      return new Response(
        JSON.stringify({ error: "videoUrl is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const mime = mimeType || "video/mp4";

    // Download video from R2
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      throw new Error(`Failed to download video: ${videoRes.status}`);
    }

    const videoBytes = new Uint8Array(await videoRes.arrayBuffer());

    // Build the video part for Gemini — inline for small files, File API for large
    let videoPart: Record<string, unknown>;

    if (videoBytes.byteLength <= INLINE_MAX_BYTES) {
      const base64 = uint8ArrayToBase64(videoBytes);
      videoPart = { inlineData: { mimeType: mime, data: base64 } };
    } else {
      const fileUri = await uploadToGeminiFileApi(videoBytes, mime);
      videoPart = { fileData: { mimeType: mime, fileUri } };
    }

    // Cap analysis at first 30 seconds to reduce token usage
    // (~258 tokens/frame at 1fps, so 30s ≈ 7,740 tokens vs uncapped)
    const MAX_ANALYZE_SECONDS = 30;
    const videoMetadataPart = {
      videoMetadata: {
        startOffset: { seconds: 0 },
        endOffset: { seconds: MAX_ANALYZE_SECONDS },
      },
    };

    const geminiRes = await fetch(GEMINI_GENERATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [videoPart, videoMetadataPart, { text: ANALYSIS_PROMPT }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 800,
          responseMimeType: "application/json",
        },
      }),
    });

    const geminiData = await geminiRes.json();

    if (!geminiRes.ok) {
      throw new Error(`Gemini error: ${JSON.stringify(geminiData)}`);
    }

    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error(`No result from Gemini: ${JSON.stringify(geminiData)}`);
    }

    const analysis = JSON.parse(text);

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("analyze-video error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
