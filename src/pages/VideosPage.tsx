import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useVideos } from "@/hooks/use-videos";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { FilmStrip, UploadSimple, CaretDown, FileVideo, CopySimple, Trash, ArrowsClockwise, Sparkle, ArrowClockwise, Faders } from "@phosphor-icons/react";
import { VideoThumbnail } from "@/components/VideoThumbnail";
import { VideoFilterSheet, emptyFilters, type VideoFilters } from "@/components/VideoFilterSheet";
import type { Video } from "@/types/video";

interface UploadProgress {
  filename: string;
  percent: number;
}

export default function VideosPage() {
  const navigate = useNavigate();
  const { videos, isLoading, uploadVideo, isUploading, analyzeVideo, isAnalyzing, deleteVideo } = useVideos();
  const singleInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const [bulkProgress, setBulkProgress] = useState<UploadProgress[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [deleteVideo_, setDeleteVideo_] = useState<Video | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<VideoFilters>(emptyFilters);
  const isBulkUploading = bulkProgress.length > 0;

  const activeFilterCount = Object.values(filters).reduce((sum, arr) => sum + arr.length, 0);

  const filteredVideos = useMemo(() => {
    return videos.filter((v: Video) => {
      // Type filter
      if (filters.type.length > 0 && !filters.type.includes(v.video_type)) return false;

      // Analysis-based filters — videos without analysis pass when these filters are inactive
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

  const handleSingleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadProgress(0);
      await uploadVideo({ file, onProgress: setUploadProgress });
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploadProgress(null);
      if (singleInputRef.current) singleInputRef.current.value = "";
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const progress: UploadProgress[] = files.map((f) => ({
      filename: f.name,
      percent: 0,
    }));
    setBulkProgress([...progress]);

    for (let i = 0; i < files.length; i++) {
      try {
        await uploadVideo({
          file: files[i],
          onProgress: (percent) => {
            progress[i] = { filename: files[i].name, percent };
            setBulkProgress([...progress]);
          },
        });
        progress[i] = { filename: files[i].name, percent: 100 };
        setBulkProgress([...progress]);
      } catch (err) {
        console.error(`Upload failed for ${files[i].name}:`, err);
        progress[i] = { filename: files[i].name, percent: -1 };
        setBulkProgress([...progress]);
      }
    }

    setBulkProgress([]);
    if (bulkInputRef.current) bulkInputRef.current.value = "";
  };

  const handleAnalyze = (video: Video) => {
    setAnalyzingId(video.id);
    analyzeVideo(video);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const uploading = isUploading || isBulkUploading;

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" disabled={uploading}>
                <UploadSimple className="h-4 w-4 mr-1" />
                Upload
                <CaretDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => singleInputRef.current?.click()}>
              <FileVideo className="h-4 w-4 mr-2" />
              Single video
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => bulkInputRef.current?.click()}>
              <CopySimple className="h-4 w-4 mr-2" />
              Bulk upload
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <input
          ref={singleInputRef}
          type="file"
          accept="video/*"
          onChange={handleSingleUpload}
          className="hidden"
        />
        <input
          ref={bulkInputRef}
          type="file"
          accept="video/*"
          multiple
          onChange={handleBulkUpload}
          className="hidden"
        />
        </div>
      </div>

      {/* Single upload progress */}
      {isUploading && uploadProgress !== null && !isBulkUploading && (
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <p className="text-sm font-medium">Uploading...</p>
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
          <p className="text-sm font-medium">
            Uploading {bulkProgress.filter((p) => p.percent === 100).length} of{" "}
            {bulkProgress.length} videos...
          </p>
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
