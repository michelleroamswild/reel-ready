import { useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { AiSuggestion } from "@/types/match";
import type { Video } from "@/types/video";
import type { Phrase } from "@/types/phrase";

interface SuggestMatchesParams {
  phrase: Phrase;
  videos: Video[];
  onPass1Complete?: () => void;
}

interface DeepMatchResult {
  videoId: string;
  score: number;
  reasoning: string;
  moodMatch: string;
  energyMatch: string;
  visualNotes: string;
  timestampSuggestions?: string[];
}

async function fetchSuggestions({
  phrase,
  videos,
}: SuggestMatchesParams): Promise<AiSuggestion[]> {
  const { data, error } = await supabase.functions.invoke("suggest-matches", {
    body: {
      phraseText: phrase.text,
      phraseTags: phrase.tags,
      phraseAnalysis: phrase.analysis,
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

async function fetchDeepMatch(
  phrase: Phrase,
  video: Video
): Promise<DeepMatchResult> {
  const { data, error } = await supabase.functions.invoke("deep-match", {
    body: {
      phraseText: phrase.text,
      phraseTags: phrase.tags,
      phraseAnalysis: phrase.analysis,
      videoId: video.id,
      videoUrl: video.url,
      videoFilename: video.filename,
      videoAnalysis: video.analysis,
      mimeType: video.mime_type,
    },
  });

  if (error) throw error;
  return data as DeepMatchResult;
}

export function useAiSuggestions() {
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [refiningIds, setRefiningIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef(false);

  const reset = useCallback(() => {
    setSuggestions([]);
    setIsAnalyzing(false);
    setRefiningIds(new Set());
    setError(null);
    abortRef.current = true;
  }, []);

  const getSuggestions = useCallback(
    async ({ phrase, videos, onPass1Complete }: SuggestMatchesParams) => {
      setIsAnalyzing(true);
      setError(null);
      setSuggestions([]);
      setRefiningIds(new Set());
      abortRef.current = false;

      try {
        // Pass 1: Fast text-based comparison
        const pass1Results = await fetchSuggestions({ phrase, videos });
        if (abortRef.current) return pass1Results;

        setSuggestions(pass1Results);
        setIsAnalyzing(false);
        onPass1Complete?.();

        // Pass 2: Deep re-evaluation of top 3
        const top3 = pass1Results.slice(0, 3);
        const top3Ids = new Set(top3.map((s) => s.videoId));
        setRefiningIds(top3Ids);

        const videoMap = new Map(videos.map((v) => [v.id, v]));

        // Run deep matches in parallel
        const deepPromises = top3.map(async (suggestion) => {
          const video = videoMap.get(suggestion.videoId);
          if (!video) return null;

          try {
            const result = await fetchDeepMatch(phrase, video);
            return result;
          } catch (err) {
            console.error(`Deep match failed for ${suggestion.videoId}:`, err);
            return null;
          }
        });

        // Update scores as each deep result arrives
        for (const promise of deepPromises) {
          const result = await promise;
          if (abortRef.current) return pass1Results;
          if (!result) continue;

          setSuggestions((prev) => {
            const updated = prev.map((s) => {
              if (s.videoId === result.videoId) {
                return {
                  ...s,
                  score: result.score,
                  reasoning: result.reasoning,
                  moodMatch: result.moodMatch,
                  energyMatch: result.energyMatch,
                  visualNotes: result.visualNotes,
                };
              }
              return s;
            });
            // Re-sort by score
            updated.sort((a, b) => b.score - a.score);
            return updated;
          });

          setRefiningIds((prev) => {
            const next = new Set(prev);
            next.delete(result.videoId);
            return next;
          });
        }

        return pass1Results;
      } catch (err) {
        setError(err as Error);
        setIsAnalyzing(false);
        throw err;
      }
    },
    []
  );

  return {
    suggestions,
    getSuggestions,
    isAnalyzing,
    refiningIds,
    error,
    reset,
  };
}
