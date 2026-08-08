/**
 * Feature flags for Phase 1b (build-brief v4 §10).
 *
 * `main` auto-deploys to production, so every Phase 1b flow sits behind one of
 * these. A flag is on when ANY of three things is true:
 *
 *   1. its NEXT_PUBLIC_FF_* env var is truthy — globally on, how the preview
 *      branch turns everything on for everyone;
 *   2. the `feature_access` row for this user grants it (v4 M15) — the runtime
 *      switch, one INSERT, no redeploy. This is how a tester is let in;
 *   3. the user's email is in NEXT_PUBLIC_FF_ALLOWLIST — the legacy build-time
 *      allowlist, kept so existing deploys keep behaving as they do today.
 *
 * (3) cannot admit a tester without a rebuild: NEXT_PUBLIC_* is inlined into the
 * bundle at build time. That is exactly why (2) exists. New testers go in the
 * table; the env var is only there so nothing regresses under it.
 *
 * NEXT_PUBLIC_* vars must be referenced as static `process.env.NEXT_PUBLIC_x`
 * literals so Next.js can inline them into both server and client bundles —
 * hence the explicit ENV map rather than dynamic lookup.
 *
 * Every flag must be switchable off without breaking the app: when a flag is
 * off, the shared code path renders its Phase 1a fallback, never a broken UI.
 */

export const FLAGS = [
  'FF_MOD',
  'FF_COMPONENTS',
  'FF_POOL',
  'FF_CMF',
  'FF_BUYLIST',
  'FF_VALUE_LEDGER',
] as const

export type Flag = (typeof FLAGS)[number]

const ENV: Record<Flag, string | undefined> = {
  FF_MOD: process.env.NEXT_PUBLIC_FF_MOD,
  FF_COMPONENTS: process.env.NEXT_PUBLIC_FF_COMPONENTS,
  FF_POOL: process.env.NEXT_PUBLIC_FF_POOL,
  FF_CMF: process.env.NEXT_PUBLIC_FF_CMF,
  FF_BUYLIST: process.env.NEXT_PUBLIC_FF_BUYLIST,
  FF_VALUE_LEDGER: process.env.NEXT_PUBLIC_FF_VALUE_LEDGER,
}

function truthy(v: string | undefined): boolean {
  return v === 'true' || v === '1'
}

/** Comma-separated emails from NEXT_PUBLIC_FF_ALLOWLIST, lower-cased. */
function allowlist(): string[] {
  return (process.env.NEXT_PUBLIC_FF_ALLOWLIST ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * What `feature_access` granted this user, as read by flags-server.ts:
 *   null / undefined — no row, or we could not read the table
 *   []               — a row with the default empty array: EVERY flag
 *   ['FF_POOL', …]   — exactly these flags
 */
export type Granted = readonly string[] | null | undefined

/** Does the runtime grant cover `flag`? An empty array means all of them. */
function grants(granted: Granted, flag: Flag): boolean {
  if (granted == null) return false
  return granted.length === 0 || granted.includes(flag)
}

/**
 * Is `flag` enabled for this user? Per-flag env vars let the preview branch turn
 * flows on globally; `granted` is the runtime allowlist that admits an
 * individual tester with no redeploy; the email allowlist is the build-time
 * predecessor of that, kept for compatibility. Any one of them is enough.
 */
export function isEnabled(
  flag: Flag,
  userEmail?: string | null,
  granted?: Granted
): boolean {
  if (truthy(ENV[flag])) return true
  if (grants(granted, flag)) return true
  if (userEmail && allowlist().includes(userEmail.toLowerCase())) return true
  return false
}

export type Flags = Record<Flag, boolean>

/**
 * Resolve all six flags for a user into a plain object to hand to client views.
 * `granted` comes from `feature_access` and is only available server-side —
 * callers without it (client components, the flag-off fallback) simply omit it.
 */
export function resolveFlags(userEmail?: string | null, granted?: Granted): Flags {
  return Object.fromEntries(
    FLAGS.map((f) => [f, isEnabled(f, userEmail, granted)])
  ) as Flags
}

/** All-off flags — the safe default and the shape client components expect. */
export const ALL_OFF: Flags = Object.fromEntries(
  FLAGS.map((f) => [f, false])
) as Flags
