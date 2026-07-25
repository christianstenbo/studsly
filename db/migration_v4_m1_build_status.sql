-- Migration: v4 M1 — build status + modified flag
-- Build status is the "hero" set status (NEW/SEALED/UNBUILT/BUILT).
-- Modified is an orthogonal boolean flag; object_type='MOD' is deprecated
-- for sets. Additive only. build_status is nullable here, backfilled in M8.
-- Date: 2026-07-25

do $$ begin
  if not exists (select 1 from pg_type where typname = 'build_status') then
    create type build_status as enum ('NEW','SEALED','UNBUILT','BUILT');
  end if;
end $$;

alter table objects
  add column if not exists build_status build_status,
  add column if not exists is_modified boolean not null default false,
  add column if not exists modified_note text;

create index if not exists objects_build_status_idx on objects (user_id, build_status);
create index if not exists objects_is_modified_idx on objects (user_id) where is_modified;

comment on type object_type is
  'MOD is deprecated for sets as of v4 — use objects.is_modified. Do not write MOD.';
