create table trending_audio (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text,
  platform text not null default 'tiktok',   -- 'tiktok' | 'instagram'
  usage_count bigint,
  trend_rank int,
  genre text,
  mood text,
  energy text,
  duration_seconds int,
  external_url text,
  fetched_at timestamptz not null default now()
);

create index idx_trending_audio_fetched on trending_audio(fetched_at desc);
create index idx_trending_audio_platform on trending_audio(platform);
