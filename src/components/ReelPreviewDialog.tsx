import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Play } from "@phosphor-icons/react";
import type { ReelSegmentWithVideo } from "@/types/reel";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segments: ReelSegmentWithVideo[];
}

export function ReelPreviewDialog({ open, onOpenChange, segments }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [videoKey, setVideoKey] = useState(0);

  const current = segments[currentIndex];

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
      setIsPlaying(false);
      setFinished(false);
      setVideoKey((k) => k + 1);
    }
  }, [open]);

  // Force remount video when segment changes (but not on initial open)
  const prevIndex = useRef(0);
  useEffect(() => {
    if (open && prevIndex.current !== currentIndex) {
      setVideoKey((k) => k + 1);
    }
    prevIndex.current = currentIndex;
  }, [currentIndex, open]);

  const handlePlay = () => {
    const video = videoRef.current;
    if (!video || segments.length === 0) return;

    if (finished) {
      setFinished(false);
      setIsPlaying(true);
      setCurrentIndex(0);
      return;
    }

    setIsPlaying(true);
    video.play().catch((err) => {
      console.error("Play failed:", err);
      setIsPlaying(false);
    });
  };

  const handlePause = () => {
    videoRef.current?.pause();
    setIsPlaying(false);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    const seg = segments[currentIndex];
    if (!video || !seg) return;

    if (video.currentTime >= seg.end_seconds) {
      video.pause();
      if (currentIndex < segments.length - 1) {
        setIsPlaying(true); // keep playing into next segment
        setCurrentIndex((i) => i + 1);
      } else {
        setIsPlaying(false);
        setFinished(true);
      }
    }
  };

  // Auto-play when a NEW video loads (segment transition while playing)
  const handleLoadedData = () => {
    const video = videoRef.current;
    if (!video) return;
    // The #t= fragment in the src already positions the video.
    // If we were playing (auto-advance), start playing the new segment.
    if (isPlaying) {
      video.play().catch((err) => {
        console.error("Auto-play failed:", err);
        setIsPlaying(false);
      });
    }
  };

  if (segments.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 overflow-hidden max-w-sm">
        <DialogHeader className="sr-only">
          <DialogTitle>Reel Preview</DialogTitle>
          <DialogDescription>Sequential preview of reel segments</DialogDescription>
        </DialogHeader>

        <div className="relative bg-black" style={{ aspectRatio: "9/16" }}>
          {current && (
            <video
              key={videoKey}
              ref={videoRef}
              src={`${current.video.url}#t=${current.start_seconds}`}
              className="w-full h-full object-cover"
              playsInline
              preload="auto"
              onLoadedData={handleLoadedData}
              onTimeUpdate={handleTimeUpdate}
            />
          )}

          {/* Play overlay */}
          {!isPlaying && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
              onClick={handlePlay}
            >
              <div className="h-16 w-16 rounded-full bg-white/90 flex items-center justify-center">
                <Play className="h-8 w-8 text-black ml-1" weight="fill" />
              </div>
            </div>
          )}

          {/* Tap to pause */}
          {isPlaying && (
            <div
              className="absolute inset-0 cursor-pointer"
              onClick={handlePause}
            />
          )}

          {/* Section text */}
          {current && (
            <div className="absolute bottom-16 left-0 right-0 px-4">
              <p className="text-white text-sm font-medium text-center drop-shadow-lg whitespace-pre-line">
                {current.section_text}
              </p>
            </div>
          )}

          {/* Progress dots */}
          <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-1.5">
            {segments.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  i === currentIndex
                    ? "bg-white"
                    : i < currentIndex
                    ? "bg-white/60"
                    : "bg-white/30"
                }`}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
