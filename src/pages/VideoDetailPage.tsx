import { useParams, useNavigate } from "react-router-dom";
import { useVideos } from "@/hooks/use-videos";
import { usePhrases } from "@/hooks/use-phrases";
import { useReels } from "@/hooks/use-reels";
import { Button } from "@/components/ui/button";
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
import { TrialReelDialog } from "@/components/TrialReelDialog";
import { ArrowLeft, Trash, ArrowsClockwise, Sparkle, ArrowClockwise, ChatText, PencilSimple, FilmStrip, VideoCamera, Flask } from "@phosphor-icons/react";
import { useGenerateTrialReelsFromVideo } from "@/hooks/use-trial-reels";
import { useState } from "react";

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface px-4 py-3">
      <p className="eyebrow-plain mb-1.5">{label}</p>
      <p className="ed-display text-[28px] capitalize text-ink leading-none">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

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
    return <p className="text-sm text-muted-foreground text-center py-12">Loading…</p>;
  }

  if (!video) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate("/videos")}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Videos
        </button>
        <p className="text-[13px] text-muted-foreground text-center py-12">Video not found.</p>
      </div>
    );
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const a = video.analysis;

  return (
    <div className="space-y-6 fade-up">
      {/* Header: back + actions */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => navigate("/videos")}
          className="md:hidden flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Videos
        </button>
        <div className="hidden md:block" />
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            disabled={isAnalyzing}
            onClick={() => analyzeVideo(video)}
            className="h-8 rounded-full border-hairline-strong"
          >
            {isAnalyzing ? (
              <ArrowsClockwise className="h-4 w-4 mr-1 animate-spin" />
            ) : a ? (
              <ArrowClockwise className="h-4 w-4 mr-1" />
            ) : (
              <Sparkle className="h-4 w-4 mr-1 text-brand" weight="fill" />
            )}
            {isAnalyzing ? "Analyzing…" : a ? "Re-analyze" : "Analyze"}
          </Button>
          {a && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSuggestText(true)}
                className="h-8 rounded-full border-hairline-strong"
              >
                <ChatText className="h-4 w-4 mr-1" /> Text
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTrialConfirm(true)}
                disabled={generateTrialReels.isPending}
                className="h-8 rounded-full border-hairline-strong"
              >
                <Flask className="h-4 w-4 mr-1" />
                {generateTrialReels.isPending ? "Generating…" : "Trial"}
              </Button>
            </>
          )}
          <button
            onClick={() => setShowDelete(true)}
            className="h-8 w-8 grid place-items-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-destructive transition-colors"
            title="Delete"
          >
            <Trash className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Left: video + meta */}
        <div className="md:w-[42%] lg:w-[38%] space-y-4 shrink-0">
          <div className="relative rounded-xl overflow-hidden border border-hairline bg-black aspect-[9/16]">
            <video
              src={video.url}
              controls
              playsInline
              preload="metadata"
              poster={video.thumbnail_url ?? undefined}
              className="w-full h-full object-contain"
            />
          </div>

          {/* Filename */}
          {editingFilename ? (
            <input
              autoFocus
              className="ed-display text-[24px] bg-transparent border-b-2 border-ink outline-none w-full"
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
              className="flex items-center gap-2 cursor-pointer group/name"
              onClick={() => { setFilenameDraft(video.filename); setEditingFilename(true); }}
            >
              <h1 className="ed-display text-[24px] text-ink truncate">{video.filename}</h1>
              <PencilSimple className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover/name:opacity-100 transition-opacity" />
            </div>
          )}

          {/* Type toggle + meta chips */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex bg-surface-2 rounded-full p-0.5">
              {(["clip", "edit"] as const).map((type) => {
                const isActive = (video.video_type || "clip") === type;
                return (
                  <button
                    key={type}
                    className={`flex items-center gap-1 px-2.5 h-7 rounded-full text-[11.5px] font-semibold transition-colors ${
                      isActive ? "bg-mist text-ink shadow-sm" : "text-muted-foreground hover:text-ink"
                    }`}
                    onClick={() => {
                      if (!isActive) updateVideo({ id: video.id, updates: { video_type: type } });
                    }}
                  >
                    {type === "clip" ? <VideoCamera className="h-3 w-3" /> : <FilmStrip className="h-3 w-3" />}
                    {type === "clip" ? "Clip" : "Edit"}
                  </button>
                );
              })}
            </div>
            <span className="chip chip-outline !text-[11px]">{formatSize(video.size_bytes)}</span>
            {video.duration_seconds != null && (
              <span className="chip chip-outline !text-[11px]">{video.duration_seconds.toFixed(1)}s</span>
            )}
          </div>
        </div>

        {/* Right: AI analysis */}
        <div className="flex-1 min-w-0">
          {!a ? (
            <div className="rounded-2xl border border-dashed border-hairline-strong bg-surface px-6 py-16 flex flex-col items-center justify-center text-center space-y-3">
              <Sparkle className="h-8 w-8 text-brand" weight="fill" />
              <p className="text-[13px] text-muted-foreground max-w-xs">
                No analysis yet. Tap <span className="text-ink font-medium">Analyze</span> to have AI break down this clip.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* AI Analysis header */}
              <header className="space-y-2">
                <span className="eyebrow">
                  AI Analysis
                  <span className="accent-dot ml-1" />
                  <span className="text-ink-2 capitalize tracking-tight">Confident</span>
                </span>
                <p className="ed-display text-[26px] md:text-[30px] text-ink leading-[1.05]">
                  {a.summary}
                </p>
              </header>

              {/* Stat grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <Stat label="Mood" value={a.mood} sub={a.moodScore != null ? `Score ${a.moodScore}` : undefined} />
                <Stat label="Energy" value={a.energy} sub={a.energyScore != null ? `${a.energyScore}/10` : undefined} />
                {a.pacing && <Stat label="Pacing" value={a.pacing} />}
                {a.dominantMotion && <Stat label="Motion" value={a.dominantMotion} />}
              </div>

              {a.structure && (
                <div>
                  <p className="eyebrow-plain mb-1.5">Structure</p>
                  <p className="text-[14px] text-ink leading-relaxed">{a.structure}</p>
                </div>
              )}

              <div>
                <p className="eyebrow-plain mb-1.5">Visuals</p>
                <p className="text-[14px] text-ink leading-relaxed">{a.visuals}</p>
              </div>

              {a.colorPalette?.length > 0 && (
                <div>
                  <p className="eyebrow-plain mb-2">Color palette</p>
                  <div className="flex flex-wrap gap-1.5">
                    {a.colorPalette.map((color) => (
                      <div
                        key={color}
                        className="flex items-center gap-1.5 rounded-full border border-hairline bg-surface pr-2.5 pl-1 py-1"
                      >
                        <span
                          className="h-5 w-5 rounded-full border border-black/10"
                          style={{ background: color }}
                        />
                        <span className="font-mono text-[11px] uppercase text-ink-2 tracking-tight">{color}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {a.shotTypes?.length > 0 && (
                <div>
                  <p className="eyebrow-plain mb-2">Shot types</p>
                  <div className="flex flex-wrap gap-1.5">
                    {a.shotTypes.map((type) => (
                      <span key={type} className="chip chip-outline !text-[11px]">{type}</span>
                    ))}
                  </div>
                </div>
              )}

              {a.audioNotes && (
                <div>
                  <p className="eyebrow-plain mb-1.5">Audio</p>
                  <p className="text-[14px] text-ink leading-relaxed">{a.audioNotes}</p>
                </div>
              )}

              <div>
                <p className="eyebrow-plain mb-2">Scene tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {a.sceneTags.map((tag) => (
                    <span key={tag} className="chip">{tag}</span>
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

      <TrialReelDialog
        open={showTrialConfirm}
        onOpenChange={setShowTrialConfirm}
        isPending={generateTrialReels.isPending}
        onGenerate={async (opts) => {
          setShowTrialConfirm(false);
          try {
            const batchId = await generateTrialReels.mutateAsync({
              video,
              allVideos: videos,
              ...opts,
            });
            navigate(`/trials/${batchId}`);
          } catch (err) {
            console.error("Failed to generate trial reels:", err);
          }
        }}
      />
    </div>
  );
}
