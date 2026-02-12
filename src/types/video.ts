export interface Video {
  id: string;
  filename: string;
  r2_key: string;
  url: string;
  size_bytes: number;
  duration_seconds: number | null;
  mime_type: string;
  created_at: string;
}
