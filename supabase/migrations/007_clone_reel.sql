-- Allow reels without a phrase (cloned reels derive text from the template)
ALTER TABLE reels ALTER COLUMN phrase_id DROP NOT NULL;

-- Store the source reel template for cloned reels
ALTER TABLE reels ADD COLUMN source_template jsonb;
