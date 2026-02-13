-- Add AI scoring columns to matches table
alter table matches add column score integer;
alter table matches add column reasoning text not null default '';
