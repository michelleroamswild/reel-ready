import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { MatchWithDetails } from "@/types/match";

const MATCHES_KEY = ["matches"];

async function fetchMatches(): Promise<MatchWithDetails[]> {
  const { data, error } = await supabase
    .from("matches")
    .select(
      `
      *,
      phrase:phrases!phrase_id(id, text, tags),
      video:videos!video_id(id, filename, url, duration_seconds)
    `
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as MatchWithDetails[];
}

export function useMatches() {
  const queryClient = useQueryClient();

  const { data: matches = [], isLoading } = useQuery({
    queryKey: MATCHES_KEY,
    queryFn: fetchMatches,
  });

  const saveMutation = useMutation({
    mutationFn: async ({
      phraseId,
      videoId,
      score,
      reasoning,
    }: {
      phraseId: string;
      videoId: string;
      score?: number;
      reasoning?: string;
    }) => {
      const { data, error } = await supabase
        .from("matches")
        .insert({
          phrase_id: phraseId,
          video_id: videoId,
          score: score ?? null,
          reasoning: reasoning ?? "",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MATCHES_KEY }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("matches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MATCHES_KEY }),
  });

  const saveMatch = (
    phraseId: string,
    videoId: string,
    score?: number,
    reasoning?: string
  ) => saveMutation.mutate({ phraseId, videoId, score, reasoning });

  const deleteMatch = (id: string) => deleteMutation.mutate(id);

  return {
    matches,
    isLoading,
    saveMatch,
    deleteMatch,
    isSaving: saveMutation.isPending,
  };
}
