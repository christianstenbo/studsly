-- Migration: v4 M10 — buy-list view fixes (two live-DB findings)
-- Additive only: CREATE OR REPLACE VIEW, no DROP, no data mutation.
-- Date: 2026-07-25
--
-- Finding 1 (loose parts, unknown colour): all three loose PART objects have
--   part_num set but part_color_id NULL. The old rollup nets free pool against
--   needed on (part_num, color_id); NULL never matches, so loose parts could
--   never offset needed parts. Fix: also net NULL-colour loose parts on part_num
--   alone, into a separate "unconfirmed" bucket the UI surfaces as
--   "colour unconfirmed" rather than matching silently.
-- Finding 2 (set 40370, never counted): 70 checklist rows, qty_expected>0,
--   qty_present=0 across the board — a parts check started but never counted.
--   Treat a set with zero counted rows as NOT COUNTED and keep it out of the
--   buy list until counting begins.
--
-- New/changed columns on v_buy_list_rollup (existing names preserved so any
-- Phase 1a reader keeps working):
--   qty_available_loose            total loose available (exact + unconfirmed)
--   qty_to_buy                     needed − available, floored at 0
--   qty_available_loose_exact      loose with a confirmed matching colour
--   qty_available_loose_unconfirmed  loose whose colour is unknown (part_num match)
--   colour_unconfirmed             true when any of the availability is unconfirmed

-- ── v_buy_list_items: drop not-yet-counted sets (Finding 2) ──────────────────
create or replace view v_buy_list_items as
select
  ip.user_id,
  ip.object_id,
  o.name        as object_name,
  o.set_number,
  ip.part_num, ip.part_name, ip.color_id, ip.color_name, ip.part_img_url,
  greatest(ip.qty_expected - ip.qty_present, 0)                        as qty_missing,
  ip.replace_qty                                                       as qty_to_replace,
  greatest(ip.qty_expected - ip.qty_present, 0) + ip.replace_qty       as qty_needed,
  ip.replace_tags
from inventory_parts ip
join objects o on o.id = ip.object_id
where not ip.is_spare
  and (ip.qty_present < ip.qty_expected or ip.replace_qty > 0)
  -- Counting must have begun: at least one row on this object is counted.
  -- A set where nothing is counted yet is "Not counted", not "missing everything".
  and exists (
    select 1 from inventory_parts ip2
    where ip2.object_id = ip.object_id and ip2.qty_present > 0
  );

-- ── v_buy_list_rollup: net NULL-colour loose parts on part_num (Finding 1) ───
create or replace view v_buy_list_rollup as
with needed as (
  select user_id, part_num, color_id,
         max(part_name) as part_name, max(color_name) as color_name,
         max(part_img_url) as part_img_url,
         sum(qty_missing)::int    as qty_missing,
         sum(qty_to_replace)::int as qty_to_replace,
         sum(qty_needed)::int     as qty_needed,
         count(distinct object_id)::int as used_in_objects
  from v_buy_list_items group by user_id, part_num, color_id
),
free_typed as (            -- loose parts with a confirmed colour
  select user_id, part_num, part_color_id as color_id, sum(qty_free)::int as qty_free
  from v_free_parts
  where qty_free > 0 and part_color_id is not null
  group by user_id, part_num, part_color_id
),
free_unknown as (          -- loose parts whose colour is unconfirmed (Finding 1)
  select user_id, part_num, sum(qty_free)::int as qty_free_unknown
  from v_free_parts
  where qty_free > 0 and part_color_id is null
  group by user_id, part_num
)
-- Existing columns keep their name/order; new columns are appended at the end
-- (CREATE OR REPLACE VIEW cannot reorder/rename existing view columns).
select n.*,
       coalesce(ft.qty_free, 0) + coalesce(fu.qty_free_unknown, 0) as qty_available_loose,
       greatest(
         n.qty_needed - (coalesce(ft.qty_free, 0) + coalesce(fu.qty_free_unknown, 0)),
         0
       )                                                           as qty_to_buy,
       coalesce(ft.qty_free, 0)                                    as qty_available_loose_exact,
       coalesce(fu.qty_free_unknown, 0)                            as qty_available_loose_unconfirmed,
       (coalesce(fu.qty_free_unknown, 0) > 0)                      as colour_unconfirmed
from needed n
left join free_typed   ft on ft.user_id = n.user_id and ft.part_num = n.part_num and ft.color_id = n.color_id
left join free_unknown fu on fu.user_id = n.user_id and fu.part_num = n.part_num;

-- =============================================================================
-- ROLLBACK (paste to revert M10 exactly to the M6 definitions):
--
-- create or replace view v_buy_list_items as
-- select
--   ip.user_id,
--   ip.object_id,
--   o.name        as object_name,
--   o.set_number,
--   ip.part_num, ip.part_name, ip.color_id, ip.color_name, ip.part_img_url,
--   greatest(ip.qty_expected - ip.qty_present, 0)                        as qty_missing,
--   ip.replace_qty                                                       as qty_to_replace,
--   greatest(ip.qty_expected - ip.qty_present, 0) + ip.replace_qty       as qty_needed,
--   ip.replace_tags
-- from inventory_parts ip
-- join objects o on o.id = ip.object_id
-- where not ip.is_spare
--   and (ip.qty_present < ip.qty_expected or ip.replace_qty > 0);
--
-- create or replace view v_buy_list_rollup as
-- with needed as (
--   select user_id, part_num, color_id,
--          max(part_name) as part_name, max(color_name) as color_name,
--          max(part_img_url) as part_img_url,
--          sum(qty_missing)::int    as qty_missing,
--          sum(qty_to_replace)::int as qty_to_replace,
--          sum(qty_needed)::int     as qty_needed,
--          count(distinct object_id)::int as used_in_objects
--   from v_buy_list_items group by user_id, part_num, color_id
-- ),
-- free as (
--   select user_id, part_num, part_color_id as color_id, sum(qty_free)::int as qty_free
--   from v_free_parts where qty_free > 0 group by user_id, part_num, part_color_id
-- )
-- select n.*,
--        coalesce(f.qty_free, 0)                              as qty_available_loose,
--        greatest(n.qty_needed - coalesce(f.qty_free, 0), 0)  as qty_to_buy
-- from needed n
-- left join free f on f.user_id = n.user_id and f.part_num = n.part_num and f.color_id = n.color_id;
-- =============================================================================
