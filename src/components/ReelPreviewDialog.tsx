import { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

  const current = segments[currentIndex];

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
      setIsPlaying(false);
      setFinished(false);
    }
  }, [open]);

  // Load segment into video element when index changes
  useEffect(() => {
    if (!open || !current || !videoRef.current) return;

    const video = videoRef.current;
    const segmentUrl = current.video.url;

    // Only change src if it's a different video
    if (!video.src.includes(segmentUrl.split("?")[0]?.split("/").pop() ?? "__none__")) {
      video.src = segmentUrl;
      video.load();
    }

    const handleCanPlay = () => {
      video.currentTime = current.start_seconds;
    };

    const handleSeeked = () => {
      if (isPlaying) {
        video.play().catch(() => {});
      }
    };

    video.addEventListener("canplay", handleCanPlay, { once: true });
    video.addEventListener("seeked", handleSeeked, { once: true });

    // If src didn't change, just seek
    if (video.readyState >= 2) {
      video.currentTime = current.start_seconds;
    }

    return () => {
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("seeked", handleSeeked);
    };
  }, [currentIndex, open, current]);

  // Monitor playback to pause at end_seconds and advance
  const handleTimeUpdate = useCallback(() => {
    if (!current || !videoRef.current) return;
    if (videoRef.current.currentTime >= current.end_seconds) {
      videoRef.current.pause();

      if (currentIndex < segments.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        setIsPlaying(false);
        setFinished(true);
      }
    }
  }, [current, currentIndex, segments.length]);

  const handlePlay = () => {
    if (!videoRef.current || !current) return;

    if (finished) {
      setCurrentIndex(0);
      setFinished(false);
    }

    setIsPlaying(true);
    videoRef.current.currentTime = current.start_seconds;
    videoRef.current.play().catch(() => {});
  };

  const handlePause = () => {
    videoRef.current?.pause();
    setIsPlaying(false);
  };

  if (segments.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 overflow-hidden max-w-sm">
        <DialogHeader className="sr-only">
          <DialogTitle>Reel Preview</DialogTitle>
        </DialogHeader>

        <div className="relative bg-black" style={{ aspectRatio: "9/16" }}>
          {/* Video element */}
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => {
              // Only set not playing if we intentionally paused
              if (videoRef.current && current && videoRef.current.currentTime < current.end_seconds - 0.1) {
                setIsPlaying(false);
              }
            }}
          />

          {/* Play/pause overlay */}
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

          {/* Tap to pause when playing */}
          {isPlaying && (
            <div
              className="absolute inset-0 cursor-pointer"
              onClick={handlePause}
            />
          )}

          {/* Section text overlay */}
          {current && (
            <div className="absolute bottom-16 left-0 right-0 px-4">
              <p className="text-white text-sm font-medium text-center drop-shadow-lg">
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
