import type { ReelWithDetails } from "./reel";

export type TrialVariantType = "hook" | "pacing" | "tone" | "structure" | "format";

export interface TrialBatch {
  id: string;
  base_reel_id: string;
  status: "generating" | "ready";
  created_at: string;
}

export interface TrialBatchWithReels extends TrialBatch {
  base_reel: { id: string; title: string };
  reels: ReelWithDetails[];
}
