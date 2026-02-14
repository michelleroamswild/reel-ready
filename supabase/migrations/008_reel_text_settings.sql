-- Add text overlay settings to reels
alter table reels
  add column text_position text not null default 'center',
  add column text_size text not null default 'small',
  add column text_border text not null default 'shadow',
  add column text_border_color text not null default 'black',
  add column burn_text boolean not null default true;
