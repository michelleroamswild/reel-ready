import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VideoThumbnail } from "@/components/VideoThumbnail";
import { ArrowRight, VideoCamera } from "@phosphor-icons/react";
import type { ReelWithDetails } from "@/types/reel";
import type { TrialVariantType } from "@/types/trial";

const VARIANT_COLORS: Record<TrialVariantType, string> = {
  hook: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  pacing: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  tone: "bg-purple-500/15 text-purple-700 border-purple-500/30",
  structure: "bg-green-500/15 text-green-700 border-green-500/30",
  format: "bg-pink-500/15 text-pink-700 border-pink-500/30",
};

interface TrialVariantCardProps {
  reel: ReelWithDetails;
}

export function TrialVariantCard({ reel }: TrialVariantCardProps) {
  const navigate = useNavigate();
  const variantType = reel.trial_variant_type as TrialVariantType | null;
  const firstSeg = reel.reel_segments[0];
  const totalDuration = reel.reel_segments.reduce(
    (sum, seg) => sum + (seg.end_seconds - seg.start_seconds),
    0
  );

  return (
    <div
      className="rounded-lg border bg-card overflow-hidden cursor-pointer transition-colors hover:border-primary/50 group"
      onClick={() => navigate(`/reels/${reel.id}`)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[9/16]">
        {firstSeg?.video?.url ? (
          <VideoThumbnail
            src={`${firstSeg.video.url}#t=${firstSeg.start_seconds}`}
            thumbnailUrl={firstSeg.video.thumbnail_url}
            className="w-full h-full"
            iconSize="sm"
          />
        ) : (
          <div className="w-full h-full bg-black flex items-center justify-center">
            <VideoCamera className="h-8 w-8 text-white/30" />
          </div>
        )}

        {/* Text overlay preview */}
        {firstSeg?.section_text && reel.burn_text && (
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 z-10 px-2">
            <p
              className="text-white font-semibold text-center whitespace-pre-line line-clamp-3"
              style={{
                fontSize: 9,
                textShadow: "1px 1px 3px rgba(0,0,0,0.5)",
              }}
            >
              {firstSeg.section_text}
            </p>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-2.5 space-y-1.5">
        {variantType && (
          <Badge
            className={`text-[10px] border px-1.5 py-0 capitalize ${
              VARIANT_COLORS[variantType] ?? ""
            }`}
          >
            {variantType}
          </Badge>
        )}
        {reel.trial_variant_label && (
          <p className="text-xs font-medium truncate">
            {reel.trial_variant_label}
          </p>
        )}
        <div className="flex gap-1.5 flex-wrap">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {reel.reel_segments.length} clip
            {reel.reel_segments.length !== 1 ? "s" : ""}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {Math.round(totalDuration)}s
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs mt-1"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/reels/${reel.id}`);
          }}
        >
          Open <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}
