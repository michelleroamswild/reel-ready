import express from "express";
import { execFile } from "node:child_process";
import { writeFile, unlink, readFile, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use((_req, res, next) => {
  res.setTimeout(600_000); // 10 min response timeout
  next();
});

const API_KEY = process.env.API_KEY || "";

/* ------------------------------------------------------------------ */
/*  CORS                                                               */
/* ------------------------------------------------------------------ */

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

/* ------------------------------------------------------------------ */
/*  POST /export-reel                                                  */
/* ------------------------------------------------------------------ */

app.post("/export-reel", async (req, res) => {
  // Auth
  if (API_KEY && req.body.apiKey !== API_KEY) {
    return res.status(401).json({ error: "Invalid API key" });
  }

  const { segments, burnText, textPosition, textSize, textBorder, textBorderColor, textColor, fontColor, textWidth, textShadowIntensity } = req.body;

  if (!segments?.length) {
    return res.status(400).json({ error: "No segments provided" });
  }
  let workDir;
  try {
    workDir = await mkdtemp(join(tmpdir(), "reel-"));
    console.log(`[export] Work dir: ${workDir}, ${segments.length} segments`);

    // 1. Download all source videos
    const inputPaths = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      console.log(`[export] Downloading segment ${i}: ${seg.videoUrl}`);
      const resp = await fetch(seg.videoUrl);
      if (!resp.ok) throw new Error(`Failed to download video: ${resp.status}`);
      const buf = Buffer.from(await resp.arrayBuffer());
      const inputPath = join(workDir, `input${i}.mp4`);
      await writeFile(inputPath, buf);
      inputPaths.push(inputPath);
    }

    const outputPath = join(workDir, "output.mp4");

    // 2. Run FFmpeg
    if (burnText) {
      await exportWithText(segments, inputPaths, outputPath, textPosition, textSize, textBorder, textBorderColor, textColor || fontColor, textWidth, textShadowIntensity);
    } else {
      await exportCopyMode(segments, inputPaths, outputPath, workDir);
    }

    // 3. Send the file directly
    const resultBuf = await readFile(outputPath);
    console.log(`[export] Done! ${(resultBuf.length / 1024 / 1024).toFixed(1)}MB, sending directly`);
    res.set("Content-Type", "video/mp4");
    res.set("Content-Length", String(resultBuf.length));
    res.send(resultBuf);
  } catch (err) {
    console.error("[export] Error:", err);
    res.status(500).json({ error: err.message || "Export failed" });
  } finally {
    // Cleanup temp files
    if (workDir) {
      try {
        const { rm } = await import("node:fs/promises");
        await rm(workDir, { recursive: true, force: true });
      } catch {}
    }
  }
});

/* ------------------------------------------------------------------ */
/*  FFmpeg: lossless copy mode (no text overlay)                       */
/* ------------------------------------------------------------------ */

async function exportCopyMode(segments, inputPaths, outputPath, workDir) {
  const WIDTH = 1080;
  const HEIGHT = 1920;

  // Trim each segment using video filters for frame-accurate cuts with clean timestamps
  const trimmedPaths = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const trimmedPath = join(workDir, `seg${i}.mp4`);

    // Use trim filter + setpts to guarantee timestamps start at 0 (no black frame)
    const vf = `trim=start=${seg.startSeconds}:end=${seg.endSeconds},setpts=PTS-STARTPTS,scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:black`;
    const af = `atrim=start=${seg.startSeconds}:end=${seg.endSeconds},asetpts=PTS-STARTPTS`;

    await runFFmpeg([
      "-y",
      "-i", inputPaths[i],
      "-vf", vf,
      "-af", af,
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "18",
      "-r", "30",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      trimmedPath,
    ]);

    trimmedPaths.push(trimmedPath);
  }

  // Build concat list
  const listContent = trimmedPaths.map((p) => `file '${p}'`).join("\n");
  const listPath = join(workDir, "list.txt");
  await writeFile(listPath, listContent);

  // Concat
  await runFFmpeg([
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", listPath,
    "-c", "copy",
    "-movflags", "+faststart",
    outputPath,
  ]);
}

/* ------------------------------------------------------------------ */
/*  Word-wrap helper (FFmpeg drawtext has no auto-wrap)                 */
/* ------------------------------------------------------------------ */

function wrapText(text, fontSize, availableWidth) {
  // ~0.52x fontSize matches system sans-serif wrapping in the CSS preview
  const charWidth = fontSize * 0.52;
  const maxChars = Math.max(5, Math.floor(availableWidth / charWidth));

  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    if (!line) {
      line = word;
    } else if ((line + " " + word).length <= maxChars) {
      line += " " + word;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);

  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/*  FFmpeg: re-encode with text overlay                                */
/* ------------------------------------------------------------------ */

async function exportWithText(segments, inputPaths, outputPath, textPosition, textSize, textBorder, textBorderColor, textColor, textWidth, textShadowIntensity) {
  const WIDTH = 1080;
  const HEIGHT = 1920;

  // Y coordinate for text position (matches original working positions)
  let textY;
  if (textPosition === "top") textY = "(h*0.15)";
  else if (textPosition === "center") textY = "(h/2)";
  else textY = "(h*0.85)"; // bottom (default)

  // Font — Liberation Sans Bold is a clean sans-serif (like Arial/Helvetica)
  const fontFile = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf";

  // Font size — supports percentage of width (new) and legacy px values
  const fontSizeMap = { small: 36, medium: 72, large: 96 };
  let fontSize;
  if (typeof textSize === "string" && fontSizeMap[textSize]) {
    fontSize = fontSizeMap[textSize];
  } else {
    const num = Number(textSize);
    if (num <= 8) {
      // New percentage-based: convert to pixels (percentage of 1080px width)
      fontSize = Math.round((num / 100) * WIDTH);
    } else {
      // Legacy px-based values (9–24): multiply by 4 for 1080p
      fontSize = num * 4;
    }
  }
  if (!fontSize || fontSize < 20) fontSize = 72;

  // Font color — supports hex (#ffffff), named colors (white, black), default white
  const fontColor = (textColor || "white").replace(/^#/, "0x");

  // Border style params for drawtext — scaled to match preview at ~4x
  const borderColor = textBorderColor || "black";
  let borderParams;
  if (textBorder === "none") {
    borderParams = "";
  } else if (textBorder === "shadow") {
    // Glow effect using borderw (matches CSS text-shadow: 0 0 Xpx blur glow)
    const intensity = Math.min(10, Math.max(1, Number(textShadowIntensity) || 5));
    const borderW = Math.max(1, Math.round(intensity * 0.8));
    const glowOpacity = Math.min(1, 0.14 * intensity).toFixed(2);
    borderParams = `borderw=${borderW}:bordercolor=black@${glowOpacity}`;
  } else if (textBorder === "box") {
    borderParams = `box=1:boxborderw=16:boxcolor=${borderColor}@0.35`;
  } else {
    // outline (default)
    borderParams = `borderw=3:bordercolor=${borderColor}`;
  }

  // Process each segment ONE AT A TIME to avoid OOM from loading all inputs
  const workDir = join(outputPath, "..");
  const processedPaths = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const processedPath = join(workDir, `text${i}.mp4`);
    console.log(`[export] Processing segment ${i} with text overlay`);

    // Build video filter: trim + reset PTS + scale + pad + optional drawtext
    let vf = `trim=start=${seg.startSeconds}:end=${seg.endSeconds},setpts=PTS-STARTPTS,scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:black`;
    const af = `atrim=start=${seg.startSeconds}:end=${seg.endSeconds},asetpts=PTS-STARTPTS`;

    const text = seg.sectionText || "";
    if (text) {
      const widthPct = Math.min(100, Math.max(40, Number(textWidth) || 100));
      const wrapWidth = Math.round(WIDTH * widthPct / 100);
      const lines = wrapText(text, fontSize, wrapWidth).split("\n");
      const lineHeight = Math.round(fontSize * 1.4);
      const totalTextHeight = lines.length * lineHeight;

      // Calculate starting Y so the text block is positioned correctly
      let startY;
      if (textPosition === "top") startY = Math.round(HEIGHT * 0.15);
      else if (textPosition === "center") startY = Math.round((HEIGHT - totalTextHeight) / 2);
      else startY = Math.round(HEIGHT * 0.85 - totalTextHeight);

      console.log(`[export] Text "${text}" → ${lines.length} lines, fontSize=${fontSize}, lineHeight=${lineHeight}, startY=${startY}`);

      // Render each line as its own drawtext so each is independently centered
      for (let j = 0; j < lines.length; j++) {
        const lineY = startY + j * lineHeight;
        const escaped = lines[j]
          .replace(/\\/g, "\\\\\\\\")
          .replace(/'/g, "'\\\\\\''")
          .replace(/:/g, "\\:")
          .replace(/%/g, "%%");
        vf += `,drawtext=text='${escaped}':fontfile=${fontFile}:fontsize=${fontSize}:fontcolor=${fontColor}:x=(w-text_w)/2:y=${lineY}:${borderParams}`;
      }
    }

    await runFFmpeg([
      "-y",
      "-i", inputPaths[i],
      "-vf", vf,
      "-af", af,
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "23",
      "-r", "30",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      processedPath,
    ]);

    processedPaths.push(processedPath);
  }

  // Concat all processed segments (lossless copy since they're already encoded identically)
  const listContent = processedPaths.map((p) => `file '${p}'`).join("\n");
  const listPath = join(workDir, "textlist.txt");
  await writeFile(listPath, listContent);

  await runFFmpeg([
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", listPath,
    "-c", "copy",
    "-movflags", "+faststart",
    outputPath,
  ]);
}

/* ------------------------------------------------------------------ */
/*  FFmpeg runner                                                      */
/* ------------------------------------------------------------------ */

async function runFFmpeg(args) {
  console.log(`[ffmpeg] ffmpeg ${args.join(" ")}`);
  try {
    const { stdout, stderr } = await execFileAsync("ffmpeg", args, {
      timeout: 300_000, // 5 minute timeout per segment
      maxBuffer: 10 * 1024 * 1024,
    });
    if (stderr) console.log("[ffmpeg stderr]", stderr.slice(-500));
    return stdout;
  } catch (err) {
    console.error("[ffmpeg] Failed:", err.stderr?.slice(-1000) || err.message);
    throw new Error(`FFmpeg failed: ${err.stderr?.slice(-200) || err.message}`);
  }
}

/* ------------------------------------------------------------------ */
/*  POST /generate-thumbnail                                           */
/* ------------------------------------------------------------------ */

app.post("/generate-thumbnail", async (req, res) => {
  if (API_KEY && req.body.apiKey !== API_KEY) {
    return res.status(401).json({ error: "Invalid API key" });
  }

  const { videoUrl } = req.body;
  if (!videoUrl) {
    return res.status(400).json({ error: "videoUrl is required" });
  }

  let workDir;
  try {
    workDir = await mkdtemp(join(tmpdir(), "thumb-"));
    const outputPath = join(workDir, "thumb.jpg");

    // Extract a single frame at ~1s directly from URL.
    // -ss before -i means FFmpeg seeks in the stream efficiently (only reads first seconds).
    await runFFmpeg([
      "-y",
      "-ss", "1",
      "-i", videoUrl,
      "-vframes", "1",
      "-q:v", "5",
      "-vf", "scale=360:-1",
      outputPath,
    ]);

    const thumbBuf = await readFile(outputPath);
    console.log(`[thumbnail] Generated ${(thumbBuf.length / 1024).toFixed(0)}KB thumbnail`);
    res.set("Content-Type", "image/jpeg");
    res.set("Content-Length", String(thumbBuf.length));
    res.send(thumbBuf);
  } catch (err) {
    console.error("[thumbnail] Error:", err);
    res.status(500).json({ error: err.message || "Thumbnail generation failed" });
  } finally {
    if (workDir) {
      try {
        const { rm } = await import("node:fs/promises");
        await rm(workDir, { recursive: true, force: true });
      } catch {}
    }
  }
});

/* ------------------------------------------------------------------ */
/*  Health check                                                       */
/* ------------------------------------------------------------------ */

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/*  Start                                                              */
/* ------------------------------------------------------------------ */

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[worker] Listening on port ${PORT}`);
});
