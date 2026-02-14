import { useRef, useEffect, useState, useCallback } from "react";
import { VideoCamera } from "@phosphor-icons/react";

// ---------- Thumbnail cache ----------
// Stores captured frame as data URL so we never re-load the same thumbnail.
const frameCache = new Map<string, string>();

// ---------- Sequential loading queue ----------
// Mobile browsers limit concurrent <video> connections (~4-6).
// This queue ensures only one thumbnail loads at a time.

type LoadRequest = {
  id: number;
  src: string;
  targetTime: number;
  onDone: (dataUrl: string | null) => void;
};

let nextId = 0;
const pending: LoadRequest[] = [];
let activeId: number | null = null;

function enqueue(req: LoadRequest) {
  pending.push(req);
  drain();
}

function dequeue(id: number) {
  const idx = pending.findIndex((r) => r.id === id);
  if (idx !== -1) pending.splice(idx, 1);
}

function drain() {
  if (activeId !== null || pending.length === 0) return;
  const req = pending.shift()!;
  activeId = req.id;

  const { src, targetTime, onDone } = req;
  let done = false;

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.setAttribute("crossorigin", "anonymous");

  const finish = (success: boolean) => {
    if (done) return;
    done = true;

    let dataUrl: string | null = null;
    if (success && video.videoWidth > 0) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d")?.drawImage(video, 0, 0);
        dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        frameCache.set(src, dataUrl);
      } catch {
        // CORS issue — fall back to no cache
      }
    }

    video.removeAttribute("src");
    video.load();
    onDone(dataUrl);
    activeId = null;
    drain();
  };

  video.onloadedmetadata = () => {
    video.currentTime = Math.min(targetTime, Math.max(video.duration - 0.1, 0));
  };

  video.onseeked = () => {
    // Brief play+pause to ensure frame is decoded on mobile
    video.play()
      .then(() => { video.pause(); finish(true); })
      .catch(() => finish(true));
  };

  video.onerror = () => finish(false);

  // Timeout fallback
  setTimeout(() => finish(false), 8000);

  video.src = src;
}

// ---------- Component ----------

interface Props {
  src: string;
  className?: string;
  iconSize?: "sm" | "md";
}

export function VideoThumbnail({ src, className = "", iconSize = "md" }: Props) {
  const idRef = useRef(0);
  const iconCls = iconSize === "sm" ? "h-4 w-4" : "h-8 w-8";

  // Check cache first
  const cached = frameCache.get(src);
  const [imageUrl, setImageUrl] = useState<string | null>(cached ?? null);
  const [failed, setFailed] = useState(false);

  const getTargetTime = useCallback(() => {
    const match = src.match(/#t=([\d.]+)/);
    return match ? Math.max(parseFloat(match[1]) + 0.5, 0.5) : 0.5;
  }, [src]);

  useEffect(() => {
    // Already cached
    if (frameCache.has(src)) {
      setImageUrl(frameCache.get(src)!);
      return;
    }

    setImageUrl(null);
    setFailed(false);
    const id = ++nextId;
    idRef.current = id;

    enqueue({
      id,
      src,
      targetTime: getTargetTime(),
      onDone: (dataUrl) => {
        if (idRef.current !== id) return;
        if (dataUrl) {
          setImageUrl(dataUrl);
        } else {
          // Canvas failed (CORS) — fall back to inline video
          setFailed(true);
        }
      },
    });

    return () => { dequeue(id); };
  }, [src, getTargetTime]);

  const showShimmer = !imageUrl && !failed;

  return (
    <div className={`relative bg-black ${className}`}>
      {showShimmer && (
        <div className="absolute inset-0 bg-muted/30 animate-pulse flex items-center justify-center">
          <VideoCamera className={`${iconCls} text-white/20`} />
        </div>
      )}

      {imageUrl ? (
        <img
          src={imageUrl}
          className="w-full h-full object-cover"
          alt=""
        />
      ) : failed ? (
        /* CORS fallback: use a regular video element */
        <FallbackVideo src={src} targetTime={getTargetTime()} />
      ) : null}
    </div>
  );
}

// Fallback when canvas capture fails due to CORS
function FallbackVideo({ src, targetTime }: { src: string; targetTime: number }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const onMeta = () => {
      video.currentTime = Math.min(targetTime, Math.max(video.duration - 0.1, 0));
    };
    const onSeeked = () => {
      video.play().then(() => video.pause()).catch(() => {});
    };

    video.addEventListener("loadedmetadata", onMeta, { once: true });
    video.addEventListener("seeked", onSeeked, { once: true });
  }, [src, targetTime]);

  return (
    <video
      ref={ref}
      src={src}
      muted
      playsInline
      preload="metadata"
      className="w-full h-full object-cover"
    />
  );
}
