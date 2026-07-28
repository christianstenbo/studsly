# Preview: Flow 1 — free parts pool (FF_POOL)

Preview-only branch to test the Individual-parts pool behind `FF_POOL`.
Env is set in Vercel **Preview** scope only: `NEXT_PUBLIC_FF_POOL=true`,
`NEXT_PUBLIC_FF_ALLOWLIST=christian.stenbo@gmail.com`. Production (`main`)
does not carry these, so the pool stays off in prod.

⚠️ Preview points at the **live** Supabase project — same data as production.
Viewing is read-only, but two actions below persist real writes; they're marked.

## What to check — Collection ▸ Individual parts

1. **Tab appears.** With the flag on, Collection shows the **Parts** tab as the
   live pool (not the 1a placeholder). Count = number of loose part rows (3).
2. **Columns** read `Part · Colour · Owned · Free · Allocated · Location`.
   With no allocations yet: Owned = Free, Allocated = `—`.
3. **Colour unconfirmed (Finding 1).** All three loose parts have no colour, so
   each shows the amber **"Colour unconfirmed ✎"** chip instead of a colour name.
4. **Set colour** — *persists a real write.* Clicking the chip opens a picker
   over the Rebrickable colour catalog (search + swatches). Picking one writes
   `part_color_id` / `part_color_name` to that loose part. Only use it if you
   actually want to set that part's colour; say the word if you'd rather I make
   it a dry-run for testing.
5. **Restore** — nothing to restore yet (0 active allocations in the DB). The
   Allocate → Restore round-trip gets its real UI entry points in Flows 2 & 6;
   the backend path is already verified (rolled-back smoke test).
6. **Flag-off fallback.** (Sanity, prod) with the flag off the Parts tab is the
   old placeholder — no shared path changed.

Not in this flow: Allocate buttons (come from missing/to-replace rows and the
buy list), MOD, buy list, value ledger.
