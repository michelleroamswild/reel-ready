import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
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
        video:videos!video_id(id, filename, url, duration_seconds)
      )
    `
    )
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
        video:videos!video_id(id, filename, url, duration_seconds)
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
      const { data: reel, error: reelError } = await supabase
        .from("reels")
        .insert({
          phrase_id: phrase.id,
          title,
          target_duration_seconds: targetDuration,
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
        await supabase.from("reels").delete().eq("id", reelId).catch(() => {});
        throw err;
      }
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

  return {
    reel,
    isLoading,
    updateSegment: updateSegmentMutation.mutateAsync,
    isUpdating: updateSegmentMutation.isPending,
    updateTitle: updateTitleMutation.mutateAsync,
  };
}
