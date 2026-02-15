import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTrialBatch } from "@/hooks/use-trial-reels";
import { useExportReel } from "@/hooks/use-export-reel";
import { useToast } from "@/hooks/use-toast";
import { TrialVariantCard } from "@/components/TrialVariantCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Export,
  CircleNotch,
  Flask,
} from "@phosphor-icons/react";

export default function TrialBatchPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: batch, isLoading } = useTrialBatch(batchId);

  // Batch export state
  const { isExporting, progress, startExport, reset: resetExport } =
    useExportReel();
  const [batchExportIndex, setBatchExportIndex] = useState(-1);
  const [batchExportTotal, setBatchExportTotal] = useState(0);
  const isBatchExporting = batchExportIndex >= 0;

  const handleExportAll = useCallback(async () => {
    if (!batch?.reels.length) return;

    const reels = batch.reels;
    setBatchExportTotal(reels.length);

    for (let i = 0; i < reels.length; i++) {
      const reel = reels[i];
      setBatchExportIndex(i);
      resetExport();

      const safeName = reel.title
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 50)
        .toLowerCase();

      const parsedSize = (() => {
        const s = reel.text_size;
        if (s === "small") return 9;
        if (s === "medium") return 18;
        if (s === "large") return 24;
        const n = Number(s);
        return n > 0 ? n : 13;
      })();

      await startExport(reel.reel_segments, {
        burnText: reel.burn_text ?? true,
        textPosition:
          (reel.text_position as "top" | "center" | "bottom") ?? "center",
        textSize: parsedSize,
        textBorder:
          (reel.text_border as "outline" | "shadow" | "box") ?? "shadow",
        textBorderColor:
          (reel.text_border_color as "black" | "white") ?? "black",
        filename: `${safeName}_reel.mp4`,
      });
    }

    setBatchExportIndex(-1);
    setBatchExportTotal(0);
    toast({
      title: `Exported ${reels.length} trial reel${reels.length !== 1 ? "s" : ""}`,
    });
  }, [batch, startExport, resetExport, toast]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground text-center py-8">
          Loading...
        </p>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <p className="text-sm text-muted-foreground text-center py-8">
          Trial batch not found.
        </p>
      </div>
    );
  }

  const isGenerating = batch.status === "generating";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Reels
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {!isGenerating && batch.reels.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportAll}
              disabled={isBatchExporting}
            >
              <Export className="h-4 w-4 mr-1" /> Export All
            </Button>
          )}
        </div>
      </div>

      {/* Title + info */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Flask className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Trial Reels</h1>
          <Badge
            variant={isGenerating ? "outline" : "secondary"}
            className="text-xs"
          >
            {isGenerating ? "Generating..." : "Ready"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Based on{" "}
          <span
            className="text-primary cursor-pointer hover:underline"
            onClick={() => navigate(`/reels/${batch.base_reel.id}`)}
          >
            {batch.base_reel.title}
          </span>
        </p>
      </div>

      {/* Batch export progress */}
      {isBatchExporting && (
        <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
          <p className="text-sm font-medium">
            Exporting reel {batchExportIndex + 1} of {batchExportTotal}...
          </p>
          <Progress
            value={Math.round((progress?.overallProgress ?? 0) * 100)}
            className="h-2"
          />
        </div>
      )}

      {/* Generating spinner */}
      {isGenerating && (
        <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
          <CircleNotch className="h-8 w-8 text-muted-foreground animate-spin" />
          <p className="text-sm text-muted-foreground">
            Generating variant reels...
          </p>
        </div>
      )}

      {/* Variant cards grid */}
      {!isGenerating && batch.reels.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 snap-x">
          {batch.reels.map((reel) => (
            <div key={reel.id} className="shrink-0 w-44 snap-start">
              <TrialVariantCard reel={reel} />
            </div>
          ))}
        </div>
      )}

      {!isGenerating && batch.reels.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No variant reels found for this batch.
        </p>
      )}
    </div>
  );
}
