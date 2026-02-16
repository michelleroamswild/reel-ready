export interface PhraseAnalysis {
  tone: string;              // e.g. "inspirational", "humorous", "serious"
  toneScore: number;         // -5 to +5 matching video moodScore scale
  energyLevel: number;       // 1-10 matching video energyScore scale
  idealPacing: string;       // "slow" | "medium" | "fast"
  emotionalArc: string;      // e.g. "steady", "building", "dramatic turn"
  suggestedVisuals: string[];// e.g. ["nature", "close-up faces", "dramatic lighting"]
  keywords: string[];        // key content words extracted
}

export interface Phrase {
  id: string;
  text: string;
  tags: string[];
  notes: string;
  analysis: PhraseAnalysis | null;
  user_id: string;
  created_at: string;
}
