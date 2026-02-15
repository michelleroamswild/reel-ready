-- Add source column to track how audio entries were added
alter table trending_audio add column source text not null default 'api';

create index idx_trending_audio_source on trending_audio(source);
