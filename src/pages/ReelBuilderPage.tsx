import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useReel } from "@/hooks/use-reels";
import { useVideos } from "@/hooks/use-videos";
import { useVoiceProfile } from "@/hooks/use-voice-profile";
import { supabase } from "@/lib/supabase";
import { ArrowsClockwise } from "@phosphor-icons/react";
import { useGenerateTrialReels, useTrialBatchesForReel, useTrialBatch, useDeleteTrialBatch, useRegenerateVariant } from "@/hooks/use-trial-reels";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TrialReelDialog } from "@/components/TrialReelDialog";
import { TrialVariantCard } from "@/components/TrialVariantCard";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { VideoThumbnail } from "@/components/VideoThumbnail";
import { ArrowLeft, Play, Export, PencilSimple, Trash, Sparkle, Copy, Check, X, Flask, MusicNote, CaretLeft, CaretRight, CircleNotch, Plus } from "@phosphor-icons/react";
import type { TrialVariantType } from "@/types/trial";
import type { ReelSegmentWithVideo } from "@/types/reel";
import type { Video } from "@/types/video";
import type { TextPosition, TextSize, TextBorder, TextBorderColor, TextColor } from "@/lib/ffmpeg";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const VARIANT_COLORS: Record<TrialVariantType, string> = {
  text: "bg-purple-500/15 text-purple-700 border-purple-500/30",
  visual: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  audio: "bg-orange-500/15 text-orange-700 border-orange-500/30",
};

/** Convert legacy string sizes ("small"/"medium"/"large") or old px values to percentage of container width */
function parseTextSize(value: string | number | undefined): number {
  if (value === "small") return 3;
  if (value === "large") return 7;
  if (value === "medium") return 4.5;
  const num = typeof value === "number" ? value : parseFloat(value ?? "");
  if (isNaN(num) || num <= 0) return 4.5;
  // Old px-based values were 9–24; new percentage values are 2.5–8.
  // If > 8, it's a legacy px value — convert by mapping 9–24 → 2.5–8
  if (num > 8) return Math.min(8, Math.max(2.5, 2.5 + ((num - 9) / (24 - 9)) * (8 - 2.5)));
  return num;
}

function parseTextWidth(value: string | number | undefined): number {
  const num = typeof value === "number" ? value : parseInt(value ?? "", 10);
  if (isNaN(num) || num <= 0) return 100;
  return Math.min(100, Math.max(40, num));
}

function parseTextShadowIntensity(value: string | number | undefined): number {
  const num = typeof value === "number" ? value : parseInt(value ?? "", 10);
  if (isNaN(num) || num <= 0) return 5;
  return Math.min(10, Math.max(1, num));
}

export default function ReelBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { reel, isLoading, updateSegment, isUpdating, updateSegmentText, deleteSegment, updateTitle, updateTextSettings, updateSavedCaptions, addSegment, isAdding, reorderSegments } = useReel(id);
  const { videos } = useVideos();
  const { profile: voiceProfile } = useVoiceProfile();
  const generateTrialReels = useGenerateTrialReels();
  const { data: trialBatches } = useTrialBatchesForReel(id);
  const { data: parentBatch } = useTrialBatch(reel?.trial_batch_id ?? undefined);
  const deleteTrialBatch = useDeleteTrialBatch();
  const regenerateVariant = useRegenerateVariant();

  const [swapSegment, setSwapSegment] = useState<ReelSegmentWithVideo | null>(null);
  const [swapVideoId, setSwapVideoId] = useState<string>("");
  const [swapSuggesting, setSwapSuggesting] = useState(false);
  const [swapSearch, setSwapSearch] = useState("");
  const [showExport, setShowExport] = useState(() => searchParams.get("export") === "true");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingTextSegId, setEditingTextSegId] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState("");
  const [findingBestSegId, setFindingBestSegId] = useState<string | null>(null);
  const [editingPhrase, setEditingPhrase] = useState(false);
  const [phraseDraft, setPhraseDraft] = useState("");
  const [applyToAll, setApplyToAll] = useState(false);

  // Text overlay settings — initialized from saved reel data
  const [burnText, setBurnText] = useState(true);
  const [textPosition, setTextPosition] = useState<TextPosition>("center");
  const [textSize, setTextSize] = useState<TextSize>(4.5);
  const [textBorder, setTextBorder] = useState<TextBorder>("shadow");
  const [textBorderColor, setTextBorderColor] = useState<TextBorderColor>("black");
  const [textColor, setTextColor] = useState<TextColor>("white");
  const [textWidth, setTextWidth] = useState<number>(100);
  const [textShadowIntensity, setTextShadowIntensity] = useState<number>(5);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Text-overlay generation (short on-screen words burned onto the clip)
  const [generatingOverlay, setGeneratingOverlay] = useState(false);
  const [overlayError, setOverlayError] = useState<string | null>(null);

  // Caption generation (Instagram post caption + hashtags)
  const CAPTION_MOODS = ["confident", "chill", "emotional", "playful", "edgy"] as const;
  const CAPTION_TONES = ["casual", "witty", "inspirational", "storytelling", "minimal"] as const;
  const CAPTION_TENSES = ["timeless", "past", "reflective", "any"] as const;
  const [captionMood, setCaptionMood] = useState<string>("playful");
  const [captionTone, setCaptionTone] = useState<string>("casual");
  const [captionTense, setCaptionTense] = useState<string>("timeless");
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [captionError, setCaptionError] = useState<string | null>(null);
  const [matchVoice, setMatchVoice] = useState(true);
  const [editingCaption, setEditingCaption] = useState(false);
  const [capTextDraft, setCapTextDraft] = useState("");
  const [capTagsDraft, setCapTagsDraft] = useState("");
  const [copiedCap, setCopiedCap] = useState<number | null>(null);

  // Add clip state
  const [showAddClip, setShowAddClip] = useState(false);
  const [addClipVideoId, setAddClipVideoId] = useState("");
  const [addClipDuration, setAddClipDuration] = useState("3");
  const [addClipText, setAddClipText] = useState("");
  const [addClipSuggesting, setAddClipSuggesting] = useState(false);
  const [addClipSearch, setAddClipSearch] = useState("");

  // Trial reels state
  const [showTrialConfirm, setShowTrialConfirm] = useState(false);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);

  // Load saved text settings from reel
  useEffect(() => {
    if (reel && !settingsLoaded) {
      setBurnText(reel.burn_text ?? true);
      setTextPosition((reel.text_position as TextPosition) ?? "center");
      setTextSize(parseTextSize(reel.text_size));
      setTextBorder((reel.text_border as TextBorder) ?? "shadow");
      setTextBorderColor((reel.text_border_color as TextBorderColor) ?? "black");
      setTextColor(reel.text_color ?? "white");
      setTextWidth(parseTextWidth(reel.text_width));
      setTextShadowIntensity(parseTextShadowIntensity(reel.text_shadow_intensity));
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
      text_color: string;
      text_width: string;
      text_shadow_intensity: string;
    }>) => {
      if (!settingsLoaded) return;
      updateTextSettings({
        burn_text: burnText,
        text_position: textPosition,
        text_size: String(textSize),
        text_border: textBorder,
        text_border_color: textBorderColor,
        text_color: textColor,
        text_width: String(textWidth),
        text_shadow_intensity: String(textShadowIntensity),
        ...overrides,
      });
    },
    [settingsLoaded, burnText, textPosition, textSize, textBorder, textBorderColor, textColor, textWidth, textShadowIntensity, updateTextSettings]
  );

  // Inline preview state
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [finished, setFinished] = useState(false);

  const segments = reel?.reel_segments ?? [];
  const current = segments[currentIndex];
  const currentVideo = current ? videos.find((v) => v.id === current.video_id) : undefined;
  const segmentIds = useMemo(() => segments.map((s) => s.id), [segments]);

  // --- Text overlay (short on-screen words) ---
  // Draft the best short overlay text from the clip's analysis, write it onto the
  // clip, and open the inline editor so the user can refine it.
  const generateOverlayText = async () => {
    if (!current || !currentVideo?.analysis) return;
    setGeneratingOverlay(true);
    setOverlayError(null);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-text", {
        body: { analysis: currentVideo.analysis, filename: currentVideo.filename, length: "short", style: "auto" },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      const suggestions = (data.suggestions ?? []) as { text: string; confidence?: number }[];
      const best = suggestions.slice().sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
      if (!best) throw new Error("No text returned");
      const text = best.text.replace(/\\n/g, "\n");
      updateSegmentText({ segmentId: current.id, text });
      setPhraseDraft(text);
      setEditingPhrase(true);
    } catch (err) {
      setOverlayError(err instanceof Error ? err.message : "Failed to generate text");
    } finally {
      setGeneratingOverlay(false);
    }
  };

  // --- Caption (IG post caption + hashtags), persisted on reel.saved_captions ---
  const savedCaptions = reel?.saved_captions ?? [];
  const primaryCaptionIdx = (() => {
    const i = savedCaptions.findIndex((c) => c.selected);
    return i >= 0 ? i : savedCaptions.length ? 0 : -1;
  })();
  const altCaptions = savedCaptions
    .map((c, i) => ({ c, i }))
    .filter(({ i }) => i !== primaryCaptionIdx)
    .slice(0, 3);

  const generateCaptions = async () => {
    setGeneratingCaption(true);
    setCaptionError(null);
    try {
      const segmentData = segments.map((seg) => {
        const fv = videos.find((v) => v.id === seg.video_id);
        return { section_text: seg.section_text, analysis: fv?.analysis ?? null };
      });
      const { data, error } = await supabase.functions.invoke("generate-caption", {
        body: {
          mood: captionMood,
          tone: captionTone,
          tense: captionTense,
          segments: segmentData,
          matchVoice: matchVoice && !!voiceProfile?.text,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      const incoming = (data.captions ?? []) as { text: string; hashtags?: string[] }[];
      const existing = new Set(savedCaptions.map((c) => c.text));
      const additions = incoming
        .filter((c) => c.text && !existing.has(c.text))
        .map((c) => ({ text: c.text, hashtags: c.hashtags ?? [] }));
      if (!additions.length) return;
      const selectNone = !savedCaptions.some((c) => c.selected);
      let next = [...savedCaptions, ...additions];
      if (selectNone) {
        const firstNew = additions[0].text;
        next = next.map((c) => ({ ...c, selected: c.text === firstNew }));
      }
      updateSavedCaptions(next);
    } catch (err) {
      setCaptionError(err instanceof Error ? err.message : "Failed to generate captions");
    } finally {
      setGeneratingCaption(false);
    }
  };
  const selectCaption = (idx: number) =>
    updateSavedCaptions(savedCaptions.map((c, i) => ({ ...c, selected: i === idx })));
  const removeCaption = (idx: number) => {
    if (editingCaption && idx === primaryCaptionIdx) setEditingCaption(false);
    updateSavedCaptions(savedCaptions.filter((_, i) => i !== idx));
  };
  const startEditCaption = () => {
    const c = savedCaptions[primaryCaptionIdx];
    if (!c) return;
    setCapTextDraft(c.text);
    setCapTagsDraft((c.hashtags ?? []).join(" "));
    setEditingCaption(true);
  };
  const saveCaptionEdit = () => {
    const tags = capTagsDraft.split(/[\s,]+/).map((t) => t.replace(/^#/, "").trim()).filter(Boolean);
    updateSavedCaptions(
      savedCaptions.map((c, i) => (i === primaryCaptionIdx ? { ...c, text: capTextDraft.trim(), hashtags: tags } : c))
    );
    setEditingCaption(false);
  };
  const copyCaption = async (text: string, hashtags: string[], key: number) => {
    const formatted = hashtags.length ? `${text}\n\n${hashtags.map((t) => `#${t}`).join(" ")}` : text;
    await navigator.clipboard.writeText(formatted);
    setCopiedCap(key);
    setTimeout(() => setCopiedCap(null), 2000);
  };

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = segments.findIndex((s) => s.id === active.id);
      const newIndex = segments.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = [...segments];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);

      // Update currentIndex to follow the segment that was active
      if (currentIndex === oldIndex) {
        setCurrentIndex(newIndex);
      } else if (oldIndex < currentIndex && newIndex >= currentIndex) {
        setCurrentIndex(currentIndex - 1);
      } else if (oldIndex > currentIndex && newIndex <= currentIndex) {
        setCurrentIndex(currentIndex + 1);
      }

      reorderSegments(reordered.map((s) => s.id));
    },
    [segments, currentIndex, reorderSegments]
  );

  // When currentIndex changes during playback, start playing the new segment
  const playingRef = useRef(false);
  playingRef.current = isPlaying;

  useEffect(() => {
    const video = videoRefs.current[currentIndex];
    const seg = segments[currentIndex];
    if (!video || !seg) return;

    // Seek slightly past start to skip any black intro frame
    const safeStart = Math.min(seg.start_seconds + 0.1, seg.end_seconds - 0.05);
    video.currentTime = safeStart;

    if (playingRef.current) {
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

  const handleFindBest = async (segment: ReelSegmentWithVideo) => {
    if (findingBestSegId) return;
    setFindingBestSegId(segment.id);
    try {
      const clipDur = Math.round((segment.end_seconds - segment.start_seconds) * 10) / 10;
      const videoDur = segment.video.duration_seconds ?? clipDur;

      const { data, error } = await supabase.functions.invoke("analyze-video", {
        body: { videoUrl: segment.video.url, mimeType: "video/mp4" },
      });

      if (error) throw error;
      let parsed = data;
      if (typeof data === "string") parsed = JSON.parse(data);
      if (parsed.error) throw new Error(parsed.error);

      const analysis = parsed.analysis;
      const segments: Array<{ startSeconds: number; endSeconds: number; description: string }> =
        analysis?.segments ?? [];

      // Find the segment window with the most action/movement
      // Score each possible window by how many analyzed segments overlap it
      let bestStart = segment.start_seconds;
      let bestScore = -1;

      const step = 0.5;
      for (let s = 0; s <= videoDur - clipDur; s = Math.round((s + step) * 10) / 10) {
        const e = s + clipDur;
        let score = 0;
        for (const seg of segments) {
          // Calculate overlap
          const overlapStart = Math.max(s, seg.startSeconds);
          const overlapEnd = Math.min(e, seg.endSeconds);
          if (overlapEnd > overlapStart) {
            score += overlapEnd - overlapStart;
            // Bonus for segments with descriptions suggesting movement
            const desc = (seg.description || "").toLowerCase();
            if (/walk|run|move|danc|jump|turn|pan|zoom|action|dynamic/.test(desc)) {
              score += (overlapEnd - overlapStart) * 0.5;
            }
          }
        }
        if (score > bestScore) {
          bestScore = score;
          bestStart = s;
        }
      }

      const newStart = Math.round(bestStart * 10) / 10;
      const newEnd = Math.round((bestStart + clipDur) * 10) / 10;

      if (newStart !== segment.start_seconds || newEnd !== segment.end_seconds) {
        await updateSegment({
          segmentId: segment.id,
          videoId: segment.video_id,
          startSeconds: newStart,
          endSeconds: newEnd,
        });
      }
    } catch (err) {
      console.error("Find best moment failed:", err);
    } finally {
      setFindingBestSegId(null);
    }
  };

  const handleOpenSwap = (segment: ReelSegmentWithVideo) => {
    setSwapSegment(segment);
    setSwapVideoId(segment.video_id);
    setSwapSearch("");
  };

  const handleConfirmSwap = async () => {
    if (!swapSegment) return;
    const segDuration = swapSegment.end_seconds - swapSegment.start_seconds;
    const newVideo = videos.find((v) => v.id === swapVideoId);
    const maxEnd = newVideo?.duration_seconds ?? segDuration;
    const end = Math.min(segDuration, maxEnd);
    await updateSegment({
      segmentId: swapSegment.id,
      videoId: swapVideoId,
      startSeconds: 0,
      endSeconds: Math.round(end * 10) / 10,
    });
    setSwapSegment(null);
  };

  const handleSuggestSwap = async () => {
    if (!swapSegment || swapSuggesting) return;
    setSwapSuggesting(true);
    try {
      const segDuration = swapSegment.end_seconds - swapSegment.start_seconds;
      const analysis = swapSegment.video.analysis as Record<string, unknown> | null;

      const template = {
        totalDurationSeconds: segDuration,
        segmentCount: 1,
        segments: [{
          index: 0,
          startSeconds: 0,
          endSeconds: segDuration,
          durationSeconds: segDuration,
          textOverlay: swapSegment.section_text || null,
          mood: (analysis?.mood as string) || "neutral",
          energy: (analysis?.energy as string) || "medium",
          visualDescription: (analysis?.visuals as string) || "",
        }],
        overallMood: (analysis?.mood as string) || "neutral",
        overallEnergy: (analysis?.energy as string) || "medium",
        overallPacing: "moderate",
        visualStyleNotes: "",
        textOverlayStyle: null,
      };

      const usedVideoIds = new Set(
        segments
          .filter((s) => s.id !== swapSegment.id)
          .map((s) => s.video_id)
      );
      const availableVideos = videos
        .filter((v) => !usedVideoIds.has(v.id) && v.id !== swapSegment.video_id)
        .map((v) => ({
          id: v.id,
          filename: v.filename,
          duration_seconds: v.duration_seconds,
          analysis: v.analysis,
        }));

      if (availableVideos.length === 0) return;

      const { data, error } = await supabase.functions.invoke("clone-reel-segments", {
        body: { template, videos: availableVideos },
      });

      if (!error && data?.segments?.[0]) {
        setSwapVideoId(data.segments[0].videoId);
      }
    } catch (err) {
      console.error("Suggest swap failed:", err);
    } finally {
      setSwapSuggesting(false);
    }
  };

  return (
    <div>
      {/* Two-column body — video pinned on the LEFT, controls scroll on the RIGHT */}
      <div className="flex flex-col md:flex-row md:items-start md:gap-8">
      {/* LEFT (desktop) / TOP (mobile): Video preview — fully fixed in place */}
      <div className="md:sticky md:top-10 md:self-start shrink-0 flex justify-center">
        <div className="relative rounded-xl border border-hairline bg-black overflow-hidden aspect-[9/16] w-full md:w-auto md:h-[calc(100vh-5rem)] mx-auto" style={{ containerType: "inline-size" }}>
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
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-150 ${
                  i === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0"
                }`}
                playsInline
                preload={i === currentIndex ? "auto" : "metadata"}
                poster={seg.video.thumbnail_url ?? undefined}
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
              className={`absolute left-0 right-0 z-20 flex justify-center ${
                textPosition === "top"
                  ? "top-[15%]"
                  : textPosition === "center"
                  ? "top-1/2 -translate-y-1/2"
                  : "bottom-[15%]"
              }`}
            >
              <div style={{ width: `${textWidth}%`, paddingLeft: '0.75rem', paddingRight: '0.75rem' }}>
                <p
                  className="font-semibold text-center whitespace-pre-line"
                  style={{
                    fontSize: `${textSize}cqw`,
                    color: textColor,
                    ...(textBorder === "none"
                      ? {}
                      : textBorder === "outline"
                      ? {
                          WebkitTextStroke: `0.8px ${textBorderColor}`,
                          textShadow: `0 0 2px ${textBorderColor}`,
                        }
                      : textBorder === "shadow"
                      ? {
                          textShadow: `0 0 ${Math.round(6 * textShadowIntensity / 5)}px rgba(0,0,0,${Math.min(1, 0.7 * textShadowIntensity / 5).toFixed(2)}), 0 0 ${Math.round(12 * textShadowIntensity / 5)}px rgba(0,0,0,${Math.min(1, 0.4 * textShadowIntensity / 5).toFixed(2)})`,
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

      {/* RIGHT (desktop) / BELOW (mobile): Scrollable controls column */}
      <div className="flex-1 min-w-0 space-y-4 mt-6 md:mt-0">

      {/* Variant info banner (for variant reels) */}
      {reel.trial_batch_id && (() => {
        const variantType = reel.trial_variant_type as TrialVariantType | null;
        const audioLabel = reel.trial_variant_label ?? "";
        const audioSuggestion =
          variantType === "audio" && (audioLabel.includes(" — ") || audioLabel.includes(" by "))
            ? audioLabel.split(" · ").slice(1).join(" · ") || null
            : null;

        return (
          <div className="rounded-lg border bg-muted/50 px-3 py-2 space-y-2">
            {variantType && (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  className={`text-[10px] border px-1.5 py-0 capitalize ${
                    VARIANT_COLORS[variantType] ?? ""
                  }`}
                >
                  {variantType} variant
                </Badge>
                {reel.trial_variant_label && (
                  <span className="text-xs text-muted-foreground truncate flex-1">
                    {reel.trial_variant_label}
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs px-2 ml-auto"
                  disabled={regenerateVariant.isPending}
                  onClick={() => {
                    regenerateVariant.mutate({ variantReel: reel, videos });
                  }}
                >
                  <ArrowsClockwise className={`h-3.5 w-3.5 mr-1 ${regenerateVariant.isPending ? "animate-spin" : ""}`} />
                  {regenerateVariant.isPending ? "Regenerating..." : "Regenerate"}
                </Button>
              </div>
            )}
            {audioSuggestion && (
              <div className="flex items-center gap-1.5 rounded bg-orange-500/10 px-2 py-1.5">
                <MusicNote className="h-3.5 w-3.5 text-orange-600 shrink-0" weight="fill" />
                <p className="text-xs font-medium text-orange-700">
                  {audioSuggestion}
                </p>
              </div>
            )}
            <div
              className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded px-1 py-0.5 -mx-1 transition-colors"
              onClick={() => navigate(`/trials/${reel.trial_batch_id}`)}
            >
              <Flask className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">
                Part of trial batch —{" "}
                <span className="text-primary hover:underline">View all variants</span>
              </p>
            </div>
          </div>
        );
      })()}

      {/* Title + badges */}
          <div className="space-y-2">
            <span className="eyebrow">Editor</span>
            {editingTitle ? (
              <input
                autoFocus
                className="ed-display text-[32px] text-ink bg-transparent border-b-2 border-ink outline-none w-full"
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
                className="ed-display text-[32px] text-ink truncate cursor-pointer hover:text-ink-2 transition-colors"
                onClick={() => { setTitleDraft(reel.title); setEditingTitle(true); }}
                title="Click to edit"
              >
                {reel.title}
              </h1>
            )}
            <div className="flex flex-wrap gap-1.5">
              <span className="chip chip-outline !text-[11px]">
                {reel.reel_segments.length} segment{reel.reel_segments.length !== 1 ? "s" : ""}
              </span>
              <span className="chip chip-outline !text-[11px]">
                {Math.round(totalDuration)}s / {reel.target_duration_seconds}s
              </span>
            </div>
          </div>

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
            <div className="space-y-3">
              {/* On-screen text for the selected clip */}
              {current && (
                <div className="rounded-lg border border-hairline bg-surface p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="eyebrow-plain">On-screen text</span>
                    <div className="flex items-center gap-2">
                      {currentVideo?.analysis && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={generatingOverlay}
                          className="h-6 text-xs px-2 text-brand hover:text-brand"
                          onClick={generateOverlayText}
                          title="Draft short overlay text from this clip's AI analysis"
                        >
                          {generatingOverlay ? (
                            <><ArrowsClockwise className="h-3.5 w-3.5 mr-1 animate-spin" /> Generating…</>
                          ) : (
                            <><Sparkle className="h-3.5 w-3.5 mr-1" weight="fill" /> Generate</>
                          )}
                        </Button>
                      )}
                      {segments.length > 1 && (
                        <span className="font-mono text-[10.5px] tracking-[0.05em] text-muted-foreground">
                          {String(currentIndex + 1).padStart(2, "0")} / {String(segments.length).padStart(2, "0")}
                        </span>
                      )}
                    </div>
                  </div>
                  {overlayError && <p className="text-xs text-destructive mb-2">{overlayError}</p>}
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
                            <Checkbox checked={applyToAll} onCheckedChange={(v) => setApplyToAll(v === true)} />
                            <span className="text-xs text-muted-foreground">Apply to all clips</span>
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
                                  if (seg.section_text !== trimmed) updateSegmentText({ segmentId: seg.id, text: trimmed });
                                });
                              } else if (current && trimmed !== current.section_text) {
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
                      onClick={() => { setPhraseDraft(current.section_text); setEditingPhrase(true); }}
                    >
                      <p className="text-sm whitespace-pre-line flex-1">
                        {current.section_text || <span className="text-muted-foreground italic">Add text…</span>}
                      </p>
                      <PencilSimple className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover/phrase:opacity-100 transition-opacity mt-0.5" />
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      min={2.5}
                      max={8}
                      step={0.5}
                      value={[textSize]}
                      onValueChange={([v]) => { setTextSize(v); saveTextSettings({ text_size: String(v) }); }}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium text-muted-foreground">A</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Width</Label>
                  <div className="flex items-center gap-2 h-7">
                    <span className="text-[10px] text-muted-foreground">N</span>
                    <Slider
                      min={40}
                      max={100}
                      step={5}
                      value={[textWidth]}
                      onValueChange={([v]) => { setTextWidth(v); saveTextSettings({ text_width: String(v) }); }}
                      className="flex-1"
                    />
                    <span className="text-[10px] text-muted-foreground">W</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Color</Label>
                  <div className="flex gap-1">
                    {([
                      { value: "#ffffff", label: "White" },
                      { value: "#000000", label: "Black" },
                      { value: "#facc15", label: "Yellow" },
                      { value: "#FFF7A7", label: "Soft Yellow" },
                      { value: "#f87171", label: "Red" },
                      { value: "#34d399", label: "Green" },
                      { value: "#60a5fa", label: "Blue" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        title={opt.label}
                        className={`h-7 w-7 rounded-full border-2 transition-colors ${
                          textColor === opt.value ? "border-primary scale-110" : "border-border hover:border-primary/50"
                        }`}
                        style={{ backgroundColor: opt.value }}
                        onClick={() => { setTextColor(opt.value); saveTextSettings({ text_color: opt.value }); }}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Border style</Label>
                  <div className="flex gap-1">
                    {([
                      { value: "none", label: "None" },
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

                {textBorder === "shadow" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Shadow intensity</Label>
                    <div className="flex items-center gap-2 h-7">
                      <span className="text-[10px] text-muted-foreground">Light</span>
                      <Slider
                        min={1}
                        max={10}
                        step={1}
                        value={[textShadowIntensity]}
                        onValueChange={([v]) => { setTextShadowIntensity(v); saveTextSettings({ text_shadow_intensity: String(v) }); }}
                        className="flex-1"
                      />
                      <span className="text-[10px] text-muted-foreground">Heavy</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}
          </div>

          {/* Caption — Instagram post caption + hashtags */}
          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Caption</p>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Mood</Label>
              <div className="flex gap-1 flex-wrap">
                {CAPTION_MOODS.map((m) => (
                  <Button key={m} variant={captionMood === m ? "default" : "outline"} size="sm" className="h-7 text-xs px-2 capitalize" onClick={() => setCaptionMood(m)}>{m}</Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tone</Label>
              <div className="flex gap-1 flex-wrap">
                {CAPTION_TONES.map((t) => (
                  <Button key={t} variant={captionTone === t ? "default" : "outline"} size="sm" className="h-7 text-xs px-2 capitalize" onClick={() => setCaptionTone(t)}>{t}</Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tense</Label>
              <div className="flex gap-1 flex-wrap">
                {CAPTION_TENSES.map((te) => (
                  <Button key={te} variant={captionTense === te ? "default" : "outline"} size="sm" className="h-7 text-xs px-2 capitalize" onClick={() => setCaptionTense(te)}>{te}</Button>
                ))}
              </div>
            </div>

            {voiceProfile?.text ? (
              <label className="flex items-center justify-between gap-2 rounded-lg border border-hairline bg-surface px-3 py-2 cursor-pointer">
                <span className="flex items-center gap-1.5">
                  <Sparkle className="h-3.5 w-3.5 text-brand" weight="fill" />
                  <span className="text-xs font-medium">Match my voice</span>
                </span>
                <Switch checked={matchVoice} onCheckedChange={setMatchVoice} />
              </label>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Tip: build a voice profile in{" "}
                <button className="text-brand hover:underline" onClick={() => navigate("/account")}>Account</button>{" "}
                to make captions sound like you.
              </p>
            )}

            <Button className="w-full" size="sm" disabled={generatingCaption || segments.length === 0} onClick={generateCaptions}>
              {generatingCaption ? (
                <><Sparkle className="h-4 w-4 mr-1 animate-pulse" /> Generating…</>
              ) : (
                <><Sparkle className="h-4 w-4 mr-1" /> Generate captions</>
              )}
            </Button>
            {captionError && <p className="text-xs text-destructive">{captionError}</p>}

            {/* Selected caption — editable inline */}
            {primaryCaptionIdx >= 0 && (
              <div className="rounded-lg border border-brand ring-1 ring-brand/40 bg-card p-3 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-brand">Selected caption</p>
                {editingCaption ? (
                  <div className="space-y-2">
                    <textarea
                      autoFocus
                      rows={3}
                      className="text-sm w-full bg-transparent border rounded px-2 py-1.5 outline-none resize-none"
                      value={capTextDraft}
                      onChange={(e) => setCapTextDraft(e.target.value)}
                    />
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Hashtags (space or comma separated)</Label>
                      <Input value={capTagsDraft} onChange={(e) => setCapTagsDraft(e.target.value)} placeholder="travel sunset vibes" className="h-7 text-xs" />
                    </div>
                    <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setEditingCaption(false)}>Cancel</Button>
                      <Button size="sm" className="h-6 text-xs px-2" onClick={saveCaptionEdit}>Save</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm whitespace-pre-line">{savedCaptions[primaryCaptionIdx].text}</p>
                    {savedCaptions[primaryCaptionIdx].hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {savedCaptions[primaryCaptionIdx].hashtags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px]">#{tag}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={startEditCaption}>
                        <PencilSimple className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => copyCaption(savedCaptions[primaryCaptionIdx].text, savedCaptions[primaryCaptionIdx].hashtags, primaryCaptionIdx)}>
                        {copiedCap === primaryCaptionIdx ? (
                          <><Check className="h-3.5 w-3.5 mr-1 text-green-500" /> Copied!</>
                        ) : (
                          <><Copy className="h-3.5 w-3.5 mr-1" /> Copy</>
                        )}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-destructive hover:text-destructive ml-auto" onClick={() => removeCaption(primaryCaptionIdx)} title="Remove">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Other options */}
            {altCaptions.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Other options</p>
                {altCaptions.map(({ c, i }) => (
                  <div key={i} className="rounded-lg border border-hairline bg-card p-2.5 space-y-1.5">
                    <p className="text-sm whitespace-pre-line">{c.text}</p>
                    {c.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {c.hashtags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px]">#{tag}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => selectCaption(i)}>Select</Button>
                      <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => copyCaption(c.text, c.hashtags, i)}>
                        {copiedCap === i ? (
                          <><Check className="h-3.5 w-3.5 mr-1 text-green-500" /> Copied!</>
                        ) : (
                          <><Copy className="h-3.5 w-3.5 mr-1" /> Copy</>
                        )}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-destructive hover:text-destructive ml-auto" onClick={() => removeCaption(i)} title="Remove">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>


      {/* Segment strip — horizontal scroll */}
      {reel.reel_segments.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            No segments yet. Delete this reel and create a new one.
          </p>
        </div>
      ) : reel.reel_segments.length >= 1 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Segments
          </p>
          <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={segmentIds} strategy={horizontalListSortingStrategy}>
              <div className="flex gap-2 overflow-x-auto py-1 -my-1 pb-2 -mx-4 px-4 snap-x">
                {reel.reel_segments.map((segment, idx) => (
                  <SortableSegmentCard
                    key={segment.id}
                    segment={segment}
                    idx={idx}
                    isActive={idx === currentIndex}
                    editingTextSegId={editingTextSegId}
                    textDraft={textDraft}
                    findingBestSegId={findingBestSegId}
                    onJump={() => jumpToSegment(idx)}
                    onEditText={(segId, text) => { setTextDraft(text); setEditingTextSegId(segId); }}
                    onEditTextCancel={() => setEditingTextSegId(null)}
                    onTextChange={setTextDraft}
                    onTextCommit={(segId, text) => {
                      updateSegmentText({ segmentId: segId, text });
                      setEditingTextSegId(null);
                    }}
                    onDurationCommit={(segId, videoId, start, end) => {
                      updateSegment({ segmentId: segId, videoId, startSeconds: start, endSeconds: end });
                    }}
                    onSlipEarlier={(seg) => {
                      const shift = Math.min(0.5, seg.start_seconds);
                      if (shift > 0) {
                        updateSegment({
                          segmentId: seg.id, videoId: seg.video_id,
                          startSeconds: Math.round((seg.start_seconds - shift) * 10) / 10,
                          endSeconds: Math.round((seg.end_seconds - shift) * 10) / 10,
                        });
                      }
                    }}
                    onSlipLater={(seg) => {
                      const maxEnd = seg.video.duration_seconds ?? 999;
                      const shift = Math.min(0.5, maxEnd - seg.end_seconds);
                      if (shift > 0) {
                        updateSegment({
                          segmentId: seg.id, videoId: seg.video_id,
                          startSeconds: Math.round((seg.start_seconds + shift) * 10) / 10,
                          endSeconds: Math.round((seg.end_seconds + shift) * 10) / 10,
                        });
                      }
                    }}
                    onFindBest={() => handleFindBest(segment)}
                    onSwap={() => handleOpenSwap(segment)}
                    onDelete={() => {
                      deleteSegment(segment.id).then(() => {
                        if (currentIndex >= segments.length - 1 && currentIndex > 0) {
                          setCurrentIndex(currentIndex - 1);
                        }
                      });
                    }}
                  />
                ))}
                {/* Add clip card */}
                <div
                  className="shrink-0 w-28 rounded-md border-2 border-dashed border-muted-foreground/30 bg-card cursor-pointer hover:border-primary/50 transition-colors snap-start flex flex-col items-center justify-center min-h-[140px]"
                  onClick={() => {
                    setAddClipVideoId("");
                    setAddClipDuration("3");
                    setAddClipText("");
                    setAddClipSearch("");
                    setShowAddClip(true);
                  }}
                >
                  <Plus className="h-5 w-5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground mt-1">Add Clip</span>
                </div>
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Trial batches for this base reel */}
      {!reel.trial_batch_id && trialBatches && trialBatches.length > 0 && (
        <div className="space-y-3">
          {trialBatches.map((batch) => (
            <div key={batch.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flask className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <p className="text-xs font-medium text-muted-foreground">
                    Trial batch · {new Date(batch.created_at).toLocaleDateString()}{" "}
                    · {batch.status}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => navigate(`/trials/${batch.id}`)}
                  >
                    View batch
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2 text-destructive hover:text-destructive"
                    onClick={() => setDeletingBatchId(batch.id)}
                    disabled={deleteTrialBatch.isPending}
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {batch.reels.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {batch.reels.map((variantReel) => (
                    <TrialVariantCard key={variantReel.id} reel={variantReel} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Sticky bottom action bar — Variants + Export pinned at bottom of controls column */}
      <div className="mt-8 md:sticky md:bottom-0 md:z-30 md:py-3 md:bg-mist/90 md:backdrop-blur-md md:border-t md:border-hairline flex items-center justify-end gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowTrialConfirm(true)}
          disabled={reel.reel_segments.length === 0 || generateTrialReels.isPending}
          className="h-9 rounded-full border-hairline-strong"
        >
          <Flask className="h-4 w-4 mr-1.5" />
          {generateTrialReels.isPending ? "Generating…" : "Variants"}
        </Button>
        <Button
          size="sm"
          onClick={() => setShowExport(true)}
          disabled={reel.reel_segments.length === 0}
          className="h-9 rounded-full bg-brand text-brand-ink hover:bg-brand/90 font-semibold px-5"
        >
          <Export className="h-4 w-4 mr-1.5" weight="bold" /> Export
        </Button>
      </div>

      </div>{/* end controls column */}
      </div>{/* end two-column body */}

      {/* Swap dialog */}
      <Dialog
        open={swapSegment !== null}
        onOpenChange={(open) => !open && setSwapSegment(null)}
      >
        <DialogContent className="sm:max-w-2xl">
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
              <Input
                value={swapSearch}
                onChange={(e) => setSwapSearch(e.target.value)}
                placeholder="Search clips by mood, scene, color..."
                className="h-8 text-sm"
              />
              <div className="max-h-[50vh] overflow-y-auto p-0.5 -m-0.5">
                <div className="grid grid-cols-4 gap-2">
                {(() => {
                  const usedVideoIds = new Set(
                    segments
                      .filter((s) => s.id !== swapSegment?.id)
                      .map((s) => s.video_id)
                  );
                  const query = swapSearch.toLowerCase().trim();
                  return videos
                    .filter((v: Video) => {
                      if (usedVideoIds.has(v.id)) return false;
                      if (!query) return true;
                      const a = v.analysis;
                      if (!a) return v.filename.toLowerCase().includes(query);
                      const searchable = [
                        v.filename,
                        a.mood,
                        a.energy,
                        a.visuals,
                        a.summary,
                        a.pacing,
                        a.dominantMotion,
                        a.structure,
                        a.audioNotes,
                        ...(a.sceneTags ?? []),
                        ...(a.colorPalette ?? []),
                        ...(a.shotTypes ?? []),
                      ].filter(Boolean).join(" ").toLowerCase();
                      return searchable.includes(query);
                    })
                    .map((v: Video) => (
                  <div
                    key={v.id}
                    className={`relative rounded-lg overflow-hidden cursor-pointer transition-colors ${
                      swapVideoId === v.id
                        ? "border-2 border-primary"
                        : "border-2 border-border hover:border-primary/50"
                    }`}
                    onClick={() => {
                      setSwapVideoId(v.id);
                    }}
                  >
                    <VideoThumbnail
                      src={v.url}
                      thumbnailUrl={v.thumbnail_url}
                      className="w-full aspect-[9/16]"
                      iconSize="sm"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1 pb-0.5 pt-3">
                      <p className="text-[9px] text-white truncate">
                        {v.filename}
                      </p>
                    </div>
                  </div>
                    ));
                })()}
                </div>
              </div>
            </div>

            {/* Segment duration + suggest */}
            <div className="flex items-center justify-between">
              {swapSegment && (
                <p className="text-xs text-muted-foreground">
                  Segment duration: {Math.round((swapSegment.end_seconds - swapSegment.start_seconds) * 10) / 10}s
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={swapSuggesting}
                onClick={handleSuggestSwap}
              >
                {swapSuggesting ? (
                  <>
                    <CircleNotch className="h-3.5 w-3.5 mr-1 animate-spin" /> Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkle className="h-3.5 w-3.5 mr-1" /> Suggest
                  </>
                )}
              </Button>
            </div>

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

      {/* Add clip dialog */}
      <Dialog
        open={showAddClip}
        onOpenChange={(open) => !open && setShowAddClip(false)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Clip</DialogTitle>
            <DialogDescription>
              Choose a video to add as a new segment at the end of your reel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Video</Label>
              <Input
                value={addClipSearch}
                onChange={(e) => setAddClipSearch(e.target.value)}
                placeholder="Search clips by mood, scene, color..."
                className="h-8 text-sm"
              />
              <div className="max-h-[50vh] overflow-y-auto p-0.5 -m-0.5">
                <div className="grid grid-cols-4 gap-2">
                {(() => {
                  const usedVideoIds = new Set(segments.map((s) => s.video_id));
                  const query = addClipSearch.toLowerCase().trim();
                  return videos
                    .filter((v: Video) => {
                      if (usedVideoIds.has(v.id)) return false;
                      if (!query) return true;
                      const a = v.analysis;
                      if (!a) return v.filename.toLowerCase().includes(query);
                      const searchable = [
                        v.filename,
                        a.mood,
                        a.energy,
                        a.visuals,
                        a.summary,
                        a.pacing,
                        a.dominantMotion,
                        a.structure,
                        a.audioNotes,
                        ...(a.sceneTags ?? []),
                        ...(a.colorPalette ?? []),
                        ...(a.shotTypes ?? []),
                      ].filter(Boolean).join(" ").toLowerCase();
                      return searchable.includes(query);
                    })
                    .map((v: Video) => (
                      <div
                        key={v.id}
                        className={`relative rounded-lg overflow-hidden cursor-pointer transition-colors ${
                          addClipVideoId === v.id
                            ? "border-2 border-primary"
                            : "border-2 border-border hover:border-primary/50"
                        }`}
                        onClick={() => setAddClipVideoId(v.id)}
                      >
                        <VideoThumbnail
                          src={v.url}
                          thumbnailUrl={v.thumbnail_url}
                          className="w-full aspect-[9/16]"
                          iconSize="sm"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1 pb-0.5 pt-3">
                          <p className="text-[9px] text-white truncate">
                            {v.filename}
                          </p>
                        </div>
                      </div>
                    ));
                })()}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Duration (s)</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max={(() => {
                    const v = videos.find((v) => v.id === addClipVideoId);
                    return v?.duration_seconds ?? 30;
                  })()}
                  value={addClipDuration}
                  onChange={(e) => setAddClipDuration(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Text overlay</Label>
                <Input
                  value={addClipText}
                  onChange={(e) => setAddClipText(e.target.value)}
                  placeholder="Optional"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {addClipVideoId
                  ? `${videos.find((v) => v.id === addClipVideoId)?.filename ?? "Selected"}`
                  : "No video selected"}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={addClipSuggesting}
                onClick={async () => {
                  setAddClipSuggesting(true);
                  try {
                    const dur = parseFloat(addClipDuration) || 3;
                    const lastSeg = segments[segments.length - 1];
                    const lastAnalysis = lastSeg
                      ? (videos.find((v) => v.id === lastSeg.video_id)?.analysis as Record<string, unknown> | null)
                      : null;

                    const template = {
                      totalDurationSeconds: dur,
                      segmentCount: 1,
                      segments: [{
                        index: 0,
                        startSeconds: 0,
                        endSeconds: dur,
                        durationSeconds: dur,
                        textOverlay: addClipText || null,
                        mood: (lastAnalysis?.mood as string) || "neutral",
                        energy: (lastAnalysis?.energy as string) || "medium",
                        visualDescription: "",
                      }],
                      overallMood: (lastAnalysis?.mood as string) || "neutral",
                      overallEnergy: (lastAnalysis?.energy as string) || "medium",
                      overallPacing: "moderate",
                      visualStyleNotes: "",
                      textOverlayStyle: null,
                    };

                    const usedVideoIds = new Set(segments.map((s) => s.video_id));
                    const availableVideos = videos
                      .filter((v) => !usedVideoIds.has(v.id) && v.analysis)
                      .map((v) => ({
                        id: v.id,
                        filename: v.filename,
                        duration_seconds: v.duration_seconds,
                        analysis: v.analysis,
                      }));

                    if (availableVideos.length === 0) return;

                    const { data, error } = await supabase.functions.invoke("clone-reel-segments", {
                      body: { template, videos: availableVideos },
                    });

                    if (!error && data?.segments?.[0]) {
                      setAddClipVideoId(data.segments[0].videoId);
                    }
                  } catch (err) {
                    console.error("Suggest add clip failed:", err);
                  } finally {
                    setAddClipSuggesting(false);
                  }
                }}
              >
                {addClipSuggesting ? (
                  <>
                    <CircleNotch className="h-3.5 w-3.5 mr-1 animate-spin" /> Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkle className="h-3.5 w-3.5 mr-1" /> Suggest
                  </>
                )}
              </Button>
            </div>

            <Button
              className="w-full"
              onClick={async () => {
                if (!addClipVideoId) return;
                const dur = parseFloat(addClipDuration) || 3;
                const selectedVideo = videos.find((v) => v.id === addClipVideoId);
                const maxEnd = selectedVideo?.duration_seconds ?? dur;
                const endSeconds = Math.min(dur, maxEnd);
                await addSegment({
                  videoId: addClipVideoId,
                  sectionText: addClipText.trim(),
                  startSeconds: 0,
                  endSeconds: Math.round(endSeconds * 10) / 10,
                });
                setCurrentIndex(segments.length); // jump to the newly added segment
                setShowAddClip(false);
              }}
              disabled={!addClipVideoId || isAdding}
            >
              {isAdding ? "Adding..." : "Add Clip"}
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
        textColor={textColor}
        textWidth={textWidth}
        textShadowIntensity={textShadowIntensity}
      />

      {/* Delete trial batch confirmation */}
      <AlertDialog
        open={deletingBatchId !== null}
        onOpenChange={(open) => !open && setDeletingBatchId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete trial batch?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this trial batch and all its variant reels. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deletingBatchId || !id) return;
                deleteTrialBatch.mutate(
                  { batchId: deletingBatchId, baseReelId: id },
                  { onSettled: () => setDeletingBatchId(null) }
                );
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Trial reels dialog */}
      <TrialReelDialog
        open={showTrialConfirm}
        onOpenChange={setShowTrialConfirm}
        isPending={generateTrialReels.isPending}
        onGenerate={async (opts) => {
          setShowTrialConfirm(false);
          try {
            const batchId = await generateTrialReels.mutateAsync({
              reel,
              videos,
              ...opts,
            });
            navigate(`/trials/${batchId}`);
          } catch (err) {
            console.error("Failed to generate trial reels:", err);
          }
        }}
      />
    </div>
  );
}

function SegTimeInput({
  value,
  max,
  title,
  onCommit,
  suffix,
}: {
  value: number;
  max: number;
  title: string;
  onCommit: (v: number) => void;
  suffix?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  const commit = () => {
    const n = parseFloat(draft);
    if (!isNaN(n) && n >= 0 && n <= max) {
      onCommit(Math.round(n * 10) / 10);
    } else {
      setDraft(String(value));
    }
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        inputMode="decimal"
        className="w-full h-7 sm:h-5 bg-muted border rounded px-1 text-[11px] sm:text-[9px] text-center outline-none"
        title={title}
        value={draft}
        onFocus={() => setFocused(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
      />
      {suffix && (
        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] text-muted-foreground pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

function SortableSegmentCard({
  segment,
  idx,
  isActive,
  editingTextSegId,
  textDraft,
  findingBestSegId,
  onJump,
  onEditText,
  onEditTextCancel,
  onTextChange,
  onTextCommit,
  onDurationCommit,
  onSlipEarlier,
  onSlipLater,
  onFindBest,
  onSwap,
  onDelete,
}: {
  segment: ReelSegmentWithVideo;
  idx: number;
  isActive: boolean;
  editingTextSegId: string | null;
  textDraft: string;
  findingBestSegId: string | null;
  onJump: () => void;
  onEditText: (segId: string, text: string) => void;
  onEditTextCancel: () => void;
  onTextChange: (text: string) => void;
  onTextCommit: (segId: string, text: string) => void;
  onDurationCommit: (segId: string, videoId: string, start: number, end: number) => void;
  onSlipEarlier: (seg: ReelSegmentWithVideo) => void;
  onSlipLater: (seg: ReelSegmentWithVideo) => void;
  onFindBest: () => void;
  onSwap: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: segment.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const roundedDur = Math.round((segment.end_seconds - segment.start_seconds) * 10) / 10;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`shrink-0 w-36 sm:w-28 rounded-md border-2 bg-card cursor-pointer transition-colors snap-start ${
        isActive ? "border-primary" : "border-border hover:border-primary/50"
      }`}
      onClick={onJump}
    >
      {/* Thumbnail — drag handle */}
      <div
        className="relative aspect-square overflow-hidden rounded-t-md touch-none"
        {...attributes}
        {...listeners}
      >
        <VideoThumbnail
          src={`${segment.video.url}#t=${segment.start_seconds}`}
          thumbnailUrl={segment.video.thumbnail_url}
          className="w-full h-full"
          iconSize="sm"
        />
        <div className="absolute top-1 left-1">
          <Badge variant="secondary" className="bg-black/60 text-white text-[11px] sm:text-[9px] border-0 px-1.5 sm:px-1 py-0">
            #{idx + 1}
          </Badge>
        </div>
        <div className="absolute top-1 right-1">
          <Badge variant="secondary" className="bg-black/60 text-white text-[11px] sm:text-[9px] border-0 px-1.5 sm:px-1 py-0">
            {roundedDur}s
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-2 sm:p-1.5 space-y-1.5 sm:space-y-1">
        {editingTextSegId === segment.id ? (
          <textarea
            autoFocus
            className="text-xs sm:text-[10px] font-medium leading-snug w-full bg-muted border rounded px-1.5 py-1 outline-none resize-none"
            rows={2}
            value={textDraft}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onTextChange(e.target.value)}
            onBlur={() => {
              const trimmed = textDraft.trim();
              if (trimmed !== segment.section_text) {
                onTextCommit(segment.id, trimmed);
              } else {
                onEditTextCancel();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); }
              if (e.key === "Escape") onEditTextCancel();
            }}
          />
        ) : (
          <p
            className="text-xs sm:text-[10px] font-medium leading-snug line-clamp-1 cursor-pointer hover:text-primary/80 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onEditText(segment.id, segment.section_text);
            }}
          >
            {segment.section_text || <span className="text-muted-foreground italic">Add text...</span>}
          </p>
        )}
        <div className="flex gap-0.5 text-[11px] sm:text-[9px]" onClick={(e) => e.stopPropagation()}>
          <SegTimeInput
            value={roundedDur}
            max={Math.round(((segment.video.duration_seconds ?? 999) - segment.start_seconds) * 10) / 10}
            title="Duration (s)"
            onCommit={(v) => {
              if (v > 0) {
                const maxEnd = segment.video.duration_seconds ?? 999;
                const newEnd = Math.min(segment.start_seconds + v, maxEnd);
                onDurationCommit(segment.id, segment.video_id, segment.start_seconds, Math.round(newEnd * 10) / 10);
              }
            }}
            suffix="s"
          />
        </div>
        {/* Slip & find best */}
        <div className="flex gap-1 sm:gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            className="flex-1 inline-flex items-center justify-center h-7 sm:h-5 rounded border bg-background text-muted-foreground hover:bg-muted transition-colors disabled:opacity-30"
            title="Slip earlier"
            disabled={segment.start_seconds <= 0}
            onClick={() => onSlipEarlier(segment)}
          >
            <CaretLeft className="h-3.5 w-3.5 sm:h-2.5 sm:w-2.5" />
          </button>
          <button
            className="flex-1 inline-flex items-center justify-center h-7 sm:h-5 rounded border bg-background text-primary hover:bg-muted transition-colors"
            title="AI: find best moment"
            disabled={findingBestSegId === segment.id}
            onClick={onFindBest}
          >
            {findingBestSegId === segment.id ? (
              <CircleNotch className="h-3.5 w-3.5 sm:h-2.5 sm:w-2.5 animate-spin" />
            ) : (
              <Sparkle className="h-3.5 w-3.5 sm:h-2.5 sm:w-2.5" />
            )}
          </button>
          <button
            className="flex-1 inline-flex items-center justify-center h-7 sm:h-5 rounded border bg-background text-muted-foreground hover:bg-muted transition-colors disabled:opacity-30"
            title="Slip later"
            disabled={segment.end_seconds >= (segment.video.duration_seconds ?? 999)}
            onClick={() => onSlipLater(segment)}
          >
            <CaretRight className="h-3.5 w-3.5 sm:h-2.5 sm:w-2.5" />
          </button>
        </div>
        <div className="flex gap-1">
          <button
            className="flex-1 inline-flex items-center justify-center h-7 sm:h-5 rounded border bg-background text-muted-foreground hover:bg-muted transition-colors"
            onClick={(e) => { e.stopPropagation(); onSwap(); }}
          >
            <ArrowsClockwise className="h-3.5 w-3.5 sm:h-2.5 sm:w-2.5" />
          </button>
          <button
            className="flex-1 inline-flex items-center justify-center h-7 sm:h-5 rounded border bg-background text-destructive hover:bg-muted transition-colors"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Delete segment"
          >
            <Trash className="h-3.5 w-3.5 sm:h-2.5 sm:w-2.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
