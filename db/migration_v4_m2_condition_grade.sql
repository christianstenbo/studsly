-- Migration: v4 M2 — condition grade scale
-- New progressive grade (MINT/EXCELLENT/GOOD/FAIR/POOR) supersedes the
-- legacy wear_level enum. wear_level is migrated (M8) and read-only from v4.
-- Additive only. Date: 2026-07-25

do $$ begin
  if not exists (select 1 from pg_type where typname = 'condition_grade') then
    create type condition_grade as enum ('MINT','EXCELLENT','GOOD','FAIR','POOR');
  end if;
end $$;

alter table objects
  add column if not exists condition_grade condition_grade,
  add column if not exists condition_note text;

comment on type wear_level is
  'Legacy (v3). Superseded by condition_grade. Read-only from v4.';
