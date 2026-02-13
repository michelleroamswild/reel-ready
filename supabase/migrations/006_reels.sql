-- Reels table
create table reels (
  id uuid primary key default gen_random_uuid(),
  phrase_id uuid not null references phrases(id) on delete cascade,
  title text not null default '',
  target_duration_seconds integer not null default 30,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reel segments table
create table reel_segments (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references reels(id) on delete cascade,
  video_id uuid not null references videos(id) on delete cascade,
  section_text text not null default '',
  section_index integer not null default 0,
  start_seconds real not null default 0,
  end_seconds real not null default 0,
  score integer,
  reasoning text not null default '',
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_reels_created_at on reels(created_at desc);
create index idx_reels_phrase_id on reels(phrase_id);
create index idx_reel_segments_reel_id on reel_segments(reel_id);
create index idx_reel_segments_video_id on reel_segments(video_id);
