import { useRef, useEffect, useState } from "react";
import { VideoCamera } from "@phosphor-icons/react";

interface Props {
  src: string;
  className?: string;
  iconSize?: "sm" | "md";
}

export function VideoThumbnail({ src, className = "", iconSize = "md" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const iconCls = iconSize === "sm" ? "h-4 w-4" : "h-8 w-8";

  // On mobile, briefly play+pause to force a frame to render
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const forceFrame = () => {
      video.play().then(() => {
        video.pause();
        setLoaded(true);
      }).catch(() => {
        // Autoplay blocked — frame may still show from metadata
        setLoaded(true);
      });
    };

    video.addEventListener("loadeddata", forceFrame, { once: true });
    return () => video.removeEventListener("loadeddata", forceFrame);
  }, [src]);

  return (
    <div className={`relative bg-black ${className}`}>
      {!loaded && (
        <div className="absolute inset-0 bg-muted/30 animate-pulse flex items-center justify-center">
          <VideoCamera className={`${iconCls} text-white/20`} />
        </div>
      )}
      <video
        ref={videoRef}
        src={src}
        preload="metadata"
        muted
        playsInline
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
