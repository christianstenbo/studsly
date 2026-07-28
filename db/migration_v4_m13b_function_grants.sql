-- Migration: v4 M13b — lock down function EXECUTE grants
-- Three trigger functions were exposed as REST RPCs and callable by anon:
--   sync_component_parent, sync_object_component_flags,
--   check_allocation_not_overallocated. They are trigger bodies with no place
--   in the API — revoke EXECUTE entirely.
-- The three allocate/restore RPCs (M11) check auth.uid() internally so anon was
--   not a live hole, but anon has no reason to reach them — remove anon, keep
--   authenticated (Flow 1 calls them).
--
-- IMPORTANT: functions default-grant EXECUTE to PUBLIC, and anon/authenticated
-- are members of PUBLIC. Revoking from anon alone leaves the PUBLIC grant in
-- place, so we revoke from PUBLIC as well. For the allocate RPCs we re-grant to
-- authenticated after revoking PUBLIC, so only signed-in users keep access.
--
-- Note: after this, the linter still reports authenticated_security_definer_
-- function_executable (0029) for the three allocate RPCs. That is intentional —
-- they are meant to be callable by authenticated users. Only the anon (0028)
-- warnings and the trigger-function warnings should clear.
-- Additive/idempotent. Date: 2026-07-28

-- Trigger functions: never reachable over REST.
revoke execute on function public.sync_component_parent()              from public, anon, authenticated;
revoke execute on function public.sync_object_component_flags()        from public, anon, authenticated;
revoke execute on function public.check_allocation_not_overallocated() from public, anon, authenticated;

-- Allocate/restore RPCs: drop the PUBLIC blanket + anon, keep authenticated.
revoke execute on function public.allocate_part(uuid, uuid, allocation_purpose, integer, text, integer, text) from public, anon;
revoke execute on function public.allocate_component(uuid, uuid, uuid, text) from public, anon;
revoke execute on function public.restore_allocation(uuid)             from public, anon;

grant execute on function public.allocate_part(uuid, uuid, allocation_purpose, integer, text, integer, text) to authenticated;
grant execute on function public.allocate_component(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.restore_allocation(uuid)             to authenticated;

-- ROLLBACK (restores the permissive default — not recommended):
--   grant execute on function public.sync_component_parent() to anon, authenticated;
--   grant execute on function public.sync_object_component_flags() to anon, authenticated;
--   grant execute on function public.check_allocation_not_overallocated() to anon, authenticated;
--   grant execute on function public.allocate_part(uuid, uuid, allocation_purpose, integer, text, integer, text) to anon;
--   grant execute on function public.allocate_component(uuid, uuid, uuid, text) to anon;
--   grant execute on function public.restore_allocation(uuid) to anon;
