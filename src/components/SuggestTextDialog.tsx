import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sparkle, Copy, Check, Plus, FilmStrip, Crosshair } from "@phosphor-icons/react";
import type { VideoAnalysis } from "@/types/video";

interface TextSuggestion {
  text: string;
  category: string;
  confidence: number;
  grounded?: boolean;
}

type Step = "configure" | "loading" | "results";

const LENGTH_OPTIONS = [
  { value: "short", label: "Short", description: "Punchy, 2-5 words" },
  { value: "medium", label: "Medium", description: "5-8 words" },
  { value: "long", label: "Long", description: "Short sentences, max 8 words" },
];

const STYLE_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "witty", label: "Witty" },
  { value: "poetic", label: "Poetic" },
  { value: "bold", label: "Bold" },
  { value: "minimal", label: "Minimal" },
  { value: "storytelling", label: "Story" },
  { value: "edgy", label: "Edgy" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysis: VideoAnalysis;
  filename: string;
  onSaveAsPhrase: (text: string, tags: string[]) => void;
  onCreateReel?: (text: string) => void;
  // When provided, shows a "Use this text" action that writes the picked
  // suggestion straight onto the current reel segment (reel-builder flow).
  onUseText?: (text: string) => void;
  useTextLabel?: string;
}

export function SuggestTextDialog({
  open,
  onOpenChange,
  analysis,
  filename,
  onSaveAsPhrase,
  onCreateReel,
  onUseText,
  useTextLabel = "Use this text",
}: Props) {
  const [step, setStep] = useState<Step>("configure");
  const [length, setLength] = useState("short");
  const [style, setStyle] = useState("auto");
  const [suggestions, setSuggestions] = useState<TextSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set());
  const [reelCreatedIndices, setReelCreatedIndices] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);

  // Track previous suggestions for anti-repetition across regenerations
  const previousSuggestionsRef = useRef<string[]>([]);

  const INITIAL_COUNT = 4;

  useEffect(() => {
    if (!open) {
      setStep("configure");
      setSuggestions([]);
      setError(null);
      setCopiedIndex(null);
      setSavedIndices(new Set());
      setReelCreatedIndices(new Set());
      setShowAll(false);
      previousSuggestionsRef.current = [];
    }
  }, [open]);

  const fetchSuggestions = async () => {
    setStep("loading");
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "suggest-text",
        {
          body: {
            analysis,
            filename,
            length,
            style,
            previousSuggestions: previousSuggestionsRef.current,
          },
        }
      );
      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      // Accumulate previous suggestions for anti-repetition
      if (suggestions.length > 0) {
        previousSuggestionsRef.current = [
          ...previousSuggestionsRef.current,
          ...suggestions.map((s) => s.text),
        ];
      }

      setSuggestions(data.suggestions);
      setCopiedIndex(null);
      setSavedIndices(new Set());
      setReelCreatedIndices(new Set());
      setShowAll(false);
      setStep("results");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate suggestions"
      );
      setStep("results");
    }
  };

  const handleCopy = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text.replace(/\\n/g, "\n"));
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSave = (suggestion: TextSuggestion, index: number) => {
    onSaveAsPhrase(suggestion.text.replace(/\\n/g, "\n"), [suggestion.category]);
    setSavedIndices((prev) => new Set(prev).add(index));
  };

  const confidenceLabel = (c: number) => {
    if (c >= 0.9) return "perfect";
    if (c >= 0.7) return "good";
    return "decent";
  };

  const confidenceColor = (c: number) => {
    if (c >= 0.9) return "text-green-600";
    if (c >= 0.7) return "text-blue-600";
    return "text-muted-foreground";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {step === "configure" && (
          <>
            <DialogHeader>
              <DialogTitle>Suggest Text Overlays</DialogTitle>
              <DialogDescription>
                AI generates text that matches this clip's vibe.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Style</Label>
                <div className="flex flex-wrap gap-1.5">
                  {STYLE_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      variant={style === opt.value ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs px-2.5"
                      onClick={() => setStyle(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Length</Label>
                <div className="flex gap-2">
                  {LENGTH_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      variant={length === opt.value ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setLength(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {LENGTH_OPTIONS.find((o) => o.value === length)?.description}
                </p>
              </div>

              <Button className="w-full" onClick={fetchSuggestions}>
                <Sparkle className="h-4 w-4 mr-1" /> Generate
              </Button>
            </div>
          </>
        )}

        {step === "loading" && (
          <>
            <DialogHeader>
              <DialogTitle>Suggest Text Overlays</DialogTitle>
              <DialogDescription>Generating...</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center space-y-4 py-8">
              <Sparkle className="h-10 w-10 text-primary animate-pulse" />
              <p className="text-sm font-medium">Crafting suggestions...</p>
            </div>
          </>
        )}

        {step === "results" && (
          <>
            <DialogHeader>
              <DialogTitle>Suggest Text Overlays</DialogTitle>
              <DialogDescription>
                Tap + to save as a phrase, or copy to clipboard.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="text-center space-y-2 py-4">
                <p className="text-sm text-destructive">{error}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStep("configure")}
                >
                  Back
                </Button>
              </div>
            )}

            {!error && suggestions.length > 0 && (
              <div className="space-y-3">
                {(showAll ? suggestions : suggestions.slice(0, INITIAL_COUNT)).map((s, i) => (
                  <div
                    key={i}
                    className="rounded-lg border bg-card p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="text-xs capitalize"
                        >
                          {s.category.replace(/_/g, " ")}
                        </Badge>
                        <span className={`text-xs ${confidenceColor(s.confidence)}`}>
                          {confidenceLabel(s.confidence)}
                        </span>
                        {s.grounded && (
                          <Crosshair className="h-3 w-3 text-muted-foreground" title="Specific to this clip" />
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleCopy(s.text, i)}
                          title="Copy text"
                        >
                          {copiedIndex === i ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        {!onUseText && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleSave(s, i)}
                            disabled={savedIndices.has(i)}
                            title="Save as phrase"
                          >
                            {savedIndices.has(i) ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Plus className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                        {onCreateReel && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setReelCreatedIndices((prev) => new Set(prev).add(i));
                              onCreateReel(s.text.replace(/\\n/g, "\n"));
                            }}
                            disabled={reelCreatedIndices.has(i)}
                            title="Create reel"
                          >
                            {reelCreatedIndices.has(i) ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <FilmStrip className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-line">
                      {s.text.replace(/\\n/g, "\n")}
                    </p>
                    {onUseText && (
                      <Button
                        size="sm"
                        className="w-full h-8 bg-brand text-brand-ink hover:bg-brand/90 font-semibold"
                        onClick={() => onUseText(s.text.replace(/\\n/g, "\n"))}
                      >
                        <Check className="h-3.5 w-3.5 mr-1" /> {useTextLabel}
                      </Button>
                    )}
                  </div>
                ))}

                {!showAll && suggestions.length > INITIAL_COUNT && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                    onClick={() => setShowAll(true)}
                  >
                    Show {suggestions.length - INITIAL_COUNT} more
                  </Button>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setStep("configure")}
                >
                  Regenerate
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
