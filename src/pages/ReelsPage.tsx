import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useReels } from "@/hooks/use-reels";
import { useVideos } from "@/hooks/use-videos";
import { useExportReel } from "@/hooks/use-export-reel";
import { useGenerateTrialReelsFromVideo } from "@/hooks/use-trial-reels";
import { CloneReelDialog } from "@/components/CloneReelDialog";
import { TrialReelDialog } from "@/components/TrialReelDialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Flask,
  CaretDown,
  Layout,
  Faders,
} from "@phosphor-icons/react";
import { VideoThumbnail } from "@/components/VideoThumbnail";
import { ReelFilterSheet, type ReelFilter } from "@/components/ReelFilterSheet";
import type { ReelWithDetails } from "@/types/reel";

export default function ReelsPage() {
  const navigate = useNavigate();
  const { reels, isLoading, deleteReel } = useReels();
  const { videos } = useVideos();
  const generateTrialReels = useGenerateTrialReelsFromVideo();
  const { toast } = useToast();
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [showTrialDialog, setShowTrialDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReelWithDetails | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const [filter, setFilter] = useState<ReelFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);

  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBatchDelete, setShowBatchDelete] = useState(false);

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
    for (const id of selected) deleteReel(id);
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

      const safeName = reel.title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50).toLowerCase();

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
        textBorder: (reel.text_border as "none" | "outline" | "shadow" | "box") ?? "shadow",
        textBorderColor: (reel.text_border_color as "black" | "white") ?? "black",
        textWidth: parseInt(reel.text_width ?? "100", 10) || 100,
        textShadowIntensity: parseInt(reel.text_shadow_intensity ?? "5", 10) || 5,
        filename: `${safeName}_reel.mp4`,
      });
    }

    setBatchExportIndex(-1);
    setBatchExportTotal(0);
    exitSelecting();
    toast({ title: `Exported ${selectedReels.length} reel${selectedReels.length !== 1 ? "s" : ""}` });
  }, [reels, selected, startExport, resetExport, exitSelecting, toast]);

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

  const sortedReels = [...filteredReels].sort((a, b) => {
    const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return sortNewestFirst ? diff : -diff;
  });

  return (
    <div className="space-y-6 fade-up">
      {/* Editorial header */}
      <header className="space-y-3 pb-1">
        <span className="eyebrow">Library</span>
        <div className="flex items-end justify-between gap-4">
          <h1 className="ed-display text-[44px] md:text-[64px] text-ink">Reels</h1>
          {!selecting && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="rounded-full bg-brand text-brand-ink hover:bg-brand/90 font-semibold h-9 px-4 shrink-0">
                  <Plus className="h-4 w-4 mr-1" weight="bold" /> New
                  <CaretDown className="h-3 w-3 ml-1.5 opacity-80" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowCloneDialog(true)}>
                  <LinkSimple className="h-4 w-4 mr-2" /> Clone Reel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/templates")}>
                  <Layout className="h-4 w-4 mr-2" /> From Template
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowTrialDialog(true)}>
                  <Flask className="h-4 w-4 mr-2" /> Trial Reels
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <p className="text-[13px] text-muted-foreground">
          {filter === "all"
            ? `${reels.length} reel${reels.length !== 1 ? "s" : ""} · ${reels.filter((r) => r.source_template).length} cloned`
            : `${filteredReels.length} of ${reels.length}`}
        </p>
      </header>

      {/* Toolbar */}
      {reels.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          {selecting ? (
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium text-ink">{selected.size} selected</span>
              {selected.size > 0 && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-full border-hairline-strong"
                    onClick={handleBatchExport}
                    disabled={isBatchExporting}
                  >
                    <Export className="h-4 w-4 mr-1" /> Export
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-full border-hairline-strong text-destructive hover:text-destructive"
                    onClick={() => setShowBatchDelete(true)}
                  >
                    <Trash className="h-4 w-4 mr-1" /> Delete
                  </Button>
                </>
              )}
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilterOpen(true)}
              className="h-8 rounded-full border-hairline-strong relative"
            >
              <Faders className="h-4 w-4 mr-1.5" />
              Filters
              {filter !== "all" && <span className="ml-1.5 accent-dot" />}
            </Button>
          )}
          <div className="flex items-center gap-1">
            {!selecting && (
              <div className="flex items-center bg-surface-2 rounded-full p-0.5">
                <button
                  onClick={() => setView("grid")}
                  className={`h-7 w-8 grid place-items-center rounded-full transition-colors ${view === "grid" ? "bg-mist text-ink shadow-sm" : "text-muted-foreground hover:text-ink"}`}
                  title="Grid view"
                >
                  <SquaresFour className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setView("list")}
                  className={`h-7 w-8 grid place-items-center rounded-full transition-colors ${view === "list" ? "bg-mist text-ink shadow-sm" : "text-muted-foreground hover:text-ink"}`}
                  title="List view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-3 rounded-full text-[13px]"
              onClick={() => (selecting ? exitSelecting() : setSelecting(true))}
            >
              {selecting ? (<><X className="h-4 w-4 mr-1" /> Cancel</>) : "Select"}
            </Button>
          </div>
        </div>
      )}

      {/* Batch export progress */}
      {isBatchExporting && (
        <div className="rounded-xl border border-hairline bg-surface px-4 py-3 space-y-2">
          <p className="text-[13px] font-medium text-ink">
            Exporting reel {batchExportIndex + 1} of {batchExportTotal}…
          </p>
          <div className="progress-hair">
            <i style={{ width: `${Math.round((progress?.overallProgress ?? 0) * 100)}%` }} />
          </div>
        </div>
      )}

      {/* Body */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-12">Loading…</p>
      ) : reels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="grid place-items-center h-14 w-14 rounded-full bg-surface-2">
            <VideoCamera className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-[14px] text-muted-foreground max-w-xs">
            No reels yet. Clone a trending reel or generate trial variants.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-hairline-strong"
              onClick={() => setShowCloneDialog(true)}
            >
              <LinkSimple className="h-4 w-4 mr-1" /> Clone Reel
            </Button>
            <Button
              size="sm"
              className="rounded-full bg-brand text-brand-ink hover:bg-brand/90"
              onClick={() => setShowTrialDialog(true)}
            >
              <Flask className="h-4 w-4 mr-1" /> Trial Reels
            </Button>
          </div>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {sortedReels.map((reel) => {
            const totalDuration = reel.reel_segments.reduce(
              (sum, seg) => sum + (seg.end_seconds - seg.start_seconds),
              0
            );
            const firstSeg = reel.reel_segments[0];
            const isSelected = selected.has(reel.id);
            const cloned = !!reel.source_template;

            return (
              <article
                key={reel.id}
                className={`group cursor-pointer ${isSelected ? "ring-2 ring-brand rounded-xl" : ""}`}
                onClick={() => (selecting ? toggleSelect(reel.id) : navigate(`/reels/${reel.id}`))}
              >
                <div className="reel-thumb hoverable border border-hairline">
                  {firstSeg?.video?.url ? (
                    <VideoThumbnail
                      src={`${firstSeg.video.url}#t=${firstSeg.start_seconds}`}
                      thumbnailUrl={firstSeg.video.thumbnail_url}
                      className="w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full thumb-placeholder grid place-items-center">
                      <VideoCamera className="h-6 w-6 text-white/40" />
                    </div>
                  )}
                  <div className="scrim-bottom" />

                  {/* Top-left: select / cloned badge */}
                  {selecting ? (
                    <div className="absolute top-2 left-2 z-10">
                      {isSelected ? (
                        <CheckSquare className="h-5 w-5 text-brand drop-shadow" weight="fill" />
                      ) : (
                        <Square className="h-5 w-5 text-white/85 drop-shadow" />
                      )}
                    </div>
                  ) : cloned ? (
                    <span className="badge !bg-brand !text-brand-ink">Cloned</span>
                  ) : null}

                  {/* Top-right: menu */}
                  {!selecting && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="absolute top-1.5 right-1.5 z-10 h-7 w-7 grid place-items-center rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DotsThree className="h-4 w-4" weight="bold" />
                        </button>
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

                  {/* Bottom: title + meta */}
                  <div className="meta">
                    <p className="text-[12px] font-semibold tracking-tight leading-tight line-clamp-2 drop-shadow-sm">
                      {reel.title}
                    </p>
                    <p className="mt-1 text-[10px] font-medium text-white/75 tracking-[0.02em]">
                      {formatDuration(Math.round(totalDuration))} · {reel.reel_segments.length} clip{reel.reel_segments.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        // List view
        <div className="space-y-2">
          <div className="flex justify-end">
            <button
              onClick={() => setSortNewestFirst((v) => !v)}
              className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-ink transition-colors"
            >
              {sortNewestFirst ? <SortDescending className="h-3.5 w-3.5" /> : <SortAscending className="h-3.5 w-3.5" />}
              {sortNewestFirst ? "Newest first" : "Oldest first"}
            </button>
          </div>
          {sortedReels.map((reel, idx) => {
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
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-surface cursor-pointer transition-colors ${
                  isSelected ? "border-brand ring-1 ring-brand" : "border-hairline hover:border-hairline-strong"
                }`}
                onClick={() => (selecting ? toggleSelect(reel.id) : navigate(`/reels/${reel.id}`))}
              >
                {selecting && (
                  <div className="shrink-0">
                    {isSelected ? (
                      <CheckSquare className="h-5 w-5 text-brand" weight="fill" />
                    ) : (
                      <Square className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                )}
                <span className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground w-6 shrink-0">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <div className="shrink-0 w-12 rounded-md overflow-hidden">
                  {firstSeg?.video?.url ? (
                    <VideoThumbnail
                      src={`${firstSeg.video.url}#t=${firstSeg.start_seconds}`}
                      thumbnailUrl={firstSeg.video.thumbnail_url}
                      className="w-full aspect-[9/16]"
                      iconSize="sm"
                    />
                  ) : (
                    <div className="w-full aspect-[9/16] thumb-placeholder" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-ink truncate tracking-tight">{reel.title}</p>
                  <p className="text-[12px] text-muted-foreground line-clamp-1 mt-0.5">
                    {reel.phrase?.text ??
                      reel.reel_segments[0]?.section_text ??
                      (reel.source_template ? `Cloned · ${reel.source_template.overallMood}` : "—")}
                  </p>
                </div>
                <div className="shrink-0 hidden sm:flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{dateStr}</span>
                  <span className="chip chip-outline !text-[10.5px] !px-2 !py-1 !font-medium">
                    {formatDuration(Math.round(totalDuration))}
                  </span>
                  {reel.source_template && (
                    <span className="chip chip-accent !text-[10.5px] !px-2 !py-1">Cloned</span>
                  )}
                </div>
                {!selecting && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="shrink-0 h-8 w-8 grid place-items-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-ink transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DotsThree className="h-4 w-4" weight="bold" />
                      </button>
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
            );
          })}
        </div>
      )}

      {!isLoading && reels.length > 0 && filteredReels.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
          <p className="text-sm text-muted-foreground">No reels match the current filter.</p>
          <Button variant="link" size="sm" onClick={() => setFilter("all")}>Clear filter</Button>
        </div>
      )}

      <ReelFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filter={filter}
        onFilterChange={setFilter}
      />

      <TrialReelDialog
        open={showTrialDialog}
        onOpenChange={setShowTrialDialog}
        videos={videos}
        isPending={generateTrialReels.isPending}
        onGenerate={async (opts) => {
          if (!opts.selectedVideo) return;
          setShowTrialDialog(false);
          try {
            const batchId = await generateTrialReels.mutateAsync({
              video: opts.selectedVideo,
              allVideos: videos,
              trendingAudio: opts.trendingAudio,
              referencePatterns: opts.referencePatterns,
              referenceUrls: opts.referenceUrls,
            });
            navigate(`/trials/${batchId}`);
          } catch (err) {
            const message = err instanceof Error ? err.message : "Something went wrong";
            toast({ variant: "destructive", title: "Failed to generate trial reels", description: message });
          }
        }}
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

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete reel?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" and all its segments will be permanently deleted.
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
