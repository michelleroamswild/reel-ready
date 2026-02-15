import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { TrendingAudio } from "@/types/trending-audio";

const TRENDING_AUDIO_KEY = ["trending-audio"];

export function useTrendingAudio() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: TRENDING_AUDIO_KEY,
    queryFn: async (): Promise<TrendingAudio[]> => {
      const { data, error } = await supabase
        .from("trending_audio")
        .select("*")
        .order("fetched_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data ?? []) as TrendingAudio[];
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: TRENDING_AUDIO_KEY });
  };

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    refresh,
  };
}
