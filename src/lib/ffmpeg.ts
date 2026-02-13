import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import type { ReelSegmentWithVideo } from "@/types/reel";

const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 1920;
const TARGET_FPS = 30;

export type ExportStage =
  | "loading"
  | "downloading"
  | "trimming"
  | "concatenating"
  | "done"
  | "error";

export interface ExportProgress {
  stage: ExportStage;
  stageProgress: number;
  overallProgress: number;
  currentSegment?: number;
  totalSegments?: number;
  error?: string;
}

type ProgressCallback = (progress: ExportProgress) => void;

export type TextPosition = "top" | "center" | "bottom";

export async function exportReel(
  segments: ReelSegmentWithVideo[],
  options: { burnText: boolean; textPosition?: TextPosition },
  onProgress: ProgressCallback
): Promise<Blob> {
  const total = segments.length;

  onProgress({ stage: "loading", stageProgress: 0, overallProgress: 0 });

  // --- Stage 1: Download all videos as blob URLs ---
  const blobUrls: string[] = [];
  for (let i = 0; i < total; i++) {
    const seg = segments[i];
    console.log(`[export] Downloading ${i + 1}/${total}: ${seg.video.filename}`);

    onProgress({
      stage: "downloading",
      stageProgress: i / total,
      overallProgress: 0.1 * (i / total),
      currentSegment: i + 1,
      totalSegments: total,
    });

    const resp = await fetch(seg.video.url);
    if (!resp.ok) throw new Error(`Failed to download ${seg.video.filename}: ${resp.status}`);
    const blob = await resp.blob();
    blobUrls.push(URL.createObjectURL(blob));
  }

  onProgress({ stage: "downloading", stageProgress: 1, overallProgress: 0.1 });

  // --- Stage 2: Set up MP4 muxer + H.264 encoder ---
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: "avc",
      width: TARGET_WIDTH,
      height: TARGET_HEIGHT,
    },
    fastStart: "in-memory",
  });

  let frameCount = 0;
  const frameDuration = 1_000_000 / TARGET_FPS; // microseconds per frame

  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta);
    },
    error: (err) => {
      console.error("[export] Encoder error:", err);
    },
  });

  encoder.configure({
    codec: "avc1.640028", // H.264 High Profile Level 4.0
    width: TARGET_WIDTH,
    height: TARGET_HEIGHT,
    bitrate: 4_000_000,
    framerate: TARGET_FPS,
  });

  // Canvas for drawing frames
  const canvas = new OffscreenCanvas(TARGET_WIDTH, TARGET_HEIGHT);
  const ctx = canvas.getContext("2d")!;

  // --- Stage 3: Record each segment ---
  for (let i = 0; i < total; i++) {
    const seg = segments[i];
    console.log(`[export] Recording segment ${i + 1}/${total}: "${seg.section_text}"`);

    onProgress({
      stage: "trimming",
      stageProgress: i / total,
      overallProgress: 0.1 + 0.85 * (i / total),
      currentSegment: i + 1,
      totalSegments: total,
    });

    frameCount = await recordSegment(
      ctx,
      canvas,
      encoder,
      seg,
      blobUrls[i],
      options.burnText,
      options.textPosition ?? "bottom",
      frameCount,
      frameDuration
    );
  }

  // Clean up blob URLs
  blobUrls.forEach((u) => URL.revokeObjectURL(u));

  // --- Stage 4: Finalize ---
  onProgress({ stage: "concatenating", stageProgress: 0.5, overallProgress: 0.97 });

  await encoder.flush();
  encoder.close();
  muxer.finalize();

  const { buffer } = muxer.target;
  const blob = new Blob([buffer], { type: "video/mp4" });

  console.log(`[export] Done! ${frameCount} frames, ${(blob.size / 1024 / 1024).toFixed(1)}MB`);

  onProgress({ stage: "done", stageProgress: 1, overallProgress: 1 });
  return blob;
}

/** Play a segment and encode each frame at correct timestamps */
function recordSegment(
  ctx: OffscreenCanvasRenderingContext2D,
  canvas: OffscreenCanvas,
  encoder: VideoEncoder,
  seg: ReelSegmentWithVideo,
  blobUrl: string,
  burnText: boolean,
  textPosition: TextPosition,
  startFrame: number,
  frameDuration: number
): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.playsInline = true;
    video.muted = true;
    video.preload = "auto";
    video.src = blobUrl;

    let frameCount = startFrame;
    let animFrame: number;
    let resolved = false;
    let lastEncodedTime = -1;
    const frameInterval = 1 / TARGET_FPS; // seconds between output frames

    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      cancelAnimationFrame(animFrame);
      video.pause();
      video.removeAttribute("src");
      video.load();
    };

    const drawFrame = () => {
      if (resolved) return;

      if (video.currentTime >= seg.end_seconds || video.ended) {
        cleanup();
        resolve(frameCount);
        return;
      }

      // Only encode at ~30fps — skip if we haven't advanced enough in the video
      const elapsed = video.currentTime - seg.start_seconds;
      const nextEncodeTime = (lastEncodedTime < 0) ? 0 : lastEncodedTime + frameInterval;

      if (elapsed >= nextEncodeTime) {
        // Draw video scaled/padded to portrait
        const vw = video.videoWidth || TARGET_WIDTH;
        const vh = video.videoHeight || TARGET_HEIGHT;
        const scale = Math.min(TARGET_WIDTH / vw, TARGET_HEIGHT / vh);
        const dw = vw * scale;
        const dh = vh * scale;
        const dx = (TARGET_WIDTH - dw) / 2;
        const dy = (TARGET_HEIGHT - dh) / 2;

        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);
        ctx.drawImage(video, dx, dy, dw, dh);

        if (burnText && seg.section_text) {
          ctx.save();
          ctx.font = "bold 44px sans-serif";
          ctx.textAlign = "center";
          ctx.fillStyle = "white";
          ctx.strokeStyle = "black";
          ctx.lineWidth = 3;
          let textY: number;
          if (textPosition === "top") {
            textY = 120;
          } else if (textPosition === "center") {
            textY = TARGET_HEIGHT / 2;
          } else {
            textY = TARGET_HEIGHT - TARGET_HEIGHT / 6;
          }
          ctx.strokeText(seg.section_text, TARGET_WIDTH / 2, textY);
          ctx.fillText(seg.section_text, TARGET_WIDTH / 2, textY);
          ctx.restore();
        }

        const videoFrame = new VideoFrame(canvas, {
          timestamp: frameCount * frameDuration,
        });
        const isKeyFrame = frameCount % (TARGET_FPS * 2) === 0;
        encoder.encode(videoFrame, { keyFrame: isKeyFrame });
        videoFrame.close();
        frameCount++;
        lastEncodedTime = elapsed;
      }

      animFrame = requestAnimationFrame(drawFrame);
    };

    video.onloadeddata = () => {
      video.currentTime = seg.start_seconds;
    };

    video.onseeked = () => {
      video.play().then(() => {
        drawFrame();
      }).catch(reject);
    };

    video.onerror = () => {
      cleanup();
      reject(new Error(`Failed to load video: ${seg.video.filename}`));
    };

    setTimeout(() => {
      if (!resolved) {
        cleanup();
        resolve(frameCount);
      }
    }, 30_000);
  });
}

export function triggerDownload(blob: Blob, filename: string): void {
  const name = filename.replace(/\.\w+$/, "") + ".mp4";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
