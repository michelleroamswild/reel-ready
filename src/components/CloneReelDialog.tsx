import { useState, useEffect, useRef } from "react";
import { useCloneReel } from "@/hooks/use-clone-reel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sparkle,
  LinkSimple,
  UploadSimple,
  XCircle,
} from "@phosphor-icons/react";
import type { Video } from "@/types/video";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videos: Video[];
  onComplete: (reelId: string) => void;
}

export function CloneReelDialog({
  open,
  onOpenChange,
  videos,
  onComplete,
}: Props) {
  const {
    step,
    template,
    error,
    reset,
    downloadFromUrl,
    uploadFile,
    buildReel,
  } = useCloneReel();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      reset();
      setUrl("");
      setTitle("");
    }
  }, [open, reset]);

  useEffect(() => {
    if (template && !title) {
      const mood = template.overallMood || "reel";
      const pacing = template.overallPacing || "";
      setTitle(`Clone — ${mood} ${pacing}`.trim().slice(0, 40));
    }
  }, [template, title]);

  const handleGo = () => {
    if (!url.trim()) return;
    downloadFromUrl(url.trim());
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const handleBuild = async () => {
    try {
      const reelId = await buildReel(title, videos);
      onComplete(reelId);
    } catch {
      // error already set in hook state
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Step: Input */}
        {step === "input" && (
          <>
            <DialogHeader>
              <DialogTitle>Clone a Reel</DialogTitle>
              <DialogDescription>
                Paste a TikTok or Instagram Reel URL, or upload the video
                directly.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reel-url">Reel URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="reel-url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.tiktok.com/..."
                    className="flex-1"
                    onKeyDown={(e) => e.key === "Enter" && handleGo()}
                  />
                  <Button onClick={handleGo} disabled={!url.trim()}>
                    <LinkSimple className="h-4 w-4 mr-1" /> Go
                  </Button>
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    or
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadSimple className="h-4 w-4 mr-1" /> Upload video file
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </>
        )}

        {/* Step: Downloading / Uploading / Analyzing */}
        {(step === "downloading" ||
          step === "uploading" ||
          step === "analyzing") && (
          <>
            <DialogHeader>
              <DialogTitle>
                {step === "downloading"
                  ? "Fetching Video..."
                  : step === "uploading"
                    ? "Uploading..."
                    : "Analyzing Reel..."}
              </DialogTitle>
              <DialogDescription>
                {step === "analyzing"
                  ? "AI is extracting the reel structure. This may take 10-20 seconds."
                  : step === "downloading"
                    ? "Downloading the video from the URL..."
                    : "Uploading your video file..."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center space-y-3 py-8">
              <Sparkle className="h-10 w-10 text-primary animate-pulse" />
              <p className="text-sm font-medium">
                {step === "downloading"
                  ? "Downloading..."
                  : step === "uploading"
                    ? "Uploading..."
                    : "Extracting template..."}
              </p>
            </div>
          </>
        )}

        {/* Step: Download Failed */}
        {step === "download-failed" && (
          <>
            <DialogHeader>
              <DialogTitle>Download Failed</DialogTitle>
              <DialogDescription>
                Couldn't fetch the video from that URL.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {error && (
                <p className="text-xs text-muted-foreground bg-muted rounded p-2">
                  {error}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                You can upload the video file directly instead. Save it from
                TikTok/Instagram and upload here.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadSimple className="h-4 w-4 mr-1" /> Upload video file
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button variant="ghost" className="w-full" onClick={reset}>
                Try a different URL
              </Button>
            </div>
          </>
        )}

        {/* Step: Review Template */}
        {step === "review" && template && (
          <>
            <DialogHeader>
              <DialogTitle>Reel Template</DialogTitle>
              <DialogDescription>
                Extracted {template.segmentCount} segments. Review and build
                your clone.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Template summary */}
              <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary">
                    {template.segmentCount} segments
                  </Badge>
                  <Badge variant="outline">
                    {Math.round(template.totalDurationSeconds)}s
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {template.overallPacing}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {template.overallMood}
                  </Badge>
                </div>
                {template.visualStyleNotes && (
                  <p className="text-xs text-muted-foreground">
                    {template.visualStyleNotes}
                  </p>
                )}
                {template.textOverlayStyle && (
                  <p className="text-xs text-muted-foreground">
                    Text style: {template.textOverlayStyle}
                  </p>
                )}
              </div>

              {/* Segment breakdown */}
              <div className="space-y-2">
                <Label>Segments</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {template.segments.map((seg) => (
                    <div
                      key={seg.index}
                      className="rounded border p-2 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">#{seg.index + 1}</span>
                        <span className="text-muted-foreground">
                          {seg.durationSeconds.toFixed(1)}s
                        </span>
                      </div>
                      {seg.textOverlay && (
                        <p className="font-medium">&ldquo;{seg.textOverlay}&rdquo;</p>
                      )}
                      <p className="text-muted-foreground">
                        {seg.visualDescription}
                      </p>
                      <div className="flex gap-1">
                        <Badge variant="outline" className="text-[10px]">
                          {seg.mood}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {seg.energy}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="clone-title">Title</Label>
                <Input
                  id="clone-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="My cloned reel"
                />
              </div>

              {/* Build */}
              <Button
                className="w-full"
                onClick={handleBuild}
                disabled={!title.trim()}
              >
                <Sparkle className="h-4 w-4 mr-1" /> Build Clone
              </Button>
            </div>
          </>
        )}

        {/* Step: Building */}
        {step === "building" && (
          <>
            <DialogHeader>
              <DialogTitle>Building Reel...</DialogTitle>
              <DialogDescription>
                AI is matching your videos to the template.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center space-y-3 py-8">
              <Sparkle className="h-10 w-10 text-primary animate-pulse" />
              <p className="text-sm font-medium">Matching your videos...</p>
            </div>
          </>
        )}

        {/* Step: Error */}
        {step === "error" && (
          <>
            <DialogHeader>
              <DialogTitle>Something went wrong</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-2 py-4">
              <XCircle
                className="h-10 w-10 text-destructive"
                weight="fill"
              />
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                {error}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
              <Button className="flex-1" onClick={reset}>
                Start Over
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
