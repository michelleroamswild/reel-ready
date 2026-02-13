import { useState } from "react";
import { useMatches } from "@/hooks/use-matches";
import { usePhrases } from "@/hooks/use-phrases";
import { useVideos } from "@/hooks/use-videos";
import { MatchCard } from "@/components/MatchCard";
import { SuggestMatchesDialog } from "@/components/SuggestMatchesDialog";
import { Button } from "@/components/ui/button";
import { Sparkle } from "@phosphor-icons/react";

export default function MatchesPage() {
  const { matches, isLoading, saveMatch, deleteMatch } = useMatches();
  const { phrases } = usePhrases();
  const { videos } = useVideos();
  const [showDialog, setShowDialog] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Matches</h1>
        <Button size="sm" onClick={() => setShowDialog(true)}>
          <Sparkle className="h-4 w-4 mr-1" /> Find Matches
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Loading...
        </p>
      ) : matches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <Sparkle className="h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground max-w-xs">
            No matches yet. Select a phrase and let AI find the best video
            pairings!
          </p>
          <Button variant="outline" size="sm" onClick={() => setShowDialog(true)}>
            Find Matches
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => (
            <MatchCard key={m.id} match={m} onDelete={deleteMatch} />
          ))}
        </div>
      )}

      <SuggestMatchesDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        phrases={phrases}
        videos={videos}
        onSaveMatch={saveMatch}
      />
    </div>
  );
}
