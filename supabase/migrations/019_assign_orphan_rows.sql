-- Assign all rows with NULL user_id to the primary user account
UPDATE phrases SET user_id = '8831cf37-5d99-45c8-a418-f2573a24d7f4' WHERE user_id IS NULL;
UPDATE videos SET user_id = '8831cf37-5d99-45c8-a418-f2573a24d7f4' WHERE user_id IS NULL;
UPDATE matches SET user_id = '8831cf37-5d99-45c8-a418-f2573a24d7f4' WHERE user_id IS NULL;
UPDATE reels SET user_id = '8831cf37-5d99-45c8-a418-f2573a24d7f4' WHERE user_id IS NULL;
UPDATE trial_batches SET user_id = '8831cf37-5d99-45c8-a418-f2573a24d7f4' WHERE user_id IS NULL;
UPDATE trending_audio SET user_id = '8831cf37-5d99-45c8-a418-f2573a24d7f4' WHERE user_id IS NULL;
