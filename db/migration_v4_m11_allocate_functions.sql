-- Migration: v4 M11 — allocate/restore functions (the one code path)
-- Transactional RPCs behind web/lib/allocate.ts. One allocate_part, one
-- allocate_component, one restore_allocation — no per-call-site variants.
-- security definer + pinned search_path per repo convention (M9). Because
-- security definer bypasses RLS, ownership is checked explicitly against
-- auth.uid() on every object touched.
-- Additive only. Date: 2026-07-25
--
-- Pool safety: the allocation insert runs the M5 over-allocation guard trigger
-- inside this transaction, so a part can never be allocated beyond what is
-- owned — and the receiving-row update below can never drive the pool negative
-- because it does not touch the pool (qty_free derives from allocations alone).

-- ── allocate_part: missing / replacement / mod ──────────────────────────────
create or replace function allocate_part(
  p_source uuid, p_target uuid, p_purpose allocation_purpose,
  p_quantity int, p_part_num text, p_color_id int, p_note text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if p_purpose = 'COMPONENT' then
    raise exception 'allocate_part handles parts only; use allocate_component';
  end if;
  if p_quantity is null or p_quantity < 1 then
    raise exception 'quantity must be >= 1';
  end if;
  if not exists (select 1 from objects where id = p_source and user_id = v_uid) then
    raise exception 'source object not found';
  end if;
  if not exists (select 1 from objects where id = p_target and user_id = v_uid) then
    raise exception 'target object not found';
  end if;

  -- Guard trigger (M5) fires here and rejects any over-allocation.
  insert into allocations(user_id, source_object_id, target_object_id, purpose,
                          quantity, target_part_num, target_color_id, note)
  values (v_uid, p_source, p_target, p_purpose, p_quantity, p_part_num, p_color_id, p_note)
  returning id into v_id;

  -- Reflect the allocation on the receiving inventory_parts row.
  --  MISSING/MOD: the piece is now present (MOD may push present > expected).
  --  REPLACEMENT: a worn piece is now sourced, so one fewer awaits replacement;
  --               qty_present is unchanged (the count present never changed).
  if p_purpose in ('MISSING_PART', 'MOD_PART') then
    update inventory_parts
       set qty_present = qty_present + p_quantity
     where object_id = p_target and part_num = p_part_num
       and color_id is not distinct from p_color_id and user_id = v_uid;
  elsif p_purpose = 'REPLACEMENT_PART' then
    update inventory_parts
       set replace_qty = greatest(replace_qty - p_quantity, 0)
     where object_id = p_target and part_num = p_part_num
       and color_id is not distinct from p_color_id and user_id = v_uid;
  end if;

  return v_id;
end $$;

-- ── allocate_component: loose manual / box → a set copy ──────────────────────
create or replace function allocate_component(
  p_source uuid, p_target uuid, p_component_id uuid, p_note text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if not exists (select 1 from objects where id = p_source and user_id = v_uid) then
    raise exception 'source object not found';
  end if;
  if not exists (select 1 from object_components where id = p_component_id and user_id = v_uid) then
    raise exception 'component not found';
  end if;

  -- parent-sync trigger (M5) sets source.parent_object_id here.
  insert into allocations(user_id, source_object_id, target_object_id, purpose,
                          quantity, target_component_id, note)
  values (v_uid, p_source, p_target, 'COMPONENT', 1, p_component_id, p_note)
  returning id into v_id;

  update object_components
     set is_present = true, linked_object_id = p_source
   where id = p_component_id and user_id = v_uid;

  return v_id;
end $$;

-- ── restore_allocation: free an active allocation, reverse its effect ────────
create or replace function restore_allocation(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); a allocations;
begin
  select * into a from allocations
   where id = p_id and user_id = v_uid and released_at is null;
  if not found then
    raise exception 'active allocation not found';
  end if;

  -- Frees the pool; parent-sync trigger nulls parent_object_id for COMPONENT.
  update allocations set released_at = now() where id = p_id;

  if a.purpose in ('MISSING_PART', 'MOD_PART') then
    update inventory_parts
       set qty_present = greatest(qty_present - a.quantity, 0)
     where object_id = a.target_object_id and part_num = a.target_part_num
       and color_id is not distinct from a.target_color_id and user_id = v_uid;
  elsif a.purpose = 'REPLACEMENT_PART' then
    -- The worn piece again awaits replacement; keep replace_qty <= qty_present.
    update inventory_parts
       set replace_qty = least(replace_qty + a.quantity, qty_present)
     where object_id = a.target_object_id and part_num = a.target_part_num
       and color_id is not distinct from a.target_color_id and user_id = v_uid;
  elsif a.purpose = 'COMPONENT' and a.target_component_id is not null then
    update object_components
       set is_present = false, linked_object_id = null
     where id = a.target_component_id and user_id = v_uid;
  end if;
end $$;

grant execute on function allocate_part(uuid, uuid, allocation_purpose, int, text, int, text) to authenticated;
grant execute on function allocate_component(uuid, uuid, uuid, text) to authenticated;
grant execute on function restore_allocation(uuid) to authenticated;

-- ROLLBACK:
--   drop function if exists allocate_part(uuid, uuid, allocation_purpose, int, text, int, text);
--   drop function if exists allocate_component(uuid, uuid, uuid, text);
--   drop function if exists restore_allocation(uuid);
