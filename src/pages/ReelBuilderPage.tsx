import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useReel } from "@/hooks/use-reels";
import { useVideos } from "@/hooks/use-videos";
import { ArrowsClockwise } from "@phosphor-icons/react";
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
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Play, Export } from "@phosphor-icons/react";
import type { ReelSegmentWithVideo } from "@/types/reel";
import type { Video } from "@/types/video";
import type { TextPosition, TextSize, TextBorder, TextBorderColor } from "@/lib/ffmpeg";

export default function ReelBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { reel, isLoading, updateSegment, isUpdating, updateTitle } = useReel(id);
  const { videos } = useVideos();

  const [swapSegment, setSwapSegment] = useState<ReelSegmentWithVideo | null>(null);
  const [swapVideoId, setSwapVideoId] = useState<string>("");
  const [swapStart, setSwapStart] = useState("0");
  const [swapEnd, setSwapEnd] = useState("5");
  const [showExport, setShowExport] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  // Text overlay settings
  const [burnText, setBurnText] = useState(true);
  const [textPosition, setTextPosition] = useState<TextPosition>("center");
  const [textSize, setTextSize] = useState<TextSize>("small");
  const [textBorder, setTextBorder] = useState<TextBorder>("shadow");
  const [textBorderColor, setTextBorderColor] = useState<TextBorderColor>("black");

  // Inline preview state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [videoKey, setVideoKey] = useState(0);

  const segments = reel?.reel_segments ?? [];
  const current = segments[currentIndex];

  // Force remount video when segment changes
  const prevIndex = useRef(0);
  useEffect(() => {
    if (prevIndex.current !== currentIndex) {
      setVideoKey((k) => k + 1);
    }
    prevIndex.current = currentIndex;
  }, [currentIndex]);

  const handlePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || segments.length === 0) return;

    if (finished) {
      setFinished(false);
      setIsPlaying(true);
      setCurrentIndex(0);
      return;
    }

    setIsPlaying(true);
    video.play().catch(() => setIsPlaying(false));
  }, [finished, segments.length]);

  const handlePause = useCallback(() => {
    videoRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    const seg = segments[currentIndex];
    if (!video || !seg) return;

    if (video.currentTime >= seg.end_seconds) {
      video.pause();
      if (currentIndex < segments.length - 1) {
        setIsPlaying(true);
        setCurrentIndex((i) => i + 1);
      } else {
        setIsPlaying(false);
        setFinished(true);
      }
    }
  }, [currentIndex, segments]);

  const handleLoadedData = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.play().catch(() => setIsPlaying(false));
    }
  }, [isPlaying]);

  const jumpToSegment = useCallback((index: number) => {
    setCurrentIndex(index);
    setIsPlaying(false);
    setFinished(false);
  }, []);

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
            onClick={handlePlay}
            disabled={reel.reel_segments.length === 0}
          >
            <Play className="h-4 w-4 mr-1" /> Preview
          </Button>
        </div>
      </div>

      {/* Top row: Preview + details side by side */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Preview player */}
        <div className="shrink-0 md:w-64 lg:w-72">
          <div className="relative rounded-lg border bg-black aspect-[9/16] overflow-hidden">
            {current ? (
              <video
                key={videoKey}
                ref={videoRef}
                src={`${current.video.url}#t=${current.start_seconds}`}
                className="w-full h-full object-contain"
                playsInline
                preload="auto"
                onLoadedData={handleLoadedData}
                onTimeUpdate={handleTimeUpdate}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-sm text-white/50">No segments</p>
              </div>
            )}

            {/* Play overlay */}
            {current && !isPlaying && (
              <div
                className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
                onClick={handlePlay}
              >
                <div className="h-14 w-14 rounded-full bg-white/90 flex items-center justify-center">
                  <Play className="h-7 w-7 text-black ml-0.5" weight="fill" />
                </div>
              </div>
            )}

            {/* Tap to pause */}
            {isPlaying && (
              <div
                className="absolute inset-0 cursor-pointer"
                onClick={handlePause}
              />
            )}

            {/* Section text overlay */}
            {current && burnText && current.section_text && (
              <div
                className={`absolute left-0 right-0 px-3 ${
                  textPosition === "top"
                    ? "top-[15%]"
                    : textPosition === "center"
                    ? "top-1/2 -translate-y-1/2"
                    : "bottom-[15%]"
                }`}
              >
                <p
                  className="text-white font-semibold text-center whitespace-pre-line"
                  style={{
                    fontSize:
                      textSize === "small" ? 12 : textSize === "large" ? 24 : 18,
                    ...(textBorder === "outline"
                      ? {
                          WebkitTextStroke: `0.8px ${textBorderColor}`,
                          textShadow: `0 0 2px ${textBorderColor}`,
                        }
                      : textBorder === "shadow"
                      ? {
                          textShadow: "1px 1px 3px rgba(0,0,0,0.5)",
                        }
                      : {
                          background: `${textBorderColor === "black" ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.35)"}`,
                          padding: "4px 10px",
                          borderRadius: 6,
                          display: "inline",
                          boxDecorationBreak: "clone" as const,
                        }),
                  }}
                >
                  {current.section_text}
                </p>
              </div>
            )}

            {/* Progress dots */}
            {segments.length > 0 && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
                {segments.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full transition-colors cursor-pointer ${
                      i === currentIndex
                        ? "bg-white"
                        : i < currentIndex
                        ? "bg-white/60"
                        : "bg-white/30"
                    }`}
                    onClick={() => jumpToSegment(i)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Details + text controls */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Title + badges */}
          <div className="space-y-1">
            {editingTitle ? (
              <input
                autoFocus
                className="text-lg font-semibold bg-transparent border-b border-primary outline-none w-full"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => {
                  const trimmed = titleDraft.trim();
                  if (trimmed && trimmed !== reel.title) updateTitle(trimmed);
                  setEditingTitle(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") { setEditingTitle(false); }
                }}
              />
            ) : (
              <h1
                className="text-lg font-semibold truncate cursor-pointer hover:text-primary/80 transition-colors"
                onClick={() => { setTitleDraft(reel.title); setEditingTitle(true); }}
                title="Click to edit"
              >
                {reel.title}
              </h1>
            )}
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-xs">
                {reel.reel_segments.length} segments
              </Badge>
              <Badge variant="outline" className="text-xs">
                {Math.round(totalDuration)}s / {reel.target_duration_seconds}s target
              </Badge>
            </div>
          </div>

          {/* Phrase card */}
          {reel.phrase && (
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Phrase
              </p>
              <p className="text-sm whitespace-pre-line">{reel.phrase.text}</p>
            </div>
          )}

          {/* Cloned template card */}
          {reel.source_template && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Cloned Template
              </p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  {reel.source_template.segmentCount} template segments
                </Badge>
                <Badge variant="outline" className="text-xs capitalize">
                  {reel.source_template.overallPacing}
                </Badge>
                <Badge variant="outline" className="text-xs capitalize">
                  {reel.source_template.overallMood}
                </Badge>
              </div>
              {reel.source_template.visualStyleNotes && (
                <p className="text-xs text-muted-foreground">
                  {reel.source_template.visualStyleNotes}
                </p>
              )}
            </div>
          )}

          {/* Text overlay controls */}
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="burn-text-preview" className="text-sm font-medium">
                Text overlay
              </Label>
              <Switch
                id="burn-text-preview"
                checked={burnText}
                onCheckedChange={setBurnText}
              />
            </div>

            {burnText && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Position</Label>
                  <div className="flex gap-1">
                    {([
                      { value: "top", label: "Top" },
                      { value: "center", label: "Mid" },
                      { value: "bottom", label: "Bot" },
                    ] as const).map((opt) => (
                      <Button
                        key={opt.value}
                        variant={textPosition === opt.value ? "default" : "outline"}
                        size="sm"
                        className="flex-1 h-7 text-xs px-1"
                        onClick={() => setTextPosition(opt.value)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Font size</Label>
                  <div className="flex gap-1">
                    {([
                      { value: "small", label: "S" },
                      { value: "medium", label: "M" },
                      { value: "large", label: "L" },
                    ] as const).map((opt) => (
                      <Button
                        key={opt.value}
                        variant={textSize === opt.value ? "default" : "outline"}
                        size="sm"
                        className="flex-1 h-7 text-xs px-1"
                        onClick={() => setTextSize(opt.value)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Border style</Label>
                  <div className="flex gap-1">
                    {([
                      { value: "outline", label: "Outline" },
                      { value: "shadow", label: "Shadow" },
                      { value: "box", label: "Box" },
                    ] as const).map((opt) => (
                      <Button
                        key={opt.value}
                        variant={textBorder === opt.value ? "default" : "outline"}
                        size="sm"
                        className="flex-1 h-7 text-xs px-1"
                        onClick={() => setTextBorder(opt.value)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {textBorder !== "shadow" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Border color</Label>
                    <div className="flex gap-1">
                      {([
                        { value: "black", label: "Black" },
                        { value: "white", label: "White" },
                      ] as const).map((opt) => (
                        <Button
                          key={opt.value}
                          variant={textBorderColor === opt.value ? "default" : "outline"}
                          size="sm"
                          className="flex-1 h-7 text-xs px-1"
                          onClick={() => setTextBorderColor(opt.value)}
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Segment strip — horizontal scroll */}
      {reel.reel_segments.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            No segments yet. Delete this reel and create a new one.
          </p>
        </div>
      ) : (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Segments
          </p>
          <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 snap-x">
            {reel.reel_segments.map((segment, idx) => {
              const dur = segment.end_seconds - segment.start_seconds;
              const maxDur = segment.video.duration_seconds
                ? Math.round((segment.video.duration_seconds - segment.start_seconds) * 10) / 10
                : dur;
              const durOptions: number[] = [];
              for (let d = 1; d <= Math.floor(maxDur); d++) {
                durOptions.push(d);
              }
              const roundedDur = Math.round(dur * 10) / 10;
              if (!durOptions.includes(roundedDur) && roundedDur > 0) {
                durOptions.push(roundedDur);
                durOptions.sort((a, b) => a - b);
              }

              const isActive = idx === currentIndex;

              return (
                <div
                  key={segment.id}
                  className={`shrink-0 w-44 rounded-lg border bg-card overflow-hidden cursor-pointer transition-colors snap-start ${
                    isActive ? "ring-2 ring-primary" : "hover:border-primary/50"
                  }`}
                  onClick={() => jumpToSegment(idx)}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-[9/16] bg-muted">
                    <video
                      src={`${segment.video.url}#t=${segment.start_seconds}`}
                      preload="metadata"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1.5 left-1.5">
                      <Badge variant="secondary" className="bg-black/60 text-white text-[10px] border-0 px-1.5 py-0">
                        #{segment.section_index + 1}
                      </Badge>
                    </div>
                    <div className="absolute top-1.5 right-1.5">
                      <Badge variant="secondary" className="bg-black/60 text-white text-[10px] border-0 px-1.5 py-0">
                        {roundedDur}s
                      </Badge>
                    </div>
                    {segment.score != null && (
                      <div className="absolute bottom-1.5 left-1.5">
                        <Badge variant="secondary" className="bg-black/60 text-white text-[10px] border-0 px-1.5 py-0">
                          {segment.score}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-2 space-y-1.5">
                    <p className="text-xs font-medium leading-snug line-clamp-2">{segment.section_text}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{segment.video.filename}</p>
                    <div className="flex gap-1.5">
                      <div className="flex-1" onClick={(e) => e.stopPropagation()}>
                        <select
                          className="w-full bg-muted text-[10px] border rounded px-1 py-0.5 cursor-pointer outline-none"
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
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-5 text-[10px] px-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenSwap(segment);
                        }}
                      >
                        <ArrowsClockwise className="h-3 w-3 mr-0.5" />
                        Swap
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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

      {/* Export dialog */}
      <ExportReelDialog
        open={showExport}
        onOpenChange={setShowExport}
        segments={reel.reel_segments}
        reelTitle={reel.title}
        burnText={burnText}
        onBurnTextChange={setBurnText}
        textPosition={textPosition}
        textSize={textSize}
        textBorder={textBorder}
        textBorderColor={textBorderColor}
      />
    </div>
  );
}
