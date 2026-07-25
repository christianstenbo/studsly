-- Migration: v4 M5 — allocations (the backbone)
-- One Allocate mechanic, three uses: missing part, worn part ("to replace"),
-- and loose component (manual/box). Restore = set released_at. The free pool
-- is derived (v_free_parts / v_free_components), never a flag. Over-allocation
-- is impossible: a guard trigger rejects any write where active allocated
-- quantity would exceed objects.quantity for the source.
-- Additive only. Date: 2026-07-25

do $$ begin
  if not exists (select 1 from pg_type where typname = 'allocation_purpose') then
    create type allocation_purpose as enum
      ('MISSING_PART','REPLACEMENT_PART','MOD_PART','COMPONENT');
  end if;
end $$;

create table if not exists allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  source_object_id uuid not null references objects(id) on delete cascade,  -- the free thing
  target_object_id uuid not null references objects(id) on delete cascade,  -- the set copy that receives
  purpose allocation_purpose not null,
  quantity integer not null default 1 check (quantity > 0),
  target_part_num text,          -- for part allocations: which inventory_parts row
  target_color_id integer,
  target_component_id uuid references object_components(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  released_at timestamptz,       -- Restore = set this
  check (
    (purpose = 'COMPONENT' and target_component_id is not null)
    or (purpose <> 'COMPONENT' and target_part_num is not null and target_color_id is not null)
  )
);

create index if not exists allocations_active_source_idx on allocations (source_object_id) where released_at is null;
create index if not exists allocations_active_target_idx on allocations (target_object_id) where released_at is null;

alter table allocations enable row level security;
drop policy if exists "allocations: owner reads"   on allocations;
drop policy if exists "allocations: owner inserts" on allocations;
drop policy if exists "allocations: owner updates" on allocations;
drop policy if exists "allocations: owner deletes" on allocations;
create policy "allocations: owner reads"   on allocations for select using (user_id = auth.uid());
create policy "allocations: owner inserts" on allocations for insert with check (user_id = auth.uid());
create policy "allocations: owner updates" on allocations for update using (user_id = auth.uid());
create policy "allocations: owner deletes" on allocations for delete using (user_id = auth.uid());

-- Keep parent_object_id in sync for whole-object (component) allocations only.
-- Parts do NOT use parent_object_id (quantity can split across several sets).
create or replace function sync_component_parent() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.purpose = 'COMPONENT' then
    if new.released_at is null then
      update objects set parent_object_id = new.target_object_id where id = new.source_object_id;
    else
      update objects set parent_object_id = null where id = new.source_object_id;
    end if;
  end if;
  return null;
end $$;

drop trigger if exists allocations_sync_parent on allocations;
create trigger allocations_sync_parent after insert or update on allocations
  for each row execute function sync_component_parent();

-- Over-allocation guard: never a negative pool. Rejects any active allocation
-- whose source would end up with sum(active quantity) > objects.quantity.
create or replace function check_allocation_not_overallocated() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_active int; v_owned int;
begin
  if new.released_at is not null then
    return new;   -- releasing frees capacity, never exceeds it
  end if;
  select coalesce(sum(a.quantity), 0) into v_active
    from allocations a
    where a.source_object_id = new.source_object_id
      and a.released_at is null
      and a.id <> new.id;
  select quantity into v_owned from objects where id = new.source_object_id;
  if v_active + new.quantity > coalesce(v_owned, 0) then
    raise exception 'Over-allocation: source % owns % but % would be allocated',
      new.source_object_id, coalesce(v_owned, 0), v_active + new.quantity;
  end if;
  return new;
end $$;

drop trigger if exists allocations_guard_overalloc on allocations;
create trigger allocations_guard_overalloc before insert or update on allocations
  for each row execute function check_allocation_not_overallocated();

-- Free-pool views (quantitative for parts, existence-based for components).
create or replace view v_free_parts as
select
  o.id as source_object_id, o.user_id, o.part_num, o.part_color_id, o.part_color_name,
  o.name as part_name, o.location_id, l.name as location_name, o.sub_location,
  o.quantity as qty_owned,
  coalesce((select sum(a.quantity) from allocations a
            where a.source_object_id = o.id and a.released_at is null), 0)::int as qty_allocated,
  (o.quantity - coalesce((select sum(a.quantity) from allocations a
            where a.source_object_id = o.id and a.released_at is null), 0))::int as qty_free
from objects o
left join locations l on l.id = o.location_id
where o.object_type = 'PART' and o.status = 'OWNED';

create or replace view v_free_components as
select o.id as source_object_id, o.user_id, o.object_type, o.name, o.set_number,
       o.location_id, l.name as location_name, o.condition_grade
from objects o
left join locations l on l.id = o.location_id
where o.object_type in ('INSTRUCTION','ORIGINAL_BOX')
  and o.status = 'OWNED'
  and not exists (select 1 from allocations a
                  where a.source_object_id = o.id and a.released_at is null);
