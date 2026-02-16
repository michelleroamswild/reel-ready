// Force HMR reload
import { useState, useCallback, useRef } from "react";
import {
  exportReel,
  triggerDownload,
  type ExportProgress,
  type TextPosition,
  type TextSize,
  type TextBorder,
  type TextBorderColor,
  type TextColor,
} from "@/lib/ffmpeg";
import type { ReelSegmentWithVideo } from "@/types/reel";

const INITIAL_PROGRESS: ExportProgress = {
  stage: "loading",
  stageProgress: 0,
  overallProgress: 0,
};

export function useExportReel() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const startExport = useCallback(
    async (
      segments: ReelSegmentWithVideo[],
      options: {
        burnText: boolean;
        textPosition?: TextPosition;
        textSize?: TextSize;
        textBorder?: TextBorder;
        textBorderColor?: TextBorderColor;
        textColor?: TextColor;
        filename: string;
      }
    ) => {
      setIsExporting(true);
      setProgress(INITIAL_PROGRESS);
      setError(null);
      cancelledRef.current = false;

      try {
        const blob = await exportReel(
          segments,
          {
            burnText: options.burnText,
            textPosition: options.textPosition,
            textSize: options.textSize,
            textBorder: options.textBorder,
            textBorderColor: options.textBorderColor,
            textColor: options.textColor,
          },
          (p) => {
            if (!cancelledRef.current) {
              setProgress(p);
            }
          }
        );

        if (!cancelledRef.current) {
          triggerDownload(blob, options.filename);
          setProgress({ stage: "done", stageProgress: 1, overallProgress: 1 });
        }
      } catch (err) {
        console.error("[Export] Failed:", err);
        if (!cancelledRef.current) {
          const message =
            err instanceof Error ? err.message : "Export failed";
          setError(message);
          setProgress({
            stage: "error",
            stageProgress: 0,
            overallProgress: 0,
            error: message,
          });
        }
      } finally {
        setIsExporting(false);
      }
    },
    []
  );

  const cancelExport = useCallback(() => {
    cancelledRef.current = true;
    setIsExporting(false);
    setProgress(null);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setIsExporting(false);
    setProgress(null);
    setError(null);
    cancelledRef.current = false;
  }, []);

  return { isExporting, progress, error, startExport, cancelExport, reset };
}
