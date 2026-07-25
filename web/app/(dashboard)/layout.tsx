import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TopNav } from "@/components/layout/top-nav"

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

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <TopNav user={user} />
      <main className="app-main">{children}</main>
    </div>
  )
}
