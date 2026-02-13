import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useReel } from "@/hooks/use-reels";
import { useVideos } from "@/hooks/use-videos";
import { ArrowsClockwise } from "@phosphor-icons/react";
import { ReelPreviewDialog } from "@/components/ReelPreviewDialog";
import { ExportReelDialog } from "@/components/ExportReelDialog";
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
import { ArrowLeft, Play, Export } from "@phosphor-icons/react";
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
  const [showExport, setShowExport] = useState(false);

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
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExport(true)}
            disabled={reel.reel_segments.length === 0}
          >
            <Export className="h-4 w-4 mr-1" /> Export
          </Button>
          <Button
            size="sm"
            onClick={() => setShowPreview(true)}
            disabled={reel.reel_segments.length === 0}
          >
            <Play className="h-4 w-4 mr-1" /> Preview
          </Button>
        </div>
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
      {reel.reel_segments.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <p className="text-sm text-muted-foreground">
            No segments yet. Delete this reel and create a new one.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reel.reel_segments.map((segment) => {
            const dur = segment.end_seconds - segment.start_seconds;
            const maxDur = segment.video.duration_seconds
              ? Math.round((segment.video.duration_seconds - segment.start_seconds) * 10) / 10
              : dur;
            // Build duration options: 1s increments from 1s (or 2s) up to maxDur
            const durOptions: number[] = [];
            for (let d = 1; d <= Math.floor(maxDur); d++) {
              durOptions.push(d);
            }
            // Include the current duration if it's fractional and not already in the list
            const roundedDur = Math.round(dur * 10) / 10;
            if (!durOptions.includes(roundedDur) && roundedDur > 0) {
              durOptions.push(roundedDur);
              durOptions.sort((a, b) => a - b);
            }

            return (
              <div key={segment.id} className="rounded-lg border bg-card overflow-hidden">
                {/* Video thumbnail */}
                <div className="relative aspect-video bg-muted">
                  <video
                    src={`${segment.video.url}#t=${segment.start_seconds}`}
                    preload="metadata"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary" className="bg-black/60 text-white text-xs border-0">
                      #{segment.section_index + 1}
                    </Badge>
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="bg-black/60 text-white text-xs border-0">
                      {segment.start_seconds.toFixed(1)}s – {segment.end_seconds.toFixed(1)}s
                    </Badge>
                  </div>
                  {segment.score != null && (
                    <div className="absolute bottom-2 left-2">
                      <Badge variant="secondary" className="bg-black/60 text-white text-xs border-0">
                        Score: {segment.score}
                      </Badge>
                    </div>
                  )}
                  <div className="absolute bottom-2 right-2">
                    <select
                      className="bg-black/60 text-white text-xs border-0 rounded-full px-2 py-0.5 cursor-pointer outline-none appearance-none text-center"
                      value={roundedDur}
                      onChange={(e) => {
                        const newDur = parseFloat(e.target.value);
                        updateSegment({
                          segmentId: segment.id,
                          videoId: segment.video_id,
                          startSeconds: segment.start_seconds,
                          endSeconds: segment.start_seconds + newDur,
                        });
                      }}
                    >
                      {durOptions.map((d) => (
                        <option key={d} value={d}>
                          {d}s
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Content */}
                <div className="p-3 space-y-2">
                  <p className="text-sm font-medium">{segment.section_text}</p>
                  <p className="text-xs text-muted-foreground">{segment.video.filename}</p>
                  {segment.reasoning && (
                    <p className="text-xs text-muted-foreground italic">{segment.reasoning}</p>
                  )}
                  <Button variant="outline" size="sm" className="w-full" onClick={() => handleOpenSwap(segment)}>
                    <ArrowsClockwise className="h-4 w-4 mr-1" />
                    Swap Clip
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

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

      {/* Export dialog */}
      <ExportReelDialog
        open={showExport}
        onOpenChange={setShowExport}
        segments={reel.reel_segments}
        reelTitle={reel.title}
      />
    </div>
  );
}
