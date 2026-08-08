-- Migration: v4 M17 — reclassify three misclassified objects
--
-- ⚠️ This is the only migration in this batch that CHANGES EXISTING ROWS. It
-- touches exactly 3 of 586 owned objects, each named by id. The other 583 are
-- not referenced. Presented as SQL and approved before running.
--
-- All three were object_type = 'PART', quality_level = 'BASIC',
-- part_color_id = null, location "Loftstue".
--
-- 1. elephant2c02 (SL-G8DJTX) — "Elephant, Fixed Leg with Short White Tusks".
--    An official creature. The data model is explicit that elephants, dragons
--    and big-figs are assembly/figure entities, not parts. As a PART it counts
--    wrongly in the Animals/Figures lane and breaks the two-denominator rule:
--    it should be ONE entity in its own tab, with its pieces exploding into the
--    piece total — not a single "part" in the loose-parts pool.
--    MINIFIG is the object_type the schema uses for assembled figure entities.
--
-- 2+3. Two × 6418411 (SL-0T8RPT, SL-0V7V7F) — sticker sheets. After Flow 3,
--    STICKER_SHEET exists as a component_kind, and M16 added it to object_type.
--    They belong in the component/Allocate track, not the parts pool. Left as
--    PART they sit in v_free_parts and can be netted against missing bricks,
--    which is meaningless: no set's buy list is ever short a sticker sheet in
--    the part_num sense.
--
-- Effect on the pool: v_free_parts drops from 3 rows to 0. All three of its
-- rows were these objects, and none of them was ever a real loose part.
-- Date: 2026-08-08

begin;

-- 1. The elephant becomes an assembly/figure entity.
update objects
   set object_type = 'MINIFIG'
 where id = '791adb3a-a750-42af-87e9-8d1388956dc1'
   and object_type = 'PART';          -- no-op if already corrected

-- 2+3. The sticker sheets join the component track.
update objects
   set object_type = 'STICKER_SHEET'
 where id in ('60d7fe8d-09a8-40b4-bf0d-1cc2c182b0db',
              '50470e82-d8d5-4bc9-a846-4a7001b16887')
   and object_type = 'PART';

-- Refuse to commit if this touched anything beyond the three.
do $$
declare n int;
begin
  select count(*) into n from objects
   where object_type in ('MINIFIG','STICKER_SHEET')
     and id in ('791adb3a-a750-42af-87e9-8d1388956dc1',
                '60d7fe8d-09a8-40b4-bf0d-1cc2c182b0db',
                '50470e82-d8d5-4bc9-a846-4a7001b16887');
  if n <> 3 then
    raise exception 'expected exactly 3 reclassified objects, found %', n;
  end if;
  select count(*) into n from objects where status = 'OWNED';
  if n <> 586 then
    raise exception 'owned object count changed to % — expected 586', n;
  end if;
end $$;

commit;

-- ── v_free_components: sticker sheets are allocatable components too ─────────
-- Without this the two sheets would leave the parts pool and appear nowhere.
create or replace view v_free_components as
select o.id as source_object_id,
       o.user_id,
       o.object_type,
       o.name,
       o.set_number,
       o.location_id,
       l.name as location_name,
       o.condition_grade
  from objects o
  left join locations l on l.id = o.location_id
 where o.object_type = any (array['INSTRUCTION'::object_type,
                                  'ORIGINAL_BOX'::object_type,
                                  'STICKER_SHEET'::object_type])
   and o.status = 'OWNED'::status_type
   and not exists (select 1 from allocations a
                    where a.source_object_id = o.id and a.released_at is null);

-- =============================================================================
-- ROLLBACK (restores all three to PART and the M3 view definition):
--   update objects set object_type = 'PART'
--    where id in ('791adb3a-a750-42af-87e9-8d1388956dc1',
--                 '60d7fe8d-09a8-40b4-bf0d-1cc2c182b0db',
--                 '50470e82-d8d5-4bc9-a846-4a7001b16887');
--   -- then re-create v_free_components without 'STICKER_SHEET' in the array.
-- =============================================================================

-- ⚠️ M17b — CREATE OR REPLACE VIEW does NOT preserve reloptions. Replacing the
-- view above silently dropped the security_invoker=on that M13 set on it, which
-- would have let it run as its owner and bypass RLS. Caught by re-reading
-- pg_class.reloptions after the change; every other view still had it.
-- Any future CREATE OR REPLACE VIEW in this repo must re-assert this.
alter view public.v_free_components set (security_invoker = on);
