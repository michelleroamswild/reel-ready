export interface TemplateSegment {
  index: number;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  textOverlay: string | null;
  mood: string;
  energy: string;
  visualDescription: string;
}

export interface ReelTemplate {
  totalDurationSeconds: number;
  segmentCount: number;
  segments: TemplateSegment[];
  overallMood: string;
  overallEnergy: string;
  overallPacing: string;
  visualStyleNotes: string;
  textOverlayStyle: string | null;
  sourceUrl: string | null;
}

export interface Reel {
  id: string;
  phrase_id: string | null;
  title: string;
  target_duration_seconds: number;
  status: string;
  source_template: ReelTemplate | null;
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
  } | null;
  reel_segments: ReelSegmentWithVideo[];
}
