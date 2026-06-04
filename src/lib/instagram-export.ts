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

// Recursively collect every "title" string value (the caption field).
function collectTitles(node: unknown, out: string[]): void {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) collectTitles(item, out);
    return;
  }
  if (typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === "title" && typeof value === "string" && value.trim()) {
        out.push(value);
      } else {
        collectTitles(value, out);
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
  collectTitles(data, raw);
  return raw;
}

// Parse one or more export files, repair encoding, de-dupe, and drop trivially
// short captions. Returns the cleaned caption list ready for voice profiling.
export function captionsFromExportFiles(fileTexts: string[]): string[] {
  const all: string[] = [];
  for (const text of fileTexts) all.push(...extractCaptionsFromExport(text));

  const seen = new Set<string>();
  const out: string[] = [];
  for (const rawCaption of all) {
    const cleaned = fixMojibake(rawCaption).trim();
    if (cleaned.length < 10) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}
