import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { ReelTemplate } from "@/types/reel";
import type { ReferencePatterns } from "@/types/trial";

export type ReferenceStatus =
  | "idle"
  | "analyzing"
  | "synthesizing"
  | "done"
  | "error";

interface ReferenceState {
  status: ReferenceStatus;
  templates: ReelTemplate[];
  patterns: ReferencePatterns | null;
  currentIndex: number;
  totalUrls: number;
  error: string | null;
  failedUrls: string[];
}

export function useReferenceAnalysis() {
  const [state, setState] = useState<ReferenceState>({
    status: "idle",
    templates: [],
    patterns: null,
    currentIndex: 0,
    totalUrls: 0,
    error: null,
    failedUrls: [],
  });

  const reset = useCallback(() => {
    setState({
      status: "idle",
      templates: [],
      patterns: null,
      currentIndex: 0,
      totalUrls: 0,
      error: null,
      failedUrls: [],
    });
  }, []);

  const analyzeAll = useCallback(async (urls: string[]) => {
    setState((s) => ({
      ...s,
      status: "analyzing",
      templates: [],
      patterns: null,
      currentIndex: 0,
      totalUrls: urls.length,
      error: null,
      failedUrls: [],
    }));

    const templates: ReelTemplate[] = [];
    const failedUrls: string[] = [];

    // Analyze each URL sequentially
    for (let i = 0; i < urls.length; i++) {
      setState((s) => ({ ...s, currentIndex: i }));

      try {
        const { data, error } = await supabase.functions.invoke(
          "analyze-reel-template",
          { body: { videoUrl: urls[i], mimeType: "video/mp4" } }
        );

        if (error) throw error;

        let parsed = data;
        if (typeof data === "string") {
          parsed = JSON.parse(data);
        }
        if (parsed.error) throw new Error(parsed.error);

        const template = parsed.template as ReelTemplate;
        template.sourceUrl = urls[i];
        templates.push(template);
      } catch {
        failedUrls.push(urls[i]);
      }
    }

    if (templates.length === 0) {
      setState((s) => ({
        ...s,
        status: "error",
        error: "All reference URLs failed to analyze. Try different URLs or upload directly.",
        failedUrls,
      }));
      return;
    }

    // Now synthesize patterns
    setState((s) => ({
      ...s,
      status: "synthesizing",
      templates,
      failedUrls,
    }));

    try {
      const { data, error } = await supabase.functions.invoke(
        "synthesize-reference-patterns",
        { body: { templates } }
      );

      if (error) throw error;

      let parsed = data;
      if (typeof data === "string") {
        parsed = JSON.parse(data);
      }
      if (parsed.error) throw new Error(parsed.error);

      const patterns = parsed.patterns as ReferencePatterns;

      setState((s) => ({
        ...s,
        status: "done",
        patterns,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        status: "error",
        error: err instanceof Error ? err.message : "Failed to synthesize patterns",
      }));
    }
  }, []);

  return {
    ...state,
    analyzeAll,
    reset,
    progress: state.totalUrls > 0
      ? `${state.currentIndex + 1} of ${state.totalUrls}`
      : "",
  };
}
