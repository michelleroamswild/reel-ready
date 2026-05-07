import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useVideos } from "@/hooks/use-videos";
import { UploadCancelledError } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { FilmStrip, UploadSimple, Trash, ArrowsClockwise, Sparkle, ArrowClockwise, Faders, VideoCamera, X, CheckCircle, CircleNotch } from "@phosphor-icons/react";
import { VideoThumbnail } from "@/components/VideoThumbnail";
import { VideoFilterSheet, emptyFilters, type VideoFilters } from "@/components/VideoFilterSheet";
import type { Video } from "@/types/video";

interface UploadProgress {
  filename: string;
  percent: number;
}

interface UploadComplete {
  filename: string;
  count: number;
}

export default function VideosPage() {
  const navigate = useNavigate();
  const { videos, isLoading, uploadVideo, isUploading, analyzeVideo, isAnalyzing, deleteVideo, deletingVideoId } = useVideos();
  const [bulkProgress, setBulkProgress] = useState<UploadProgress[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadFilename, setUploadFilename] = useState<string | null>(null);
  const [uploadComplete, setUploadComplete] = useState<UploadComplete | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [deleteVideo_, setDeleteVideo_] = useState<Video | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<VideoFilters>(emptyFilters);
  const isBulkUploading = bulkProgress.length > 0;

  const [showUpload, setShowUpload] = useState(false);
  const [uploadType, setUploadType] = useState<"clip" | "edit">("clip");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  const completeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    return () => {
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    };
  }, []);

  const activeFilterCount = Object.values(filters).reduce((sum, arr) => sum + arr.length, 0);

  // Build mood/type chips from analyzed videos for the horizontal rail
  const moodCounts = useMemo(() => {
    const c = new Map<string, number>();
    videos.forEach((v) => {
      const mood = v.analysis?.mood?.toLowerCase();
      if (mood) c.set(mood, (c.get(mood) ?? 0) + 1);
    });
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [videos]);

  const filteredVideos = useMemo(() => {
    return videos.filter((v: Video) => {
      if (filters.type.length > 0 && !filters.type.includes(v.video_type)) return false;
      if (!v.analysis) {
        return filters.mood.length === 0 &&
          filters.energy.length === 0 &&
          filters.pacing.length === 0 &&
          filters.tags.length === 0 &&
          filters.shotTypes.length === 0;
      }
      if (filters.mood.length > 0 && !filters.mood.includes(v.analysis.mood?.toLowerCase())) return false;
      if (filters.energy.length > 0 && !filters.energy.includes(v.analysis.energy?.toLowerCase())) return false;
      if (filters.pacing.length > 0 && !filters.pacing.includes(v.analysis.pacing?.toLowerCase())) return false;
      if (filters.tags.length > 0) {
        const videoTags = (v.analysis.sceneTags ?? []).map((t) => t.toLowerCase());
        if (!filters.tags.some((t) => videoTags.includes(t))) return false;
      }
      if (filters.shotTypes.length > 0) {
        const videoShots = (v.analysis.shotTypes ?? []).map((s) => s.toLowerCase());
        if (!filters.shotTypes.some((s) => videoShots.includes(s))) return false;
      }
      return true;
    });
  }, [videos, filters]);

  const uploading = isUploading || isBulkUploading;

  const handleCancelUpload = () => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    setUploadProgress(null);
    setUploadFilename(null);
    setBulkProgress([]);
  };

  const showComplete = (filename: string, count: number) => {
    if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    setUploadComplete({ filename, count });
    completeTimerRef.current = setTimeout(() => setUploadComplete(null), 30000);
  };

  const handleStartUpload = async () => {
    if (selectedFiles.length === 0) return;

    const files = [...selectedFiles];
    const savedType = uploadType;

    setShowUpload(false);
    setSelectedFiles([]);
    setUploadType("clip");

    const controller = new AbortController();
    abortRef.current = controller;
    cancelledRef.current = false;

    if (files.length === 1) {
      try {
        setUploadFilename(files[0].name);
        setUploadProgress(0);
        await uploadVideo({
          file: files[0],
          videoType: savedType,
          onProgress: setUploadProgress,
          signal: controller.signal,
        });
        setUploadProgress(null);
        setUploadFilename(null);
        showComplete(files[0].name, 1);
      } catch (err) {
        if (err instanceof UploadCancelledError) {
          // cancelled
        } else {
          console.error("Upload failed:", err);
        }
        setUploadProgress(null);
        setUploadFilename(null);
      }
    } else {
      const progress: UploadProgress[] = files.map((f) => ({ filename: f.name, percent: 0 }));
      setBulkProgress([...progress]);
      let completed = 0;

      for (let i = 0; i < files.length; i++) {
        if (cancelledRef.current) break;
        try {
          await uploadVideo({
            file: files[i],
            videoType: savedType,
            onProgress: (percent) => {
              progress[i] = { filename: files[i].name, percent };
              setBulkProgress([...progress]);
            },
            signal: controller.signal,
          });
          progress[i] = { filename: files[i].name, percent: 100 };
          setBulkProgress([...progress]);
          completed++;
        } catch (err) {
          if (err instanceof UploadCancelledError) break;
          console.error(`Upload failed for ${files[i].name}:`, err);
          progress[i] = { filename: files[i].name, percent: -1 };
          setBulkProgress([...progress]);
        }
      }

      setBulkProgress([]);
      if (completed > 0 && !cancelledRef.current) {
        showComplete(files[0].name, completed);
      }
    }

    abortRef.current = null;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) setSelectedFiles((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = (video: Video) => {
    setAnalyzingId(video.id);
    analyzeVideo(video);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const toggleMoodFilter = (mood: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      next.mood = prev.mood.includes(mood)
        ? prev.mood.filter((m) => m !== mood)
        : [...prev.mood, mood];
      return next;
    });
  };

  return (
    <div className="space-y-6 fade-up">
      {/* Editorial header */}
      <header className="space-y-3 pb-1">
        <span className="eyebrow">Source</span>
        <div className="flex items-end justify-between gap-4">
          <h1 className="ed-display text-[44px] md:text-[64px] text-ink">Videos</h1>
          <Button
            disabled={uploading}
            className="rounded-full bg-brand text-brand-ink hover:bg-brand/90 font-semibold h-9 px-4 shrink-0"
            onClick={() => setShowUpload(true)}
          >
            <UploadSimple className="h-4 w-4 mr-1.5" weight="bold" /> Upload
          </Button>
        </div>
        <p className="text-[13px] text-muted-foreground">
          {videos.length} clip{videos.length !== 1 ? "s" : ""}
          {videos.filter((v) => v.video_type === "edit").length > 0 &&
            ` · ${videos.filter((v) => v.video_type === "edit").length} edits`}
        </p>
      </header>

      {/* Toolbar: filter pill */}
      {videos.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterOpen(true)}
            className="h-8 rounded-full border-hairline-strong relative"
          >
            <Faders className="h-4 w-4 mr-1.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1.5 chip chip-accent !text-[10px] !px-1.5 !py-0.5 !font-bold">{activeFilterCount}</span>
            )}
          </Button>
        </div>
      )}

      {/* Mood / chip rail */}
      {moodCounts.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
          <button
            onClick={() => setFilters(emptyFilters)}
            className={`chip ${filters.mood.length === 0 ? "chip-dark" : "chip-outline"}`}
          >
            All <span className="opacity-60">· {videos.length}</span>
          </button>
          {moodCounts.map(([mood, count]) => {
            const active = filters.mood.includes(mood);
            return (
              <button
                key={mood}
                onClick={() => toggleMoodFilter(mood)}
                className={`chip capitalize ${active ? "chip-dark" : "chip-outline"}`}
              >
                {mood} <span className="opacity-60">· {count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Upload complete banner */}
      {uploadComplete && (
        <div className="rounded-xl border border-hairline bg-surface px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="h-5 w-5 text-emerald-600" weight="fill" />
            <p className="text-[13px] font-medium text-ink">
              {uploadComplete.count === 1
                ? `${uploadComplete.filename} uploaded`
                : `${uploadComplete.count} videos uploaded`}
            </p>
          </div>
          <button
            className="text-muted-foreground hover:text-ink"
            onClick={() => {
              setUploadComplete(null);
              if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Single upload progress */}
      {isUploading && uploadProgress !== null && !isBulkUploading && (
        <div className="rounded-xl border border-hairline bg-surface px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-ink truncate">
              Uploading{uploadFilename ? ` ${uploadFilename}` : ""}…
            </p>
            <button
              className="text-[12px] text-muted-foreground hover:text-destructive"
              onClick={handleCancelUpload}
            >
              Cancel
            </button>
          </div>
          <div className="progress-hair">
            <i style={{ width: `${uploadProgress}%` }} />
          </div>
          <p className="text-[11px] text-muted-foreground text-right">{uploadProgress}%</p>
        </div>
      )}

      {/* Bulk upload progress */}
      {isBulkUploading && (
        <div className="rounded-xl border border-hairline bg-surface px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-ink">
              Uploading {bulkProgress.filter((p) => p.percent === 100).length} of {bulkProgress.length} videos…
            </p>
            <button
              className="text-[12px] text-muted-foreground hover:text-destructive"
              onClick={handleCancelUpload}
            >
              Cancel
            </button>
          </div>
          {bulkProgress.map((p, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-[12px] truncate max-w-[70%] text-ink">{p.filename}</p>
                <p className="text-[11px] text-muted-foreground">
                  {p.percent === -1 ? "Failed" : p.percent === 100 ? "Done" : `${p.percent}%`}
                </p>
              </div>
              <div className="progress-hair">
                <i
                  style={{
                    width: `${Math.max(p.percent, 0)}%`,
                    background: p.percent === -1 ? "hsl(var(--destructive))" : undefined,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-12">Loading…</p>
      ) : videos.length === 0 && !uploading && activeFilterCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="grid place-items-center h-14 w-14 rounded-full bg-surface-2">
            <FilmStrip className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-[14px] text-muted-foreground max-w-xs">
            No videos yet. Upload your first clip.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filteredVideos.map((v: Video) => (
            <article
              key={v.id}
              className="group cursor-pointer"
              onClick={() => navigate(`/videos/${v.id}`)}
            >
              <div className="reel-thumb hoverable border border-hairline">
                <VideoThumbnail
                  src={v.url}
                  thumbnailUrl={v.thumbnail_url}
                  className="w-full h-full"
                />
                <div className="scrim-bottom" />

                {/* Edit type badge */}
                {v.video_type === "edit" && <span className="badge !bg-brand !text-brand-ink">Edit</span>}

                {/* Hover actions */}
                <div className="absolute top-1.5 right-1.5 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    disabled={isAnalyzing && analyzingId === v.id}
                    className="h-7 w-7 grid place-items-center rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-sm"
                    onClick={(e) => { e.stopPropagation(); handleAnalyze(v); }}
                    title={v.analysis ? "Re-analyze with AI" : "Analyze with AI"}
                  >
                    {isAnalyzing && analyzingId === v.id ? (
                      <ArrowsClockwise className="h-3.5 w-3.5 animate-spin" />
                    ) : v.analysis ? (
                      <ArrowClockwise className="h-3.5 w-3.5" />
                    ) : (
                      <Sparkle className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    className="h-7 w-7 grid place-items-center rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-sm"
                    onClick={(e) => { e.stopPropagation(); setDeleteVideo_(v); }}
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </button>
                </div>

                {deletingVideoId === v.id && (
                  <div className="absolute inset-0 bg-black/50 grid place-items-center z-20">
                    <CircleNotch className="h-6 w-6 text-white animate-spin" />
                  </div>
                )}

                <div className="meta">
                  <p className="text-[11px] font-semibold text-white tracking-tight truncate drop-shadow-sm">
                    {v.filename}
                  </p>
                  <p className="text-[10px] text-white/75 mt-0.5">
                    {v.analysis?.mood && <span className="capitalize">{v.analysis.mood} · </span>}
                    {formatSize(v.size_bytes)}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {!isLoading && videos.length > 0 && filteredVideos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
          <p className="text-sm text-muted-foreground">No videos match the current filters.</p>
          <Button variant="link" size="sm" onClick={() => setFilters(emptyFilters)}>Clear filters</Button>
        </div>
      )}

      <VideoFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onFiltersChange={setFilters}
        videos={videos}
      />

      <Dialog
        open={showUpload}
        onOpenChange={(open) => {
          if (!open && !uploading) {
            setShowUpload(false);
            setSelectedFiles([]);
            setUploadType("clip");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload videos</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-[13px] font-medium text-ink mb-2">Video type</p>
              <div className="inline-flex bg-surface-2 rounded-full p-0.5">
                {(["clip", "edit"] as const).map((type) => {
                  const isActive = uploadType === type;
                  return (
                    <button
                      key={type}
                      className={`flex items-center gap-1.5 px-3 h-8 rounded-full text-[12px] font-semibold transition-colors ${
                        isActive ? "bg-mist text-ink shadow-sm" : "text-muted-foreground hover:text-ink"
                      }`}
                      onClick={() => setUploadType(type)}
                    >
                      {type === "clip" ? <VideoCamera className="h-3.5 w-3.5" /> : <FilmStrip className="h-3.5 w-3.5" />}
                      {type === "clip" ? "Clip" : "Edit"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className="border-2 border-dashed border-hairline-strong rounded-xl p-6 text-center cursor-pointer hover:border-brand/50 hover:bg-brand/5 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadSimple className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-[13px] text-ink font-medium">Click to browse or drop files</p>
              <p className="text-[11px] text-muted-foreground mt-1">Accepts video files</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {selectedFiles.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {selectedFiles.map((file, i) => (
                  <div
                    key={`${file.name}-${i}`}
                    className="flex items-center justify-between rounded-lg border border-hairline bg-surface px-3 py-2 text-[13px]"
                  >
                    <span className="truncate mr-2 text-ink">{file.name}</span>
                    <button
                      className="shrink-0 text-muted-foreground hover:text-ink"
                      onClick={() => removeFile(i)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Button
              className="w-full rounded-full bg-brand text-brand-ink hover:bg-brand/90 font-semibold h-10"
              disabled={selectedFiles.length === 0 || uploading}
              onClick={handleStartUpload}
            >
              <UploadSimple className="h-4 w-4 mr-1.5" weight="bold" />
              Upload {selectedFiles.length > 0 ? `${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""}` : ""}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteVideo_ !== null} onOpenChange={(open) => !open && setDeleteVideo_(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete video?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteVideo_?.filename}" will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteVideo_) deleteVideo(deleteVideo_.id);
                setDeleteVideo_(null);
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
