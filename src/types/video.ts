export interface VideoAnalysis {
  mood: string;
  energy: string;
  visuals: string;
  sceneTags: string[];
  summary: string;
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
  created_at: string;
}
