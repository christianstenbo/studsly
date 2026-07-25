-- Migration: v4 M6 — "to replace" + buy list
-- replace_qty = parts physically present but worn/damaged enough to warrant
-- replacement. It counts as PRESENT for completeness and NEVER affects
-- present/missing — v_object_parts_completeness is deliberately left unchanged.
-- Additive only. Date: 2026-07-25

alter table inventory_parts
  add column if not exists replace_qty integer not null default 0 check (replace_qty >= 0),
  add column if not exists replace_tags text[] not null default '{}',
  add column if not exists replace_note text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'inventory_parts_replace_within_present') then
    alter table inventory_parts
      add constraint inventory_parts_replace_within_present check (replace_qty <= qty_present);
  end if;
end $$;

comment on column inventory_parts.replace_qty is
  'Parts physically present but worn/damaged enough to warrant replacement. Counts as PRESENT for completeness.';

-- Reminder for future maintainers: replace_qty must NOT be folded into
-- completeness. present/missing stay based on qty_present vs qty_expected.
comment on view v_object_parts_completeness is
  'Completeness = qty_present vs qty_expected. Do NOT factor in inventory_parts.replace_qty — worn parts still count as present (v4 M6).';

-- Raw buy list, per set.
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
  and (ip.qty_present < ip.qty_expected or ip.replace_qty > 0);

-- Rollup + netting against the free pool (collection level, part+colour).
-- Netting is informative, not automatic: the pool only shrinks on Allocate,
-- so qty_available_loose is "available", never "reserved".
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
free as (
  select user_id, part_num, part_color_id as color_id, sum(qty_free)::int as qty_free
  from v_free_parts where qty_free > 0 group by user_id, part_num, part_color_id
)
select n.*,
       coalesce(f.qty_free, 0)                              as qty_available_loose,
       greatest(n.qty_needed - coalesce(f.qty_free, 0), 0)  as qty_to_buy
from needed n
left join free f on f.user_id = n.user_id and f.part_num = n.part_num and f.color_id = n.color_id;
