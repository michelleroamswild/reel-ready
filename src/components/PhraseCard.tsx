import type { Phrase } from "@/types/phrase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PencilSimple, Trash, Sparkle } from "@phosphor-icons/react";

interface Props {
  phrase: Phrase;
  onEdit: (phrase: Phrase) => void;
  onDelete: (id: string) => void;
  onFindMatches?: (phrase: Phrase) => void;
}

export function PhraseCard({ phrase, onEdit, onDelete, onFindMatches }: Props) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <p className="text-sm font-medium leading-snug text-card-foreground">{phrase.text}</p>
      {phrase.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {phrase.tags.map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}
      {phrase.notes && (
        <p className="text-xs text-muted-foreground">{phrase.notes}</p>
      )}
      <div className="flex justify-end gap-1 pt-1">
        {onFindMatches && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onFindMatches(phrase)}>
            <Sparkle className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(phrase)}>
          <PencilSimple className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(phrase.id)}>
          <Trash className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
