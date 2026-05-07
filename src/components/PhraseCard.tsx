import { useState } from "react";
import type { Phrase } from "@/types/phrase";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PencilSimple, Trash, FilmStrip, DotsThree } from "@phosphor-icons/react";

interface Props {
  phrase: Phrase;
  index?: number;
  onEdit: (phrase: Phrase) => void;
  onDelete: (id: string) => void;
  onBuildReel?: (phrase: Phrase) => void;
}

export function PhraseCard({ phrase, index, onEdit, onDelete, onBuildReel }: Props) {
  const [showDelete, setShowDelete] = useState(false);

  return (
    <>
      <div className="phrase-card hoverable">
        {typeof index === "number" && (
          <div className="num">{String(index + 1).padStart(2, "0")}</div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[15px] leading-[1.45] tracking-tight text-ink">{phrase.text}</p>
          {phrase.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {phrase.tags.map((tag) => (
                <span key={tag} className="chip chip-outline !text-[10.5px] !px-2 !py-1 !font-medium">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {phrase.notes && (
            <p className="mt-2 text-[12px] text-muted-foreground leading-snug">{phrase.notes}</p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="shrink-0 h-8 w-8 grid place-items-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-ink transition-colors"
              title="More"
            >
              <DotsThree className="h-4 w-4" weight="bold" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onBuildReel && (
              <DropdownMenuItem onClick={() => onBuildReel(phrase)}>
                <FilmStrip className="h-4 w-4 mr-2" /> Build Reel
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onEdit(phrase)}>
              <PencilSimple className="h-4 w-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setShowDelete(true)}
            >
              <Trash className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
