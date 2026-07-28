"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { strings } from "@/lib/i18n/strings"

// Google G icon
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  )
}

const auth = strings.common.auth

/** Map a normalized error code (from /auth/callback) to friendly copy; fall
 * back to showing the raw text for any legacy/unknown value. */
function friendlyError(raw?: string): string | null {
  if (!raw) return null
  return auth.errors[raw] ?? decodeURIComponent(raw)
}

export function LoginForm({ error }: { error?: string }) {
  const [googleLoading, setGoogleLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [otpLoading, setOtpLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const displayError = formError ?? friendlyError(error)

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    })
    // Page will redirect — no need to reset loading
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setOtpLoading(true)
    const supabase = createClient()
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    })
    setOtpLoading(false)
    if (otpError) {
      const rateLimited = otpError.status === 429 || /rate/i.test(otpError.message)
      setFormError(rateLimited ? auth.errors.rate_limited : auth.errors.generic)
      return
    }
    setSentTo(email)
  }

  if (sentTo) {
    return (
      <Card>
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-lg">{auth.checkInboxTitle}</CardTitle>
          <CardDescription>
            {auth.checkInboxDesc.replace("{email}", sentTo)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => {
              setSentTo(null)
              setFormError(null)
            }}
          >
            ←
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-lg">{auth.cardTitle}</CardTitle>
        <CardDescription>{auth.cardDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayError && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {displayError}
          </div>
        )}

        {/* Primary: Google */}
        <Button
          variant="outline"
          size="lg"
          className="w-full gap-3"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
        >
          <GoogleIcon />
          {googleLoading ? auth.signingIn : auth.continueWithGoogle}
        </Button>

        {/* Divider */}
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="h-px flex-1 bg-gray-200" />
          {auth.dividerOr}
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        {/* Secondary: email magic link */}
        <form onSubmit={handleMagicLink} className="space-y-3">
          <label htmlFor="email" className="sr-only">
            {auth.emailLabel}
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={auth.emailPlaceholder}
            className="w-full rounded-md border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
          />
          <Button
            type="submit"
            variant="outline"
            size="lg"
            className="w-full"
            disabled={otpLoading || !email}
          >
            {otpLoading ? auth.sendingMagicLink : auth.sendMagicLink}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
