const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

const DEEP_MATCH_PROMPT = `You are performing a deep analysis to determine how well this phrase pairs with this specific video clip for short-form social media content (TikTok/Reels/Shorts).

Watch the video carefully, then evaluate the match.

Phrase: "{PHRASE_TEXT}"
{TAGS_LINE}
{PHRASE_ANALYSIS_SECTION}

{VIDEO_ANALYSIS_SECTION}

Now that you've watched the actual video alongside reading the phrase, provide a refined match evaluation. Consider things that text analysis alone might miss:
- Does the visual rhythm actually work with the phrase?
- Are there specific moments in the video that perfectly match parts of the phrase?
- Does the overall feeling of watching the video while reading the phrase create the right impact?
- Are there any visual elements that clash with or contradict the phrase?

Respond in this exact JSON format:
{
  "videoId": "{VIDEO_ID}",
  "score": <refined score 0-100, based on actually watching the video with the phrase>,
  "reasoning": "<2-3 sentences with detailed reasoning based on watching the actual video>",
  "moodMatch": "<how the moods align, with specific visual references>",
  "energyMatch": "<how the energy levels align based on actual video pacing>",
  "visualNotes": "<specific visual elements that complement or clash with the phrase>",
  "timestampSuggestions": ["<e.g. 0:00-0:05 best for opening line>", "<e.g. 0:08-0:12 peak moment>"]
}

Be honest and specific. Reference actual visual elements you see. Only return the JSON, nothing else.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      phraseText,
      phraseTags,
      phraseAnalysis,
      videoId,
      videoUrl,
      videoFilename,
      videoAnalysis,
      mimeType,
    } = await req.json();

    if (!phraseText || !videoUrl || !videoId) {
      return new Response(
        JSON.stringify({ error: "phraseText, videoUrl, and videoId are required" }),
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
      throw new Error("Video too large for deep analysis (>20MB)");
    }

    const base64 = uint8ArrayToBase64(videoBytes);

    // Build prompt
    let tagsLine = "";
    if (phraseTags?.length > 0) {
      tagsLine = `Phrase tags: ${phraseTags.join(", ")}`;
    }

    let phraseAnalysisSection = "";
    if (phraseAnalysis) {
      phraseAnalysisSection = `Phrase Pre-Analysis:
  Tone: ${phraseAnalysis.tone} (Score: ${phraseAnalysis.toneScore})
  Energy Level: ${phraseAnalysis.energyLevel}/10
  Ideal Pacing: ${phraseAnalysis.idealPacing}
  Emotional Arc: ${phraseAnalysis.emotionalArc}
  Suggested Visuals: ${phraseAnalysis.suggestedVisuals?.join(", ") || "none"}
  Keywords: ${phraseAnalysis.keywords?.join(", ") || "none"}`;
    }

    let videoAnalysisSection = "";
    if (videoAnalysis) {
      videoAnalysisSection = `Previous Video Analysis (file: ${videoFilename}):
  Mood: ${videoAnalysis.mood} (Score: ${videoAnalysis.moodScore ?? "N/A"})
  Energy: ${videoAnalysis.energy} (Score: ${videoAnalysis.energyScore ?? "N/A"}/10)
  Pacing: ${videoAnalysis.pacing ?? "N/A"}
  Visuals: ${videoAnalysis.visuals}
  Structure: ${videoAnalysis.structure ?? "N/A"}
  Tags: ${videoAnalysis.sceneTags?.join(", ") || "none"}`;
    }

    const prompt = DEEP_MATCH_PROMPT
      .replace("{PHRASE_TEXT}", phraseText)
      .replace("{TAGS_LINE}", tagsLine)
      .replace("{PHRASE_ANALYSIS_SECTION}", phraseAnalysisSection)
      .replace("{VIDEO_ANALYSIS_SECTION}", videoAnalysisSection)
      .replace("{VIDEO_ID}", videoId);

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
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 800,
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

    const result = JSON.parse(text);
    // Ensure videoId is set correctly
    result.videoId = videoId;

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("deep-match error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
