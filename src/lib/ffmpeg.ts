import type { ReelSegmentWithVideo } from "@/types/reel";
import { renderTextOverlay } from "./render-text-overlay";

export type ExportStage =
  | "loading"
  | "processing"
  | "downloading"
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
export type TextSize = number;
export type TextBorder = "none" | "outline" | "shadow" | "box";
export type TextWidth = number; // 40-100 (percentage of container width)
export type TextShadowIntensity = number; // 1-10 (shadow strength, default 5)
export type TextBorderColor = "black" | "white";
export type TextColor = string;

const WORKER_URL = import.meta.env.VITE_EXPORT_WORKER_URL as string;

/**
 * Export a reel by sending segment data to the Fly.io FFmpeg worker.
 * Text overlays are rendered as transparent PNGs in the browser (Canvas API)
 * so they match the preview exactly, then composited by FFmpeg on the worker.
 */
export async function exportReel(
  segments: ReelSegmentWithVideo[],
  options: {
    burnText: boolean;
    textPosition?: TextPosition;
    textSize?: TextSize;
    textBorder?: TextBorder;
    textBorderColor?: TextBorderColor;
    textColor?: TextColor;
    textWidth?: TextWidth;
    textShadowIntensity?: TextShadowIntensity;
  },
  onProgress: ProgressCallback
): Promise<Blob> {
  if (!WORKER_URL) {
    throw new Error("VITE_EXPORT_WORKER_URL is not configured");
  }

  onProgress({ stage: "loading", stageProgress: 0, overallProgress: 0 });

  // Filter valid segments
  const validSegments = segments.filter((seg) => seg.end_seconds > seg.start_seconds);

  // Render text overlays as transparent PNGs in the browser
  const overlayPngs: (string | null)[] = [];
  if (options.burnText) {
    for (const seg of validSegments) {
      if (seg.section_text?.trim()) {
        const dataUrl = await renderTextOverlay({
          text: seg.section_text,
          position: options.textPosition ?? "bottom",
          textSize: options.textSize ?? 4.5,
          textColor: options.textColor ?? "white",
          textBorder: options.textBorder ?? "shadow",
          textBorderColor: options.textBorderColor ?? "black",
          textWidth: options.textWidth ?? 100,
          textShadowIntensity: options.textShadowIntensity ?? 5,
        });
        // Strip the data URL prefix, send just the base64 payload
        overlayPngs.push(dataUrl ? dataUrl.replace(/^data:image\/png;base64,/, "") : null);
      } else {
        overlayPngs.push(null);
      }
    }
  }

  const body = {
    segments: validSegments.map((seg, i) => ({
      videoUrl: seg.video.url,
      startSeconds: seg.start_seconds,
      endSeconds: Math.max(seg.end_seconds, seg.start_seconds + 0.1),
      overlayPng: options.burnText ? overlayPngs[i] ?? null : null,
    })),
    burnText: options.burnText,
  };

  // Estimate total processing time: ~8s per segment for download + encode
  let estimatedMs = segments.length * 8000 + 3000;

  // Simulate smooth progress while waiting for the server
  let currentProgress = 0.05;
  const startTime = Date.now();
  const ticker = setInterval(() => {
    const elapsed = Date.now() - startTime;
    // If taking longer than expected, extend the estimate so progress keeps moving
    if (elapsed > estimatedMs * 0.9) {
      estimatedMs = elapsed + 5000;
    }
    const target = Math.min(0.90, (elapsed / estimatedMs) * 0.90);
    currentProgress += (target - currentProgress) * 0.1;

    const segEstimate = Math.min(
      segments.length,
      Math.floor((elapsed / estimatedMs) * segments.length) + 1
    );

    onProgress({
      stage: "processing",
      stageProgress: currentProgress,
      overallProgress: currentProgress,
      currentSegment: segEstimate,
      totalSegments: segments.length,
    });
  }, 400);

  try {
    const resp = await fetch(`${WORKER_URL}/export-reel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    clearInterval(ticker);

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => null);
      throw new Error(errBody?.error || `Export failed (${resp.status})`);
    }

    onProgress({
      stage: "downloading",
      stageProgress: 0.9,
      overallProgress: 0.9,
    });

    const blob = await resp.blob();

    onProgress({ stage: "done", stageProgress: 1, overallProgress: 1 });
    return blob;
  } catch (err) {
    clearInterval(ticker);
    throw err;
  }
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
