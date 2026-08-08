import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { resolveFlags, ALL_OFF, type Flags, type Granted } from '@/lib/flags'

/**
 * Server-side flag resolution for Phase 1b.
 *
 * The one thing this file adds over the pure `resolveFlags` in lib/flags.ts is
 * the `feature_access` lookup (v4 M15) — the runtime allowlist that lets a
 * tester in with a single INSERT and no redeploy. Env vars alone cannot do that:
 * NEXT_PUBLIC_* is inlined at build time, and even a server-only Vercel var
 * needs a redeploy before the new value is live.
 *
 * The resulting plain `Flags` object is what gets handed down into client views.
 * The client never learns the allowlist, only the booleans.
 */

/**
 * Read this user's runtime grant. Returns `null` when there is no row — and also
 * when the read fails, because a flag lookup must never take a page down: the
 * env vars and the legacy allowlist still decide, and the user sees the Phase 1a
 * fallback rather than an error.
 */
async function readGrant(
  supabase: SupabaseClient,
  email: string | null | undefined
): Promise<Granted> {
  if (!email) return null
  const { data, error } = await supabase
    .from('feature_access')
    .select('flags')
    .ilike('email', email)
    .maybeSingle()
  if (error) {
    console.error('[flags] feature_access lookup failed:', error.message)
    return null
  }
  return (data?.flags as string[] | undefined) ?? null
}

/**
 * Resolve flags when the caller already has a client and user in hand — every
 * Server Component that renders a flagged view does. Avoids a second
 * `auth.getUser()` round-trip per request.
 */
export async function getFlagsFor(
  supabase: SupabaseClient,
  user: User | null
): Promise<Flags> {
  // No session — every Phase 1b flow stays off, matching the previous call
  // sites' `user ? resolveFlags(…) : ALL_OFF`.
  if (!user) return ALL_OFF
  const granted = await readGrant(supabase, user.email)
  return resolveFlags(user.email ?? null, granted)
}

/** Resolve flags from scratch, for callers that have neither client nor user. */
export async function getFlags(): Promise<Flags> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return getFlagsFor(supabase, data.user ?? null)
}
