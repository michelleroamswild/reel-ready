import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useReels } from "@/hooks/use-reels";
import { usePhrases } from "@/hooks/use-phrases";
import { useVideos } from "@/hooks/use-videos";
import { NewReelDialog } from "@/components/NewReelDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { VideoCamera, Plus, Trash } from "@phosphor-icons/react";
import type { ReelWithDetails } from "@/types/reel";
import type { Phrase } from "@/types/phrase";

export default function ReelsPage() {
  const navigate = useNavigate();
  const { reels, isLoading, createReel, isCreating, deleteReel } = useReels();
  const { phrases } = usePhrases();
  const { videos } = useVideos();
  const [showDialog, setShowDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReelWithDetails | null>(null);

  const handleSubmit = async (phrase: Phrase, title: string, targetDuration: number) => {
    try {
      const reelId = await createReel({ phrase, title, targetDuration, videos });
      setShowDialog(false);
      navigate(`/reels/${reelId}`);
    } catch (err) {
      console.error("Failed to create reel:", err);
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Reels</h1>
        <Button size="sm" onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Reel
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Loading...
        </p>
      ) : reels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <VideoCamera className="h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground max-w-xs">
            No reels yet. Select a phrase and let AI build a storyboard!
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDialog(true)}
          >
            New Reel
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {reels.map((reel) => {
            const totalDuration = reel.reel_segments.reduce(
              (sum, seg) => sum + (seg.end_seconds - seg.start_seconds),
              0
            );

            return (
              <div
                key={reel.id}
                className="rounded-lg border bg-card p-3 cursor-pointer hover:bg-accent transition-colors group"
                onClick={() => navigate(`/reels/${reel.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{reel.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {reel.phrase?.text}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(reel);
                    }}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-2 mt-2">
                  <Badge variant="secondary" className="text-xs">
                    {reel.reel_segments.length} segment
                    {reel.reel_segments.length !== 1 ? "s" : ""}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {formatDuration(Math.round(totalDuration))}
                  </Badge>
                  <Badge variant="outline" className="text-xs capitalize">
                    {reel.status}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NewReelDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        phrases={phrases}
        onSubmit={handleSubmit}
        isSubmitting={isCreating}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete reel?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" and all its segments will be permanently
              deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) deleteReel(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
