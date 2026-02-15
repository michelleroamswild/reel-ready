import { useState, useEffect } from "react";
import { useReferenceAnalysis } from "@/hooks/use-reference-analysis";
import { useTrendingAudio } from "@/hooks/use-trending-audio";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sparkle,
  Flask,
  SkipForward,
  CircleNotch,
  CheckCircle,
  WarningCircle,
  XCircle,
  LinkSimple,
  VideoCamera,
} from "@phosphor-icons/react";
import { VideoThumbnail } from "@/components/VideoThumbnail";
import type { ReferencePatterns } from "@/types/trial";
import type { TrendingAudio } from "@/types/trending-audio";
import type { Video } from "@/types/video";

type Step = "select-video" | "urls" | "analyzing" | "review" | "confirm";

interface TrialReelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (opts: {
    referencePatterns?: ReferencePatterns;
    referenceUrls?: string[];
    trendingAudio?: TrendingAudio[];
    selectedVideo?: Video;
  }) => void;
  isPending: boolean;
  videos?: Video[];
}

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function TrialReelDialog({
  open,
  onOpenChange,
  onGenerate,
  isPending,
  videos,
}: TrialReelDialogProps) {
  const hasVideoStep = !!videos;
  const initialStep: Step = hasVideoStep ? "select-video" : "urls";
  const [step, setStep] = useState<Step>(initialStep);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [urlText, setUrlText] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const {
    status,
    patterns,
    failedUrls,
    progress,
    analyzeAll,
    reset: resetAnalysis,
    error: analysisError,
  } = useReferenceAnalysis();
  const { data: trendingAudio } = useTrendingAudio();

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep(hasVideoStep ? "select-video" : "urls");
      setSelectedVideo(null);
      setUrlText("");
      setUrlError(null);
      resetAnalysis();
    }
  }, [open, resetAnalysis, hasVideoStep]);

  // Auto-advance from analyzing to review when done
  useEffect(() => {
    if (status === "done" && step === "analyzing") {
      setStep("review");
    }
    if (status === "error" && step === "analyzing") {
      setStep("review");
    }
  }, [status, step]);

  const handleAnalyze = () => {
    const lines = urlText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setUrlError("Paste at least one URL.");
      return;
    }

    if (lines.length > 5) {
      setUrlError("Maximum 5 URLs allowed.");
      return;
    }

    const invalid = lines.filter((l) => !isValidUrl(l));
    if (invalid.length > 0) {
      setUrlError(`Invalid URL: ${invalid[0]}`);
      return;
    }

    setUrlError(null);
    setStep("analyzing");
    analyzeAll(lines);
  };

  const handleSkipToConfirm = () => {
    setStep("confirm");
  };

  const handleGenerate = () => {
    onGenerate({
      referencePatterns: patterns ?? undefined,
      referenceUrls:
        urlText
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean) || undefined,
      trendingAudio: trendingAudio.length > 0 ? trendingAudio : undefined,
      selectedVideo: selectedVideo ?? undefined,
    });
  };

  const parsedUrls = urlText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Step 0: Video selection (only when videos prop provided) */}
        {step === "select-video" && videos && (
          <>
            <DialogHeader>
              <DialogTitle>Select a Video</DialogTitle>
              <DialogDescription>
                Choose an analyzed video to use as the base for your trial
                variants.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                {videos
                  .filter((v) => v.analysis !== null)
                  .map((v) => (
                    <div
                      key={v.id}
                      className={`relative rounded-lg border overflow-hidden cursor-pointer transition-colors ${
                        selectedVideo?.id === v.id
                          ? "ring-2 ring-primary"
                          : "hover:border-primary/50"
                      }`}
                      onClick={() => setSelectedVideo(v)}
                    >
                      <div className="aspect-[9/16]">
                        {v.thumbnail_url || v.url ? (
                          <VideoThumbnail
                            src={v.url}
                            thumbnailUrl={v.thumbnail_url}
                            className="w-full h-full"
                            iconSize="sm"
                          />
                        ) : (
                          <div className="w-full h-full bg-black flex items-center justify-center">
                            <VideoCamera className="h-4 w-4 text-white/30" />
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] px-1.5 py-1 truncate text-muted-foreground">
                        {v.filename}
                      </p>
                    </div>
                  ))}
              </div>
              {videos.filter((v) => v.analysis !== null).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No analyzed videos. Analyze at least one video first.
                </p>
              )}
              <Button
                className="w-full"
                onClick={() => setStep("urls")}
                disabled={!selectedVideo}
              >
                Continue
              </Button>
            </div>
          </>
        )}

        {/* Step 1: URLs */}
        {step === "urls" && (
          <>
            <DialogHeader>
              <DialogTitle>Paste Reference Reels (Optional)</DialogTitle>
              <DialogDescription>
                Paste URLs of trending reels to analyze their patterns. The AI
                will extract hooks, pacing, and text style to guide your
                variants.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <LinkSimple className="h-3.5 w-3.5" />
                  One URL per line (1-5 URLs)
                </div>
                <textarea
                  className="w-full min-h-[100px] rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder={"https://www.tiktok.com/...\nhttps://www.instagram.com/reel/..."}
                  value={urlText}
                  onChange={(e) => {
                    setUrlText(e.target.value);
                    setUrlError(null);
                  }}
                />
                {urlError && (
                  <p className="text-xs text-destructive">{urlError}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleSkipToConfirm}
                >
                  <SkipForward className="h-4 w-4 mr-1" /> Skip
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleAnalyze}
                  disabled={parsedUrls.length === 0}
                >
                  <Sparkle className="h-4 w-4 mr-1" /> Analyze References
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Step 2: Analyzing */}
        {step === "analyzing" && (
          <>
            <DialogHeader>
              <DialogTitle>Analyzing References</DialogTitle>
              <DialogDescription>
                {status === "synthesizing"
                  ? "Synthesizing common patterns..."
                  : `Analyzing ${progress}...`}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center space-y-3 py-8">
              <CircleNotch className="h-10 w-10 text-primary animate-spin" />
              <p className="text-sm font-medium">
                {status === "synthesizing"
                  ? "Extracting patterns..."
                  : `Downloading & analyzing reel ${progress}`}
              </p>
              {failedUrls.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-amber-600">
                  <WarningCircle className="h-3.5 w-3.5" />
                  {failedUrls.length} URL{failedUrls.length > 1 ? "s" : ""} failed
                </div>
              )}
            </div>
          </>
        )}

        {/* Step 3: Review */}
        {step === "review" && (
          <>
            <DialogHeader>
              <DialogTitle>
                {patterns ? "Reference Patterns" : "Analysis Complete"}
              </DialogTitle>
              <DialogDescription>
                {patterns
                  ? "Common patterns extracted from your reference reels."
                  : analysisError ?? "Could not extract patterns."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {patterns && (
                <div className="space-y-3">
                  <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                        Hook Style
                      </p>
                      <p className="text-sm">{patterns.hookStyle}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                        Pacing
                      </p>
                      <p className="text-sm">{patterns.pacingNotes}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                        Text Style
                      </p>
                      <p className="text-sm">{patterns.textStyle}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                        Structure
                      </p>
                      <p className="text-sm">{patterns.structureNotes}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                        Audio
                      </p>
                      <p className="text-sm">{patterns.audioNotes}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                        Moods
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {patterns.commonMoods.map((mood) => (
                          <Badge
                            key={mood}
                            variant="secondary"
                            className="text-[10px]"
                          >
                            {mood}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  {patterns.summary && (
                    <p className="text-xs text-muted-foreground italic">
                      {patterns.summary}
                    </p>
                  )}
                </div>
              )}

              {failedUrls.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600">
                  <WarningCircle className="h-3.5 w-3.5 shrink-0" />
                  {failedUrls.length} URL{failedUrls.length > 1 ? "s" : ""}{" "}
                  failed to analyze
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("confirm")}
                >
                  {patterns ? "Skip Patterns" : "Continue Without"}
                </Button>
                {patterns && (
                  <Button
                    className="flex-1"
                    onClick={() => setStep("confirm")}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" /> Use These Patterns
                  </Button>
                )}
              </div>
            </div>
          </>
        )}

        {/* Step 4: Confirm */}
        {step === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle>Generate Trial Reels</DialogTitle>
              <DialogDescription>
                This will generate 3-5 variant reels, each isolating one
                variable — text, visuals, or audio — while keeping everything
                else the same. Includes multiple text angles like bold claims,
                questions, and emotional hooks.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {patterns && (
                <div className="flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-2">
                  <Sparkle className="h-4 w-4 text-primary shrink-0" />
                  <p className="text-xs text-primary font-medium">
                    Using patterns from {parsedUrls.length} reference reel
                    {parsedUrls.length !== 1 ? "s" : ""}
                  </p>
                </div>
              )}
              {trendingAudio.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {trendingAudio.length} trending tracks loaded for audio
                  suggestions
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleGenerate}
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <CircleNotch className="h-4 w-4 mr-1 animate-spin" />{" "}
                      Generating...
                    </>
                  ) : (
                    <>
                      <Flask className="h-4 w-4 mr-1" /> Generate Variants
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
