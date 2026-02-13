import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { AiSuggestion } from "@/types/match";
import type { Video } from "@/types/video";
import type { Phrase } from "@/types/phrase";

interface SuggestMatchesParams {
  phrase: Phrase;
  videos: Video[];
}

async function fetchSuggestions({
  phrase,
  videos,
}: SuggestMatchesParams): Promise<AiSuggestion[]> {
  const { data, error } = await supabase.functions.invoke("suggest-matches", {
    body: {
      phraseText: phrase.text,
      phraseTags: phrase.tags,
      videos: videos.map((v) => ({
        id: v.id,
        filename: v.filename,
        analysis: v.analysis,
      })),
    },
  });

  if (error) throw error;
  return data.suggestions as AiSuggestion[];
}

export function useAiSuggestions() {
  const mutation = useMutation({
    mutationFn: fetchSuggestions,
  });

  return {
    suggestions: mutation.data ?? [],
    getSuggestions: mutation.mutateAsync,
    isAnalyzing: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
