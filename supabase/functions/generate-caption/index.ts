import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthUser } from "../_shared/auth.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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
    const { userId } = await getAuthUser(req);
    const { mood, tone, tense, iterateOn, segments, matchVoice } = (await req.json()) as {
      mood: string;
      tone?: string;
      tense?: string;
      iterateOn?: string;
      segments: SegmentInput[];
      matchVoice?: boolean;
    };

    if (!mood || !segments?.length) {
      return new Response(
        JSON.stringify({ error: "mood and segments are required" }),
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

    // Optionally load the creator's distilled voice profile so captions sound like them.
    let voiceBlock = "";
    if (matchVoice) {
      try {
        const admin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        const { data: prof } = await admin
          .from("account_profiles")
          .select("voice_profile")
          .eq("user_id", userId)
          .eq("platform", "instagram")
          .maybeSingle();
        const vp = prof?.voice_profile as
          | { text?: string; signatureHashtags?: string[] }
          | null;
        if (vp?.text) {
          voiceBlock = `\n\nVOICE PROFILE — This is how THIS creator actually writes their captions. Match this voice exactly; it OVERRIDES every generic guideline below where they conflict, including capitalization, punctuation, emoji, and hashtag style. Follow the capitalization/casing described here precisely — do not impose all-lowercase or any casing the profile doesn't describe.\n${vp.text}`;
          if (vp.signatureHashtags?.length) {
            voiceBlock += `\nWhen relevant, reuse the hashtags this creator commonly uses: ${vp.signatureHashtags
              .map((h) => `#${h}`)
              .join(" ")}. Match their typical hashtag count and style.`;
          }
        }
      } catch {
        // Non-fatal: fall back to generic voice if the profile can't be loaded.
      }
    }

    const prompt = `You write social media captions for Instagram Reels and TikTok posts. Write captions that feel authentic and engaging — like a real creator posting, not a brand.

REEL CONTENT:
${segmentContext}${voiceBlock}

MOOD: ${mood}${tone ? `\nTONE: ${tone}` : ""}${tense && tense !== "any" ? `\nTENSE: ${tense}. ${tense === "past" ? 'Write in past tense — the content already happened. For example prefer "loved every second of this" over "loving every second of this".' : tense === "reflective" ? 'Write in a reflective, looking-back tone — reminiscing or appreciating something that happened. For example "still thinking about this" or "one of those moments you never forget".' : 'Write in a timeless, tense-neutral way — no specific time reference. Avoid present progressive ("loving this") and explicit past tense. For example "nothing beats this" or "the kind of moment you hold onto".'}` : ""}

${iterateOn ? `The user liked this caption and wants 3 variations of it:\n"${iterateOn}"\n\nWrite 3 new captions that are similar in style, structure, and vibe but not identical. Rephrase, remix, or riff on the original.` : "Write 3 captions for this reel. Make the three DISTINCTLY DIFFERENT from one another — vary the length, structure, and angle (e.g. one short and punchy, one with a personal or story beat, one that opens with a question or a bold hook). They must NOT read like three rewrites of the same sentence."} Each caption should:
- Match the "${mood}" mood${tone ? ` and "${tone}" tone` : ""}
- Be informed by the video content and text overlays described above
- Be 1-3 sentences, concise and engaging
- Include 4-5 relevant hashtags that would perform well on Instagram/TikTok
- Feel natural and authentic to how real creators write captions

Capitalization: write in normal sentence case by default (capitalize the first letter of sentences and proper nouns). Do NOT make captions all-lowercase unless the voice profile explicitly says this creator writes in lowercase.

${tone ? `Guidelines by tone:
- casual: conversational and relaxed, like talking to a friend
- witty: clever wordplay, unexpected twist, slightly humorous
- inspirational: uplifting but not generic, grounded in the specific content
- storytelling: brief narrative arc, draws the viewer in, personal
- minimal: very short (1 sentence max), lets the video speak

` : ""}Guidelines by mood:
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
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      }),
    });

    const data = await geminiResponse.json();
    // Gemini may split output across multiple parts — join them so the JSON
    // isn't truncated mid-string.
    const parts = (data?.candidates?.[0]?.content?.parts ?? []) as Array<{ text?: string }>;
    const text = parts.map((p) => p.text ?? "").join("");

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
