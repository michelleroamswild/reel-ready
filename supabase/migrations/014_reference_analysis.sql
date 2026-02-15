alter table trial_batches
  add column reference_urls text[] default '{}',
  add column reference_patterns jsonb;
