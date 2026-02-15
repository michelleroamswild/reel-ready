import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { TrendingAudio } from "@/types/trending-audio";

const TRENDING_AUDIO_KEY = ["trending-audio"];

export function useTrendingAudio() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: TRENDING_AUDIO_KEY,
    queryFn: async (): Promise<TrendingAudio[]> => {
      // First try to get fresh cached data (within 24h)
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: cached, error: cacheError } = await supabase
        .from("trending_audio")
        .select("*")
        .gte("fetched_at", cutoff)
        .order("trend_rank", { ascending: true })
        .limit(20);

      if (!cacheError && cached && cached.length > 0) {
        return cached as TrendingAudio[];
      }

      // If empty or stale, trigger edge function to refresh
      const { data: result, error: fnError } =
        await supabase.functions.invoke("fetch-trending-audio", {
          body: {},
        });

      if (fnError) throw fnError;

      let parsed = result;
      if (typeof result === "string") {
        parsed = JSON.parse(result);
      }

      return (parsed?.tracks ?? []) as TrendingAudio[];
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
