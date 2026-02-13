import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useReel } from "@/hooks/use-reels";
import { useVideos } from "@/hooks/use-videos";
import { SegmentCard } from "@/components/SegmentCard";
import { ReelPreviewDialog } from "@/components/ReelPreviewDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, Play } from "@phosphor-icons/react";
import type { ReelSegmentWithVideo } from "@/types/reel";
import type { Video } from "@/types/video";

export default function ReelBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { reel, isLoading, updateSegment, isUpdating } = useReel(id);
  const { videos } = useVideos();

  const [swapSegment, setSwapSegment] = useState<ReelSegmentWithVideo | null>(null);
  const [swapVideoId, setSwapVideoId] = useState<string>("");
  const [swapStart, setSwapStart] = useState("0");
  const [swapEnd, setSwapEnd] = useState("5");
  const [showPreview, setShowPreview] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground text-center py-8">
          Loading...
        </p>
      </div>
    );
  }

  if (!reel) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/reels")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <p className="text-sm text-muted-foreground text-center py-8">
          Reel not found.
        </p>
      </div>
    );
  }

  const totalDuration = reel.reel_segments.reduce(
    (sum, seg) => sum + (seg.end_seconds - seg.start_seconds),
    0
  );

  const handleOpenSwap = (segment: ReelSegmentWithVideo) => {
    setSwapSegment(segment);
    setSwapVideoId(segment.video_id);
    setSwapStart(segment.start_seconds.toString());
    setSwapEnd(segment.end_seconds.toString());
  };

  const handleConfirmSwap = async () => {
    if (!swapSegment) return;
    await updateSegment({
      segmentId: swapSegment.id,
      videoId: swapVideoId,
      startSeconds: parseFloat(swapStart) || 0,
      endSeconds: parseFloat(swapEnd) || 5,
    });
    setSwapSegment(null);
  };

  const selectedSwapVideo = videos.find((v) => v.id === swapVideoId);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/reels")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Reels
        </Button>
        <Button size="sm" onClick={() => setShowPreview(true)}>
          <Play className="h-4 w-4 mr-1" /> Preview
        </Button>
      </div>

      {/* Reel info */}
      <div>
        <h1 className="text-lg font-semibold">{reel.title}</h1>
        <div className="flex gap-2 mt-1">
          <Badge variant="secondary" className="text-xs">
            {reel.reel_segments.length} segments
          </Badge>
          <Badge variant="outline" className="text-xs">
            {Math.round(totalDuration)}s / {reel.target_duration_seconds}s target
          </Badge>
        </div>
      </div>

      {/* Phrase card */}
      <div className="rounded-lg border bg-muted/50 p-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
          Phrase
        </p>
        <p className="text-sm whitespace-pre-line">{reel.phrase?.text}</p>
      </div>

      {/* Segment list */}
      <div className="space-y-3">
        {reel.reel_segments.map((segment) => (
          <SegmentCard
            key={segment.id}
            segment={segment}
            onSwap={() => handleOpenSwap(segment)}
          />
        ))}
      </div>

      {/* Swap dialog */}
      <Dialog
        open={swapSegment !== null}
        onOpenChange={(open) => !open && setSwapSegment(null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Swap Clip</DialogTitle>
            <DialogDescription>
              Section {(swapSegment?.section_index ?? 0) + 1}: "
              {swapSegment?.section_text}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Video selection */}
            <div className="space-y-2">
              <Label>Select Video</Label>
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {videos.map((v: Video) => (
                  <div
                    key={v.id}
                    className={`relative rounded-lg border overflow-hidden cursor-pointer transition-colors ${
                      swapVideoId === v.id
                        ? "ring-2 ring-primary"
                        : "hover:border-primary/50"
                    }`}
                    onClick={() => {
                      setSwapVideoId(v.id);
                      setSwapStart("0");
                      setSwapEnd(
                        v.duration_seconds
                          ? Math.min(5, v.duration_seconds).toString()
                          : "5"
                      );
                    }}
                  >
                    <video
                      src={v.url}
                      preload="metadata"
                      className="w-full aspect-[9/16] object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1 pb-0.5 pt-3">
                      <p className="text-[9px] text-white truncate">
                        {v.filename}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Time range */}
            {selectedSwapVideo && (
              <div className="space-y-2">
                <Label>Time Range</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max={selectedSwapVideo.duration_seconds ?? 999}
                      value={swapStart}
                      onChange={(e) => setSwapStart(e.target.value)}
                      placeholder="Start"
                    />
                    <p className="text-xs text-muted-foreground mt-0.5">Start (s)</p>
                  </div>
                  <span className="text-muted-foreground">–</span>
                  <div className="flex-1">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max={selectedSwapVideo.duration_seconds ?? 999}
                      value={swapEnd}
                      onChange={(e) => setSwapEnd(e.target.value)}
                      placeholder="End"
                    />
                    <p className="text-xs text-muted-foreground mt-0.5">End (s)</p>
                  </div>
                </div>
                {selectedSwapVideo.duration_seconds && (
                  <p className="text-xs text-muted-foreground">
                    Video duration: {selectedSwapVideo.duration_seconds.toFixed(1)}s
                  </p>
                )}
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleConfirmSwap}
              disabled={!swapVideoId || isUpdating}
            >
              {isUpdating ? "Updating..." : "Confirm Swap"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <ReelPreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        segments={reel.reel_segments}
      />
    </div>
  );
}
