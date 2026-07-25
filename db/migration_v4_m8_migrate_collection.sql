-- Migration: v4 M8 — migrate the 586 objects to the v4 model
-- Runs as one transaction, after M0. Order matters. Additive/backfill only:
-- writes the new nullable columns and inserts component rows; touches no
-- legacy column destructively. Numbers below were simulated against the live
-- DB 2026-07-25 and must match exactly (see §9 QA). Date: 2026-07-25

begin;

-- 0) Free-pool part identity for the 3 existing PART objects (manual, logged).
--    Identity lives in bl_item_no (== set_number) for all three:
--    LG-000474 Elephant  -> 'elephant2c02'
--    LG-000510/511 Dots Sticker Sheet -> '6418411'
update objects set part_num = bl_item_no
  where object_type = 'PART' and part_num is null and bl_item_no is not null;

-- 1) Build status. (Cast the CASE to the enum: a multi-branch CASE resolves
--    to text, which Postgres will not implicitly coerce on assignment.)
update objects set build_status = (case
  when is_built                                    then 'BUILT'
  when condition = 'BUILT'                         then 'BUILT'
  when condition = 'SEALED'                        then 'SEALED'
  when condition in ('OPENED','USED','INCOMPLETE') then 'UNBUILT'
end)::build_status
where object_type in ('SET','MOC','MOD') and build_status is null;

-- 2) Condition grade: wear_level first (authoritative), then derived from text fields
update objects set condition_grade = (case wear_level
  when 'MINT' then 'MINT' when 'NEAR_MINT' then 'EXCELLENT'
  when 'VERY_GOOD' then 'GOOD' when 'GOOD' then 'GOOD' when 'FAIR' then 'FAIR' end)::condition_grade
where wear_level is not null and condition_grade is null;

update objects set condition_grade = (case
  when box_condition = 'Mint'          then 'MINT'
  when box_condition = 'Good'          then 'GOOD'
  when box_condition = 'Fair_Damaged'  then 'FAIR'
  when set_condition = 'LikeNew'       then 'EXCELLENT'
  when parts_condition = 'LikeNew'     then 'EXCELLENT'
  when parts_condition = 'NoIssues'    then 'GOOD'
  else null end)::condition_grade
where condition_grade is null;

-- 3) Components: instructions
insert into object_components (object_id, user_id, kind, is_present, grade, note)
select o.id, o.user_id, 'INSTRUCTIONS', true,
       case o.manual_condition when 'Mint' then 'MINT'::condition_grade
                               when 'Good' then 'GOOD'::condition_grade else null end,
       'migrated from manual_present (v4)'
from objects o
where o.manual_present is true
on conflict (object_id, kind, label) do nothing;

-- 4) Components: box. A sealed set always has a box.
insert into object_components (object_id, user_id, kind, is_present, grade, note)
select o.id, o.user_id, 'ORIGINAL_BOX', true,
       case o.box_condition when 'Mint' then 'MINT'::condition_grade
                            when 'Good' then 'GOOD'::condition_grade
                            when 'Fair_Damaged' then 'FAIR'::condition_grade else null end,
       'migrated from box_condition/SEALED (v4)'
from objects o
where (o.box_condition is not null or o.condition = 'SEALED')
  and o.object_type = 'SET'
on conflict (object_id, kind, label) do nothing;

-- 5) Value tier + base
update objects set
  value_tier = case
    when condition = 'SEALED' then 'SEALED'::value_tier
    when completeness_level = 'Complete' then 'USED_COMPLETE_CIB'::value_tier
    else 'USED_INCOMPLETE'::value_tier end,
  value_base_nok = estimated_value_bl
where object_type = 'SET' and value_tier is null;

commit;

-- Rollback (see migration notes / §8):
--   update objects o set build_status=null, is_modified=false, condition_grade=null,
--     value_tier=null, value_base_nok=null
--   from objects_pre_v4_backup b where b.id = o.id;
--   delete from object_components where note like 'migrated from %(v4)';
