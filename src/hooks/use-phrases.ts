import { useState, useCallback } from "react";
import type { Phrase } from "@/types/phrase";

const STORAGE_KEY = "clipmatch-phrases";

function loadPhrases(): Phrase[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePhrases(phrases: Phrase[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(phrases));
}

export function usePhrases() {
  const [phrases, setPhrases] = useState<Phrase[]>(loadPhrases);

  const sync = (next: Phrase[]) => {
    setPhrases(next);
    savePhrases(next);
  };

  const addPhrase = useCallback((text: string, tags: string[], notes: string) => {
    const p: Phrase = { id: crypto.randomUUID(), text, tags, notes, createdAt: Date.now() };
    sync([p, ...loadPhrases()]);
  }, []);

  const updatePhrase = useCallback((id: string, updates: Partial<Omit<Phrase, "id" | "createdAt">>) => {
    const current = loadPhrases();
    sync(current.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const deletePhrase = useCallback((id: string) => {
    sync(loadPhrases().filter(p => p.id !== id));
  }, []);

  return { phrases, addPhrase, updatePhrase, deletePhrase };
}
