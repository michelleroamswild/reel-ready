import { selectTrendsForClip, type Trend } from "../_shared/trends.ts";
import { getAuthUser } from "../_shared/auth.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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
  textOverlays?: string[];
  segments?: {
    startSeconds: number;
    endSeconds: number;
    description: string;
    textOnScreen: string;
  }[];
}

// ── Style Directives ──────────────────────────────────────

const STYLE_DIRECTIVES: Record<string, { persona: string; categoryBias?: string[] }> = {
  auto: { persona: "" },
  witty: {
    persona: "Write with self-aware humor and clever wordplay. Think dry wit, ironic observations, and playful understatement. Avoid anything that sounds like a motivational poster.",
    categoryBias: ["understated", "hook"],
  },
  poetic: {
    persona: "Write with lyrical, evocative language. Use metaphor, sensory imagery, and rhythm. Channel lowercase poetry accounts — brief but resonant.",
    categoryBias: ["cinematic", "soft_life"],
  },
  bold: {
    persona: "Write with unapologetic confidence. Direct, punchy, main-character energy. No hedging, no softening.",
    categoryBias: ["bold", "sign"],
  },
  minimal: {
    persona: "Write with extreme economy. 1-4 words only. Let the visual do the talking. Think one-word reactions, short fragments, or a single evocative noun.",
    categoryBias: ["cinematic", "understated"],
  },
  storytelling: {
    persona: "Write as narrative hooks that imply a story. Before/after energy, 'nobody tells you...' format, moments of realization. Make the viewer want to know more.",
    categoryBias: ["hook", "pov"],
  },
  edgy: {
    persona: "Write raw and unfiltered. Slightly provocative, unapologetically honest. The opposite of 'safe' content. Think confessional posts and hot takes.",
    categoryBias: ["bold", "hook"],
  },
};

// ── Creative Angle Seeds ──────────────────────────────────

const ANGLE_SEEDS = [
  "Focus on what's NOT shown — the feeling behind the visual.",
  "Write as if texting your best friend about this moment.",
  "Channel main character monologue energy.",
  "Think of the caption someone would screenshot and share.",
  "Write the thought that crosses your mind 2 seconds after this moment ends.",
  "Imagine this is the opening line of a short film.",
  "Write what the scenery would say if it could talk.",
  "Channel the energy of a late-night voice note.",
  "Think of the text you'd overlay right before the beat drops.",
  "Write the thing everyone thinks but nobody posts.",
  "Focus on texture, sensation, or a single detail.",
  "Write from the perspective of someone watching this for the first time.",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await getAuthUser(req);
    const { analysis, filename, length, style, previousSuggestions } = await req.json();

    const wordLength = length || "short";
    const selectedStyle = style || "auto";

    if (!analysis) {
      return new Response(
        JSON.stringify({ error: "Video analysis is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const a = analysis as VideoAnalysis;
    const styleDirective = STYLE_DIRECTIVES[selectedStyle] || STYLE_DIRECTIVES.auto;

    // Select relevant trends using soft-weight scoring (with category bias from style)
    const matchedTrends = selectTrendsForClip({
      moodScore: a.moodScore ?? 0,
      energyScore: a.energyScore ?? 5,
      sceneTags: a.sceneTags,
      mood: a.mood,
    }, 10, styleDirective.categoryBias);

    // Format trends as reference examples for the prompt
    const trendExamples = matchedTrends
      .map(
        (t: Trend) =>
          `[${t.category}] "${t.template_text}" — ${t.usage_notes}`
      )
      .join("\n");

    const trendCategories = [
      ...new Set(matchedTrends.map((t: Trend) => t.category)),
    ].join(", ");

    // ── Video context ──
    let videoContext = `Video: ${filename || "untitled"}
Summary: ${a.summary}
Mood: ${a.mood}
Energy: ${a.energy}
Visuals: ${a.visuals}
Scene Tags: ${a.sceneTags.join(", ")}`;

    if (a.moodScore != null)
      videoContext += `\nMood Score: ${a.moodScore} (-5 dark to +5 uplifting)`;
    if (a.energyScore != null)
      videoContext += `\nEnergy Score: ${a.energyScore}/10`;
    if (a.pacing) videoContext += `\nPacing: ${a.pacing}`;
    if (a.colorPalette?.length)
      videoContext += `\nColors: ${a.colorPalette.join(", ")}`;
    if (a.shotTypes?.length)
      videoContext += `\nShot Types: ${a.shotTypes.join(", ")}`;
    if (a.dominantMotion) videoContext += `\nMotion: ${a.dominantMotion}`;
    if (a.structure) videoContext += `\nStructure: ${a.structure}`;
    if (a.audioNotes) videoContext += `\nAudio: ${a.audioNotes}`;

    // ── Visual details from segments ──
    let visualDetails = "";
    if (a.segments?.length) {
      const segDescriptions = a.segments
        .map((seg) => seg.description)
        .filter(Boolean);
      if (segDescriptions.length > 0) {
        visualDetails += `\nSPECIFIC SCENES: ${segDescriptions.join(" | ")}`;
      }
      const onScreenTexts = a.segments
        .map((seg) => seg.textOnScreen)
        .filter(Boolean);
      if (onScreenTexts.length > 0) {
        visualDetails += `\nEXISTING TEXT ON SCREEN: ${onScreenTexts.join(" | ")}`;
      }
    }
    if (a.textOverlays?.length) {
      visualDetails += `\nCREATOR TEXT OVERLAYS: ${a.textOverlays.join(" | ")}`;
    }

    // ── Length guide ──
    const lengthGuide: Record<string, string> = {
      short:
        "Keep it punchy. MAX 8 WORDS per suggestion total. Fragment style, not full sentences.",
      medium: "Each suggestion is a short phrase, MAX 8 WORDS total across all lines.",
      long: "Short sentences allowed. MAX 8 WORDS per suggestion total.",
    };

    // ── Derive tone ──
    const ms = a.moodScore ?? 0;
    const es = a.energyScore ?? 5;
    let derivedTone = "chill";
    if (ms <= -3) derivedTone = "dark/emotional";
    else if (ms <= -1) derivedTone = "moody/introspective";
    else if (ms >= 3 && es >= 7) derivedTone = "hype/energetic";
    else if (ms >= 3) derivedTone = "uplifting/warm";
    else if (es >= 7) derivedTone = "bold/intense";
    else if (es <= 3) derivedTone = "calm/peaceful";

    // ── Random creative angle ──
    const angleSeed = ANGLE_SEEDS[Math.floor(Math.random() * ANGLE_SEEDS.length)];

    // ── Style persona ──
    const styleBlock = styleDirective.persona
      ? `\nSTYLE DIRECTION: ${styleDirective.persona}`
      : "";

    // ── Previous suggestions exclusion ──
    let avoidBlock = "";
    if (previousSuggestions?.length > 0) {
      const listed = (previousSuggestions as string[])
        .map((s: string, i: number) => `${i + 1}. "${s}"`)
        .join("\n");
      avoidBlock = `\nAVOID REPEATING: The user has already seen these suggestions. Generate COMPLETELY DIFFERENT text — different phrasing, different angle, different emotional register:\n${listed}\n`;
    }

    // ── Grounding instruction ──
    const groundingBlock = visualDetails
      ? `\nGROUNDING: At least 3 of the 10 suggestions should reference something SPECIFIC to this video — a visual detail, a scene description, a color, an action visible in the footage. The other suggestions can be more universal/abstract. When referencing specifics, weave them in naturally (e.g. "the way the light hits the water" not "video contains water and light").${visualDetails}\n`
      : "";

    const prompt = `You write text overlays for Instagram Reels and TikTok. Be direct, modern, lowercase. No cringe, no generic motivational fluff. Write like a real person posting, not a brand.${styleBlock}

${videoContext}

TONE (derived from video): ${derivedTone}. The video mood is "${a.mood}" with ${a.energy} energy. All suggestions must feel authentic to this vibe.

CREATIVE ANGLE: ${angleSeed}

WORD LIMIT: ${lengthGuide[wordLength] || lengthGuide.short}
CRITICAL: Every suggestion MUST be 8 words or fewer. Count carefully. Shorter is better.

TREND REFERENCE — These are trending caption templates that match this clip (scored by AI for fit). Use them as INSPIRATION (riff on them, fill placeholders, remix the format) but don't copy them verbatim:

${trendExamples}

Best-fit categories for this clip: ${trendCategories}
${groundingBlock}${avoidBlock}
STRUCTURE RULES:
- Most suggestions should be a SINGLE LINE. Only use 2 lines when there's a natural dramatic pause between two distinct phrases (e.g. "not for everyone\\nand that's the point"). NEVER split a single thought mid-sentence across lines.
- NEVER more than 2 lines. Most should be 1 line.
- Total word count must be 8 words or fewer.
- Line breaks (\\n) are pauses — only use them between COMPLETE phrases, never in the middle of a sentence.
- Fill any {placeholder} from templates with something specific to this video.
- BAD line break: "romanticizing my river reading\\nmoment" — this splits one phrase awkwardly.
- GOOD line break: "no thoughts\\njust the river" — two distinct phrases.

Generate 10 suggestions. At least half should be inspired by the trend templates above. The rest can be original but in the same categories (${trendCategories}).

For "confidence", rate how well each suggestion matches the video's vibe:
- 0.9-1.0 = perfect match
- 0.7-0.8 = good match
- 0.5-0.6 = decent match

Respond with a JSON array:
[
  {
    "text": "<1-2 lines, MAX 8 words total. Most should be 1 line.>",
    "category": "<category name from: ${trendCategories}>",
    "confidence": <0.5-1.0>,
    "grounded": <true if this references something specific to this video, false if universal>
  }
]

Only return the JSON array.`;

    const geminiResponse = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 3000,
          responseMimeType: "application/json",
        },
      }),
    });

    const data = await geminiResponse.json();
    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;

    if (!text) {
      return new Response(
        JSON.stringify({ error: "Gemini returned no result", suggestions: [] }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // A MAX_TOKENS stop truncates the JSON array mid-object, which would
    // otherwise surface as an opaque "Expected double-quoted property name".
    if (candidate.finishReason && candidate.finishReason !== "STOP") {
      return new Response(
        JSON.stringify({
          error: `Gemini stopped early (${candidate.finishReason}) — response was incomplete.`,
          suggestions: [],
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const suggestions = JSON.parse(text);

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message, suggestions: [] }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
