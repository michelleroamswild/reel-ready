-- Add user_id columns for per-user data isolation
ALTER TABLE phrases ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE videos ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE matches ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE reels ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE trial_batches ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE trending_audio ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX idx_phrases_user_id ON phrases(user_id);
CREATE INDEX idx_videos_user_id ON videos(user_id);
CREATE INDEX idx_matches_user_id ON matches(user_id);
CREATE INDEX idx_reels_user_id ON reels(user_id);
CREATE INDEX idx_trial_batches_user_id ON trial_batches(user_id);
CREATE INDEX idx_trending_audio_user_id ON trending_audio(user_id);

-- Enable RLS on all tables
ALTER TABLE phrases ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE reel_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE trending_audio ENABLE ROW LEVEL SECURITY;

-- phrases policies
CREATE POLICY "Users can view own phrases" ON phrases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own phrases" ON phrases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own phrases" ON phrases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own phrases" ON phrases FOR DELETE USING (auth.uid() = user_id);

-- videos policies
CREATE POLICY "Users can view own videos" ON videos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own videos" ON videos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own videos" ON videos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own videos" ON videos FOR DELETE USING (auth.uid() = user_id);

-- matches policies
CREATE POLICY "Users can view own matches" ON matches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own matches" ON matches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own matches" ON matches FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own matches" ON matches FOR DELETE USING (auth.uid() = user_id);

-- reels policies
CREATE POLICY "Users can view own reels" ON reels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reels" ON reels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reels" ON reels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reels" ON reels FOR DELETE USING (auth.uid() = user_id);

-- reel_segments policies (protected via parent reel)
CREATE POLICY "Users can view own reel segments" ON reel_segments
  FOR SELECT USING (reel_id IN (SELECT id FROM reels WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own reel segments" ON reel_segments
  FOR INSERT WITH CHECK (reel_id IN (SELECT id FROM reels WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own reel segments" ON reel_segments
  FOR UPDATE USING (reel_id IN (SELECT id FROM reels WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete own reel segments" ON reel_segments
  FOR DELETE USING (reel_id IN (SELECT id FROM reels WHERE user_id = auth.uid()));

-- trial_batches policies
CREATE POLICY "Users can view own trial batches" ON trial_batches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trial batches" ON trial_batches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trial batches" ON trial_batches FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own trial batches" ON trial_batches FOR DELETE USING (auth.uid() = user_id);

-- trending_audio policies (nullable user_id for global data)
CREATE POLICY "Users can view own or global trending audio" ON trending_audio
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can insert own trending audio" ON trending_audio
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can update own trending audio" ON trending_audio
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own trending audio" ON trending_audio
  FOR DELETE USING (auth.uid() = user_id);
