import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Phrase } from "@/types/phrase";

const PHRASES_KEY = ["phrases"];

async function fetchPhrases(): Promise<Phrase[]> {
  const { data, error } = await supabase
    .from("phrases")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
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
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PHRASES_KEY }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<Phrase, "id" | "created_at">>;
    }) => {
      const { error } = await supabase
        .from("phrases")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PHRASES_KEY }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("phrases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PHRASES_KEY }),
  });

  const addPhrase = (text: string, tags: string[], notes: string) => {
    addMutation.mutate({ text, tags, notes });
  };

  const updatePhrase = (
    id: string,
    updates: Partial<Omit<Phrase, "id" | "created_at">>
  ) => {
    updateMutation.mutate({ id, updates });
  };

  const deletePhrase = (id: string) => {
    deleteMutation.mutate(id);
  };

  return { phrases, isLoading, addPhrase, updatePhrase, deletePhrase };
}
