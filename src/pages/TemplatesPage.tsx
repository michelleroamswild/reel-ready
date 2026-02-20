import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useVideos } from "@/hooks/use-videos";
import { useToast } from "@/hooks/use-toast";
import { CloneReelDialog } from "@/components/CloneReelDialog";
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
import {
  ArrowLeft,
  Trash,
  Play,
  Layout,
  Sparkle,
} from "@phosphor-icons/react";
import type { ReelTemplate } from "@/types/reel";

interface SavedTemplate {
  id: string;
  title: string;
  created_at: string;
  source_template: ReelTemplate;
}

export default function TemplatesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { videos } = useVideos();
  const { toast } = useToast();

  const [deleteTarget, setDeleteTarget] = useState<SavedTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [cloneTemplate, setCloneTemplate] = useState<ReelTemplate | null>(null);
  const [showCloneDialog, setShowCloneDialog] = useState(false);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["saved-templates"],
    queryFn: async (): Promise<SavedTemplate[]> => {
      const { data, error } = await supabase
        .from("reels")
        .select("id, title, created_at, source_template")
        .not("source_template", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as SavedTemplate[];
    },
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-template", {
        body: {
          reelId: deleteTarget.id,
          r2Key: deleteTarget.source_template.sourceR2Key ?? null,
        },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["saved-templates"] });
      queryClient.invalidateQueries({ queryKey: ["reels"] });
      toast({ title: "Template deleted" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to delete template",
        description: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleUseTemplate = (template: ReelTemplate) => {
    setCloneTemplate(template);
    setShowCloneDialog(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold">Templates</h1>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center py-12">
          <Sparkle className="h-8 w-8 text-primary animate-pulse" />
          <p className="text-sm text-muted-foreground mt-2">
            Loading templates...
          </p>
        </div>
      ) : !templates || templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <Layout className="h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground max-w-xs">
            No templates yet. Clone a reel to save its structure as a template.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            Back to Reels
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => {
            const tmpl = t.source_template;
            const date = new Date(t.created_at);
            const dateStr = date.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year:
                date.getFullYear() !== new Date().getFullYear()
                  ? "numeric"
                  : undefined,
            });

            return (
              <div
                key={t.id}
                className="rounded-lg border bg-card p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {dateStr}
                    </p>
                  </div>
                </div>

                <div className="flex gap-1.5 flex-wrap">
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0"
                  >
                    {tmpl.segmentCount} segments
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0"
                  >
                    {Math.round(tmpl.totalDurationSeconds)}s
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 capitalize"
                  >
                    {tmpl.overallMood}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 capitalize"
                  >
                    {tmpl.overallPacing}
                  </Badge>
                </div>

                {tmpl.visualStyleNotes && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {tmpl.visualStyleNotes}
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => handleUseTemplate(tmpl)}
                  >
                    <Play className="h-3.5 w-3.5 mr-1" /> Use Template
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(t)}
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CloneReelDialog
        open={showCloneDialog}
        onOpenChange={(open) => {
          setShowCloneDialog(open);
          if (!open) setCloneTemplate(null);
        }}
        videos={videos}
        initialTemplate={cloneTemplate}
        onComplete={(reelId) => {
          setShowCloneDialog(false);
          setCloneTemplate(null);
          navigate(`/reels/${reelId}`);
        }}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the template from "{deleteTarget?.title}" and
              delete the source video from storage. The reel itself will be kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
