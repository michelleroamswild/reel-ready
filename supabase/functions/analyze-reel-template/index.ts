const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_GENERATE_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_UPLOAD_URL = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TEMPLATE_PROMPT = `You are analyzing a short-form social media video (TikTok/Instagram Reel) to extract its structure as a reusable template.

IMPORTANT — IGNORE ALL PLATFORM UI:
This is likely a screen recording or download from TikTok/Instagram/YouTube. You MUST completely ignore all platform elements:
- EXCLUDE: "TikTok", "@username", any @mentions, hashtags (#), like/comment/share/bookmark buttons, follower counts, profile pictures, platform logos, "Original Sound" labels, caption text pinned to the bottom of the screen, and any other platform chrome.
- For textOverlay fields, ONLY include text that the creator intentionally placed as part of their video content (styled text overlays, titles, storytelling captions that are part of the creative edit).
- Platform captions, watermarks, and usernames are NOT text overlays — do not include them.

Analyze the video carefully and identify:
1. Every distinct visual segment/cut (when the background scene or clip changes)
2. Any CREATOR text overlays and when they appear (NOT platform UI)
3. The mood, energy, and visual style of each segment
4. The overall pacing and structure

Respond in this exact JSON format:
{
  "totalDurationSeconds": <number>,
  "segmentCount": <number>,
  "segments": [
    {
      "index": 0,
      "startSeconds": <number>,
      "endSeconds": <number>,
      "durationSeconds": <number>,
      "textOverlay": "<creator text visible in this segment, or null if none>",
      "mood": "<mood of this specific segment>",
      "energy": "<low|medium|high>",
      "visualDescription": "<what is shown: camera angle, subject, movement>"
    }
  ],
  "overallMood": "<overall mood of the reel>",
  "overallEnergy": "<overall energy level>",
  "overallPacing": "<slow|medium|fast|variable>",
  "visualStyleNotes": "<general observations about visual style, transitions, color grading>",
  "textOverlayStyle": "<how text is presented: font style, position, animation, or null if no text>"
}

Guidelines:
- Be precise about cut points (to 0.1s accuracy)
- Every frame of the video should belong to exactly one segment
- A "cut" is when the visual content/clip changes (not just text changing)
- If text appears or changes within the same visual scene, note the text but keep it as one segment
- ONLY include creator text overlays — NEVER include TikTok watermarks, @usernames, hashtags, or platform captions
- For energy: "low" = calm/slow, "medium" = moderate pace, "high" = fast/intense

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
    body: JSON.stringify({
      file: { displayName: "reel-template-source" },
    }),
  });

  const uploadUrl = startRes.headers.get("X-Goog-Upload-URL");
  if (!uploadUrl) {
    throw new Error("Gemini File API did not return an upload URL");
  }

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

  let state = uploadData.file.state;
  const fileUrl = fileUri + `?key=${GEMINI_API_KEY}`;
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

/** Remove platform watermark / UI text from template results. */
function stripPlatformText(obj: Record<string, unknown>) {
  const STRIP_PATTERNS = [
    /@[\w.]+/g,                      // @username
    /#[\w]+/g,                       // #hashtag
    /\bTikTok\b/gi,
    /\bInstagram\b/gi,
    /\bYouTube\s*Shorts?\b/gi,
    /\bOriginal\s*Sound\b/gi,
    /\bFYP\b/gi,
    /\bFor\s*You\b/gi,
  ];

  function clean(str: string): string {
    let out = str;
    for (const p of STRIP_PATTERNS) {
      out = out.replace(p, "");
    }
    return out.replace(/\s{2,}/g, " ").replace(/^\s*[,\-–—]\s*/, "").trim();
  }

  function walk(val: unknown): unknown {
    if (typeof val === "string") {
      const cleaned = clean(val);
      return cleaned.length === 0 ? null : cleaned;
    }
    if (Array.isArray(val)) return val.map(walk).filter((v) => v !== null && v !== "");
    if (val && typeof val === "object") {
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        (val as Record<string, unknown>)[k] = walk(v);
      }
    }
    return val;
  }

  walk(obj);
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

    // Download video
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      throw new Error(`Failed to download video: ${videoRes.status}`);
    }

    const videoBytes = new Uint8Array(await videoRes.arrayBuffer());

    // Build the video part for Gemini
    let videoPart: Record<string, unknown>;

    if (videoBytes.byteLength <= INLINE_MAX_BYTES) {
      const base64 = uint8ArrayToBase64(videoBytes);
      videoPart = { inlineData: { mimeType: mime, data: base64 } };
    } else {
      const fileUri = await uploadToGeminiFileApi(videoBytes, mime);
      videoPart = { fileData: { mimeType: mime, fileUri } };
    }

    // No time cap — analyze full video for all cuts
    const geminiRes = await fetch(GEMINI_GENERATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [videoPart, { text: TEMPLATE_PROMPT }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4000,
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

    const template = JSON.parse(text);

    // Strip platform watermark/UI text from results
    stripPlatformText(template);

    return new Response(JSON.stringify({ template }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("analyze-reel-template error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
