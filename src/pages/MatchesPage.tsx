import { Sparkles } from "lucide-react";

export default function MatchesPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
      <Sparkles className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-lg font-semibold">Matches</h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        Pair your phrases with video clips. Add phrases and videos first to start matching.
      </p>
    </div>
  );
}
