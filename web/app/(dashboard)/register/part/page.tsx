import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getFlagsFor } from "@/lib/flags-server"
import { strings } from "@/lib/i18n/strings"
import { PartForm } from "@/components/register/part-form"

export const metadata = { title: strings.register.part.pageTitle }

/**
 * Flow 1 (FF_POOL) — register a loose part into the free pool.
 *
 * Gated: with the flag off this redirects back to /register, so no half-built
 * page is reachable in production. Flags resolve through getFlagsFor, which
 * consults feature_access — a tester added there reaches this on their next
 * request with no redeploy (M15).
 */
export default async function RegisterPartPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const flags = await getFlagsFor(supabase, user)
  if (!flags.FF_POOL) redirect("/register")

  return <PartForm />
}
