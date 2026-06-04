-- Distilled "voice profile" of the user's Instagram caption style.
-- Built from their historic captions and fed into caption generation so new
-- captions sound like them. Stored on account_profiles so it persists with or
-- without a live Instagram connection.
ALTER TABLE account_profiles
  ADD COLUMN IF NOT EXISTS voice_profile jsonb,
  ADD COLUMN IF NOT EXISTS voice_profile_updated_at timestamptz;
