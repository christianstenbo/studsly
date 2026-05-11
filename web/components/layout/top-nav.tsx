"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useRouter, usePathname } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { LogOut, LayoutGrid, Zap } from "lucide-react"

const NAV_LINKS = [
  { href: "/collection", label: "Samling", icon: LayoutGrid },
  { href: "/hurtigscan", label: "Hurtigscan", icon: Zap },
]

export function TopNav({ user }: { user: User }) {
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
    <header className="border-b border-gray-200 bg-white">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Wordmark + nav */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-[#2E5FA3] flex items-center justify-center">
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
              >
                <circle cx="7" cy="7" r="5" fill="white" fillOpacity="0.3" />
                <circle cx="7" cy="7" r="3" fill="white" fillOpacity="0.6" />
                <circle cx="7" cy="7" r="1.5" fill="white" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm tracking-tight">Studsly</span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/")
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    active
                      ? "bg-[#2E5FA3]/10 text-[#2E5FA3]"
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <Icon size={14} />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* User + sign out */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 hidden sm:block">
            {user.email}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            disabled={signingOut}
            className="gap-1.5 text-gray-500"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Logg ut</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
