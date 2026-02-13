import { useState, useEffect } from "react";
import type { Phrase } from "@/types/phrase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X } from "@phosphor-icons/react";

interface Props {
  initial?: Phrase | null;
  onSubmit: (text: string, tags: string[], notes: string) => void;
  onCancel: () => void;
}

export function PhraseForm({ initial, onSubmit, onCancel }: Props) {
  const [text, setText] = useState(initial?.text ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  useEffect(() => {
    setText(initial?.text ?? "");
    setTags(initial?.tags ?? []);
    setNotes(initial?.notes ?? "");
  }, [initial]);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit(text.trim(), tags, notes.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-card">
      <div>
        <Textarea
          placeholder="Enter your phrase or statement..."
          value={text}
          onChange={e => setText(e.target.value)}
          className="min-h-[80px] resize-none"
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="Add a tag..."
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            className="flex-1"
          />
          <Button type="button" variant="secondary" size="sm" onClick={addTag}>
            Add
          </Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs gap-1">
                {tag}
                <button type="button" onClick={() => setTags(tags.filter(t => t !== tag))}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Textarea
        placeholder="Notes (optional)..."
        value={notes}
        onChange={e => setNotes(e.target.value)}
        className="min-h-[60px] resize-none"
      />

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={!text.trim()}>
          {initial ? "Update" : "Add Phrase"}
        </Button>
      </div>
    </form>
  );
}
