import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, getCurrentUserId } from "@/lib/supabase";
import type { Reel, ReelWithDetails } from "@/types/reel";
import type { Phrase } from "@/types/phrase";
import type { Video } from "@/types/video";

const REELS_KEY = ["reels"];
const reelKey = (id: string) => ["reels", id];

async function fetchReels(): Promise<ReelWithDetails[]> {
  const { data, error } = await supabase
    .from("reels")
    .select(
      `
      *,
      phrase:phrases(id, text, tags),
      reel_segments(
        *,
        video:videos!video_id(id, filename, url, duration_seconds, thumbnail_url)
      )
    `
    )
    .is("trial_batch_id", null)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Sort segments by section_index within each reel
  for (const reel of data) {
    reel.reel_segments?.sort(
      (a: { section_index: number }, b: { section_index: number }) =>
        a.section_index - b.section_index
    );
  }

  return data as ReelWithDetails[];
}

async function fetchReel(id: string): Promise<ReelWithDetails> {
  const { data, error } = await supabase
    .from("reels")
    .select(
      `
      *,
      phrase:phrases(id, text, tags),
      reel_segments(
        *,
        video:videos!video_id(id, filename, url, duration_seconds, thumbnail_url)
      )
    `
    )
    .eq("id", id)
    .single();

  if (error) throw error;

  data.reel_segments?.sort(
    (a: { section_index: number }, b: { section_index: number }) =>
      a.section_index - b.section_index
  );

  return data as ReelWithDetails;
}

export function useReels() {
  const queryClient = useQueryClient();

  const { data: reels = [], isLoading } = useQuery({
    queryKey: REELS_KEY,
    queryFn: fetchReels,
  });

  const createMutation = useMutation({
    mutationFn: async ({
      phrase,
      title,
      targetDuration,
      videos,
    }: {
      phrase: Phrase;
      title: string;
      targetDuration: number;
      videos: Video[];
    }) => {
      // 1. Insert the reel
      const user_id = await getCurrentUserId();
      const { data: reel, error: reelError } = await supabase
        .from("reels")
        .insert({
          phrase_id: phrase.id,
          title,
          target_duration_seconds: targetDuration,
          user_id,
        })
        .select()
        .single();

      if (reelError) throw reelError;

      const reelId = (reel as Reel).id;

      try {
        // 2. Filter to analyzed videos
        const analyzedVideos = videos.filter(
          (v) => v.analysis !== null && v.analysis !== undefined
        );

        if (analyzedVideos.length === 0) {
          throw new Error(
            "No analyzed videos available. Analyze at least one video first."
          );
        }

        // 3. Call edge function — AI splits the phrase into beats and assigns clips
        const { data: result, error: fnError } =
          await supabase.functions.invoke("suggest-reel-segments", {
            body: {
              phraseText: phrase.text,
              targetDuration,
              phraseAnalysis: phrase.analysis ?? null,
              videos: analyzedVideos.map((v) => ({
                id: v.id,
                filename: v.filename,
                duration_seconds: v.duration_seconds,
                analysis: v.analysis,
              })),
            },
          });

        if (fnError) throw fnError;

        // Parse result — handle both parsed JSON and string responses
        let parsed = result;
        if (typeof result === "string") {
          try {
            parsed = JSON.parse(result);
          } catch {
            throw new Error(`Edge function returned invalid JSON: ${result.slice(0, 200)}`);
          }
        }

        if (!parsed) {
          throw new Error("Edge function returned empty response");
        }

        if (parsed.error) {
          throw new Error(parsed.error);
        }

        // 4. Extract and validate segments
        const rawSegments = parsed.segments as Array<Record<string, unknown>> | undefined;

        if (!rawSegments || rawSegments.length === 0) {
          throw new Error("AI returned no segments");
        }

        const segments = rawSegments.map((seg) => ({
          reel_id: reelId,
          video_id: (seg.videoId ?? seg.video_id) as string,
          section_text: (seg.sectionText ?? seg.section_text ?? "") as string,
          section_index: (seg.sectionIndex ?? seg.section_index ?? 0) as number,
          start_seconds: (seg.startSeconds ?? seg.start_seconds ?? 0) as number,
          end_seconds: (seg.endSeconds ?? seg.end_seconds ?? 5) as number,
          score: (seg.score ?? null) as number | null,
          reasoning: (seg.reasoning ?? "") as string,
        }));

        // Validate video IDs are UUIDs
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        for (const seg of segments) {
          if (!uuidRegex.test(seg.video_id)) {
            throw new Error(
              `Invalid video_id "${seg.video_id}" — expected UUID. AI may have returned an index instead.`
            );
          }
        }

        const { error: segError } = await supabase
          .from("reel_segments")
          .insert(segments);

        if (segError) throw segError;

        return reelId;
      } catch (err) {
        // Rollback: delete the reel since segments failed
        try { await supabase.from("reels").delete().eq("id", reelId); } catch {}
        throw err;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REELS_KEY }),
  });

  const createQuickReelMutation = useMutation({
    mutationFn: async ({
      title,
      text,
      videoId,
      startSeconds,
      endSeconds,
    }: {
      title: string;
      text?: string;
      videoId: string;
      startSeconds: number;
      endSeconds: number;
    }) => {
      // 1. Insert reel with no phrase
      const user_id = await getCurrentUserId();
      const { data: reel, error: reelError } = await supabase
        .from("reels")
        .insert({
          phrase_id: null,
          title,
          target_duration_seconds: endSeconds - startSeconds,
          user_id,
        })
        .select()
        .single();

      if (reelError) throw reelError;

      const reelId = (reel as Reel).id;

      // 2. Insert single segment covering the full clip
      const { error: segError } = await supabase
        .from("reel_segments")
        .insert({
          reel_id: reelId,
          video_id: videoId,
          section_text: text ?? "",
          section_index: 0,
          start_seconds: startSeconds,
          end_seconds: endSeconds,
        });

      if (segError) {
        try { await supabase.from("reels").delete().eq("id", reelId); } catch {}
        throw segError;
      }

      return reelId;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REELS_KEY }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REELS_KEY }),
  });

  return {
    reels,
    isLoading,
    createReel: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createQuickReel: createQuickReelMutation.mutateAsync,
    isCreatingQuickReel: createQuickReelMutation.isPending,
    deleteReel: (id: string) => deleteMutation.mutate(id),
  };
}

export function useReel(id: string | undefined) {
  const queryClient = useQueryClient();

  const { data: reel, isLoading } = useQuery({
    queryKey: reelKey(id!),
    queryFn: () => fetchReel(id!),
    enabled: !!id,
  });

  const updateSegmentMutation = useMutation({
    mutationFn: async ({
      segmentId,
      videoId,
      startSeconds,
      endSeconds,
    }: {
      segmentId: string;
      videoId: string;
      startSeconds: number;
      endSeconds: number;
    }) => {
      const { error } = await supabase
        .from("reel_segments")
        .update({
          video_id: videoId,
          start_seconds: startSeconds,
          end_seconds: endSeconds,
        })
        .eq("id", segmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      if (id) queryClient.invalidateQueries({ queryKey: reelKey(id) });
      queryClient.invalidateQueries({ queryKey: REELS_KEY });
    },
  });

  const updateSegmentTextMutation = useMutation({
    mutationFn: async ({ segmentId, text }: { segmentId: string; text: string }) => {
      const { error } = await supabase
        .from("reel_segments")
        .update({ section_text: text })
        .eq("id", segmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (id) queryClient.invalidateQueries({ queryKey: reelKey(id) });
      queryClient.invalidateQueries({ queryKey: REELS_KEY });
    },
  });

  const updateTitleMutation = useMutation({
    mutationFn: async (title: string) => {
      const { error } = await supabase
        .from("reels")
        .update({ title })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      if (id) queryClient.invalidateQueries({ queryKey: reelKey(id) });
      queryClient.invalidateQueries({ queryKey: REELS_KEY });
    },
  });

  const deleteSegmentMutation = useMutation({
    mutationFn: async (segmentId: string) => {
      const { error } = await supabase
        .from("reel_segments")
        .delete()
        .eq("id", segmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (id) queryClient.invalidateQueries({ queryKey: reelKey(id) });
      queryClient.invalidateQueries({ queryKey: REELS_KEY });
    },
  });

  const updateTextSettingsMutation = useMutation({
    mutationFn: async (settings: {
      burn_text: boolean;
      text_position: string;
      text_size: string;
      text_border: string;
      text_border_color: string;
      text_color: string;
      text_width?: string;
      text_shadow_intensity?: string;
    }) => {
      const { error } = await supabase
        .from("reels")
        .update(settings)
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      if (id) queryClient.invalidateQueries({ queryKey: reelKey(id) });
      queryClient.invalidateQueries({ queryKey: REELS_KEY });
    },
  });

  const updateSavedCaptionsMutation = useMutation({
    mutationFn: async (captions: { text: string; hashtags: string[] }[]) => {
      const { error } = await supabase
        .from("reels")
        .update({ saved_captions: captions })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      if (id) queryClient.invalidateQueries({ queryKey: reelKey(id) });
      queryClient.invalidateQueries({ queryKey: REELS_KEY });
    },
  });

  const addSegmentMutation = useMutation({
    mutationFn: async ({
      videoId,
      sectionText,
      startSeconds,
      endSeconds,
    }: {
      videoId: string;
      sectionText: string;
      startSeconds: number;
      endSeconds: number;
    }) => {
      const { data: existing } = await supabase
        .from("reel_segments")
        .select("section_index")
        .eq("reel_id", id!)
        .order("section_index", { ascending: false })
        .limit(1);

      const nextIndex = (existing?.[0]?.section_index ?? -1) + 1;

      const { error } = await supabase.from("reel_segments").insert({
        reel_id: id!,
        video_id: videoId,
        section_text: sectionText,
        section_index: nextIndex,
        start_seconds: startSeconds,
        end_seconds: endSeconds,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (id) queryClient.invalidateQueries({ queryKey: reelKey(id) });
      queryClient.invalidateQueries({ queryKey: REELS_KEY });
    },
  });

  const reorderSegmentsMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((segId, i) =>
        supabase
          .from("reel_segments")
          .update({ section_index: i })
          .eq("id", segId)
      );
      const results = await Promise.all(updates);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: () => {
      if (id) queryClient.invalidateQueries({ queryKey: reelKey(id) });
      queryClient.invalidateQueries({ queryKey: REELS_KEY });
    },
  });

  return {
    reel,
    isLoading,
    updateSegment: updateSegmentMutation.mutateAsync,
    isUpdating: updateSegmentMutation.isPending,
    updateSegmentText: updateSegmentTextMutation.mutateAsync,
    deleteSegment: deleteSegmentMutation.mutateAsync,
    updateTitle: updateTitleMutation.mutateAsync,
    updateTextSettings: updateTextSettingsMutation.mutateAsync,
    updateSavedCaptions: updateSavedCaptionsMutation.mutateAsync,
    addSegment: addSegmentMutation.mutateAsync,
    isAdding: addSegmentMutation.isPending,
    reorderSegments: reorderSegmentsMutation.mutateAsync,
  };
}
