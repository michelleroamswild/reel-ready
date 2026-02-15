import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Sparkle } from "@phosphor-icons/react";
import type { ReelTemplate } from "@/types/reel";

interface SavedTemplate {
  id: string;
  title: string;
  created_at: string;
  source_template: ReelTemplate;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (template: ReelTemplate) => void;
}

export function TemplatePickerDialog({ open, onOpenChange, onPick }: Props) {
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
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Saved Templates</DialogTitle>
          <DialogDescription>
            Pick a template from a previously cloned reel to build a new reel.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center py-8">
            <Sparkle className="h-8 w-8 text-primary animate-pulse" />
            <p className="text-sm text-muted-foreground mt-2">
              Loading templates...
            </p>
          </div>
        ) : !templates || templates.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              No saved templates yet. Clone a reel first to save its template.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {templates.map((t) => {
              const tmpl = t.source_template;
              return (
                <button
                  key={t.id}
                  className="w-full text-left rounded-lg border bg-card px-3 py-2.5 hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    onPick(tmpl);
                    onOpenChange(false);
                  }}
                >
                  <p className="text-sm font-medium truncate">{t.title}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {tmpl.segmentCount} segments
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {Math.round(tmpl.totalDurationSeconds)}s
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                      {tmpl.overallMood}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                      {tmpl.overallPacing}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(t.created_at).toLocaleDateString()}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
