const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;

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
  "sceneTags": ["<tag1>", "<tag2>", "<tag3>", ...],
  "summary": "<1-2 sentence description of what the video shows and its overall vibe>"
}

For sceneTags, include 3-8 short descriptive tags like: nature, urban, close-up, aerial, golden-hour, action, people, landscape, etc.

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
    const sizeMB = videoBytes.byteLength / (1024 * 1024);

    if (sizeMB > 20) {
      throw new Error("Video too large for analysis (>20MB)");
    }

    // Send as inline base64 — single API call, no File API needed
    const base64 = uint8ArrayToBase64(videoBytes);

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inlineData: { mimeType: mime, data: base64 } },
                { text: ANALYSIS_PROMPT },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 400,
            responseMimeType: "application/json",
          },
        }),
      }
    );

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
