import { useRef, useEffect, useState, useCallback } from "react";
import { VideoCamera } from "@phosphor-icons/react";

// ---------- Frame cache ----------
// Keyed by full src (including #t= fragment) — different segments have different frames.
const frameCache = new Map<string, string>();

// ---------- Blob URL cache ----------
// Keyed by base URL (no fragment). Same video file shares one blob.
const blobCache = new Map<string, string>();

// Deduplicate in-flight fetches for the same video
const fetchingBlobs = new Map<string, Promise<string | null>>();

function getBaseUrl(src: string) {
  return src.split("#")[0];
}

// ---------- Concurrent queue (2 at a time) ----------
const queue: Array<{ id: number; run: () => void }> = [];
let nextId = 0;
const activeIds = new Set<number>();
const MAX_CONCURRENT = 2;

function enqueue(id: number, run: () => void) {
  queue.push({ id, run });
  drain();
}

function dequeue(id: number) {
  const idx = queue.findIndex((r) => r.id === id);
  if (idx !== -1) queue.splice(idx, 1);
  if (activeIds.has(id)) {
    activeIds.delete(id);
    drain();
  }
}

function complete(id: number) {
  activeIds.delete(id);
  drain();
}

function drain() {
  while (activeIds.size < MAX_CONCURRENT && queue.length > 0) {
    const next = queue.shift()!;
    activeIds.add(next.id);
    next.run();
  }
}

// ---------- Get or fetch blob URL ----------
async function getBlobUrl(src: string): Promise<string | null> {
  const baseUrl = getBaseUrl(src);

  const cached = blobCache.get(baseUrl);
  if (cached) return cached;

  // Deduplicate concurrent fetches for the same video file
  const existing = fetchingBlobs.get(baseUrl);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const resp = await fetch(baseUrl);
      if (!resp.ok) return null;
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      blobCache.set(baseUrl, url);
      return url;
    } catch {
      return null;
    } finally {
      fetchingBlobs.delete(baseUrl);
    }
  })();

  fetchingBlobs.set(baseUrl, promise);
  return promise;
}

// ---------- Capture a frame ----------
async function captureFrame(src: string, targetTime: number): Promise<string | null> {
  const blobUrl = await getBlobUrl(src);
  if (!blobUrl) return null;

  return new Promise<string | null>((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    let done = false;

    const finish = (dataUrl: string | null) => {
      if (done) return;
      done = true;
      video.removeAttribute("src");
      video.load();
      resolve(dataUrl);
    };

    const tryCapture = () => {
      try {
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          finish(null);
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d")?.drawImage(video, 0, 0);
        finish(canvas.toDataURL("image/jpeg", 0.7));
      } catch {
        finish(null);
      }
    };

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(targetTime, Math.max(video.duration - 0.1, 0));
    };

    video.onseeked = () => {
      // Use requestVideoFrameCallback for most reliable frame capture (Safari 15.4+, Chrome 83+)
      if ("requestVideoFrameCallback" in video) {
        video.play().then(() => {
          (video as any).requestVideoFrameCallback(() => {
            video.pause();
            tryCapture();
          });
        }).catch(() => {
          tryCapture();
        });
      } else {
        video.play().then(() => {
          setTimeout(() => {
            video.pause();
            tryCapture();
          }, 150);
        }).catch(() => {
          tryCapture();
        });
      }
    };

    video.onerror = () => finish(null);
    setTimeout(() => finish(null), 15000);

    video.src = blobUrl;
  });
}

// ---------- Component ----------

interface Props {
  src: string;
  thumbnailUrl?: string | null;
  className?: string;
  iconSize?: "sm" | "md";
}

export function VideoThumbnail({ src, thumbnailUrl, className = "", iconSize = "md" }: Props) {
  const iconCls = iconSize === "sm" ? "h-4 w-4" : "h-8 w-8";

  // If a server-generated thumbnail exists, just show it — no client-side capture needed
  if (thumbnailUrl) {
    return (
      <div className={`relative bg-black ${className}`}>
        <img
          src={thumbnailUrl}
          className="w-full h-full object-cover"
          alt=""
        />
      </div>
    );
  }

  // Fallback: client-side capture for videos without server thumbnails
  return <VideoThumbnailFallback src={src} className={className} iconCls={iconCls} />;
}

function VideoThumbnailFallback({ src, className, iconCls }: { src: string; className: string; iconCls: string }) {
  const cached = frameCache.get(src);
  const [frameUrl, setFrameUrl] = useState<string | null>(cached ?? null);
  const idRef = useRef(0);

  const getTargetTime = useCallback(() => {
    const match = src.match(/#t=([\d.]+)/);
    return match ? Math.max(parseFloat(match[1]) + 1, 1) : 1;
  }, [src]);

  useEffect(() => {
    if (frameCache.has(src)) {
      setFrameUrl(frameCache.get(src)!);
      return;
    }

    setFrameUrl(null);
    const id = ++nextId;
    idRef.current = id;

    enqueue(id, async () => {
      const dataUrl = await captureFrame(src, getTargetTime());
      if (idRef.current !== id) { complete(id); return; }

      if (dataUrl) {
        frameCache.set(src, dataUrl);
        setFrameUrl(dataUrl);
      }
      complete(id);
    });

    return () => { dequeue(id); };
  }, [src, getTargetTime]);

  return (
    <div className={`relative bg-black ${className}`}>
      {!frameUrl && (
        <div className="absolute inset-0 bg-muted/30 animate-pulse flex items-center justify-center">
          <VideoCamera className={`${iconCls} text-white/20`} />
        </div>
      )}
      {frameUrl && (
        <img
          src={frameUrl}
          className="w-full h-full object-cover"
          alt=""
        />
      )}
    </div>
  );
}
