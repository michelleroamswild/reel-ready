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

  const { segments, burnText, textPosition, textSize, textBorder, textBorderColor } = req.body;

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
      await exportWithText(segments, inputPaths, outputPath, textPosition, textSize, textBorder, textBorderColor);
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
  // Trim each segment with -c copy
  const trimmedPaths = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const trimmedPath = join(workDir, `seg${i}.mp4`);

    await runFFmpeg([
      "-y",
      "-ss", String(seg.startSeconds),
      "-to", String(seg.endSeconds),
      "-i", inputPaths[i],
      "-c", "copy",
      "-avoid_negative_ts", "make_zero",
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
    outputPath,
  ]);
}

/* ------------------------------------------------------------------ */
/*  FFmpeg: re-encode with text overlay                                */
/* ------------------------------------------------------------------ */

async function exportWithText(segments, inputPaths, outputPath, textPosition, textSize, textBorder, textBorderColor) {
  const WIDTH = 1080;
  const HEIGHT = 1920;

  // Y coordinate for text position
  let textY;
  if (textPosition === "top") textY = "(h*0.15)";
  else if (textPosition === "center") textY = "(h/2)";
  else textY = "(h*0.85)"; // bottom (default)

  // Font — Liberation Sans Bold is a clean sans-serif (like Arial/Helvetica)
  const fontFile = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf";

  // Font size — scaled to match preview CSS at ~4x (preview: 14/18/24px on ~270px wide → 1080px)
  const fontSizeMap = { small: 56, medium: 72, large: 96 };
  const fontSize = fontSizeMap[textSize] || 72;

  // Border style params for drawtext — scaled to match preview at ~4x
  const borderColor = textBorderColor || "black";
  let borderParams;
  if (textBorder === "shadow") {
    borderParams = "shadowx=4:shadowy=4:shadowcolor=black@0.5";
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

    // Build video filter: scale + pad + optional drawtext
    let vf = `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:black`;

    const text = seg.sectionText || "";
    if (text) {
      const escapedText = text
        .replace(/\\/g, "\\\\\\\\")
        .replace(/'/g, "'\\\\\\''")
        .replace(/:/g, "\\:")
        .replace(/%/g, "%%");
      vf += `,drawtext=text='${escapedText}':fontfile=${fontFile}:fontsize=${fontSize}:fontcolor=white:x=(w-text_w)/2:y=${textY}:${borderParams}`;
    }

    await runFFmpeg([
      "-y",
      "-ss", String(seg.startSeconds),
      "-to", String(seg.endSeconds),
      "-i", inputPaths[i],
      "-vf", vf,
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "23",
      "-r", "30",
      "-pix_fmt", "yuv420p",
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
