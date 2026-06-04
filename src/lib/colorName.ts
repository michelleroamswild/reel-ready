// Resolve a human color *description* (e.g. "warm orange", "muted earth tones")
// into a CSS hex color for display swatches. The analysis stores colors as
// descriptive strings, not hex, so we approximate a representative color here.

type HSL = [number, number, number];

// Base color terms → HSL. Longer/multi-word keys are matched first.
const BASE: Record<string, HSL> = {
  // earthy / neutral phrases
  "earth tone": [28, 35, 45], earthy: [28, 35, 45], terracotta: [14, 55, 52],
  // named-ish colors
  burgundy: [345, 60, 28], maroon: [0, 60, 28], crimson: [348, 75, 47],
  scarlet: [8, 80, 50], red: [0, 72, 50], rust: [16, 65, 42], brick: [10, 55, 42],
  coral: [12, 80, 65], salmon: [10, 70, 70], peach: [26, 85, 78], apricot: [28, 80, 68],
  orange: [28, 85, 55], amber: [38, 85, 52], gold: [44, 75, 52], golden: [44, 75, 52],
  mustard: [46, 65, 48], yellow: [50, 90, 60], cream: [48, 60, 90], ivory: [50, 40, 94],
  beige: [40, 35, 80], tan: [34, 40, 65], sand: [42, 40, 75], khaki: [50, 35, 55],
  taupe: [30, 12, 55], brown: [25, 50, 35], chocolate: [22, 50, 28], bronze: [30, 50, 40],
  copper: [20, 60, 45], ochre: [38, 60, 45],
  olive: [70, 45, 38], lime: [85, 70, 55], chartreuse: [80, 75, 55],
  sage: [110, 22, 58], mint: [150, 45, 75], green: [130, 55, 42], forest: [140, 50, 28],
  emerald: [150, 65, 40], teal: [180, 55, 40], turquoise: [175, 65, 55], aqua: [185, 65, 60],
  cyan: [185, 70, 55], sky: [205, 70, 70], azure: [205, 80, 60],
  blue: [215, 65, 50], navy: [220, 60, 28], indigo: [240, 50, 40], royal: [225, 70, 45],
  cobalt: [220, 75, 45], periwinkle: [230, 55, 72], lavender: [255, 45, 78],
  violet: [270, 55, 55], purple: [275, 50, 50], plum: [300, 40, 38], lilac: [285, 45, 78],
  mauve: [310, 25, 62], magenta: [320, 70, 55], fuchsia: [320, 80, 60],
  pink: [335, 75, 72], rose: [345, 60, 62], blush: [350, 60, 82], salmonpink: [355, 70, 75],
  charcoal: [220, 8, 26], slate: [210, 15, 45], gray: [0, 0, 60], grey: [0, 0, 60],
  silver: [0, 0, 78], white: [0, 0, 96], black: [0, 0, 12],
};

// Modifier keywords adjust the base HSL.
function applyModifiers(hsl: HSL, text: string): HSL {
  let [h, s, l] = hsl;
  if (/\b(dark|deep|rich)\b/.test(text)) l -= 16;
  if (/\b(light|pale|pastel)\b/.test(text)) { l += 14; s -= 8; }
  if (/\b(soft|gentle)\b/.test(text)) { l += 8; s -= 12; }
  if (/\b(muted|dusty|dull|faded|washed|desaturat)\w*/.test(text)) s -= 26;
  if (/\b(bright|vivid|vibrant|bold|electric|saturated|neon)\b/.test(text)) { s += 22; l += 2; }
  if (/\bwarm\b/.test(text)) h -= 6;
  if (/\bcool\b/.test(text)) h += 6;
  return [(h + 360) % 360, clamp(s, 0, 100), clamp(l, 4, 96)];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function hslToHex([h, s, l]: HSL): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const c = l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Resolve a color description to a hex string for a swatch.
 * Passes through valid hex/rgb values untouched; otherwise maps known
 * color words (with warm/deep/muted/etc. modifiers) to a representative hex.
 * Returns a neutral gray when nothing is recognized.
 */
export function resolveColorHex(input: string): string {
  if (!input) return "#9ca3af";
  const raw = input.trim();
  // Already a usable CSS color value
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return raw;
  if (/^(rgb|hsl)a?\(/i.test(raw)) return raw;

  const text = raw.toLowerCase();
  // Match the longest base keyword present in the description
  const key = Object.keys(BASE)
    .filter((k) => text.includes(k))
    .sort((a, b) => b.length - a.length)[0];

  if (!key) {
    // try a single bare CSS keyword (e.g. "olive" already covered, but "tomato")
    return "#9ca3af";
  }
  return hslToHex(applyModifiers([...BASE[key]] as HSL, text));
}
