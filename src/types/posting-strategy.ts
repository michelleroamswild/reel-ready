import type { ReelWithDetails } from "./reel";

// --- Platform & classification ---

export type Platform = "instagram" | "tiktok";
export type PerformanceTrend = "rising" | "stable" | "declining";
export type FollowerTier = "emerging" | "growing" | "established" | "large";
export type MomentumMode = "high" | "low";

// --- Account state (input to strategy engine) ---

export interface AccountState {
  platform: Platform;
  followerCount: number;
  postsPerWeek: number;
  performanceTrend: PerformanceTrend;
  niche: string;
  topPostingHours?: number[]; // hours 0-23 ranked by audience online time
}

// --- Account profile (persisted in DB) ---

export interface AccountProfile extends AccountState {
  id: string;
  userId: string;
  avgEngagementRate: number | null;
  audienceDemographics: Record<string, unknown> | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Instagram connection ---

export interface InstagramConnection {
  id: string;
  userId: string;
  igUserId: string;
  igUsername: string;
  followersCount: number;
  mediaCount: number;
  tokenExpiresAt: string;
  createdAt: string;
  updatedAt: string;
}

// --- Strategy output ---

export interface PostingSlot {
  dayOffset: number;
  date: string; // YYYY-MM-DD
  reelId: string;
  reelTitle: string;
  variantType: string;
  variantLabel: string;
  rationale: string;
  similarityToNext: number | null;
}

export interface PostingStrategy {
  slots: PostingSlot[];
  riskScore: number; // 0-100
  confidenceScore: number; // 0-100
  cadenceDescription: string;
  summaryRationale: string;
  warnings: string[];
  accountClassification: {
    followerTier: FollowerTier;
    momentumMode: MomentumMode;
  };
}

// --- Similarity (internal to algorithm) ---

export interface VariantSimilarityPair {
  reelIdA: string;
  reelIdB: string;
  sharedVideoRatio: number;
  textSimilarity: number;
  sameVariantType: boolean;
  compositeSimilarity: number;
}
