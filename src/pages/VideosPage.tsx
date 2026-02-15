import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useVideos } from "@/hooks/use-videos";
import { UploadCancelledError } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { FilmStrip, UploadSimple, Trash, ArrowsClockwise, Sparkle, ArrowClockwise, Faders, VideoCamera, X, CheckCircle } from "@phosphor-icons/react";
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
  const { videos, isLoading, uploadVideo, isUploading, analyzeVideo, isAnalyzing, deleteVideo } = useVideos();
  const [bulkProgress, setBulkProgress] = useState<UploadProgress[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadFilename, setUploadFilename] = useState<string | null>(null);
  const [uploadComplete, setUploadComplete] = useState<UploadComplete | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [deleteVideo_, setDeleteVideo_] = useState<Video | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<VideoFilters>(emptyFilters);
  const isBulkUploading = bulkProgress.length > 0;

  // Upload dialog state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadType, setUploadType] = useState<"clip" | "edit">("clip");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cancel support
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  // Auto-dismiss completion banner after 30s
  const completeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    return () => {
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    };
  }, []);

  const activeFilterCount = Object.values(filters).reduce((sum, arr) => sum + arr.length, 0);

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

    // Close dialog immediately so progress shows on the main page
    setShowUpload(false);
    setSelectedFiles([]);
    setUploadType("clip");

    // Set up abort controller
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
          // Cancelled — already cleaned up in handleCancelUpload
        } else {
          console.error("Upload failed:", err);
        }
        setUploadProgress(null);
        setUploadFilename(null);
      }
    } else {
      const progress: UploadProgress[] = files.map((f) => ({
        filename: f.name,
        percent: 0,
      }));
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
    if (files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...files]);
    }
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-lg font-semibold">Videos</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterOpen(true)}
            className="relative"
          >
            <Faders className="h-4 w-4 mr-1" />
            Filters
            {activeFilterCount > 0 && (
              <Badge className="absolute -top-2 -right-2 h-4 min-w-4 px-1 text-[10px] leading-none flex items-center justify-center">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          <Button size="sm" disabled={uploading} onClick={() => setShowUpload(true)}>
            <UploadSimple className="h-4 w-4 mr-1" />
            Upload
          </Button>
        </div>
      </div>

      {/* Upload complete banner */}
      {uploadComplete && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" weight="fill" />
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              {uploadComplete.count === 1
                ? `${uploadComplete.filename} uploaded successfully`
                : `${uploadComplete.count} videos uploaded successfully`}
            </p>
          </div>
          <button
            className="text-muted-foreground hover:text-foreground"
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
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium truncate">
              Uploading{uploadFilename ? ` ${uploadFilename}` : ""}...
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={handleCancelUpload}
            >
              Cancel
            </Button>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-right">{uploadProgress}%</p>
        </div>
      )}

      {/* Bulk upload progress */}
      {isBulkUploading && (
        <div className="rounded-lg border bg-card p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              Uploading {bulkProgress.filter((p) => p.percent === 100).length} of{" "}
              {bulkProgress.length} videos...
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={handleCancelUpload}
            >
              Cancel
            </Button>
          </div>
          {bulkProgress.map((p, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs truncate max-w-[70%]">{p.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {p.percent === -1 ? "Failed" : p.percent === 100 ? "Done" : `${p.percent}%`}
                </p>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    p.percent === -1 ? "bg-destructive" : "bg-primary"
                  }`}
                  style={{ width: `${Math.max(p.percent, 0)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
      ) : videos.length === 0 && !uploading && activeFilterCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <FilmStrip className="h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground max-w-xs">
            No videos yet. Upload your first clip!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {filteredVideos.map((v: Video) => (
            <div
              key={v.id}
              className="relative rounded-lg border bg-card overflow-hidden cursor-pointer group"
              onClick={() => navigate(`/videos/${v.id}`)}
            >
              <VideoThumbnail
                src={v.url}
                thumbnailUrl={v.thumbnail_url}
                className="w-full aspect-[9/16]"
              />
              {/* Overlay actions */}
              <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-6 w-6 rounded-full bg-black/50 hover:bg-black/70 text-white"
                  disabled={isAnalyzing && analyzingId === v.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAnalyze(v);
                  }}
                  title={v.analysis ? "Re-analyze with AI" : "Analyze with AI"}
                >
                  {isAnalyzing && analyzingId === v.id ? (
                    <ArrowsClockwise className="h-3 w-3 animate-spin" />
                  ) : v.analysis ? (
                    <ArrowClockwise className="h-3 w-3" />
                  ) : (
                    <Sparkle className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-6 w-6 rounded-full bg-black/50 hover:bg-black/70 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteVideo_(v);
                  }}
                >
                  <Trash className="h-3 w-3" />
                </Button>
              </div>
              {/* Edit badge */}
              {v.video_type === "edit" && (
                <div className="absolute top-1 left-1">
                  <Badge variant="secondary" className="bg-black/60 text-white text-[9px] border-0 px-1 py-0">
                    Edit
                  </Badge>
                </div>
              )}
              {/* Filename + size */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1 pt-4">
                <p className="text-[10px] text-white truncate">{v.filename}</p>
                <p className="text-[9px] text-white/70">{formatSize(v.size_bytes)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No results after filtering */}
      {!isLoading && videos.length > 0 && filteredVideos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
          <p className="text-sm text-muted-foreground">No videos match the current filters.</p>
          <Button variant="link" size="sm" onClick={() => setFilters(emptyFilters)}>
            Clear filters
          </Button>
        </div>
      )}

      <VideoFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onFiltersChange={setFilters}
        videos={videos}
      />

      {/* Upload Dialog */}
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
            <DialogTitle>Upload Videos</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Clip / Edit toggle */}
            <div>
              <p className="text-sm font-medium mb-2">Video type</p>
              <div className="flex rounded-md overflow-hidden border w-fit">
                {(["clip", "edit"] as const).map((type) => {
                  const isActive = uploadType === type;
                  return (
                    <button
                      key={type}
                      className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-transparent text-muted-foreground hover:text-foreground"
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

            {/* Drop zone / file picker */}
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadSimple className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Click to browse or drag files here
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Accepts video files
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Selected files list */}
            {selectedFiles.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {selectedFiles.map((file, i) => (
                  <div
                    key={`${file.name}-${i}`}
                    className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-sm"
                  >
                    <span className="truncate mr-2">{file.name}</span>
                    <button
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => removeFile(i)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload action */}
            <Button
              className="w-full"
              disabled={selectedFiles.length === 0 || uploading}
              onClick={handleStartUpload}
            >
              <UploadSimple className="h-4 w-4 mr-1" />
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
