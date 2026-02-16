-- Instagram OAuth connections
CREATE TABLE instagram_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  ig_user_id text NOT NULL,
  ig_username text NOT NULL,
  access_token text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  followers_count integer NOT NULL DEFAULT 0,
  media_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_instagram_connections_user_id ON instagram_connections(user_id);

ALTER TABLE instagram_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own instagram connection" ON instagram_connections
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own instagram connection" ON instagram_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own instagram connection" ON instagram_connections
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own instagram connection" ON instagram_connections
  FOR DELETE USING (auth.uid() = user_id);

-- Account profiles (auto-populated from Instagram or manual input)
CREATE TABLE account_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'instagram',
  follower_count integer NOT NULL DEFAULT 0,
  posts_per_week real NOT NULL DEFAULT 3,
  performance_trend text NOT NULL DEFAULT 'stable',
  niche text NOT NULL DEFAULT '',
  top_posting_hours jsonb,
  audience_demographics jsonb,
  avg_engagement_rate real,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform)
);

CREATE INDEX idx_account_profiles_user_id ON account_profiles(user_id);

ALTER TABLE account_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account profiles" ON account_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own account profiles" ON account_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own account profiles" ON account_profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own account profiles" ON account_profiles
  FOR DELETE USING (auth.uid() = user_id);
