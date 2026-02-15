const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SegmentInput {
  section_text: string;
  analysis: {
    mood?: string;
    energy?: string;
    summary?: string;
    sceneTags?: string[];
    visuals?: string;
  } | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { mood, tone, tense, iterateOn, segments } = (await req.json()) as {
      mood: string;
      tone: string;
      tense?: string;
      iterateOn?: string;
      segments: SegmentInput[];
    };

    if (!mood || !tone || !segments?.length) {
      return new Response(
        JSON.stringify({ error: "mood, tone, and segments are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build context from segments
    const segmentContext = segments
      .map((seg, i) => {
        let ctx = `Segment ${i + 1}: Text overlay: "${seg.section_text || "(none)"}"`;
        if (seg.analysis) {
          const a = seg.analysis;
          if (a.summary) ctx += `\n  Summary: ${a.summary}`;
          if (a.mood) ctx += `\n  Mood: ${a.mood}`;
          if (a.energy) ctx += `\n  Energy: ${a.energy}`;
          if (a.visuals) ctx += `\n  Visuals: ${a.visuals}`;
          if (a.sceneTags?.length) ctx += `\n  Tags: ${a.sceneTags.join(", ")}`;
        }
        return ctx;
      })
      .join("\n\n");

    const prompt = `You write social media captions for Instagram Reels and TikTok posts. Write captions that feel authentic and engaging — like a real creator posting, not a brand.

REEL CONTENT:
${segmentContext}

MOOD: ${mood}
TONE: ${tone}${tense && tense !== "any" ? `\nTENSE: ${tense}. ${tense === "past" ? 'Write in past tense — the content already happened. For example prefer "loved every second of this" over "loving every second of this".' : tense === "reflective" ? 'Write in a reflective, looking-back tone — reminiscing or appreciating something that happened. For example "still thinking about this" or "one of those moments you never forget".' : 'Write in a timeless, tense-neutral way — no specific time reference. Avoid present progressive ("loving this") and explicit past tense. For example "nothing beats this" or "the kind of moment you hold onto".'}` : ""}

${iterateOn ? `The user liked this caption and wants 3 variations of it:\n"${iterateOn}"\n\nWrite 3 new captions that are similar in style, structure, and vibe but not identical. Rephrase, remix, or riff on the original.` : "Write 3 captions for this reel."} Each caption should:
- Match the "${mood}" mood and "${tone}" tone
- Be informed by the video content and text overlays described above
- Be 1-3 sentences, concise and engaging
- Include 4-5 relevant hashtags that would perform well on Instagram/TikTok
- Feel natural and authentic to how real creators write captions

Guidelines by tone:
- casual: lowercase, conversational, might use "lol" or "tbh"
- witty: clever wordplay, unexpected twist, slightly humorous
- inspirational: uplifting but not generic, grounded in the specific content
- storytelling: brief narrative arc, draws the viewer in, personal
- minimal: very short (1 sentence max), lets the video speak

Guidelines by mood:
- confident: assertive, self-assured, bold statements
- chill: relaxed, easygoing, no pressure
- emotional: heartfelt, vulnerable, genuine feeling
- playful: fun, lighthearted, maybe a bit cheeky
- edgy: raw, unfiltered, provocative but not offensive

Return valid JSON in this exact format:
{
  "captions": [
    { "text": "caption text here", "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"] },
    { "text": "caption text here", "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"] },
    { "text": "caption text here", "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"] }
  ]
}

Do NOT include # symbols in the hashtag strings — just the words (e.g. "sunset" not "#sunset").`;

    const geminiResponse = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 2000,
          responseMimeType: "application/json",
        },
      }),
    });

    const data = await geminiResponse.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return new Response(
        JSON.stringify({ error: "Gemini returned no result", captions: [] }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = JSON.parse(text);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message, captions: [] }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
