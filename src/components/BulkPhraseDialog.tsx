import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { X } from "@phosphor-icons/react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (phrases: { text: string; tags: string[]; notes: string }[]) => void;
}

export function BulkPhraseDialog({ open, onOpenChange, onSubmit }: Props) {
  const [bulk, setBulk] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const lines = bulk
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput("");
  };

  const handleSubmit = () => {
    if (lines.length === 0) return;
    onSubmit(lines.map((text) => ({ text, tags: [...tags], notes: "" })));
    setBulk("");
    setTags([]);
    setTagInput("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Add Phrases</DialogTitle>
          <DialogDescription>
            Paste one phrase per line. Tags will be applied to all.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            placeholder={"Paste your phrases here, one per line...\n\nExample:\nStay focused, stay humble\nThe grind never stops\nMain character energy"}
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            className="min-h-[160px] resize-none"
            autoFocus
          />

          {lines.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {lines.length} phrase{lines.length !== 1 && "s"} detected
            </p>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Shared tags (optional)
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Add a tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                className="flex-1"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addTag}
              >
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter((t) => t !== tag))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={lines.length === 0}>
              Add {lines.length} Phrase{lines.length !== 1 && "s"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
