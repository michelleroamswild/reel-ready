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
      phrase:phrases!phrase_id(id, text, tags),
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
      phrase:phrases!phrase_id(id, text, tags),
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

      // 2. Split phrase into sections by line breaks
      const sections = phrase.text
        .split(/\n+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      // 3. Filter to analyzed videos
      const analyzedVideos = videos.filter((v) => v.analysis !== null);

      if (analyzedVideos.length === 0) {
        throw new Error("No analyzed videos available");
      }

      // 4. Call edge function for AI suggestions
      const { data: result, error: fnError } = await supabase.functions.invoke(
        "suggest-reel-segments",
        {
          body: {
            sections,
            targetDuration,
            phraseAnalysis: phrase.analysis ?? null,
            videos: analyzedVideos.map((v) => ({
              id: v.id,
              filename: v.filename,
              duration_seconds: v.duration_seconds,
              analysis: v.analysis,
            })),
          },
        }
      );

      if (fnError) throw fnError;
      if (result.error) throw new Error(result.error);

      // 5. Insert segments
      const segments = (result.segments as Array<{
        sectionIndex: number;
        videoId: string;
        startSeconds: number;
        endSeconds: number;
        score: number;
        reasoning: string;
      }>).map((seg) => ({
        reel_id: (reel as Reel).id,
        video_id: seg.videoId,
        section_text: sections[seg.sectionIndex] ?? "",
        section_index: seg.sectionIndex,
        start_seconds: seg.startSeconds,
        end_seconds: seg.endSeconds,
        score: seg.score,
        reasoning: seg.reasoning,
      }));

      const { error: segError } = await supabase
        .from("reel_segments")
        .insert(segments);

      if (segError) throw segError;

      return (reel as Reel).id;
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

  return {
    reel,
    isLoading,
    updateSegment: updateSegmentMutation.mutateAsync,
    isUpdating: updateSegmentMutation.isPending,
  };
}
