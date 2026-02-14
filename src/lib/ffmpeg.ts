import type { ReelSegmentWithVideo } from "@/types/reel";

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
export type TextSize = "small" | "medium" | "large";
export type TextBorder = "outline" | "shadow" | "box";
export type TextBorderColor = "black" | "white";

const WORKER_URL = import.meta.env.VITE_EXPORT_WORKER_URL as string;

/**
 * Export a reel by sending segment data to the Fly.io FFmpeg worker.
 * The worker trims, concatenates, and optionally overlays text,
 * then returns the MP4 directly.
 */
export async function exportReel(
  segments: ReelSegmentWithVideo[],
  options: {
    burnText: boolean;
    textPosition?: TextPosition;
    textSize?: TextSize;
    textBorder?: TextBorder;
    textBorderColor?: TextBorderColor;
  },
  onProgress: ProgressCallback
): Promise<Blob> {
  if (!WORKER_URL) {
    throw new Error("VITE_EXPORT_WORKER_URL is not configured");
  }

  onProgress({ stage: "loading", stageProgress: 0, overallProgress: 0 });

  const body = {
    segments: segments.map((seg) => ({
      videoUrl: seg.video.url,
      startSeconds: seg.start_seconds,
      endSeconds: seg.end_seconds,
      sectionText: seg.section_text,
    })),
    burnText: options.burnText,
    textPosition: options.textPosition ?? "bottom",
    textSize: options.textSize ?? "medium",
    textBorder: options.textBorder ?? "outline",
    textBorderColor: options.textBorderColor ?? "black",
  };

  // Estimate total processing time: ~8s per segment for download + encode
  const estimatedMs = segments.length * 8000 + 3000;

  // Simulate smooth progress while waiting for the server
  let currentProgress = 0.05;
  const startTime = Date.now();
  const ticker = setInterval(() => {
    const elapsed = Date.now() - startTime;
    // Ease toward 85% over the estimated time, slowing down as it approaches
    const target = Math.min(0.85, (elapsed / estimatedMs) * 0.85);
    currentProgress += (target - currentProgress) * 0.15;

    // Figure out which segment we're probably on
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
