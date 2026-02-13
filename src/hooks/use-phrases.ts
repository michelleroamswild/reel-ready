import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Phrase, PhraseAnalysis } from "@/types/phrase";

const PHRASES_KEY = ["phrases"];

async function fetchPhrases(): Promise<Phrase[]> {
  const { data, error } = await supabase
    .from("phrases")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

async function analyzePhraseWithAi(
  phraseId: string,
  text: string,
  tags: string[],
  notes: string
): Promise<PhraseAnalysis | null> {
  try {
    const { data, error } = await supabase.functions.invoke("analyze-phrase", {
      body: { phraseText: text, tags, notes },
    });

    if (error) throw error;

    const analysis = data.analysis as PhraseAnalysis;

    await supabase
      .from("phrases")
      .update({ analysis })
      .eq("id", phraseId);

    return analysis;
  } catch (err) {
    console.error("Phrase analysis failed:", err);
    return null;
  }
}

export function usePhrases() {
  const queryClient = useQueryClient();

  const { data: phrases = [], isLoading } = useQuery({
    queryKey: PHRASES_KEY,
    queryFn: fetchPhrases,
  });

  const addMutation = useMutation({
    mutationFn: async ({
      text,
      tags,
      notes,
    }: {
      text: string;
      tags: string[];
      notes: string;
    }) => {
      const { data, error } = await supabase
        .from("phrases")
        .insert({ text, tags, notes })
        .select()
        .single();

      if (error) throw error;
      return data as Phrase;
    },
    onSuccess: (phrase) => {
      queryClient.invalidateQueries({ queryKey: PHRASES_KEY });
      // Auto-trigger phrase analysis in background
      analyzePhraseWithAi(phrase.id, phrase.text, phrase.tags, phrase.notes).then(
        () => {
          queryClient.invalidateQueries({ queryKey: PHRASES_KEY });
        }
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<Phrase, "id" | "created_at" | "analysis">>;
    }) => {
      const { data, error } = await supabase
        .from("phrases")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Phrase;
    },
    onSuccess: (phrase) => {
      queryClient.invalidateQueries({ queryKey: PHRASES_KEY });
      // Re-analyze after edit
      analyzePhraseWithAi(phrase.id, phrase.text, phrase.tags, phrase.notes).then(
        () => {
          queryClient.invalidateQueries({ queryKey: PHRASES_KEY });
        }
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("phrases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PHRASES_KEY }),
  });

  const analyzeMutation = useMutation({
    mutationFn: async (phrase: Phrase) => {
      return analyzePhraseWithAi(phrase.id, phrase.text, phrase.tags, phrase.notes);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PHRASES_KEY }),
  });

  const addPhrase = (text: string, tags: string[], notes: string) => {
    addMutation.mutate({ text, tags, notes });
  };

  const updatePhrase = (
    id: string,
    updates: Partial<Omit<Phrase, "id" | "created_at" | "analysis">>
  ) => {
    updateMutation.mutate({ id, updates });
  };

  const deletePhrase = (id: string) => {
    deleteMutation.mutate(id);
  };

  const analyzePhrase = (phrase: Phrase) => {
    analyzeMutation.mutate(phrase);
  };

  return {
    phrases,
    isLoading,
    addPhrase,
    updatePhrase,
    deletePhrase,
    analyzePhrase,
    isAnalyzingPhrase: analyzeMutation.isPending,
  };
}
