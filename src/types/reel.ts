export interface Reel {
  id: string;
  phrase_id: string;
  title: string;
  target_duration_seconds: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ReelSegment {
  id: string;
  reel_id: string;
  video_id: string;
  section_text: string;
  section_index: number;
  start_seconds: number;
  end_seconds: number;
  score: number | null;
  reasoning: string;
  created_at: string;
}

export interface ReelSegmentWithVideo extends ReelSegment {
  video: {
    id: string;
    filename: string;
    url: string;
    duration_seconds: number | null;
  };
}

export interface ReelWithDetails extends Reel {
  phrase: {
    id: string;
    text: string;
    tags: string[];
  };
  reel_segments: ReelSegmentWithVideo[];
}
