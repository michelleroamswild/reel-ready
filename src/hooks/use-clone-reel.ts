import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { uploadToR2 } from "@/lib/storage";
import type { ReelTemplate } from "@/types/reel";
import type { Video } from "@/types/video";

export type CloneStep =
  | "input"
  | "downloading"
  | "download-failed"
  | "uploading"
  | "analyzing"
  | "review"
  | "building"
  | "error";

interface CloneState {
  step: CloneStep;
  template: ReelTemplate | null;
  error: string | null;
}

export function useCloneReel() {
  const [state, setState] = useState<CloneState>({
    step: "input",
    template: null,
    error: null,
  });

  const reset = useCallback(() => {
    setState({ step: "input", template: null, error: null });
  }, []);

  const useFromTemplate = useCallback(
    (template: ReelTemplate) => {
      setState({ step: "review", template, error: null });
    },
    []
  );

  const analyzeSource = useCallback(
    async (videoUrl: string, mimeType: string, sourceUrl: string | null) => {
      setState((s) => ({ ...s, step: "analyzing", error: null }));
      try {
        const { data, error } = await supabase.functions.invoke(
          "analyze-reel-template",
          { body: { videoUrl, mimeType: mimeType || "video/mp4" } }
        );
        if (error) throw error;

        let parsed = data;
        if (typeof data === "string") {
          parsed = JSON.parse(data);
        }
        if (parsed.error) throw new Error(parsed.error);

        const template = parsed.template as ReelTemplate;
        template.sourceUrl = sourceUrl;
        setState({ step: "review", template, error: null });
      } catch (err) {
        setState({
          step: "error",
          template: null,
          error: err instanceof Error ? err.message : "Analysis failed",
        });
      }
    },
    []
  );

  const downloadFromUrl = useCallback(
    async (url: string) => {
      // Upload the URL to R2 first so the edge function can download from R2
      // Actually — we'll just pass the external URL to analyze-reel-template
      // and let the edge function fetch it directly
      setState((s) => ({ ...s, step: "downloading", error: null }));

      try {
        // Try fetching the URL from the edge function directly
        const { data, error } = await supabase.functions.invoke(
          "analyze-reel-template",
          { body: { videoUrl: url, mimeType: "video/mp4" } }
        );
        if (error) throw error;

        let parsed = data;
        if (typeof data === "string") {
          parsed = JSON.parse(data);
        }
        if (parsed.error) throw new Error(parsed.error);

        const template = parsed.template as ReelTemplate;
        template.sourceUrl = url;
        setState({ step: "review", template, error: null });
      } catch (err) {
        setState({
          step: "download-failed",
          template: null,
          error: err instanceof Error ? err.message : "Could not download video from URL",
        });
      }
    },
    []
  );

  const uploadFile = useCallback(
    async (file: File) => {
      setState((s) => ({ ...s, step: "uploading", error: null }));
      try {
        const { url } = await uploadToR2(file);
        await analyzeSource(url, file.type, null);
      } catch (err) {
        setState({
          step: "error",
          template: null,
          error: err instanceof Error ? err.message : "Upload failed",
        });
      }
    },
    [analyzeSource]
  );

  const buildReel = useCallback(
    async (title: string, videos: Video[]): Promise<string> => {
      if (!state.template) throw new Error("No template available");
      setState((s) => ({ ...s, step: "building" }));

      // Insert reel (no phrase_id for cloned reels)
      const { data: reel, error: reelError } = await supabase
        .from("reels")
        .insert({
          title,
          target_duration_seconds: Math.round(
            state.template.totalDurationSeconds
          ),
          source_template: state.template,
        })
        .select()
        .single();

      if (reelError) throw reelError;

      const reelId = reel.id;

      try {
        const analyzedVideos = videos.filter(
          (v) => v.analysis !== null && v.analysis !== undefined
        );

        if (analyzedVideos.length === 0) {
          throw new Error(
            "No analyzed videos available. Analyze at least one video first."
          );
        }

        const { data: result, error: fnError } =
          await supabase.functions.invoke("clone-reel-segments", {
            body: {
              template: state.template,
              videos: analyzedVideos.map((v) => ({
                id: v.id,
                filename: v.filename,
                duration_seconds: v.duration_seconds,
                analysis: v.analysis,
              })),
            },
          });

        if (fnError) throw fnError;

        let parsed = result;
        if (typeof result === "string") {
          parsed = JSON.parse(result);
        }
        if (parsed.error) throw new Error(parsed.error);

        const rawSegments = parsed.segments as Array<
          Record<string, unknown>
        >;
        if (!rawSegments || rawSegments.length === 0) {
          throw new Error("AI returned no segments");
        }

        // Validate UUIDs
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        const segments = rawSegments.map((seg) => {
          const videoId = (seg.videoId ?? seg.video_id) as string;
          if (!uuidRegex.test(videoId)) {
            throw new Error(
              `Invalid video_id "${videoId}" — expected UUID.`
            );
          }
          return {
            reel_id: reelId,
            video_id: videoId,
            section_text: (seg.sectionText ?? seg.section_text ?? "") as string,
            section_index: (seg.sectionIndex ?? seg.section_index ?? 0) as number,
            start_seconds: (seg.startSeconds ?? seg.start_seconds ?? 0) as number,
            end_seconds: (seg.endSeconds ?? seg.end_seconds ?? 5) as number,
            score: (seg.score ?? null) as number | null,
            reasoning: (seg.reasoning ?? "") as string,
          };
        });

        const { error: segError } = await supabase
          .from("reel_segments")
          .insert(segments);

        if (segError) throw segError;

        return reelId;
      } catch (err) {
        // Rollback: delete the reel since segments failed
        await supabase
          .from("reels")
          .delete()
          .eq("id", reelId)
          .catch(() => {});
        setState({
          step: "error",
          template: state.template,
          error: err instanceof Error ? err.message : "Build failed",
        });
        throw err;
      }
    },
    [state.template]
  );

  return {
    ...state,
    reset,
    useFromTemplate,
    downloadFromUrl,
    uploadFile,
    buildReel,
  };
}
