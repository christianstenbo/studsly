-- Migration: v4 M9 — cleanup (low risk, do now)
-- Normalize image_type casing to uppercase (new code writes uppercase only);
-- the duplicate lowercase enum values stay in place (cannot be dropped safely).
-- Deprecate missing_parts (superseded by inventory_parts + v_object_missing_parts).
-- Additive only — no enum values or tables dropped. Date: 2026-07-25

update images set image_type = 'REFERENCE'::image_type
  where image_type::text = 'reference';
update images set image_type = 'DOCUMENTATION'::image_type
  where image_type::text = 'documentation';

comment on table missing_parts is
  'Deprecated (v4) — superseded by inventory_parts + v_object_missing_parts.';
