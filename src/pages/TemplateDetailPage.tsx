import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useVideos } from "@/hooks/use-videos";
import { useCloneReel } from "@/hooks/use-clone-reel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Sparkle,
  Play,
  ListBullets,
  Copy,
  Check,
} from "@phosphor-icons/react";
import type { ReelTemplate } from "@/types/reel";

interface SavedTemplate {
  id: string;
  title: string;
  created_at: string;
  source_template: ReelTemplate;
}

type View = "detail" | "clips" | "building" | "error";

export default function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { videos } = useVideos();
  const { buildReel, step: cloneStep, error: cloneError, useFromTemplate, reset } = useCloneReel();

  const [view, setView] = useState<View>("detail");
  const [title, setTitle] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: template, isLoading } = useQuery({
    queryKey: ["template-detail", id],
    queryFn: async (): Promise<SavedTemplate> => {
      const { data, error } = await supabase
        .from("reels")
        .select("id, title, created_at, source_template")
        .eq("id", id!)
        .not("source_template", "is", null)
        .single();

      if (error) throw error;
      return data as SavedTemplate;
    },
    enabled: !!id,
  });

  const tmpl = template?.source_template;

  const handleBuildClone = async () => {
    if (!tmpl || !title.trim()) return;
    useFromTemplate(tmpl);
    setView("building");
    try {
      const reelId = await buildReel(title, videos);
      navigate(`/reels/${reelId}`);
    } catch {
      setView("error");
    }
  };

  const buildClipDescription = (seg: typeof tmpl extends undefined ? never : NonNullable<typeof tmpl>["segments"][number], i: number) => {
    const overlay = seg.textOverlay ? ` Overlay text: "${seg.textOverlay}".` : "";
    return `Clip ${i + 1}: A ~${seg.durationSeconds.toFixed(1)}s clip of ${seg.visualDescription.toLowerCase().replace(/\.$/, "")} with a ${seg.mood.toLowerCase()}, ${seg.energy.toLowerCase()} energy feel.${overlay}`;
  };

  const handleCopyClips = () => {
    if (!tmpl) return;
    const text = tmpl.segments.map(buildClipDescription).join("\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center py-12">
        <Sparkle className="h-8 w-8 text-primary animate-pulse" />
        <p className="text-sm text-muted-foreground mt-2">Loading template...</p>
      </div>
    );
  }

  if (!template || !tmpl) {
    return (
      <div className="flex flex-col items-center py-12 space-y-3">
        <p className="text-sm text-muted-foreground">Template not found.</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/templates")}>
          Back to Templates
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => navigate("/templates")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold truncate">{template.title}</h1>
      </div>

      {/* Building state */}
      {(view === "building" || cloneStep === "building") && (
        <div className="flex flex-col items-center space-y-3 py-12">
          <Sparkle className="h-10 w-10 text-primary animate-pulse" />
          <p className="text-sm font-medium">Matching your videos to the template...</p>
        </div>
      )}

      {/* Error state */}
      {view === "error" && cloneError && (
        <div className="space-y-3">
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{cloneError}</p>
          </div>
          <Button variant="outline" className="w-full" onClick={() => { reset(); setView("detail"); }}>
            Back to Template
          </Button>
        </div>
      )}

      {/* Clip descriptions view */}
      {view === "clips" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Clips You'll Need</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyClips}
            >
              {copied ? (
                <><Check className="h-3.5 w-3.5 mr-1" /> Copied</>
              ) : (
                <><Copy className="h-3.5 w-3.5 mr-1" /> Copy All</>
              )}
            </Button>
          </div>

          <div className="space-y-3">
            {tmpl.segments.map((seg, i) => (
              <div
                key={seg.index}
                className="rounded-lg border bg-card p-3"
              >
                <p className="text-xs font-medium text-muted-foreground mb-1">Clip {i + 1}</p>
                <p className="text-sm">{buildClipDescription(seg, i).replace(/^Clip \d+: /, "")}</p>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => setView("detail")}
          >
            Back to Template
          </Button>
        </div>
      )}

      {/* Detail view */}
      {view === "detail" && cloneStep !== "building" && (
        <div className="space-y-4">
          {/* Template summary */}
          <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary">
                {tmpl.segmentCount} segments
              </Badge>
              <Badge variant="outline">
                {Math.round(tmpl.totalDurationSeconds)}s
              </Badge>
              <Badge variant="outline" className="capitalize">
                {tmpl.overallPacing}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {tmpl.overallMood}
              </Badge>
            </div>
            {tmpl.visualStyleNotes && (
              <p className="text-xs text-muted-foreground">
                {tmpl.visualStyleNotes}
              </p>
            )}
            {tmpl.textOverlayStyle && (
              <p className="text-xs text-muted-foreground">
                Text style: {tmpl.textOverlayStyle}
              </p>
            )}
          </div>

          {/* Segment breakdown */}
          <div className="space-y-2">
            <Label>Segments</Label>
            <div className="space-y-2">
              {tmpl.segments.map((seg) => (
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

          {/* Title input for clone */}
          <div className="space-y-2">
            <Label htmlFor="clone-title">Title</Label>
            <Input
              id="clone-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={template.title || "My cloned reel"}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={handleBuildClone}
              disabled={!title.trim()}
            >
              <Play className="h-4 w-4 mr-1" /> Build Clone
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setView("clips")}
            >
              <ListBullets className="h-4 w-4 mr-1" /> Describe Clips
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
