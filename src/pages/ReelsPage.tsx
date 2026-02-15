import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useReels } from "@/hooks/use-reels";
import { usePhrases } from "@/hooks/use-phrases";
import { useVideos } from "@/hooks/use-videos";
import { useExportReel } from "@/hooks/use-export-reel";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  VideoCamera,
  Plus,
  Trash,
  LinkSimple,
  SquaresFour,
  List,
  SortAscending,
  SortDescending,
  DotsThree,
  Export,
  CheckSquare,
  Square,
  X,
} from "@phosphor-icons/react";
import { VideoThumbnail } from "@/components/VideoThumbnail";
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
  const [filter, setFilter] = useState<"all" | "cloned" | "matched">("all");

  // Selection mode
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBatchDelete, setShowBatchDelete] = useState(false);

  // Batch export
  const { isExporting, progress, startExport, reset: resetExport } = useExportReel();
  const [batchExportIndex, setBatchExportIndex] = useState(-1);
  const [batchExportTotal, setBatchExportTotal] = useState(0);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelecting = useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
  }, []);

  const handleBatchDelete = useCallback(() => {
    for (const id of selected) {
      deleteReel(id);
    }
    setShowBatchDelete(false);
    exitSelecting();
  }, [selected, deleteReel, exitSelecting]);

  const handleBatchExport = useCallback(async () => {
    const selectedReels = reels.filter((r) => selected.has(r.id));
    if (selectedReels.length === 0) return;

    setBatchExportTotal(selectedReels.length);

    for (let i = 0; i < selectedReels.length; i++) {
      const reel = selectedReels[i];
      setBatchExportIndex(i);
      resetExport();

      const safeName = reel.title
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 50)
        .toLowerCase();

      const parsedSize = (() => {
        const s = reel.text_size;
        if (s === "small") return 9;
        if (s === "medium") return 18;
        if (s === "large") return 24;
        const n = Number(s);
        return n > 0 ? n : 13;
      })();

      await startExport(reel.reel_segments, {
        burnText: reel.burn_text ?? true,
        textPosition: (reel.text_position as "top" | "center" | "bottom") ?? "center",
        textSize: parsedSize,
        textBorder: (reel.text_border as "outline" | "shadow" | "box") ?? "shadow",
        textBorderColor: (reel.text_border_color as "black" | "white") ?? "black",
        filename: `${safeName}_reel.mp4`,
      });
    }

    setBatchExportIndex(-1);
    setBatchExportTotal(0);
    exitSelecting();
    toast({ title: `Exported ${selectedReels.length} reel${selectedReels.length !== 1 ? "s" : ""}` });
  }, [reels, selected, startExport, resetExport, exitSelecting, toast]);

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

  const isBatchExporting = batchExportIndex >= 0;

  const filteredReels = reels.filter((r) => {
    if (filter === "cloned") return r.source_template !== null;
    if (filter === "matched") return r.source_template === null;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-lg font-semibold">Reels</h1>
        <div className="flex gap-2">
          {!selecting && (
            <>
              <Button size="sm" variant="outline" onClick={() => setShowCloneDialog(true)}>
                <LinkSimple className="h-4 w-4 mr-1" /> Clone
              </Button>
              <Button size="sm" onClick={() => setShowDialog(true)}>
                <Plus className="h-4 w-4 mr-1" /> New Reel
              </Button>
            </>
          )}
        </div>
      </div>

      {reels.length > 0 && (
        <div className="flex items-center justify-between">
          {selecting ? (
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">
                {selected.size} selected
              </p>
              {selected.size > 0 && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBatchExport}
                    disabled={isBatchExporting}
                  >
                    <Export className="h-4 w-4 mr-1" /> Export
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setShowBatchDelete(true)}
                  >
                    <Trash className="h-4 w-4 mr-1" /> Delete
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="flex gap-1">
              {(["all", "matched", "cloned"] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? "default" : "outline"}
                  className="h-7 text-xs px-2.5"
                  onClick={() => setFilter(f)}
                >
                  {f === "all" ? "All" : f === "cloned" ? "Cloned" : "Matched"}
                </Button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            {!selecting && (
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
            )}
            <Button
              size="sm"
              variant={selecting ? "default" : "outline"}
              onClick={() => selecting ? exitSelecting() : setSelecting(true)}
            >
              {selecting ? (
                <><X className="h-4 w-4 mr-1" /> Cancel</>
              ) : (
                "Select"
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Batch export progress */}
      {isBatchExporting && (
        <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
          <p className="text-sm font-medium">
            Exporting reel {batchExportIndex + 1} of {batchExportTotal}...
          </p>
          <Progress
            value={Math.round((progress?.overallProgress ?? 0) * 100)}
            className="h-2"
          />
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
              {filteredReels.map((reel) => {
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
                const isSelected = selected.has(reel.id);

                return (
                  <div
                    key={reel.id}
                    className={`rounded-lg border bg-card overflow-hidden cursor-pointer transition-colors group ${
                      isSelected ? "ring-2 ring-primary" : "hover:border-primary/50"
                    }`}
                    onClick={() => selecting ? toggleSelect(reel.id) : navigate(`/reels/${reel.id}`)}
                  >
                    <div className="relative aspect-[9/16]">
                      {firstSeg?.video?.url ? (
                        <VideoThumbnail
                          src={`${firstSeg.video.url}#t=${firstSeg.start_seconds}`}
                          thumbnailUrl={firstSeg.video.thumbnail_url}
                          className="w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full bg-black flex items-center justify-center">
                          <VideoCamera className="h-8 w-8 text-white/30" />
                        </div>
                      )}
                      <div className="absolute bottom-1.5 right-1.5">
                        <Badge variant="secondary" className="bg-black/60 text-white text-[10px] border-0 px-1.5 py-0">
                          {formatDuration(Math.round(totalDuration))}
                        </Badge>
                      </div>
                      {selecting ? (
                        <div className="absolute top-1.5 left-1.5">
                          {isSelected ? (
                            <CheckSquare className="h-5 w-5 text-primary drop-shadow" weight="fill" />
                          ) : (
                            <Square className="h-5 w-5 text-white/70 drop-shadow" />
                          )}
                        </div>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-1 right-1 h-6 w-6 bg-black/40 hover:bg-black/60 text-white"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DotsThree className="h-4 w-4" weight="bold" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => navigate(`/reels/${reel.id}?export=true`)}>
                              <Export className="h-4 w-4 mr-2" /> Export
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteTarget(reel)}
                            >
                              <Trash className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
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
                      <div className="flex gap-1.5 flex-wrap">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {reel.reel_segments.length} clip{reel.reel_segments.length !== 1 ? "s" : ""}
                        </Badge>
                        {reel.source_template && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            Cloned
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
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
              {[...filteredReels]
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
                  const isSelected = selected.has(reel.id);

                  return (
                    <div
                      key={reel.id}
                      className={`rounded-lg border bg-card overflow-hidden cursor-pointer transition-colors group flex ${
                        isSelected ? "ring-2 ring-primary" : "hover:bg-accent"
                      }`}
                      onClick={() => selecting ? toggleSelect(reel.id) : navigate(`/reels/${reel.id}`)}
                    >
                      {selecting && (
                        <div className="shrink-0 w-10 flex items-center justify-center">
                          {isSelected ? (
                            <CheckSquare className="h-5 w-5 text-primary" weight="fill" />
                          ) : (
                            <Square className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      )}
                      <div className="shrink-0 w-14">
                        {firstSeg?.video?.url ? (
                          <VideoThumbnail
                            src={`${firstSeg.video.url}#t=${firstSeg.start_seconds}`}
                            thumbnailUrl={firstSeg.video.thumbnail_url}
                            className="w-full aspect-[9/16]"
                            iconSize="sm"
                          />
                        ) : (
                          <div className="w-full aspect-[9/16] bg-black flex items-center justify-center">
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
                          {reel.source_template && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              Cloned
                            </Badge>
                          )}
                          {!selecting && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <DotsThree className="h-4 w-4" weight="bold" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem onClick={() => navigate(`/reels/${reel.id}?export=true`)}>
                                  <Export className="h-4 w-4 mr-2" /> Export
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteTarget(reel)}
                                >
                                  <Trash className="h-4 w-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
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

      {/* Single delete */}
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

      {/* Batch delete */}
      <AlertDialog open={showBatchDelete} onOpenChange={setShowBatchDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} reel{selected.size !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected reels and all their segments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBatchDelete}
            >
              Delete {selected.size} reel{selected.size !== 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
