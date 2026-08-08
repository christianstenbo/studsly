-- Migration: v4 M16 — object_type gains STICKER_SHEET
--
-- Standalone components already live in `objects` with a component-ish
-- object_type (INSTRUCTION, ORIGINAL_BOX) and reach the Allocate track through
-- v_free_components. Sticker sheets belong in exactly that lane: after Flow 3,
-- component_kind already has STICKER_SHEET, but object_type did not — so a
-- loose sticker sheet had nowhere to go except object_type = 'PART', where it
-- sits in the free PARTS pool and gets netted against missing bricks.
--
-- Additive: adds one enum label. Changes no row. Must run in its own migration
-- because Postgres will not let a new enum label be USED in the same
-- transaction that added it — the UPDATE is M17.
-- Date: 2026-08-08

alter type object_type add value if not exists 'STICKER_SHEET';

-- =============================================================================
-- ROLLBACK: Postgres cannot drop an enum label. Reverting means recreating the
-- type, which would require rewriting every dependent column. Do not add labels
-- casually. (Nothing needs reverting here: an unused label is inert.)
-- =============================================================================
