import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { resolveFlags, type Flags } from '@/lib/flags'

/**
 * Resolve Phase 1b feature flags for the currently signed-in user, for use in
 * Server Components. Reads the session email once and passes the resulting
 * plain `Flags` object down into client views — the client never needs to know
 * the allowlist, only the booleans.
 */
export async function getFlags(): Promise<Flags> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return resolveFlags(data.user?.email ?? null)
}
