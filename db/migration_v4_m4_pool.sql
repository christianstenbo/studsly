-- Migration: v4 M4 — free pool: quantity + part identity on objects
-- Batch registration (locked model decision): one objects row with a count,
-- not N rows. part_num carries the catalog part number for PART objects so
-- the free pool can net against the buy list on part+colour.
-- Additive only. part_num backfilled for the 3 existing PART rows in M8.
-- Date: 2026-07-25

alter table objects
  add column if not exists quantity integer not null default 1 check (quantity > 0),
  add column if not exists part_num text;             -- catalog part number for PART objects

create index if not exists objects_pool_idx on objects (user_id, object_type, part_num, part_color_id)
  where object_type in ('PART','INSTRUCTION','ORIGINAL_BOX') and status = 'OWNED';

comment on column objects.quantity is
  'Batch registration: one row with a count, not N rows. Always 1 for SET/MOC/MINIFIG entities.';
