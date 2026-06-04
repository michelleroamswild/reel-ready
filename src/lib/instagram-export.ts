// Parse captions out of an Instagram "Download your information" data export
// (JSON format). Captions live under "title" fields in posts_*.json, reels.json,
// etc. We collect them tolerantly across the various shapes Instagram uses.

// Instagram's JSON export encodes UTF-8 bytes as Latin-1, so emoji/accents come
// through mojibake'd. Repair strings that are pure-Latin1.
function fixMojibake(s: string): string {
  // Mis-encoded export strings are pure Latin-1 (every code unit <= 0xFF).
  // A real higher-plane char (e.g. an emoji surrogate) means it's already fine.
  let hasHigh = false;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code > 0xff) return s;
    if (code >= 0x80) hasHigh = true;
  }
  if (!hasHigh) return s; // plain ASCII — nothing to repair
  try {
    const bytes = Uint8Array.from(s, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return s;
  }
}

// Recursively collect caption strings. Instagram's export stores the caption in
// two places depending on the file/version:
//   1. label_values entries shaped { "label": "Caption", "value": "..." }  (canonical)
//   2. media items shaped { "uri": ..., "title": "..." }                   (older/reels)
// We collect both; de-duping later removes the overlap. We deliberately ignore
// the section-header `title`s ("Media", "Hashtags", "Reel metadata", …).
function collectCaptions(node: unknown, out: string[]): void {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) collectCaptions(item, out);
    return;
  }
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (obj.label === "Caption" && typeof obj.value === "string" && obj.value.trim()) {
      out.push(obj.value);
    }
    for (const [key, value] of Object.entries(obj)) {
      if (key === "title" && typeof value === "string" && value.trim()) {
        out.push(value);
      } else {
        collectCaptions(value, out);
      }
    }
  }
}

export function extractCaptionsFromExport(jsonText: string): string[] {
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return [];
  }
  const raw: string[] = [];
  collectCaptions(data, raw);
  return raw;
}

// Parse one or more export files, repair encoding, de-dupe, and drop trivially
// short captions. Returns the cleaned caption list ready for voice profiling.
export function captionsFromExportFiles(fileTexts: string[]): string[] {
  const all: string[] = [];
  for (const text of fileTexts) all.push(...extractCaptionsFromExport(text));

  // Structural labels Instagram uses as "title" that aren't real captions.
  const NOISE = /^(reel|post|story|stories|media|profile|posts?) metadata$/i;

  const seen = new Set<string>();
  const out: string[] = [];
  for (const rawCaption of all) {
    const cleaned = fixMojibake(rawCaption).trim();
    if (cleaned.length < 10) continue;
    if (NOISE.test(cleaned)) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}
