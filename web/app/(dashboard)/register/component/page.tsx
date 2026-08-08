import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getFlagsFor } from "@/lib/flags-server"
import { strings } from "@/lib/i18n/strings"
import { ComponentForm } from "@/components/register/component-form"

export const metadata = { title: strings.register.component.pageTitle }

/**
 * Flow 4 (FF_COMPONENTS) — register a standalone instruction or original box.
 * The row lands in v_free_components and becomes allocatable from a matching
 * set's Contents (Flow 3). Gated: with the flag off this route redirects back
 * to /register so no half-built page is reachable in production.
 */
export default async function RegisterComponentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const flags = await getFlagsFor(supabase, user)
  if (!flags.FF_COMPONENTS) redirect("/register")

  return <ComponentForm />
}
