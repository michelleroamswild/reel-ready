import { useParams, useNavigate } from "react-router-dom";
import { useVideos } from "@/hooks/use-videos";
import { usePhrases } from "@/hooks/use-phrases";
import { useReels } from "@/hooks/use-reels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { SuggestTextDialog } from "@/components/SuggestTextDialog";
import { ArrowLeft, Trash, ArrowsClockwise, Sparkle, ArrowClockwise, ChatText, PencilSimple, FilmStrip, VideoCamera, Flask } from "@phosphor-icons/react";
import { useGenerateTrialReelsFromVideo } from "@/hooks/use-trial-reels";
import { useState } from "react";

export default function VideoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { videos, isLoading, analyzeVideo, isAnalyzing, deleteVideo, updateVideo } = useVideos();
  const { addPhrase } = usePhrases();
  const { createQuickReel } = useReels();
  const generateTrialReels = useGenerateTrialReelsFromVideo();
  const [showDelete, setShowDelete] = useState(false);
  const [showSuggestText, setShowSuggestText] = useState(false);
  const [showTrialConfirm, setShowTrialConfirm] = useState(false);
  const [editingFilename, setEditingFilename] = useState(false);
  const [filenameDraft, setFilenameDraft] = useState("");

  const video = videos.find((v) => v.id === id);

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
    );
  }

  if (!video) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/videos")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <p className="text-sm text-muted-foreground text-center py-8">
          Video not found.
        </p>
      </div>
    );
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const a = video.analysis;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/videos")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Videos
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isAnalyzing}
            onClick={() => analyzeVideo(video)}
          >
            {isAnalyzing ? (
              <ArrowsClockwise className="h-4 w-4 mr-1 animate-spin" />
            ) : a ? (
              <ArrowClockwise className="h-4 w-4 mr-1" />
            ) : (
              <Sparkle className="h-4 w-4 mr-1" />
            )}
            {isAnalyzing ? "Analyzing..." : a ? "Re-analyze" : "Analyze"}
          </Button>
          {a && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSuggestText(true)}
              >
                <ChatText className="h-4 w-4 mr-1" /> Suggest Text
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTrialConfirm(true)}
                disabled={generateTrialReels.isPending}
              >
                <Flask className="h-4 w-4 mr-1" />
                {generateTrialReels.isPending ? "Generating..." : "Trial Reels"}
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDelete(true)}
          >
            <Trash className="h-4 w-4 mr-1" /> Delete
          </Button>
        </div>
      </div>

      {/* Two-column layout: video left, analysis right (stacked on mobile) */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left: Video + file info */}
        <div className="md:w-1/2 lg:w-2/5 space-y-3 shrink-0">
          <video
            src={video.url}
            controls
            playsInline
            preload="metadata"
            poster={video.thumbnail_url ?? undefined}
            className="w-full rounded-lg border bg-black aspect-[9/16] object-contain"
          />
          <div className="space-y-2">
            {/* Editable filename */}
            {editingFilename ? (
              <input
                autoFocus
                className="text-base font-semibold bg-transparent border-b border-primary outline-none w-full"
                value={filenameDraft}
                onChange={(e) => setFilenameDraft(e.target.value)}
                onBlur={() => {
                  const trimmed = filenameDraft.trim();
                  if (trimmed && trimmed !== video.filename) {
                    updateVideo({ id: video.id, updates: { filename: trimmed } });
                  }
                  setEditingFilename(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setEditingFilename(false);
                }}
              />
            ) : (
              <div
                className="flex items-center gap-1 cursor-pointer group/name"
                onClick={() => { setFilenameDraft(video.filename); setEditingFilename(true); }}
              >
                <h1 className="text-base font-semibold truncate">{video.filename}</h1>
                <PencilSimple className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover/name:opacity-100 transition-opacity" />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {/* Clip / Edit toggle */}
              <div className="flex rounded-md overflow-hidden border">
                {(["clip", "edit"] as const).map((type) => {
                  const isActive = (video.video_type || "clip") === type;
                  return (
                    <button
                      key={type}
                      className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-transparent text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => {
                        if (!isActive) {
                          updateVideo({ id: video.id, updates: { video_type: type } });
                        }
                      }}
                    >
                      {type === "clip" ? <VideoCamera className="h-3 w-3" /> : <FilmStrip className="h-3 w-3" />}
                      {type === "clip" ? "Clip" : "Edit"}
                    </button>
                  );
                })}
              </div>
              <Badge variant="outline" className="text-xs">
                {formatSize(video.size_bytes)}
              </Badge>
              {video.duration_seconds != null && (
                <Badge variant="outline" className="text-xs">
                  {video.duration_seconds.toFixed(1)}s
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Right: Analysis */}
        <div className="flex-1 min-w-0">
          {!a ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <Sparkle className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground max-w-xs">
                No analysis yet. Tap "Analyze" to have AI break down this clip.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Summary</p>
                <p className="text-sm">{a.summary}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Mood</p>
                  <p className="text-sm capitalize">{a.mood}</p>
                  {a.moodScore != null && (
                    <p className="text-xs text-muted-foreground">Score: {a.moodScore}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Energy</p>
                  <p className="text-sm capitalize">{a.energy}</p>
                  {a.energyScore != null && (
                    <p className="text-xs text-muted-foreground">Score: {a.energyScore}/10</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {a.pacing && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Pacing</p>
                    <p className="text-sm capitalize">{a.pacing}</p>
                  </div>
                )}
                {a.dominantMotion && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Motion</p>
                    <p className="text-sm">{a.dominantMotion}</p>
                  </div>
                )}
              </div>

              {a.structure && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Structure</p>
                  <p className="text-sm">{a.structure}</p>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Visuals</p>
                <p className="text-sm">{a.visuals}</p>
              </div>

              {a.colorPalette?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Color Palette</p>
                  <div className="flex flex-wrap gap-1.5">
                    {a.colorPalette.map((color) => (
                      <Badge key={color} variant="outline" className="text-xs">
                        {color}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {a.shotTypes?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Shot Types</p>
                  <div className="flex flex-wrap gap-1.5">
                    {a.shotTypes.map((type) => (
                      <Badge key={type} variant="outline" className="text-xs">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {a.audioNotes && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Audio</p>
                  <p className="text-sm">{a.audioNotes}</p>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Scene Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {a.sceneTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {a && (
        <SuggestTextDialog
          open={showSuggestText}
          onOpenChange={setShowSuggestText}
          analysis={a}
          filename={video.filename}
          onSaveAsPhrase={(text, tags) => addPhrase(text, tags, "")}
          onCreateReel={async (text) => {
            const title = text.length > 40 ? text.slice(0, 40) + "..." : text;
            const reelId = await createQuickReel({
              title,
              text,
              videoId: video.id,
              startSeconds: 0,
              endSeconds: video.duration_seconds ?? 5,
            });
            setShowSuggestText(false);
            navigate(`/reels/${reelId}`);
          }}
        />
      )}

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete video?</AlertDialogTitle>
            <AlertDialogDescription>
              "{video.filename}" will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                deleteVideo(video.id);
                navigate("/videos");
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showTrialConfirm} onOpenChange={setShowTrialConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate Trial Reels</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a base reel from this video and generate 3-5
              variants, each isolating one variable — text, visuals, or
              audio. AI will generate text overlays and multiple angles
              like bold claims, questions, and emotional hooks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setShowTrialConfirm(false);
                try {
                  const batchId = await generateTrialReels.mutateAsync({
                    video,
                    allVideos: videos,
                  });
                  navigate(`/trials/${batchId}`);
                } catch (err) {
                  console.error("Failed to generate trial reels:", err);
                }
              }}
            >
              <Flask className="h-4 w-4 mr-1" /> Generate Variants
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
