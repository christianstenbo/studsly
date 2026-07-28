"use client"

import Link from "next/link"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, usePathname } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { strings } from "@/lib/i18n/strings"

const NAV_LINKS = [
  { href: "/", label: strings.nav.home, exact: true },
  { href: "/collection", label: strings.nav.collection, exact: false },
  { href: "/hurtigscan", label: strings.nav.quickScan, exact: false },
  { href: "/insights", label: strings.nav.insights, exact: false },
]

export function TopNav({
  user,
  envBadge,
}: {
  user: User
  envBadge?: { label: string; flags: string[]; sha: string | null } | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="appbar">
      <Link href="/" className="lg" aria-label={strings.common.appName}>
        <span className="mk"><span /></span>
        {strings.common.appName}
      </Link>

      {envBadge && (
        <span
          className="envbadge"
          title={
            envBadge.flags.length
              ? `${envBadge.label} · flags on: ${envBadge.flags.join(", ")}`
              : envBadge.label
          }
        >
          {envBadge.label}
          {envBadge.flags.length > 0 && <b>{envBadge.flags.length}</b>}
          {envBadge.sha && (
            <code className="envsha" title={strings.nav.buildShaTitle}>
              {envBadge.sha}
            </code>
          )}
        </span>
      )}

      <nav className="nav" aria-label="Primary">
        {NAV_LINKS.map(({ href, label, exact }) => {
          const active = exact
            ? pathname === href
            : pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={active ? "active" : undefined}
              aria-current={active ? "page" : undefined}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="acct">
        <b>{user.email}</b>
        <span aria-hidden>·</span>
        <button
          type="button"
          className="signout"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          {strings.nav.signOut}
        </button>
      </div>
    </header>
  )
}
