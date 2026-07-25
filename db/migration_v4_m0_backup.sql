-- Migration: v4 M0 — backup (runs first, always)
-- Reversible snapshot of objects + inventory_parts before the v4 data
-- migration (M8). Additive only. Verify objects_pre_v4_backup = 586 rows
-- before running any further v4 migration.
-- Date: 2026-07-25

create table if not exists objects_pre_v4_backup as select * from objects;
create table if not exists inventory_parts_pre_v4_backup as select * from inventory_parts;

alter table objects_pre_v4_backup enable row level security;
alter table inventory_parts_pre_v4_backup enable row level security;

drop policy if exists "backup: owner reads" on objects_pre_v4_backup;
drop policy if exists "backup: owner reads" on inventory_parts_pre_v4_backup;
create policy "backup: owner reads" on objects_pre_v4_backup for select using (user_id = auth.uid());
create policy "backup: owner reads" on inventory_parts_pre_v4_backup for select using (user_id = auth.uid());

-- Verify: select count(*) from objects_pre_v4_backup;  -- must equal 586
