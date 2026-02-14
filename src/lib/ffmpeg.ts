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

const WORKER_URL = import.meta.env.VITE_EXPORT_WORKER_URL as string;

/**
 * Export a reel by sending segment data to the Fly.io FFmpeg worker.
 * The worker trims, concatenates, and optionally overlays text,
 * then returns the MP4 directly.
 */
export async function exportReel(
  segments: ReelSegmentWithVideo[],
  options: { burnText: boolean; textPosition?: TextPosition },
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
  };

  onProgress({
    stage: "processing",
    stageProgress: 0.2,
    overallProgress: 0.1,
    totalSegments: segments.length,
  });

  const resp = await fetch(`${WORKER_URL}/export-reel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errBody = await resp.json().catch(() => null);
    throw new Error(errBody?.error || `Export failed (${resp.status})`);
  }

  onProgress({
    stage: "downloading",
    stageProgress: 0.5,
    overallProgress: 0.85,
  });

  const blob = await resp.blob();

  onProgress({ stage: "done", stageProgress: 1, overallProgress: 1 });
  return blob;
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
