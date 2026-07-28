-- Migration: v4 M13 — close RLS leak on four M4/M5/M6 views
-- v_free_parts, v_free_components, v_buy_list_items and v_buy_list_rollup were
-- created without security_invoker, so they run as their owner (postgres) and
-- bypass RLS entirely. Each exposes user_id as a column and trusts the caller
-- to filter — which frontend filtering cannot enforce. The moment a second user
-- exists, they could read another user's free pool, locations, set names and
-- whole buy list via /rest/v1/v_*. The older M-views already have
-- security_invoker=on; only these four were missing it.
--
-- Fix is the option only: no view definition changes, no internal
-- `where user_id = auth.uid()` (RLS on the underlying tables does the work),
-- and user_id stays a column (app code reads it). Linter: clears the four
-- security_definer_view ERRORs (0010).
-- Additive/idempotent. Date: 2026-07-28

alter view public.v_free_parts       set (security_invoker = on);
alter view public.v_free_components  set (security_invoker = on);
alter view public.v_buy_list_items   set (security_invoker = on);
alter view public.v_buy_list_rollup  set (security_invoker = on);

-- v_buy_list_rollup reads from v_buy_list_items and v_free_parts; with
-- security_invoker RLS now applies at every link in the chain, so the rollup
-- sees only the caller's own rows. Verify row counts are unchanged for the
-- owner (buy_list_items=2, free_parts=3, free_components=0).

-- ROLLBACK:
--   alter view public.v_free_parts       set (security_invoker = off);
--   alter view public.v_free_components  set (security_invoker = off);
--   alter view public.v_buy_list_items   set (security_invoker = off);
--   alter view public.v_buy_list_rollup  set (security_invoker = off);
