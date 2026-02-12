import { useRef, useState } from "react";
import { useVideos } from "@/hooks/use-videos";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Film, Upload, ChevronDown, File, Files, Trash2 } from "lucide-react";
import type { Video } from "@/types/video";

interface UploadProgress {
  filename: string;
  percent: number;
}

export default function VideosPage() {
  const { videos, isLoading, uploadVideo, isUploading, deleteVideo } = useVideos();
  const singleInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const [bulkProgress, setBulkProgress] = useState<UploadProgress[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
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

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const uploading = isUploading || isBulkUploading;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Videos</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" disabled={uploading}>
              <Upload className="h-4 w-4 mr-1" />
              Upload
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => singleInputRef.current?.click()}>
              <File className="h-4 w-4 mr-2" />
              Single video
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => bulkInputRef.current?.click()}>
              <Files className="h-4 w-4 mr-2" />
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
          <Film className="h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground max-w-xs">
            No videos yet. Upload your first clip!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map((v: Video) => (
            <div key={v.id} className="rounded-lg border bg-card p-3 space-y-2">
              <video
                src={v.url}
                controls
                preload="metadata"
                className="w-full rounded-md"
              />
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{v.filename}</p>
                  <p className="text-xs text-muted-foreground">{formatSize(v.size_bytes)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive shrink-0"
                  onClick={() => deleteVideo(v.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
