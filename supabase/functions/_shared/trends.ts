// ── Schema ──────────────────────────────────────────────

export interface AvoidIf {
  energyMin?: number;   // avoid if clip energy >= this
  energyMax?: number;   // avoid if clip energy <= this
  moodMin?: number;     // avoid if clip mood >= this
  moodMax?: number;     // avoid if clip mood <= this
  tagsAny?: string[];   // avoid if clip has ANY of these tags
  tagsNone?: string[];  // avoid if clip has NONE of these tags
}

export interface Trend {
  id: string;
  category: string;
  template_text: string;           // use {placeholder} for fillable parts
  tone_tags: string[];
  usage_notes: string;
  avoid_if?: AvoidIf;
  weight?: number;                 // default 1, higher = more likely to be selected
}

// ── Trend Library ───────────────────────────────────────

export const trends: Trend[] = [
  // ─── POV ───
  {
    id: "pov-01",
    category: "pov",
    template_text: "pov: you finally {action}",
    tone_tags: ["reflective", "calm", "relieved"],
    usage_notes: "Low-medium energy clips with a sense of arrival or peace. Nature, travel, quiet moments.",
    avoid_if: { energyMin: 8 },
  },
  {
    id: "pov-02",
    category: "pov",
    template_text: "pov: nobody knows\nyou {action}",
    tone_tags: ["mysterious", "confident", "introspective"],
    usage_notes: "Moody or cinematic clips. Works with solo shots, silhouettes, driving at night.",
    weight: 1.2,
  },
  {
    id: "pov-03",
    category: "pov",
    template_text: "pov: you chose yourself\nand everything changed",
    tone_tags: ["empowering", "reflective", "warm"],
    usage_notes: "Uplifting clips with personal energy. Golden hour, solo travel, new beginnings.",
    avoid_if: { moodMax: -2 },
  },
  {
    id: "pov-04",
    category: "pov",
    template_text: "pov: this is the life\nyou used to dream about",
    tone_tags: ["grateful", "warm", "calm"],
    usage_notes: "Beautiful scenery, lifestyle moments, anything aspirational.",
    avoid_if: { moodMax: -1 },
  },

  // ─── BOLD / MAIN CHARACTER ───
  {
    id: "bold-01",
    category: "bold",
    template_text: "not for everyone\nand that's the point",
    tone_tags: ["confident", "edgy", "unapologetic"],
    usage_notes: "High confidence clips. Fashion, bold visuals, strong movement. Energy 5+.",
    avoid_if: { energyMax: 3 },
    weight: 1.1,
  },
  {
    id: "bold-02",
    category: "bold",
    template_text: "main character energy\n{moment}",
    tone_tags: ["confident", "playful", "high_energy"],
    usage_notes: "Dynamic clips with personality. Walking shots, getting ready, action moments.",
    avoid_if: { energyMax: 4 },
  },
  {
    id: "bold-03",
    category: "bold",
    template_text: "they'll understand\nwhen they see the results",
    tone_tags: ["confident", "motivated", "focused"],
    usage_notes: "Hustle/grind clips, working out, creating, focused activity. Energy 6+.",
    avoid_if: { energyMax: 4 },
  },
  {
    id: "bold-04",
    category: "bold",
    template_text: "built different\nraised different",
    tone_tags: ["confident", "edgy", "high_energy"],
    usage_notes: "High energy, bold movement, strong presence. Sports, fashion, urban.",
    avoid_if: { energyMax: 5, moodMax: -2 },
    weight: 0.9,
  },

  // ─── CINEMATIC / LOWERCASE ───
  {
    id: "cine-01",
    category: "cinematic",
    template_text: "somewhere between\nletting go and holding on",
    tone_tags: ["reflective", "melancholic", "poetic"],
    usage_notes: "Slow, moody clips. Rain, fog, twilight, solitary walks. Energy 1-4.",
    avoid_if: { energyMin: 7 },
    weight: 1.2,
  },
  {
    id: "cine-02",
    category: "cinematic",
    template_text: "the quiet version of brave",
    tone_tags: ["calm", "introspective", "gentle"],
    usage_notes: "Soft, understated clips. Close-ups, slow motion, still nature.",
    avoid_if: { energyMin: 7 },
  },
  {
    id: "cine-03",
    category: "cinematic",
    template_text: "no caption needed\njust this",
    tone_tags: ["minimal", "confident", "aesthetic"],
    usage_notes: "Visually strong clips that speak for themselves. Wide landscape, golden hour.",
    weight: 1.1,
  },
  {
    id: "cine-04",
    category: "cinematic",
    template_text: "some things feel better\nthan they look",
    tone_tags: ["reflective", "warm", "sensory"],
    usage_notes: "Texture-rich clips — water, wind, food, fabric. Slow pacing.",
    avoid_if: { energyMin: 7, tagsNone: ["nature", "water", "food", "texture", "close-up"] },
  },
  {
    id: "cine-05",
    category: "cinematic",
    template_text: "this moment\nright here",
    tone_tags: ["present", "calm", "minimal"],
    usage_notes: "Any beautiful or still moment. Low-medium energy.",
    avoid_if: { energyMin: 8 },
  },

  // ─── SOFT LIFE ───
  {
    id: "soft-01",
    category: "soft_life",
    template_text: "romanticizing my {moment}",
    tone_tags: ["warm", "gentle", "aesthetic"],
    usage_notes: "Cozy, lifestyle clips. Coffee, morning routines, soft lighting. Energy 1-4.",
    avoid_if: { energyMin: 7, moodMax: -3 },
    weight: 1.1,
  },
  {
    id: "soft-02",
    category: "soft_life",
    template_text: "healing looks different\nfor everyone",
    tone_tags: ["gentle", "reflective", "reassuring"],
    usage_notes: "Calm, nature, self-care, solo moments. Mood score 0-3.",
    avoid_if: { energyMin: 8 },
  },
  {
    id: "soft-03",
    category: "soft_life",
    template_text: "peace was always the goal",
    tone_tags: ["calm", "content", "minimal"],
    usage_notes: "Still, peaceful clips. Water, sky, minimalist scenes.",
    avoid_if: { energyMin: 7, moodMax: -3 },
  },
  {
    id: "soft-04",
    category: "soft_life",
    template_text: "the simple things\nhit different now",
    tone_tags: ["grateful", "warm", "reflective"],
    usage_notes: "Everyday beauty moments. Food, walks, sunlight through windows.",
    avoid_if: { moodMax: -3 },
  },

  // ─── UNDERSTATED / IRONY ───
  {
    id: "und-01",
    category: "understated",
    template_text: "it's giving {vibe}",
    tone_tags: ["ironic", "playful", "casual"],
    usage_notes: "Versatile — works with any clip that has a strong vibe. Medium energy.",
    weight: 1.2,
  },
  {
    id: "und-02",
    category: "understated",
    template_text: "no thoughts\njust {moment}",
    tone_tags: ["casual", "playful", "unbothered"],
    usage_notes: "Carefree moments. Beach, driving, lounging, anything effortless.",
    avoid_if: { moodMax: -3 },
  },
  {
    id: "und-03",
    category: "understated",
    template_text: "me pretending\nI'm in a movie again",
    tone_tags: ["ironic", "playful", "self_aware"],
    usage_notes: "Cinematic-looking clips that are a bit dramatic. Walking, staring, slow-mo.",
    weight: 1.1,
  },
  {
    id: "und-04",
    category: "understated",
    template_text: "casually {action}\nlike it's normal",
    tone_tags: ["ironic", "humble_brag", "playful"],
    usage_notes: "Impressive or beautiful clips played off casually. Travel, stunts, views.",
  },

  // ─── HOOK / STORYTELLING ───
  {
    id: "hook-01",
    category: "hook",
    template_text: "nobody talks about\nhow {observation}",
    tone_tags: ["honest", "reflective", "relatable"],
    usage_notes: "Clips that capture something real or underappreciated. Any energy.",
    weight: 1.2,
  },
  {
    id: "hook-02",
    category: "hook",
    template_text: "the moment I stopped {action}\neverything changed",
    tone_tags: ["reflective", "transformative", "honest"],
    usage_notes: "Before/after energy. Transition clips, nature shifts, contrast moments.",
  },
  {
    id: "hook-03",
    category: "hook",
    template_text: "I wasn't supposed to\nbe here",
    tone_tags: ["awe", "grateful", "dramatic"],
    usage_notes: "Awe-inspiring locations, unexpected beauty, achievement moments.",
    avoid_if: { tagsNone: ["travel", "landscape", "nature", "aerial", "adventure", "mountain", "ocean"] },
  },

  // ─── SIGN / CTA ───
  {
    id: "sign-01",
    category: "sign",
    template_text: "this is your sign\nto {action}",
    tone_tags: ["encouraging", "warm", "direct"],
    usage_notes: "Aspirational clips. Travel, nature, lifestyle. Mood score 1+.",
    avoid_if: { moodMax: -2 },
  },
  {
    id: "sign-02",
    category: "sign",
    template_text: "go do the thing\nyou keep putting off",
    tone_tags: ["encouraging", "direct", "motivating"],
    usage_notes: "Action-oriented clips. Movement, energy, outdoors. Energy 4+.",
    avoid_if: { energyMax: 2 },
  },
  {
    id: "sign-03",
    category: "sign",
    template_text: "you don't need permission",
    tone_tags: ["empowering", "bold", "direct"],
    usage_notes: "Solo clips with confidence. Travel, creating, bold moves.",
    avoid_if: { moodMax: -3 },
    weight: 1.1,
  },
];

// ── Clip Profile ────────────────────────────────────────

export interface ClipProfile {
  moodScore: number;   // -5 to +5
  energyScore: number; // 1-10
  sceneTags: string[];
  mood: string;
}

// ── Scoring Helpers ─────────────────────────────────────

/** Map of tone tags to mood/energy affinity ranges for soft scoring. */
const TONE_AFFINITY: Record<string, { moodRange: [number, number]; energyRange: [number, number] }> = {
  // Calm/peaceful tones
  calm:          { moodRange: [-1, 4],  energyRange: [1, 5] },
  reflective:    { moodRange: [-3, 3],  energyRange: [1, 6] },
  gentle:        { moodRange: [0, 5],   energyRange: [1, 4] },
  minimal:       { moodRange: [-2, 3],  energyRange: [1, 5] },
  present:       { moodRange: [-1, 4],  energyRange: [1, 6] },
  content:       { moodRange: [1, 5],   energyRange: [1, 5] },
  // Warm/uplifting tones
  warm:          { moodRange: [0, 5],   energyRange: [2, 7] },
  grateful:      { moodRange: [1, 5],   energyRange: [2, 7] },
  empowering:    { moodRange: [0, 5],   energyRange: [4, 9] },
  encouraging:   { moodRange: [0, 5],   energyRange: [3, 8] },
  reassuring:    { moodRange: [-1, 4],  energyRange: [1, 5] },
  relieved:      { moodRange: [0, 4],   energyRange: [1, 5] },
  // Dark/moody tones
  melancholic:   { moodRange: [-5, 0],  energyRange: [1, 4] },
  mysterious:    { moodRange: [-4, 1],  energyRange: [1, 6] },
  introspective: { moodRange: [-3, 2],  energyRange: [1, 5] },
  poetic:        { moodRange: [-3, 3],  energyRange: [1, 5] },
  // High energy tones
  confident:     { moodRange: [-1, 5],  energyRange: [4, 10] },
  bold:          { moodRange: [-1, 5],  energyRange: [5, 10] },
  high_energy:   { moodRange: [0, 5],   energyRange: [6, 10] },
  motivated:     { moodRange: [0, 5],   energyRange: [5, 10] },
  focused:       { moodRange: [-1, 4],  energyRange: [4, 9] },
  direct:        { moodRange: [-1, 5],  energyRange: [3, 9] },
  motivating:    { moodRange: [0, 5],   energyRange: [4, 10] },
  // Playful/ironic tones
  playful:       { moodRange: [-1, 5],  energyRange: [3, 8] },
  ironic:        { moodRange: [-2, 4],  energyRange: [3, 8] },
  casual:        { moodRange: [-1, 4],  energyRange: [2, 7] },
  self_aware:    { moodRange: [-2, 4],  energyRange: [3, 8] },
  humble_brag:   { moodRange: [0, 5],   energyRange: [3, 8] },
  unbothered:    { moodRange: [-1, 4],  energyRange: [2, 7] },
  unapologetic:  { moodRange: [-1, 5],  energyRange: [4, 10] },
  // Special
  edgy:          { moodRange: [-3, 3],  energyRange: [5, 10] },
  aesthetic:     { moodRange: [-1, 5],  energyRange: [1, 7] },
  sensory:       { moodRange: [-1, 4],  energyRange: [1, 5] },
  honest:        { moodRange: [-3, 4],  energyRange: [2, 7] },
  transformative:{ moodRange: [-2, 4],  energyRange: [3, 8] },
  awe:           { moodRange: [0, 5],   energyRange: [3, 9] },
  dramatic:      { moodRange: [-3, 5],  energyRange: [4, 10] },
};

/** Scene-tag to category affinity. */
const TAG_CATEGORY_BOOST: Record<string, string[]> = {
  nature:    ["cinematic", "soft_life", "pov", "sign"],
  travel:    ["pov", "sign", "hook", "understated"],
  landscape: ["cinematic", "pov", "sign"],
  aerial:    ["cinematic", "pov", "hook"],
  forest:    ["cinematic", "soft_life", "pov"],
  ocean:     ["cinematic", "soft_life", "pov"],
  mountain:  ["cinematic", "pov", "sign", "hook"],
  urban:     ["bold", "understated", "hook"],
  city:      ["bold", "understated", "hook"],
  fashion:   ["bold", "understated"],
  lifestyle: ["soft_life", "understated", "pov"],
  street:    ["bold", "understated"],
  nightlife: ["bold", "understated"],
  food:      ["soft_life", "understated", "cinematic"],
  adventure: ["bold", "sign", "hook", "pov"],
  "road trip": ["pov", "cinematic", "sign"],
  water:     ["cinematic", "soft_life"],
  sunset:    ["cinematic", "soft_life", "pov"],
  "golden hour": ["cinematic", "soft_life", "pov"],
  rain:      ["cinematic", "hook"],
  fog:       ["cinematic"],
  sport:     ["bold", "hook"],
  fitness:   ["bold", "sign"],
  "slow-mo":   ["cinematic", "understated"],
  "close-up":  ["cinematic", "soft_life"],
  texture:   ["cinematic", "soft_life"],
};

/** How well a trend's tone_tags match the clip's mood + energy (0-1). */
function scoreToneMatch(trend: Trend, clip: ClipProfile): number {
  const { moodScore, energyScore } = clip;
  let totalFit = 0;

  for (const tag of trend.tone_tags) {
    const aff = TONE_AFFINITY[tag];
    if (!aff) {
      totalFit += 0.3; // unknown tone gets a small base score
      continue;
    }

    // How well does mood fit this tone's ideal range? (0-1)
    const moodFit = rangeOverlap(moodScore, aff.moodRange[0], aff.moodRange[1]);
    // How well does energy fit this tone's ideal range? (0-1)
    const energyFit = rangeOverlap(energyScore, aff.energyRange[0], aff.energyRange[1]);

    totalFit += (moodFit * 0.5 + energyFit * 0.5);
  }

  return trend.tone_tags.length > 0 ? totalFit / trend.tone_tags.length : 0.3;
}

/** Returns 1.0 if value is inside [min, max], fading to 0.0 two units outside. */
function rangeOverlap(value: number, min: number, max: number): number {
  if (value >= min && value <= max) return 1.0;
  const dist = value < min ? min - value : value - max;
  return Math.max(0, 1 - dist / 3); // fade over 3 units of distance
}

/** Boost score for scene-tag overlap with category (0-1 range). */
function scoreTagAffinity(trend: Trend, clip: ClipProfile): number {
  const tags = clip.sceneTags.map((t) => t.toLowerCase());
  let boostCount = 0;

  for (const tag of tags) {
    const cats = TAG_CATEGORY_BOOST[tag];
    if (cats && cats.includes(trend.category)) {
      boostCount++;
    }
  }

  // Diminishing returns: first match = 0.4, second = 0.25, third = 0.15
  if (boostCount === 0) return 0;
  return Math.min(1, 0.4 + (boostCount - 1) * 0.15);
}

/** Check if a trend should be avoided for this clip. Returns true if it should be filtered out. */
function shouldAvoid(trend: Trend, clip: ClipProfile): boolean {
  const av = trend.avoid_if;
  if (!av) return false;

  const tags = clip.sceneTags.map((t) => t.toLowerCase());

  // Check energy bounds
  if (av.energyMin != null && clip.energyScore >= av.energyMin) return true;
  if (av.energyMax != null && clip.energyScore <= av.energyMax) return true;

  // Check mood bounds
  if (av.moodMin != null && clip.moodScore >= av.moodMin) return true;
  if (av.moodMax != null && clip.moodScore <= av.moodMax) return true;

  // Check tag exclusions
  if (av.tagsAny && av.tagsAny.some((t) => tags.includes(t.toLowerCase()))) return true;
  if (av.tagsNone && av.tagsNone.every((t) => !tags.includes(t.toLowerCase()))) return true;

  return false;
}

// ── Selection ───────────────────────────────────────────

interface ScoredTrend {
  trend: Trend;
  score: number;
}

/**
 * Select the best-fit trends for a clip using soft-weight scoring.
 * Returns up to `k` trends with category diversity (3-4 categories represented).
 */
export function selectTrendsForClip(clip: ClipProfile, k = 10): Trend[] {
  // Score all non-avoided trends
  const scored: ScoredTrend[] = [];

  for (const trend of trends) {
    if (shouldAvoid(trend, clip)) continue;

    const toneScore = scoreToneMatch(trend, clip);    // 0-1
    const tagScore = scoreTagAffinity(trend, clip);    // 0-1
    const weight = trend.weight ?? 1;

    // Composite: 60% tone fit, 30% tag affinity, 10% base weight
    const composite = (toneScore * 0.6 + tagScore * 0.3 + (weight - 0.5) * 0.2);

    scored.push({ trend, score: composite });
  }

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // Diversity-aware selection: pick top trends ensuring 3-4 categories
  return diverseSelect(scored, k);
}

/** Select top-k trends with category diversity. */
function diverseSelect(scored: ScoredTrend[], k: number): Trend[] {
  const selected: Trend[] = [];
  const categoryCounts: Record<string, number> = {};
  const allCategories = [...new Set(scored.map((s) => s.trend.category))];
  const minCategories = Math.min(allCategories.length, 3);

  // Phase 1: Ensure diversity — pick the top trend from each category
  const usedIds = new Set<string>();

  for (const cat of allCategories) {
    if (selected.length >= k) break;
    const best = scored.find((s) => s.trend.category === cat && !usedIds.has(s.trend.id));
    if (best) {
      selected.push(best.trend);
      usedIds.add(best.trend.id);
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
  }

  // Phase 2: Fill remaining slots from the sorted list, capping per-category at ceil(k / minCategories)
  const maxPerCategory = Math.ceil(k / minCategories);

  for (const { trend } of scored) {
    if (selected.length >= k) break;
    if (usedIds.has(trend.id)) continue;
    const catCount = categoryCounts[trend.category] || 0;
    if (catCount >= maxPerCategory) continue;

    selected.push(trend);
    usedIds.add(trend.id);
    categoryCounts[trend.category] = catCount + 1;
  }

  return selected;
}

// ── Legacy Exports (backwards compat) ───────────────────

/** @deprecated Use selectTrendsForClip instead */
export function selectTrends(clip: ClipProfile): Trend[] {
  return selectTrendsForClip(clip, 10);
}

/** @deprecated Use selectTrendsForClip instead */
export function selectCategories(clip: ClipProfile): string[] {
  const selected = selectTrendsForClip(clip, 10);
  return [...new Set(selected.map((t) => t.category))];
}
