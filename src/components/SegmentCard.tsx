import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowsClockwise } from "@phosphor-icons/react";
import type { ReelSegmentWithVideo } from "@/types/reel";
import { VideoThumbnail } from "@/components/VideoThumbnail";

interface Props {
  segment: ReelSegmentWithVideo;
  onSwap: () => void;
}

export function SegmentCard({ segment, onSwap }: Props) {
  const duration = segment.end_seconds - segment.start_seconds;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Video preview with timestamp overlay */}
      <div className="relative aspect-video bg-muted">
        <VideoThumbnail
          src={`${segment.video.url}#t=${segment.start_seconds}`}
          thumbnailUrl={segment.video.thumbnail_url}
          className="w-full h-full"
        />
        <div className="absolute top-2 left-2 flex gap-1">
          <Badge
            variant="secondary"
            className="bg-black/60 text-white text-xs border-0"
          >
            #{segment.section_index + 1}
          </Badge>
        </div>
        <div className="absolute top-2 right-2">
          <Badge
            variant="secondary"
            className="bg-black/60 text-white text-xs border-0"
          >
            {segment.start_seconds.toFixed(1)}s – {segment.end_seconds.toFixed(1)}s
          </Badge>
        </div>
        {segment.score != null && (
          <div className="absolute bottom-2 left-2">
            <Badge
              variant="secondary"
              className="bg-black/60 text-white text-xs border-0"
            >
              Score: {segment.score}
            </Badge>
          </div>
        )}
        <div className="absolute bottom-2 right-2">
          <Badge
            variant="secondary"
            className="bg-black/60 text-white text-xs border-0"
          >
            {duration.toFixed(1)}s
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        <p className="text-sm font-medium">{segment.section_text}</p>

        <p className="text-xs text-muted-foreground">{segment.video.filename}</p>

        {segment.reasoning && (
          <p className="text-xs text-muted-foreground italic">
            {segment.reasoning}
          </p>
        )}

        <Button variant="outline" size="sm" className="w-full" onClick={onSwap}>
          <ArrowsClockwise className="h-4 w-4 mr-1" />
          Swap Clip
        </Button>
      </div>
    </div>
  );
}
