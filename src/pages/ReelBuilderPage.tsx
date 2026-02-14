import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
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
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { VideoThumbnail } from "@/components/VideoThumbnail";
import { ArrowLeft, Play, Export, PencilSimple, Trash } from "@phosphor-icons/react";
import type { ReelSegmentWithVideo } from "@/types/reel";
import type { Video } from "@/types/video";
import type { TextPosition, TextSize, TextBorder, TextBorderColor } from "@/lib/ffmpeg";

/** Convert legacy string sizes ("small"/"medium"/"large") to numeric preview px */
function parseTextSize(value: string | number | undefined): number {
  if (typeof value === "number") return value;
  if (value === "small") return 9;
  if (value === "large") return 24;
  if (value === "medium") return 18;
  return 9;
}

export default function ReelBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { reel, isLoading, updateSegment, isUpdating, updateSegmentText, deleteSegment, updateTitle, updateTextSettings } = useReel(id);
  const { videos } = useVideos();

  const [swapSegment, setSwapSegment] = useState<ReelSegmentWithVideo | null>(null);
  const [swapVideoId, setSwapVideoId] = useState<string>("");
  const [swapStart, setSwapStart] = useState("0");
  const [swapEnd, setSwapEnd] = useState("5");
  const [showExport, setShowExport] = useState(() => searchParams.get("export") === "true");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingTextSegId, setEditingTextSegId] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState("");
  const [editingPhrase, setEditingPhrase] = useState(false);
  const [phraseDraft, setPhraseDraft] = useState("");
  const [applyToAll, setApplyToAll] = useState(false);

  // Text overlay settings — initialized from saved reel data
  const [burnText, setBurnText] = useState(true);
  const [textPosition, setTextPosition] = useState<TextPosition>("center");
  const [textSize, setTextSize] = useState<TextSize>(13);
  const [textBorder, setTextBorder] = useState<TextBorder>("shadow");
  const [textBorderColor, setTextBorderColor] = useState<TextBorderColor>("black");
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load saved text settings from reel
  useEffect(() => {
    if (reel && !settingsLoaded) {
      setBurnText(reel.burn_text ?? true);
      setTextPosition((reel.text_position as TextPosition) ?? "center");
      setTextSize(parseTextSize(reel.text_size) ?? 13);
      setTextBorder((reel.text_border as TextBorder) ?? "shadow");
      setTextBorderColor((reel.text_border_color as TextBorderColor) ?? "black");
      setSettingsLoaded(true);
    }
  }, [reel, settingsLoaded]);

  // Save text settings when they change
  const saveTextSettings = useCallback(
    (overrides?: Partial<{
      burn_text: boolean;
      text_position: string;
      text_size: string;
      text_border: string;
      text_border_color: string;
    }>) => {
      if (!settingsLoaded) return;
      updateTextSettings({
        burn_text: burnText,
        text_position: textPosition,
        text_size: String(textSize),
        text_border: textBorder,
        text_border_color: textBorderColor,
        ...overrides,
      });
    },
    [settingsLoaded, burnText, textPosition, textSize, textBorder, textBorderColor, updateTextSettings]
  );

  // Inline preview state
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [finished, setFinished] = useState(false);

  const segments = reel?.reel_segments ?? [];
  const current = segments[currentIndex];

  // When currentIndex changes during playback, start playing the new segment
  const playingRef = useRef(false);
  playingRef.current = isPlaying;

  useEffect(() => {
    const video = videoRefs.current[currentIndex];
    const seg = segments[currentIndex];
    if (!video || !seg) return;

    // Seek past start to skip black intro frames
    video.currentTime = Math.min(seg.start_seconds + 1, seg.end_seconds - 0.1);

    if (playingRef.current) {
      video.currentTime = seg.start_seconds;
      video.play().catch(() => setIsPlaying(false));
    } else {
      // On mobile, briefly play+pause to force a frame to render
      const onSeeked = () => {
        video.play().then(() => { video.pause(); }).catch(() => {});
      };
      video.addEventListener("seeked", onSeeked, { once: true });
    }
  }, [currentIndex, segments]);

  const handlePlay = useCallback(() => {
    if (segments.length === 0) return;

    if (finished) {
      setFinished(false);
      setIsPlaying(true);
      setCurrentIndex(0);
      return;
    }

    const video = videoRefs.current[currentIndex];
    if (!video) return;
    setIsPlaying(true);
    video.play().catch(() => setIsPlaying(false));
  }, [finished, segments.length, currentIndex]);

  const handlePause = useCallback(() => {
    const video = videoRefs.current[currentIndex];
    video?.pause();
    setIsPlaying(false);
  }, [currentIndex]);

  const handleTimeUpdate = useCallback((index: number) => {
    if (index !== currentIndex) return;
    const video = videoRefs.current[index];
    const seg = segments[index];
    if (!video || !seg) return;

    if (video.currentTime >= seg.end_seconds) {
      video.pause();
      if (index < segments.length - 1) {
        setCurrentIndex(index + 1);
      } else {
        setIsPlaying(false);
        setFinished(true);
      }
    }
  }, [currentIndex, segments]);

  const jumpToSegment = useCallback((index: number) => {
    // Pause current segment
    videoRefs.current[currentIndex]?.pause();
    setCurrentIndex(index);
    setIsPlaying(false);
    setFinished(false);
  }, [currentIndex]);

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
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
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
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
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
            {segments.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-sm text-white/50">No segments</p>
              </div>
            ) : (
              segments.map((seg, i) => (
                <video
                  key={seg.id}
                  ref={(el) => { videoRefs.current[i] = el; }}
                  src={`${seg.video.url}#t=${seg.start_seconds}`}
                  className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-150 ${
                    i === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0"
                  }`}
                  playsInline
                  preload={i === currentIndex ? "auto" : "metadata"}
                  onTimeUpdate={() => handleTimeUpdate(i)}
                />
              ))
            )}

            {/* Play overlay */}
            {current && !isPlaying && (
              <div
                className="absolute inset-0 z-20 cursor-pointer"
                onClick={handlePlay}
              >
                <div className="absolute bottom-3 left-3 h-10 w-10 rounded-full bg-white/90 flex items-center justify-center">
                  <Play className="h-5 w-5 text-black ml-0.5" weight="fill" />
                </div>
              </div>
            )}

            {/* Tap to pause */}
            {isPlaying && (
              <div
                className="absolute inset-0 z-20 cursor-pointer"
                onClick={handlePause}
              />
            )}

            {/* Section text overlay */}
            {current && burnText && current.section_text && (
              <div
                className={`absolute left-0 right-0 z-20 px-3 ${
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
                    fontSize: textSize,
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

            {/* Segment progress bar */}
            {segments.length > 1 && (
              <div className="absolute bottom-0 left-0 right-0 z-20 flex h-1">
                {segments.map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 relative"
                    style={{ borderRight: i < segments.length - 1 ? "1px solid rgba(0,0,0,0.3)" : undefined }}
                  >
                    <div
                      className={`h-full transition-colors ${
                        i < currentIndex
                          ? "bg-white/80"
                          : i === currentIndex
                          ? "bg-white"
                          : "bg-white/25"
                      }`}
                    />
                  </div>
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

          {/* Phrase card — shows text for selected segment */}
          {current && (
            <div className="rounded-lg border bg-muted/50 p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Phrase
                </p>
                {segments.length > 1 && (
                  <span className="text-[10px] text-muted-foreground">
                    Segment {currentIndex + 1}/{segments.length}
                  </span>
                )}
              </div>
              {editingPhrase ? (
                <div className="space-y-2">
                  <textarea
                    autoFocus
                    className="text-sm w-full bg-transparent border rounded px-2 py-1.5 outline-none resize-none"
                    rows={2}
                    value={phraseDraft}
                    onChange={(e) => setPhraseDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") { setEditingPhrase(false); setApplyToAll(false); }
                    }}
                  />
                  <div className="flex items-center justify-between">
                    {segments.length > 1 ? (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox
                          checked={applyToAll}
                          onCheckedChange={(v) => setApplyToAll(v === true)}
                        />
                        <span className="text-xs text-muted-foreground">Apply to all segments</span>
                      </label>
                    ) : (
                      <div />
                    )}
                    <div className="flex gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => { setEditingPhrase(false); setApplyToAll(false); }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => {
                          const trimmed = phraseDraft.trim();
                          if (applyToAll) {
                            segments.forEach((seg) => {
                              if (seg.section_text !== trimmed) {
                                updateSegmentText({ segmentId: seg.id, text: trimmed });
                              }
                            });
                          } else if (trimmed !== current.section_text) {
                            updateSegmentText({ segmentId: current.id, text: trimmed });
                          }
                          setEditingPhrase(false);
                          setApplyToAll(false);
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="flex items-start gap-1 cursor-pointer group/phrase"
                  onClick={() => {
                    setPhraseDraft(current.section_text);
                    setEditingPhrase(true);
                  }}
                >
                  <p className="text-sm whitespace-pre-line flex-1">
                    {current.section_text || <span className="text-muted-foreground italic">Add text...</span>}
                  </p>
                  <PencilSimple className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover/phrase:opacity-100 transition-opacity mt-0.5" />
                </div>
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
                onCheckedChange={(v) => { setBurnText(v); saveTextSettings({ burn_text: v }); }}
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
                        onClick={() => { setTextPosition(opt.value); saveTextSettings({ text_position: opt.value }); }}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Font size</Label>
                  <div className="flex items-center gap-2 h-7">
                    <span className="text-[10px] text-muted-foreground">A</span>
                    <Slider
                      min={9}
                      max={24}
                      step={1}
                      value={[textSize]}
                      onValueChange={([v]) => { setTextSize(v); saveTextSettings({ text_size: String(v) }); }}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium text-muted-foreground">A</span>
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
                        onClick={() => { setTextBorder(opt.value); saveTextSettings({ text_border: opt.value }); }}
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
                          onClick={() => { setTextBorderColor(opt.value); saveTextSettings({ text_border_color: opt.value }); }}
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
          <div className="flex gap-3 overflow-x-auto py-1 -my-1 pb-3 -mx-4 px-4 snap-x">
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
                  className={`shrink-0 w-44 rounded-lg border bg-card cursor-pointer transition-colors snap-start ${
                    isActive ? "ring-2 ring-primary" : "hover:border-primary/50"
                  }`}
                  onClick={() => jumpToSegment(idx)}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-[9/16] overflow-hidden rounded-t-lg">
                    <VideoThumbnail
                      src={`${segment.video.url}#t=${segment.start_seconds}`}
                      thumbnailUrl={segment.video.thumbnail_url}
                      className="w-full h-full"
                      iconSize="sm"
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
                    {editingTextSegId === segment.id ? (
                      <textarea
                        autoFocus
                        className="text-xs font-medium leading-snug w-full bg-muted border rounded px-2 py-1.5 outline-none resize-none"
                        rows={2}
                        value={textDraft}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setTextDraft(e.target.value)}
                        onBlur={() => {
                          const trimmed = textDraft.trim();
                          if (trimmed !== segment.section_text) {
                            updateSegmentText({ segmentId: segment.id, text: trimmed });
                          }
                          setEditingTextSegId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); }
                          if (e.key === "Escape") setEditingTextSegId(null);
                        }}
                      />
                    ) : (
                      <div
                        className="flex items-start gap-1 rounded bg-muted/50 border border-transparent hover:border-border px-2 py-1.5 cursor-pointer transition-colors group/text"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTextDraft(segment.section_text);
                          setEditingTextSegId(segment.id);
                        }}
                      >
                        <p className="text-xs font-medium leading-snug line-clamp-2 flex-1">
                          {segment.section_text || <span className="text-muted-foreground italic">Add text...</span>}
                        </p>
                        <PencilSimple className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover/text:opacity-100 transition-opacity mt-0.5" />
                      </div>
                    )}
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
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-5 text-[10px] px-1.5 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (segments.length <= 1) return;
                          deleteSegment(segment.id).then(() => {
                            if (currentIndex >= segments.length - 1 && currentIndex > 0) {
                              setCurrentIndex(currentIndex - 1);
                            }
                          });
                        }}
                        disabled={segments.length <= 1}
                        title={segments.length <= 1 ? "Can't delete the only segment" : "Delete segment"}
                      >
                        <Trash className="h-3 w-3" />
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
        <DialogContent>
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
