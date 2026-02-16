export interface Match {
  id: string;
  phrase_id: string;
  video_id: string;
  notes: string;
  score: number | null;
  reasoning: string;
  user_id: string;
  created_at: string;
}

export interface MatchWithDetails extends Match {
  phrase: {
    id: string;
    text: string;
    tags: string[];
  };
  video: {
    id: string;
    filename: string;
    url: string;
    duration_seconds: number | null;
  };
}

export interface AiSuggestion {
  videoId: string;
  score: number;
  reasoning: string;
  moodMatch: string;
  energyMatch: string;
  visualNotes: string;
}
