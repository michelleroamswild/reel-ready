import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Step = "select-phrase" | "configure";

const DURATION_OPTIONS = [
  { value: 15, label: "15s" },
  { value: 30, label: "30s" },
  { value: 60, label: "60s" },
  { value: 90, label: "90s" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phrases: Phrase[];
  onSubmit: (phrase: Phrase, title: string, targetDuration: number) => void;
  isSubmitting: boolean;
  initialPhrase?: Phrase | null;
}

export function NewReelDialog({
  open,
  onOpenChange,
  phrases,
  onSubmit,
  isSubmitting,
  initialPhrase,
}: Props) {
  const [step, setStep] = useState<Step>("select-phrase");
  const [selectedPhrase, setSelectedPhrase] = useState<Phrase | null>(null);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(30);

  useEffect(() => {
    if (open) {
      if (initialPhrase) {
        setSelectedPhrase(initialPhrase);
        setTitle(initialPhrase.text.split("\n")[0].slice(0, 40));
        setStep("configure");
      } else {
        setStep("select-phrase");
        setSelectedPhrase(null);
        setTitle("");
      }
      setDuration(30);
    }
  }, [open, initialPhrase]);

  const handleSelectPhrase = (phrase: Phrase) => {
    setSelectedPhrase(phrase);
    setTitle(phrase.text.split("\n")[0].slice(0, 40));
    setStep("configure");
  };

  const handleSubmit = () => {
    if (!selectedPhrase) return;
    onSubmit(selectedPhrase, title, duration);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {step === "select-phrase" && (
          <>
            <DialogHeader>
              <DialogTitle>New Reel</DialogTitle>
              <DialogDescription>
                Select a phrase to build a reel storyboard.
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
                    <p className="text-sm font-medium whitespace-pre-line">
                      {p.text}
                    </p>
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

        {step === "configure" && selectedPhrase && (
          <>
            <DialogHeader>
              <DialogTitle>Configure Reel</DialogTitle>
              <DialogDescription>
                Set a title and target duration for your reel.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Phrase preview */}
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Phrase
                </p>
                <p className="text-sm whitespace-pre-line">
                  {selectedPhrase.text}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  AI will split this into visual beats
                </p>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="reel-title">Title</Label>
                <Input
                  id="reel-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="My reel"
                />
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <Label>Target Duration</Label>
                <div className="flex gap-2">
                  {DURATION_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      variant={duration === opt.value ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setDuration(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("select-phrase")}
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSubmit}
                  disabled={!title.trim() || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Sparkle className="h-4 w-4 mr-1 animate-pulse" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkle className="h-4 w-4 mr-1" />
                      Build Reel
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
