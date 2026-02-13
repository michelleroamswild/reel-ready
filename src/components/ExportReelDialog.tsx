// Force HMR reload
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Export,
  CheckCircle,
  XCircle,
  CircleNotch,
} from "@phosphor-icons/react";
import { useExportReel } from "@/hooks/use-export-reel";
import type { ReelSegmentWithVideo } from "@/types/reel";
import type { ExportStage, TextPosition } from "@/lib/ffmpeg";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segments: ReelSegmentWithVideo[];
  reelTitle: string;
}

const STAGE_LABELS: Record<ExportStage, string> = {
  loading: "Loading video engine...",
  downloading: "Downloading clips...",
  trimming: "Trimming & normalizing...",
  concatenating: "Assembling final video...",
  done: "Export complete!",
  error: "Export failed",
};

export function ExportReelDialog({
  open,
  onOpenChange,
  segments,
  reelTitle,
}: Props) {
  const [burnText, setBurnText] = useState(false);
  const [textPosition, setTextPosition] = useState<TextPosition>("bottom");
  const { isExporting, progress, error, startExport, cancelExport, reset } =
    useExportReel();

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const handleExport = () => {
    const safeName = reelTitle
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 50)
      .toLowerCase();
    startExport(segments, {
      burnText,
      textPosition,
      filename: `${safeName}_reel.mp4`,
    });
  };

  const handleClose = (openState: boolean) => {
    if (!openState && isExporting) {
      if (!window.confirm("Export is in progress. Cancel and close?")) return;
      cancelExport();
    }
    onOpenChange(openState);
  };

  const isDone = progress?.stage === "done";
  const isError = progress?.stage === "error";
  const hasStarted = progress !== null;

  const totalDuration = segments.reduce(
    (sum, seg) => sum + (seg.end_seconds - seg.start_seconds),
    0
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Export Reel</DialogTitle>
          <DialogDescription>
            {!hasStarted
              ? "Generate an MP4 video from your storyboard."
              : STAGE_LABELS[progress.stage]}
          </DialogDescription>
        </DialogHeader>

        {/* Pre-export config */}
        {!hasStarted && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Segments</span>
                <span className="font-medium">{segments.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">
                  ~{Math.round(totalDuration)}s
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Resolution</span>
                <span className="font-medium">1080 x 1920</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="burn-text" className="text-sm font-medium">
                  Burn text overlays
                </Label>
                <p className="text-xs text-muted-foreground">
                  Render section text onto each clip
                </p>
              </div>
              <Switch
                id="burn-text"
                checked={burnText}
                onCheckedChange={setBurnText}
              />
            </div>

            {burnText && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Text position</Label>
                <div className="flex gap-2">
                  {([
                    { value: "top", label: "Top" },
                    { value: "center", label: "Center" },
                    { value: "bottom", label: "Bottom" },
                  ] as const).map((opt) => (
                    <Button
                      key={opt.value}
                      variant={textPosition === opt.value ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setTextPosition(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress */}
        {hasStarted && !isDone && !isError && (
          <div className="space-y-3 py-2">
            <Progress
              value={Math.round((progress.overallProgress ?? 0) * 100)}
              className="h-2"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CircleNotch className="h-3.5 w-3.5 animate-spin" />
                {STAGE_LABELS[progress.stage]}
              </span>
              <span>
                {Math.round((progress.overallProgress ?? 0) * 100)}%
              </span>
            </div>
            {progress.currentSegment != null && progress.totalSegments != null && (
              <p className="text-xs text-muted-foreground text-center">
                Segment {progress.currentSegment} of {progress.totalSegments}
              </p>
            )}
          </div>
        )}

        {/* Done */}
        {isDone && (
          <div className="flex flex-col items-center gap-2 py-4">
            <CheckCircle className="h-10 w-10 text-green-500" weight="fill" />
            <p className="text-sm font-medium">Video exported successfully!</p>
            <p className="text-xs text-muted-foreground">
              Check your downloads folder.
            </p>
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="flex flex-col items-center gap-2 py-4">
            <XCircle className="h-10 w-10 text-destructive" weight="fill" />
            <p className="text-sm font-medium">Export failed</p>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              {error}
            </p>
          </div>
        )}

        {/* Footer */}
        <DialogFooter>
          {!hasStarted && (
            <Button
              className="w-full"
              onClick={handleExport}
              disabled={segments.length === 0}
            >
              <Export className="h-4 w-4 mr-1" />
              Start Export
            </Button>
          )}
          {isExporting && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                cancelExport();
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
          )}
          {isDone && (
            <Button
              className="w-full"
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
          )}
          {isError && (
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
              <Button className="flex-1" onClick={handleExport}>
                Retry
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
