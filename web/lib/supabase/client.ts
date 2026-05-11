import { createBrowserClient } from "@supabase/ssr"

/**
 * Creates a Supabase client for use in Client Components.
 * Call this inside components — not at module level — to ensure
 * fresh client per render and correct cookie handling.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
