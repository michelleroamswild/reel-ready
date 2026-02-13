import type { AiSuggestion } from "@/types/match";
import type { Video } from "@/types/video";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  suggestion: AiSuggestion;
  video: Video;
  selected: boolean;
  onToggle: () => void;
}

export function SuggestionCard({ suggestion, video, selected, onToggle }: Props) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 space-y-2 cursor-pointer transition-colors",
        selected && "ring-2 ring-primary"
      )}
      onClick={onToggle}
    >
      <video
        src={video.url}
        preload="metadata"
        className="w-full rounded-md aspect-video object-cover"
      />
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium truncate">{video.filename}</p>
        <Badge variant={suggestion.score >= 75 ? "default" : "secondary"}>
          {suggestion.score}%
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{suggestion.reasoning}</p>
      <div className="flex flex-wrap gap-1.5">
        {suggestion.moodMatch && (
          <Badge variant="outline" className="text-xs">
            {suggestion.moodMatch}
          </Badge>
        )}
        {suggestion.energyMatch && (
          <Badge variant="outline" className="text-xs">
            {suggestion.energyMatch}
          </Badge>
        )}
      </div>
    </div>
  );
}
