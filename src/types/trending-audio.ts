export interface TrendingAudio {
  id: string;
  title: string;
  artist: string | null;
  platform: "tiktok" | "instagram" | "unknown";
  source: "api" | "manual" | "ai_research" | "url_extract";
  usage_count: number | null;
  trend_rank: number | null;
  genre: string | null;
  mood: string | null;
  energy: string | null;
  duration_seconds: number | null;
  external_url: string | null;
  user_id: string | null;
  fetched_at: string;
}
