-- Migration: v4 M14 — ownership_id -> Studsly SL-XXXXXX scheme
-- Today: 586 objects, 583 LG-000001.. and 3 BH-0000584.. (BrickHaus legacy).
-- No physical labels carry these numbers (confirmed), so renaming is free now
-- and only gets more expensive per new object/user.
--
-- New format: SL- + 6 Crockford base32 chars (0123456789ABCDEFGHJKMNPQRSTVWXYZ,
-- no I/L/O/U). Random, not sequential: a running number would leak collection
-- size and make a neighbour object guessable once the id becomes a URL. Fixed
-- length 9, always upper-case, ~1.07 billion values. The space is so sparsely
-- populated that a typo almost always misses, so no check digit.
--
-- Design intent: ownership_id is the LABEL on a physical object, not ownership.
-- objects.id (uuid) is the permanent identity that survives a change of owner.
-- If Studsly later supports resale, ownership_id follows the object and is never
-- reissued, so a QR sticker on the box keeps working after a sale. That is why
-- it is globally unique (objects_ownership_id_key), not unique per user — do not
-- change that. objects_pre_v4_backup is a snapshot and is left untouched here.
--
-- Idempotent-safe; run in one transaction. Date: 2026-07-28

-- 1. Preserve the legacy label before overwriting (only fill nulls, so a re-run
--    never clobbers an already-captured LG-/BH- value with an SL- one).
alter table objects add column if not exists legacy_ownership_id text;

comment on column objects.legacy_ownership_id is
  'Original pre-Studsly label (LG-/BH-), kept for traceability. Null for objects born under the SL- scheme.';

-- 2. Generator. Random SL- id, retries against the global unique index, fails
--    hard after 10 attempts. security definer + pinned search_path; EXECUTE
--    revoked so it is unreachable over REST — it is only ever called from the
--    trigger below, which does not need EXECUTE privilege to fire.
create or replace function generate_ownership_id() returns text
language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';  -- Crockford, no I/L/O/U
  candidate text;
  i int;
  attempt int;
begin
  for attempt in 1..10 loop
    candidate := 'SL-';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * 32)::int, 1);
    end loop;
    if not exists (select 1 from objects where ownership_id = candidate) then
      return candidate;
    end if;
  end loop;
  raise exception 'generate_ownership_id: no free SL- id after 10 attempts';
end $$;

revoke execute on function generate_ownership_id() from public, anon, authenticated;

comment on function generate_ownership_id() is
  'Globally-unique SL-XXXXXX id (Crockford base32). Called only from the objects BEFORE INSERT trigger, never over REST (execute revoked).';

-- 3. Backfill. Copy legacy first, then regenerate ids one row at a time so each
--    new id is visible to the next row''s uniqueness check within this
--    transaction. A set-based UPDATE would evaluate the function against a single
--    snapshot that cannot see same-statement siblings, so two rows could collide.
update objects set legacy_ownership_id = ownership_id where legacy_ownership_id is null;

do $$
declare r record;
begin
  for r in select id from objects where ownership_id !~ '^SL-' loop
    update objects set ownership_id = generate_ownership_id() where id = r.id;
  end loop;
end $$;

-- 4. Force every future insert onto the SL- scheme. A BEFORE INSERT trigger, not
--    a column default: it works even with EXECUTE revoked, and it coerces any
--    non-SL value a code path might supply, so no LG-/BH-/ST- can ever be created
--    again — including by future bulk import.
create or replace function set_ownership_id() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if NEW.ownership_id is null or NEW.ownership_id !~ '^SL-' then
    NEW.ownership_id := generate_ownership_id();
  end if;
  return NEW;
end $$;

revoke execute on function set_ownership_id() from public, anon, authenticated;

drop trigger if exists trg_set_ownership_id on objects;
create trigger trg_set_ownership_id
  before insert on objects
  for each row execute function set_ownership_id();

-- 5. Keep NOT NULL + the global unique constraint (unchanged). Add a format
--    guard so the invariant holds even if the trigger is ever bypassed.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'objects_ownership_id_sl_format') then
    alter table objects add constraint objects_ownership_id_sl_format
      check (ownership_id ~ '^SL-[0-9A-HJKMNP-TV-Z]{6}$');
  end if;
end $$;

comment on column objects.ownership_id is
  'Studsly SL-XXXXXX label (Crockford base32, globally unique). The physical-object label, not ownership; objects.id (uuid) is the permanent identity. Follows the object across resale, never reissued. Legacy LG-/BH- values live in legacy_ownership_id.';

-- ROLLBACK (restores the legacy numbers):
--   drop trigger if exists trg_set_ownership_id on objects;
--   drop function if exists set_ownership_id();
--   alter table objects drop constraint if exists objects_ownership_id_sl_format;
--   update objects set ownership_id = legacy_ownership_id where legacy_ownership_id is not null;
--   drop function if exists generate_ownership_id();
--   alter table objects drop column if exists legacy_ownership_id;
