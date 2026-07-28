-- Migration: v4 M14b — generate_ownership_id() uses a CSPRNG
-- M14 used random(), which is not cryptographically secure. The whole point of
-- a random (not sequential) id is that a QR-URL must not let anyone guess the
-- neighbouring object; a predictable PRNG undermines that. Switch to
-- extensions.gen_random_bytes (pgcrypto, already installed in the extensions
-- schema). With a 32-char alphabet, 256 % 32 = 0, so byte % 32 is uniform — no
-- modulo bias, every Crockford char equally likely.
--
-- Only the generator body changes; the trigger, the format CHECK and the
-- existing 586 SL- numbers are untouched (ids are labels — never reissued).
-- Idempotent (create or replace). Date: 2026-07-28

create or replace function generate_ownership_id() returns text
language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';  -- Crockford, no I/L/O/U
  candidate text;
  b bytea;
  i int;
  attempt int;
begin
  for attempt in 1..10 loop
    b := extensions.gen_random_bytes(6);          -- CSPRNG; 256 % 32 = 0 => uniform
    candidate := 'SL-';
    for i in 0..5 loop
      candidate := candidate || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
    end loop;
    if not exists (select 1 from objects where ownership_id = candidate) then
      return candidate;
    end if;
  end loop;
  raise exception 'generate_ownership_id: no free SL- id after 10 attempts';
end $$;

-- create or replace preserves the ACL, but re-issue the revoke so the migration
-- is self-contained: never reachable over REST.
revoke execute on function generate_ownership_id() from public, anon, authenticated;

comment on function generate_ownership_id() is
  'Globally-unique SL-XXXXXX id (Crockford base32, CSPRNG via extensions.gen_random_bytes). Called only from the objects BEFORE INSERT trigger, never over REST (execute revoked).';

-- ROLLBACK: re-apply the M14 body (random()-based) from migration_v4_m14.
