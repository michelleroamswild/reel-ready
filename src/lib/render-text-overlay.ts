/**
 * Canvas-based text overlay renderer.
 * Produces a transparent 1080×1920 PNG that mirrors the CSS preview
 * in ReelBuilderPage.tsx — same font, wrapping, and effects.
 * FFmpeg composites the PNG on top of video using the overlay filter.
 */

const WIDTH = 1080;
const HEIGHT = 1920;

export interface TextOverlayOptions {
  text: string;
  position: "top" | "center" | "bottom";
  textSize: number;       // cqw value (e.g., 4.5)
  textColor: string;
  textBorder: "none" | "outline" | "shadow" | "box";
  textBorderColor: string;
  textWidth: number;       // 40-100 percent
  textShadowIntensity: number; // 1-10
}

/**
 * Render text overlay as a transparent PNG data URL.
 * Uses the Canvas API so font metrics match the browser preview exactly.
 */
export async function renderTextOverlay(opts: TextOverlayOptions): Promise<string> {
  const {
    text,
    position,
    textSize,
    textColor,
    textBorder,
    textBorderColor,
    textWidth,
    textShadowIntensity,
  } = opts;

  if (!text.trim()) {
    return "";
  }

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;

  // Font size: convert cqw to px at 1080px width (same as CSS `${textSize}cqw`)
  const fontSize = Math.round((textSize / 100) * WIDTH);
  const font = `bold ${fontSize}px sans-serif`;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  // Word wrap using Canvas measureText (pixel-accurate)
  const paddingSide = 16;
  const availableWidth = WIDTH * (textWidth / 100) - paddingSide * 2;
  const lines = wrapLines(ctx, text, availableWidth);

  const lineHeight = Math.round(fontSize * 1.4);
  const totalTextHeight = lines.length * lineHeight;

  // Y positioning to match CSS classes:
  //  top:    top-[15%]
  //  center: top-1/2 -translate-y-1/2 → vertically centered
  //  bottom: bottom-[15%]
  let blockY: number;
  if (position === "top") {
    blockY = Math.round(HEIGHT * 0.15);
  } else if (position === "center") {
    blockY = Math.round((HEIGHT - totalTextHeight) / 2);
  } else {
    // bottom: the block's bottom edge sits at 85% of height
    blockY = Math.round(HEIGHT * 0.85 - totalTextHeight);
  }

  const centerX = WIDTH / 2;

  // Draw based on border style
  if (textBorder === "box") {
    drawBoxBackground(ctx, lines, centerX, blockY, lineHeight, fontSize, textBorderColor);
  }

  // Reset font after any box drawing
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  if (textBorder === "shadow") {
    drawShadowText(ctx, lines, centerX, blockY, lineHeight, textColor, textShadowIntensity);
  } else if (textBorder === "outline") {
    drawOutlineText(ctx, lines, centerX, blockY, lineHeight, textColor, textBorderColor);
  } else {
    // "none" or "box" — just fill text (box background already drawn)
    ctx.fillStyle = textColor;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], centerX, blockY + i * lineHeight);
    }
  }

  return canvas.toDataURL("image/png");
}

/** Word wrap using ctx.measureText for pixel-accurate line breaks. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.length > 0 ? lines : [""];
}

/**
 * Shadow border: matches CSS text-shadow with two blur layers.
 * CSS: `0 0 ${blur1}px rgba(0,0,0,${alpha1}), 0 0 ${blur2}px rgba(0,0,0,${alpha2})`
 *
 * Canvas shadowBlur approximates CSS blur radius. We draw twice
 * (one per shadow layer) since Canvas only supports one shadow per draw call.
 */
function drawShadowText(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  centerX: number,
  startY: number,
  lineHeight: number,
  textColor: string,
  intensity: number,
) {
  const safeIntensity = Math.min(10, Math.max(1, intensity));

  // Layer 1: tighter blur (matches first text-shadow value)
  ctx.save();
  ctx.fillStyle = textColor;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowBlur = Math.round(6 * safeIntensity / 5);
  ctx.shadowColor = `rgba(0,0,0,${Math.min(1, 0.7 * safeIntensity / 5).toFixed(2)})`;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], centerX, startY + i * lineHeight);
  }
  ctx.restore();

  // Layer 2: wider blur (matches second text-shadow value)
  ctx.save();
  ctx.fillStyle = textColor;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowBlur = Math.round(12 * safeIntensity / 5);
  ctx.shadowColor = `rgba(0,0,0,${Math.min(1, 0.4 * safeIntensity / 5).toFixed(2)})`;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], centerX, startY + i * lineHeight);
  }
  ctx.restore();

  // Final pass: crisp text on top (no shadow)
  ctx.fillStyle = textColor;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], centerX, startY + i * lineHeight);
  }
}

/**
 * Outline border: matches CSS `WebkitTextStroke: 0.8px` + `text-shadow: 0 0 2px`.
 * Scale 0.8px CSS stroke to 1080px export width. The preview container is roughly
 * 270px wide (phone preview), so the scale factor is ~4x → ~3.2px stroke.
 */
function drawOutlineText(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  centerX: number,
  startY: number,
  lineHeight: number,
  textColor: string,
  borderColor: string,
) {
  // Stroke outline
  ctx.save();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 3.2;
  ctx.lineJoin = "round";
  // Small glow matching CSS text-shadow: 0 0 2px
  ctx.shadowBlur = 8; // 2px * 4x scale
  ctx.shadowColor = borderColor;
  for (let i = 0; i < lines.length; i++) {
    ctx.strokeText(lines[i], centerX, startY + i * lineHeight);
  }
  ctx.restore();

  // Fill text on top
  ctx.fillStyle = textColor;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], centerX, startY + i * lineHeight);
  }
}

/**
 * Box background: matches CSS `background: rgba(color, 0.35)` with
 * `padding: 4px 10px` and `borderRadius: 6px`, scaled to 1080px.
 */
function drawBoxBackground(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  centerX: number,
  startY: number,
  lineHeight: number,
  fontSize: number,
  borderColor: string,
) {
  const padX = 40;  // 10px * 4x scale
  const padY = 16;  // 4px * 4x scale
  const radius = 24; // 6px * 4x scale

  const bgColor = borderColor === "black" || borderColor === "#000000"
    ? "rgba(0,0,0,0.35)"
    : "rgba(255,255,255,0.35)";

  for (let i = 0; i < lines.length; i++) {
    const metrics = ctx.measureText(lines[i]);
    const textW = metrics.width;
    const boxX = centerX - textW / 2 - padX;
    const boxY = startY + i * lineHeight - padY;
    const boxW = textW + padX * 2;
    const boxH = fontSize + padY * 2;

    ctx.fillStyle = bgColor;
    roundRect(ctx, boxX, boxY, boxW, boxH, radius);
    ctx.fill();
  }
}

/** Draw a rounded rectangle path. */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
