-- Add saved captions (pinned) to reels
alter table reels
  add column saved_captions jsonb not null default '[]'::jsonb;
