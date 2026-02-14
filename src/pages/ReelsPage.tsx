import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useReels } from "@/hooks/use-reels";
import { usePhrases } from "@/hooks/use-phrases";
import { useVideos } from "@/hooks/use-videos";
import { NewReelDialog } from "@/components/NewReelDialog";
import { CloneReelDialog } from "@/components/CloneReelDialog";
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
import { useToast } from "@/hooks/use-toast";
import { VideoCamera, Plus, Trash, LinkSimple, SquaresFour, List, SortAscending, SortDescending } from "@phosphor-icons/react";
import type { ReelWithDetails } from "@/types/reel";
import type { Phrase } from "@/types/phrase";

export default function ReelsPage() {
  const navigate = useNavigate();
  const { reels, isLoading, createReel, isCreating, deleteReel } = useReels();
  const { phrases } = usePhrases();
  const { videos } = useVideos();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReelWithDetails | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sortNewestFirst, setSortNewestFirst] = useState(true);

  const handleSubmit = async (phrase: Phrase, title: string, targetDuration: number) => {
    try {
      const reelId = await createReel({ phrase, title, targetDuration, videos });
      setShowDialog(false);
      navigate(`/reels/${reelId}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      toast({
        variant: "destructive",
        title: "Failed to build reel",
        description: message,
      });
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
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowCloneDialog(true)}>
            <LinkSimple className="h-4 w-4 mr-1" /> Clone
          </Button>
          <Button size="sm" onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Reel
          </Button>
        </div>
      </div>

      {reels.length > 0 && (
        <div className="flex justify-end">
          <div className="flex border rounded-md">
            <Button
              size="sm"
              variant={view === "grid" ? "default" : "ghost"}
              className="h-8 w-8 p-0 rounded-r-none"
              onClick={() => setView("grid")}
              title="Grid view"
            >
              <SquaresFour className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={view === "list" ? "default" : "ghost"}
              className="h-8 w-8 p-0 rounded-l-none"
              onClick={() => setView("list")}
              title="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

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
        <>
          {view === "grid" ? (
            <div className="grid grid-cols-3 gap-3">
              {reels.map((reel) => {
                const totalDuration = reel.reel_segments.reduce(
                  (sum, seg) => sum + (seg.end_seconds - seg.start_seconds),
                  0
                );
                const firstSeg = reel.reel_segments[0];
                const date = new Date(reel.created_at);
                const dateStr = date.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
                });

                return (
                  <div
                    key={reel.id}
                    className="rounded-lg border bg-card overflow-hidden cursor-pointer hover:border-primary/50 transition-colors group"
                    onClick={() => navigate(`/reels/${reel.id}`)}
                  >
                    <div className="relative bg-black aspect-[9/16]">
                      {firstSeg?.video?.url ? (
                        <video
                          src={`${firstSeg.video.url}#t=${firstSeg.start_seconds}`}
                          preload="metadata"
                          muted
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <VideoCamera className="h-8 w-8 text-white/30" />
                        </div>
                      )}
                      <div className="absolute bottom-1.5 right-1.5">
                        <Badge variant="secondary" className="bg-black/60 text-white text-[10px] border-0 px-1.5 py-0">
                          {formatDuration(Math.round(totalDuration))}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 bg-black/40 hover:bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(reel);
                        }}
                      >
                        <Trash className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="p-2 space-y-1">
                      <span className="text-[10px] text-muted-foreground">{dateStr}</span>
                      <p className="text-xs font-medium truncate">{reel.title}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-2 leading-snug">
                        {reel.phrase?.text ??
                          reel.reel_segments[0]?.section_text ??
                          (reel.source_template
                            ? `Cloned · ${reel.source_template.overallMood}`
                            : "")}
                      </p>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {reel.reel_segments.length} clip{reel.reel_segments.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex justify-end mb-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => setSortNewestFirst((v) => !v)}
                >
                  {sortNewestFirst ? (
                    <SortDescending className="h-3.5 w-3.5 mr-1" />
                  ) : (
                    <SortAscending className="h-3.5 w-3.5 mr-1" />
                  )}
                  {sortNewestFirst ? "Newest first" : "Oldest first"}
                </Button>
              </div>
              {[...reels]
                .sort((a, b) => {
                  const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                  return sortNewestFirst ? diff : -diff;
                })
                .map((reel) => {
                  const totalDuration = reel.reel_segments.reduce(
                    (sum, seg) => sum + (seg.end_seconds - seg.start_seconds),
                    0
                  );
                  const firstSeg = reel.reel_segments[0];
                  const date = new Date(reel.created_at);
                  const dateStr = date.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
                  });

                  return (
                    <div
                      key={reel.id}
                      className="rounded-lg border bg-card overflow-hidden cursor-pointer hover:bg-accent transition-colors group flex"
                      onClick={() => navigate(`/reels/${reel.id}`)}
                    >
                      <div className="shrink-0 w-14 bg-black">
                        {firstSeg?.video?.url ? (
                          <video
                            src={`${firstSeg.video.url}#t=${firstSeg.start_seconds}`}
                            preload="metadata"
                            muted
                            className="w-full h-full object-cover aspect-[9/16]"
                          />
                        ) : (
                          <div className="w-full aspect-[9/16] flex items-center justify-center">
                            <VideoCamera className="h-4 w-4 text-white/30" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 p-2.5 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{reel.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {reel.phrase?.text ??
                              reel.reel_segments[0]?.section_text ??
                              (reel.source_template
                                ? `Cloned · ${reel.source_template.overallMood}`
                                : "")}
                          </p>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{dateStr}</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {reel.reel_segments.length} clip{reel.reel_segments.length !== 1 ? "s" : ""}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {formatDuration(Math.round(totalDuration))}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(reel);
                            }}
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </>
      )}

      <NewReelDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        phrases={phrases}
        onSubmit={handleSubmit}
        isSubmitting={isCreating}
      />

      <CloneReelDialog
        open={showCloneDialog}
        onOpenChange={setShowCloneDialog}
        videos={videos}
        onComplete={(reelId) => {
          setShowCloneDialog(false);
          navigate(`/reels/${reelId}`);
        }}
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
