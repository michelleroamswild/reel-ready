import express from "express";
import { execFile } from "node:child_process";
import { writeFile, unlink, readFile, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const app = express();
app.use(express.json({ limit: "2mb" }));
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

  const { segments, burnText } = req.body;

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

    // 2. Run FFmpeg — overlay PNGs if burnText, otherwise copy mode
    const hasOverlays = burnText && segments.some((s) => s.overlayPng);
    if (hasOverlays) {
      await exportWithOverlay(segments, inputPaths, outputPath, workDir);
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
/*  FFmpeg: composite PNG overlays onto video                          */
/* ------------------------------------------------------------------ */

async function exportWithOverlay(segments, inputPaths, outputPath, workDir) {
  const WIDTH = 1080;
  const HEIGHT = 1920;

  const processedPaths = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const processedPath = join(workDir, `ovr${i}.mp4`);

    // Base video filter: trim + scale + pad
    const vf = `trim=start=${seg.startSeconds}:end=${seg.endSeconds},setpts=PTS-STARTPTS,scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:black`;
    const af = `atrim=start=${seg.startSeconds}:end=${seg.endSeconds},asetpts=PTS-STARTPTS`;

    if (seg.overlayPng) {
      // Decode base64 PNG and write to disk
      const overlayPath = join(workDir, `overlay_${i}.png`);
      await writeFile(overlayPath, Buffer.from(seg.overlayPng, "base64"));
      console.log(`[export] Segment ${i}: compositing PNG overlay`);

      // Use filter_complex: process video, then overlay the PNG on top
      const filterComplex = `[0:v]${vf}[vid];[1:v]scale=${WIDTH}:${HEIGHT}[ovr];[vid][ovr]overlay=0:0[out]`;

      await runFFmpeg([
        "-y",
        "-i", inputPaths[i],
        "-i", overlayPath,
        "-filter_complex", filterComplex,
        "-af", af,
        "-map", "[out]",
        "-map", "0:a",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "18",
        "-r", "30",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        processedPath,
      ]);
    } else {
      // No overlay — same as copy mode for this segment
      console.log(`[export] Segment ${i}: no overlay`);
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
        processedPath,
      ]);
    }

    processedPaths.push(processedPath);
  }

  // Concat all processed segments
  const listContent = processedPaths.map((p) => `file '${p}'`).join("\n");
  const listPath = join(workDir, "ovrlist.txt");
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
