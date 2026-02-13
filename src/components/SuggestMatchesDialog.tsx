import { useState, useEffect } from "react";
import { useAiSuggestions } from "@/hooks/use-ai-suggestions";
import { SuggestionCard } from "@/components/SuggestionCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sparkle } from "@phosphor-icons/react";
import type { Phrase } from "@/types/phrase";
import type { Video } from "@/types/video";

type Step = "select-phrase" | "analyzing" | "review";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPhrase?: Phrase | null;
  phrases: Phrase[];
  videos: Video[];
  onSaveMatch: (
    phraseId: string,
    videoId: string,
    score?: number,
    reasoning?: string
  ) => void;
}

export function SuggestMatchesDialog({
  open,
  onOpenChange,
  initialPhrase,
  phrases,
  videos,
  onSaveMatch,
}: Props) {
  const [step, setStep] = useState<Step>("select-phrase");
  const [selectedPhrase, setSelectedPhrase] = useState<Phrase | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { suggestions, getSuggestions, isAnalyzing, refiningIds, error, reset } =
    useAiSuggestions();

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      reset();
      setSelectedIds(new Set());
      if (initialPhrase) {
        setSelectedPhrase(initialPhrase);
        setStep("analyzing");
      } else {
        setSelectedPhrase(null);
        setStep("select-phrase");
      }
    }
  }, [open, initialPhrase]);

  // Trigger analysis when entering analyzing step
  useEffect(() => {
    if (step === "analyzing" && selectedPhrase && videos.length > 0) {
      getSuggestions({
        phrase: selectedPhrase,
        videos,
        onPass1Complete: () => setStep("review"),
      }).catch(() => {});
    }
  }, [step, selectedPhrase]);

  const handleSelectPhrase = (phrase: Phrase) => {
    setSelectedPhrase(phrase);
    setStep("analyzing");
  };

  const toggleSelection = (videoId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
  };

  const handleSaveSelected = () => {
    suggestions
      .filter((s) => selectedIds.has(s.videoId))
      .forEach((s) =>
        onSaveMatch(selectedPhrase!.id, s.videoId, s.score, s.reasoning)
      );
    onOpenChange(false);
  };

  const videoMap = new Map(videos.map((v) => [v.id, v]));
  const hasRefining = refiningIds.size > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        {step === "select-phrase" && (
          <>
            <DialogHeader>
              <DialogTitle>Find Matches</DialogTitle>
              <DialogDescription>
                Select a phrase to find matching videos.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {phrases.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No phrases yet. Create one first!
                </p>
              ) : (
                phrases.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg border bg-card p-3 cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => handleSelectPhrase(p)}
                  >
                    <p className="text-sm font-medium">{p.text}</p>
                    {p.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {p.tags.map((t) => (
                          <Badge
                            key={t}
                            variant="secondary"
                            className="text-xs"
                          >
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {step === "analyzing" && (
          <>
            <DialogHeader>
              <DialogTitle>Analyzing Videos</DialogTitle>
              <DialogDescription>"{selectedPhrase?.text}"</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center space-y-4 py-8">
              <Sparkle className="h-10 w-10 text-primary animate-pulse" />
              <p className="text-sm font-medium">
                Analyzing {videos.filter((v) => v.analysis).length} videos...
              </p>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                AI is comparing phrase and video analysis data. This usually
                takes 5-10 seconds.
              </p>
              {error && (
                <div className="text-center space-y-2">
                  <p className="text-sm text-destructive">
                    Analysis failed. Please try again.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      reset();
                      setStep("analyzing");
                    }}
                  >
                    Retry
                  </Button>
                </div>
              )}
            </div>
          </>
        )}

        {step === "review" && (
          <>
            <DialogHeader>
              <DialogTitle>Suggestions</DialogTitle>
              <DialogDescription>
                {hasRefining
                  ? "Refining top matches with deep video analysis..."
                  : "Tap to select, then save your matches."}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Matching phrase</p>
              <p className="text-sm font-medium">{selectedPhrase?.text}</p>
              {selectedPhrase?.tags && selectedPhrase.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {selectedPhrase.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-xs">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
              {selectedPhrase?.analysis && (
                <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Looking for</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedPhrase.analysis.tone} tone, {selectedPhrase.analysis.energyLevel >= 7 ? "high" : selectedPhrase.analysis.energyLevel >= 4 ? "moderate" : "low"} energy, {selectedPhrase.analysis.idealPacing} pacing
                    {selectedPhrase.analysis.emotionalArc !== "steady" && ` — ${selectedPhrase.analysis.emotionalArc}`}
                  </p>
                  {selectedPhrase.analysis.suggestedVisuals.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedPhrase.analysis.suggestedVisuals.map((v) => (
                        <Badge key={v} variant="outline" className="text-xs">
                          {v}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            {suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No suggestions found. Try different videos or phrases.
              </p>
            ) : (
              <div className="space-y-3">
                {suggestions.map((s) => {
                  const video = videoMap.get(s.videoId);
                  if (!video) return null;
                  return (
                    <SuggestionCard
                      key={s.videoId}
                      suggestion={s}
                      video={video}
                      selected={selectedIds.has(s.videoId)}
                      refining={refiningIds.has(s.videoId)}
                      onToggle={() => toggleSelection(s.videoId)}
                    />
                  );
                })}
              </div>
            )}
            {selectedIds.size > 0 && (
              <div className="sticky bottom-0 pt-3 bg-background">
                <Button className="w-full" onClick={handleSaveSelected}>
                  Save {selectedIds.size} Match
                  {selectedIds.size > 1 ? "es" : ""}
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
