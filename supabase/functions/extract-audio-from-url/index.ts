import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthUser } from "../_shared/auth.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_GENERATE_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_UPLOAD_URL = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const INLINE_MAX_BYTES = 20 * 1024 * 1024; // 20 MB

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
    body: JSON.stringify({
      file: { displayName: "audio-extract-source" },
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

const AUDIO_PROMPT = `You are analyzing a short-form social media video (TikTok or Instagram Reel) to identify the background audio or music track.

Listen carefully to the audio in this video and identify:
1. The song title (if it's a known song)
2. The artist/creator
3. The genre of the music
4. The mood the audio conveys (one or two words)
5. The energy level: "low", "medium", or "high"
6. Approximate duration of the audio clip in seconds
7. Whether this appears to be an original sound, a remix, or a known commercial track

If you cannot identify the exact song, provide your best description of the audio style as the title (e.g., "Upbeat Lo-Fi Beat", "Dramatic Piano Instrumental").

Return valid JSON in this exact format:
{
  "title": "song title or descriptive name",
  "artist": "artist name or Unknown",
  "genre": "genre",
  "mood": "mood descriptor",
  "energy": "low|medium|high",
  "duration_seconds": null,
  "is_original_sound": false,
  "confidence": "high|medium|low"
}

Only return the JSON, nothing else.`;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Resolve a social media page URL to actual video bytes.
 * If the URL returns HTML, attempts to extract the video from og:video meta tags.
 */
async function resolveVideoBytes(
  url: string
): Promise<{ bytes: Uint8Array; mime: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": BROWSER_UA },
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(
      `Failed to download video (${res.status}). The post may be private or the URL may be invalid.`
    );
  }

  const ct = res.headers.get("content-type") || "";

  if (ct.startsWith("video/")) {
    return {
      bytes: new Uint8Array(await res.arrayBuffer()),
      mime: ct.split(";")[0].trim(),
    };
  }

  if (ct.startsWith("text/html") || ct.startsWith("application/xhtml")) {
    const html = await res.text();

    const ogMatch =
      html.match(
        /<meta[^>]+property=["']og:video(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i
      ) ??
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video(?::secure_url)?["']/i
      );

    const twitterMatch =
      !ogMatch &&
      (html.match(
        /<meta[^>]+name=["']twitter:player:stream["'][^>]+content=["']([^"']+)["']/i
      ) ??
        html.match(
          /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:player:stream["']/i
        ));

    let jsonVideoUrl: string | null = null;
    if (!ogMatch && !twitterMatch) {
      const scriptMatch = html.match(
        /<script[^>]+id=["']__UNIVERSAL_DATA_FOR_RERENDER__["'][^>]*>([\s\S]*?)<\/script>/i
      );
      if (scriptMatch) {
        try {
          const jsonData = JSON.parse(scriptMatch[1]);
          const detail =
            jsonData?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo
              ?.itemStruct?.video;
          jsonVideoUrl =
            detail?.downloadAddr || detail?.playAddr || detail?.bitrateInfo?.[0]?.PlayAddr?.UrlList?.[0] || null;
        } catch {
          // skip
        }
      }
    }

    const videoUrl =
      ogMatch?.[1] || (twitterMatch && twitterMatch[1]) || jsonVideoUrl;

    if (videoUrl) {
      const videoRes = await fetch(videoUrl, {
        headers: { "User-Agent": BROWSER_UA, Referer: url },
        redirect: "follow",
      });

      if (!videoRes.ok) {
        throw new Error(
          `Found video URL but failed to download it (${videoRes.status}). The post may be private.`
        );
      }

      const vct = videoRes.headers.get("content-type") || "";
      if (vct.startsWith("text/html")) {
        throw new Error(
          "Could not download the video. The post may be private or require login."
        );
      }

      return {
        bytes: new Uint8Array(await videoRes.arrayBuffer()),
        mime: vct.startsWith("video/") ? vct.split(";")[0].trim() : "video/mp4",
      };
    }

    throw new Error(
      "Could not find a video in this URL. The post may be private, or try pasting a direct video file URL."
    );
  }

  return {
    bytes: new Uint8Array(await res.arrayBuffer()),
    mime: ct.split(";")[0].trim() || "video/mp4",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { userId } = await getAuthUser(req);
    const { videoUrl } = await req.json();

    if (!videoUrl || typeof videoUrl !== "string") {
      return new Response(
        JSON.stringify({ error: "videoUrl is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { bytes: videoBytes, mime: mimeType } =
      await resolveVideoBytes(videoUrl);

    // Build video part for Gemini
    let videoPart: Record<string, unknown>;

    if (videoBytes.byteLength <= INLINE_MAX_BYTES) {
      const base64 = uint8ArrayToBase64(videoBytes);
      videoPart = { inlineData: { mimeType, data: base64 } };
    } else {
      const fileUri = await uploadToGeminiFileApi(videoBytes, mimeType);
      videoPart = { fileData: { mimeType, fileUri } };
    }

    // Send to Gemini for audio identification
    const geminiRes = await fetch(GEMINI_GENERATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [videoPart, { text: AUDIO_PROMPT }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1000,
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

    const result = JSON.parse(text);

    // Detect platform from URL
    let platform = "unknown";
    if (videoUrl.includes("tiktok.com")) platform = "tiktok";
    else if (videoUrl.includes("instagram.com")) platform = "instagram";

    // Insert into trending_audio
    const { error: insertError } = await supabase
      .from("trending_audio")
      .insert({
        title: result.title || "Unknown Track",
        artist: result.artist && result.artist !== "Unknown" ? result.artist : null,
        platform,
        genre: result.genre || null,
        mood: result.mood || null,
        energy: result.energy || null,
        duration_seconds: result.duration_seconds || null,
        external_url: videoUrl,
        source: "url_extract",
        user_id: userId,
      });

    if (insertError) {
      console.error("Insert error:", insertError.message);
    }

    return new Response(
      JSON.stringify({
        track: {
          title: result.title || "Unknown Track",
          artist: result.artist || "Unknown",
          genre: result.genre || null,
          mood: result.mood || null,
          confidence: result.confidence || "medium",
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("extract-audio-from-url error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
