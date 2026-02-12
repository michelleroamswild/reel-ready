-- Phrases table
create table phrases (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  tags text[] not null default '{}',
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- Videos table (metadata only — files live in Cloudflare R2)
create table videos (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  r2_key text not null,
  url text not null,
  size_bytes bigint not null default 0,
  duration_seconds real,
  mime_type text not null default 'video/mp4',
  created_at timestamptz not null default now()
);

-- Matches table (phrase <-> video pairings)
create table matches (
  id uuid primary key default gen_random_uuid(),
  phrase_id uuid not null references phrases(id) on delete cascade,
  video_id uuid not null references videos(id) on delete cascade,
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_phrases_created_at on phrases(created_at desc);
create index idx_videos_created_at on videos(created_at desc);
create index idx_matches_phrase_id on matches(phrase_id);
create index idx_matches_video_id on matches(video_id);

-- Row Level Security (enable when you add auth)
-- alter table phrases enable row level security;
-- alter table videos enable row level security;
-- alter table matches enable row level security;
