import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TopNav } from "@/components/layout/top-nav"
import { FLAGS } from "@/lib/flags"
import { getFlagsFor } from "@/lib/flags-server"

/**
 * Dashboard layout — wraps all protected routes.
 * Server-side auth check: unauthenticated users are redirected to /login.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // Environment badge: visible on any non-production build, or on production if
  // a feature flag is somehow on — so it's always obvious you're not looking at
  // the plain production app. VERCEL_ENV is 'production' | 'preview' | undefined
  // (local dev).
  const vercelEnv = process.env.VERCEL_ENV ?? "development"
  const flags = await getFlagsFor(supabase, user)
  const onFlags = FLAGS.filter((f) => flags[f])
  const showBadge = vercelEnv !== "production" || onFlags.length > 0
  // Short commit SHA so a tester can paste the exact build into a bug report.
  // VERCEL_GIT_COMMIT_SHA is set on Vercel; empty locally.
  const sha = (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || null
  const envBadge = showBadge
    ? {
        label: vercelEnv === "production" ? "Flags on" : vercelEnv === "preview" ? "Preview" : "Dev",
        flags: onFlags,
        sha,
      }
    : null

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <TopNav user={user} envBadge={envBadge} />
      <main className="app-main">{children}</main>
    </div>
  )
}
