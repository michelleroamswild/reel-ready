import { useState } from "react";
import type { Phrase } from "@/types/phrase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { PencilSimple, Trash, Sparkle } from "@phosphor-icons/react";

interface Props {
  phrase: Phrase;
  onEdit: (phrase: Phrase) => void;
  onDelete: (id: string) => void;
  onFindMatches?: (phrase: Phrase) => void;
}

export function PhraseCard({ phrase, onEdit, onDelete, onFindMatches }: Props) {
  const [showDelete, setShowDelete] = useState(false);

  return (
    <>
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
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setShowDelete(true)}>
            <Trash className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete phrase?</AlertDialogTitle>
            <AlertDialogDescription>
              "{phrase.text.length > 80 ? phrase.text.slice(0, 80) + "..." : phrase.text}" will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onDelete(phrase.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
