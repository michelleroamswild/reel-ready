export interface VideoAnalysis {
  // Existing fields (kept for backwards compat)
  mood: string;
  energy: string;
  visuals: string;
  sceneTags: string[];
  summary: string;
  // Structured numeric/categorical fields
  moodScore: number;        // -5 (dark/somber) to +5 (bright/uplifting)
  energyScore: number;      // 1-10 scale
  pacing: string;           // "slow" | "medium" | "fast" | "variable"
  colorPalette: string[];   // e.g. ["warm orange", "deep blue", "muted green"]
  shotTypes: string[];      // e.g. ["close-up", "wide", "tracking", "aerial"]
  dominantMotion: string;   // e.g. "static", "slow pan", "fast action"
  structure: string;        // e.g. "steady", "builds intensity", "peaks then calms"
  audioNotes: string;       // e.g. "no audio", "ambient sounds", "music", "speech"
}

export interface Video {
  id: string;
  filename: string;
  r2_key: string;
  url: string;
  size_bytes: number;
  duration_seconds: number | null;
  mime_type: string;
  analysis: VideoAnalysis | null;
  thumbnail_url: string | null;
  video_type: "clip" | "edit";
  created_at: string;
}
