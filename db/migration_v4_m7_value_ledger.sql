-- Migration: v4 M7 — value ledger (fields only, no price source)
-- Phase 1 reads overridable fields only; base stays static estimated_value_bl.
-- The computation is a pure function in app code (not in the DB) so it stays
-- easy to change. Restoration cost is Phase 2 (needs part prices).
-- Additive only. Date: 2026-07-25

do $$ begin
  if not exists (select 1 from pg_type where typname = 'value_tier') then
    create type value_tier as enum ('SEALED','USED_COMPLETE_CIB','USED_INCOMPLETE');
  end if;
end $$;

alter table objects
  add column if not exists value_tier value_tier,
  add column if not exists value_base_nok numeric,             -- Phase 1: copy of estimated_value_bl
  add column if not exists value_addback_box_nok numeric,
  add column if not exists value_addback_manual_nok numeric,
  add column if not exists value_grade_adjust_pct numeric,
  add column if not exists value_restoration_cost_nok numeric, -- Phase 2 (needs part prices)
  add column if not exists value_override_nok numeric,
  add column if not exists value_notes text,
  add column if not exists value_computed_at timestamptz;
