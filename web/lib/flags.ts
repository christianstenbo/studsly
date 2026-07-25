/**
 * Feature flags for Phase 1b (build-brief v4 §10).
 *
 * `main` auto-deploys to production, so every Phase 1b flow sits behind one of
 * these. A flag is on when EITHER its NEXT_PUBLIC_FF_* env var is truthy
 * (globally on — that is how the preview branch turns everything on) OR the
 * signed-in user's email is on the allowlist (how individual test users are
 * onboarded in production without flipping a flag globally).
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
 * Is `flag` enabled for this user? An allow-listed email unlocks every Phase 1b
 * flow (that is the whole point of the allowlist — onboarding a tester), while
 * per-flag env vars let the preview branch turn flows on globally.
 */
export function isEnabled(flag: Flag, userEmail?: string | null): boolean {
  if (truthy(ENV[flag])) return true
  if (userEmail && allowlist().includes(userEmail.toLowerCase())) return true
  return false
}

export type Flags = Record<Flag, boolean>

/** Resolve all six flags for a user into a plain object to hand to client views. */
export function resolveFlags(userEmail?: string | null): Flags {
  return Object.fromEntries(
    FLAGS.map((f) => [f, isEnabled(f, userEmail)])
  ) as Flags
}

/** All-off flags — the safe default and the shape client components expect. */
export const ALL_OFF: Flags = Object.fromEntries(
  FLAGS.map((f) => [f, false])
) as Flags
