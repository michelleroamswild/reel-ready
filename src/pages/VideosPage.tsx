import { useRef, useState } from "react";
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
import { FilmStrip, UploadSimple, CaretDown, FileVideo, CopySimple, Trash, ArrowsClockwise, Sparkle, ArrowClockwise } from "@phosphor-icons/react";
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
  const isBulkUploading = bulkProgress.length > 0;

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
      ) : videos.length === 0 && !uploading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <FilmStrip className="h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground max-w-xs">
            No videos yet. Upload your first clip!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {videos.map((v: Video) => (
            <div
              key={v.id}
              className="relative rounded-lg border bg-card overflow-hidden cursor-pointer group"
              onClick={() => navigate(`/videos/${v.id}`)}
            >
              <video
                src={v.url}
                preload="metadata"
                className="w-full aspect-[9/16] object-cover"
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
              {/* Filename + size */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1 pt-4">
                <p className="text-[10px] text-white truncate">{v.filename}</p>
                <p className="text-[9px] text-white/70">{formatSize(v.size_bytes)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

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
