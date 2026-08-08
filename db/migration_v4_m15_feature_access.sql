-- Migration: v4 M15 — runtime feature-flag allowlist
--
-- Why this exists: NEXT_PUBLIC_FF_ALLOWLIST is a NEXT_PUBLIC_* var, so Next.js
-- inlines it into the bundle at BUILD time. Adding a tester's email therefore
-- required a rebuild — and even a server-only Vercel env var needs a redeploy
-- to take effect. Neither meets the actual requirement: let a tester in without
-- shipping a new build.
--
-- This table is that switch. Adding a tester is one INSERT; the next request
-- they make already sees the flags. resolveFlags() still honours the env vars,
-- so nothing about the preview-branch "everything on" setup changes.
--
-- flags = '{}' (the default) means EVERY flag — that is the common case, an
-- onboarded tester who should see all of Phase 1b. A non-empty array grants
-- exactly those flags and nothing else.
--
-- Additive: new table only. No existing row is read, moved or changed.
-- Date: 2026-08-08

create table if not exists feature_access (
  email      text primary key,
  flags      text[]      not null default '{}',
  note       text,
  created_at timestamptz not null default now()
);

comment on table feature_access is
  'Runtime feature-flag allowlist. One row per tester email. flags = ''{}'' means all flags. Read server-side per request by web/lib/flags-server.ts — adding a row needs no redeploy.';
comment on column feature_access.flags is
  'Empty array = every flag. Otherwise exactly these flag names (FF_MOD, FF_COMPONENTS, FF_POOL, FF_CMF, FF_BUYLIST, FF_VALUE_LEDGER).';

-- Emails are matched case-insensitively; store and compare lower-cased.
create unique index if not exists feature_access_email_lower_idx
  on feature_access (lower(email));

alter table feature_access enable row level security;

-- Functions and tables default-grant to PUBLIC, and anon/authenticated are both
-- members of PUBLIC. Revoking from anon alone would close nothing — revoke from
-- PUBLIC, then re-grant only the one privilege signed-in users need.
revoke all on table feature_access from public, anon, authenticated;
grant select on table feature_access to authenticated;

-- A signed-in user may read only their own row. Nobody can write over the API;
-- rows are added from the SQL editor / service role.
drop policy if exists feature_access_self on feature_access;
create policy feature_access_self on feature_access
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- =============================================================================
-- Adding a tester (no redeploy, takes effect on their next request):
--   insert into feature_access (email, note)
--   values ('tester@example.com', 'Pre-tester round 1');
--
-- Granting a subset instead of everything:
--   insert into feature_access (email, flags) values ('x@y.com', '{FF_POOL}');
--
-- Removing a tester:
--   delete from feature_access where lower(email) = lower('tester@example.com');
--
-- ROLLBACK:
--   drop table if exists feature_access;
-- =============================================================================
