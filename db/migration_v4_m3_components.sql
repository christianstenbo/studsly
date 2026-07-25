-- Migration: v4 M3 — components (contents & condition / CIB)
-- A set is valued as a whole: parts + figures + manual(s) + box + extras.
-- Each component has a present flag, optional grade, optional damage tags,
-- and may be allocated from a loose object in inventory (linked_object_id).
-- object_components is the source of truth; objects.has_instructions /
-- has_original_box are kept as derived quick-flags via trigger so existing
-- queries do not break. UI never writes the flags directly.
-- Additive only. Date: 2026-07-25

do $$ begin
  if not exists (select 1 from pg_type where typname = 'component_kind') then
    create type component_kind as enum
      ('INSTRUCTIONS','ORIGINAL_BOX','STICKER_SHEET','INNER_BAGS','EXTRAS','OTHER');
  end if;
end $$;

create table if not exists object_components (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references objects(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  kind component_kind not null,
  label text,                       -- free text for OTHER / "Manual 2 of 3"
  is_present boolean not null default false,
  grade condition_grade,
  damage_tags text[] not null default '{}',
  linked_object_id uuid references objects(id) on delete set null, -- allocated loose manual/box
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (object_id, kind, label)
);

create index if not exists object_components_object_idx on object_components (object_id);
create index if not exists object_components_linked_idx on object_components (linked_object_id);

drop trigger if exists object_components_touch on object_components;
create trigger object_components_touch before update on object_components
  for each row execute function set_updated_at();

alter table object_components enable row level security;
drop policy if exists "object_components: owner reads"   on object_components;
drop policy if exists "object_components: owner inserts" on object_components;
drop policy if exists "object_components: owner updates" on object_components;
drop policy if exists "object_components: owner deletes" on object_components;
create policy "object_components: owner reads"   on object_components for select using (user_id = auth.uid());
create policy "object_components: owner inserts" on object_components for insert with check (user_id = auth.uid());
create policy "object_components: owner updates" on object_components for update using (user_id = auth.uid());
create policy "object_components: owner deletes" on object_components for delete using (user_id = auth.uid());

-- Keep legacy quick-flags in sync from object_components (the source of truth).
create or replace function sync_object_component_flags() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_obj uuid := coalesce(new.object_id, old.object_id);
begin
  update objects o set
    has_instructions = exists (select 1 from object_components c
      where c.object_id = v_obj and c.kind = 'INSTRUCTIONS' and c.is_present),
    has_original_box = exists (select 1 from object_components c
      where c.object_id = v_obj and c.kind = 'ORIGINAL_BOX' and c.is_present)
  where o.id = v_obj;
  return null;
end $$;

drop trigger if exists object_components_sync_flags on object_components;
create trigger object_components_sync_flags
  after insert or update or delete on object_components
  for each row execute function sync_object_component_flags();
