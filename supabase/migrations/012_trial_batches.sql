create table trial_batches (
  id uuid primary key default gen_random_uuid(),
  base_reel_id uuid not null references reels(id) on delete cascade,
  status text not null default 'generating',  -- 'generating' | 'ready'
  created_at timestamptz not null default now()
);

alter table reels
  add column trial_batch_id uuid references trial_batches(id) on delete set null,
  add column trial_variant_type text,
  add column trial_variant_label text;

create index idx_trial_batches_base_reel on trial_batches(base_reel_id);
create index idx_reels_trial_batch on reels(trial_batch_id) where trial_batch_id is not null;
