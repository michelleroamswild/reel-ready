import type { ReelWithDetails } from "./reel";

export type TrialVariantType = "text" | "visual" | "audio";

export interface ReferencePatterns {
  hookStyle: string;
  avgDuration: number;
  pacingNotes: string;
  textStyle: string;
  commonMoods: string[];
  structureNotes: string;
  audioNotes: string;
  summary: string;
}

export interface TrialBatch {
  id: string;
  base_reel_id: string;
  status: "generating" | "ready";
  user_id: string;
  created_at: string;
  reference_urls?: string[];
  reference_patterns?: ReferencePatterns | null;
}

export interface TrialBatchWithReels extends TrialBatch {
  base_reel: { id: string; title: string };
  reels: ReelWithDetails[];
}
