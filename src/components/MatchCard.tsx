import type { MatchWithDetails } from "@/types/match";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash } from "@phosphor-icons/react";

interface Props {
  match: MatchWithDetails;
  onDelete: (id: string) => void;
}

export function MatchCard({ match, onDelete }: Props) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <video
        src={match.video.url}
        controls
        preload="metadata"
        className="w-full rounded-md"
      />
      <p className="text-sm font-medium leading-snug">"{match.phrase.text}"</p>
      {match.phrase.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {match.phrase.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}
      {match.score !== null && (
        <div className="flex items-center gap-2">
          <Badge variant="default">{match.score}%</Badge>
          <p className="text-xs text-muted-foreground">{match.reasoning}</p>
        </div>
      )}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          onClick={() => onDelete(match.id)}
        >
          <Trash className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
