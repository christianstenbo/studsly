"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { strings } from "@/lib/i18n/strings"
import { authErrorMessage, classifySdkError } from "@/lib/auth-errors"

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

/** Keep only digits, cap at six — makes paste of a whole code just work. */
function cleanCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 6)
}

export function LoginForm({
  error,
  emailHint,
}: {
  error?: string
  /** Address carried back from a failed callback, so recovery needs no retyping. */
  emailHint?: string
}) {
  const router = useRouter()
  const [googleLoading, setGoogleLoading] = useState(false)
  const [email, setEmail] = useState(emailHint ?? "")
  const [otpLoading, setOtpLoading] = useState(false)
  // A failed link that we can recover from opens straight into the code step,
  // rather than dropping the user back at "enter your email" with an apology.
  const [sentTo, setSentTo] = useState<string | null>(
    error === "link_wrong_device" && emailHint ? emailHint : null
  )
  const [code, setCode] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [errorKey, setErrorKey] = useState<string | null>(error ?? null)

  const codeRef = useRef<HTMLInputElement>(null)
  const displayError = authErrorMessage(errorKey)

  // Autofocus the code field whenever we land on the code step.
  useEffect(() => {
    if (sentTo) codeRef.current?.focus()
  }, [sentTo])

  const handleGoogleLogin = async () => {
    setErrorKey(null)
    setGoogleLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      })
      // On success the browser redirects; only reset on error.
      if (error) {
        setGoogleLoading(false)
        setErrorKey(classifySdkError(error))
      }
    } catch (e) {
      setGoogleLoading(false)
      setErrorKey(classifySdkError(e))
    }
  }

  /**
   * Request a code. `emailRedirectTo` is always sent explicitly and always names
   * THIS origin — never SITE_URL. A link that comes back to a different host
   * than the one that asked cannot complete its PKCE exchange, whatever device
   * it is opened on. (The origin must also be on Supabase's redirect allowlist,
   * or Supabase substitutes SITE_URL and we are back to the same failure —
   * see docs/auth-setup.md.)
   */
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorKey(null)
    setOtpLoading(true)
    try {
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
        setErrorKey(classifySdkError(otpError))
        return
      }
      setCode("")
      setSentTo(email)
    } catch (err) {
      setOtpLoading(false)
      setErrorKey(classifySdkError(err))
    }
  }

  /**
   * Verify the six digits. This is the primary path precisely because it does
   * not care where the mail was read: no PKCE verifier is involved, so a code
   * from a phone typed into a laptop signs the laptop in.
   */
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) {
      setErrorKey("code_incomplete")
      return
    }
    setErrorKey(null)
    setVerifying(true)
    try {
      const supabase = createClient()
      const { error: otpError } = await supabase.auth.verifyOtp({
        email: sentTo!,
        token: code,
        type: "email",
      })
      if (otpError) {
        setVerifying(false)
        // A rejected six-digit code is a typo far more often than anything
        // else; say so rather than blaming the link.
        const key = classifySdkError(otpError)
        setErrorKey(key === "link_invalid" ? "code_wrong" : key)
        return
      }
      // Session cookie is set — let the server re-render behind it.
      router.replace("/")
      router.refresh()
    } catch (err) {
      setVerifying(false)
      setErrorKey(classifySdkError(err))
    }
  }

  const errorBox = displayError && (
    <div
      role="alert"
      className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
    >
      {displayError}
    </div>
  )

  // ── Step 2: enter the code ────────────────────────────────────────────────
  if (sentTo) {
    return (
      <Card>
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-lg">{auth.checkInboxTitle}</CardTitle>
          <CardDescription>
            {auth.checkInboxDesc.replace("{email}", sentTo)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorBox}

          <form onSubmit={handleVerify} className="space-y-3">
            <label htmlFor="code" className="sr-only">
              {auth.codeLabel}
            </label>
            <input
              id="code"
              ref={codeRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(cleanCode(e.target.value))}
              onPaste={(e) => {
                // Paste the whole code — including "Your code is 123456".
                e.preventDefault()
                setCode(cleanCode(e.clipboardData.getData("text")))
              }}
              placeholder={auth.codePlaceholder}
              aria-label={auth.codeLabel}
              className="w-full rounded-md border border-gray-200 px-4 py-3 text-center text-2xl font-semibold tracking-[0.4em] outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
            />
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={verifying || code.length !== 6}
            >
              {verifying ? auth.verifyingCode : auth.verifyCode}
            </Button>
          </form>

          <p className="text-center text-xs text-gray-400">{auth.linkAlternative}</p>

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              className="text-xs text-gray-500 underline hover:text-gray-700"
              onClick={() => {
                setSentTo(null)
                setCode("")
                setErrorKey(null)
              }}
            >
              {auth.useAnotherEmail}
            </button>
            <button
              type="button"
              className="text-xs text-gray-500 underline hover:text-gray-700 disabled:opacity-50"
              disabled={otpLoading}
              onClick={(e) => {
                setEmail(sentTo)
                void handleSendCode(e)
              }}
            >
              {otpLoading ? auth.sendingMagicLink : auth.resend}
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── Step 1: choose a way in ───────────────────────────────────────────────
  return (
    <Card>
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-lg">{auth.cardTitle}</CardTitle>
        <CardDescription>{auth.cardDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorBox}

        {/* Primary: email code — the path that survives a device switch */}
        <form onSubmit={handleSendCode} className="space-y-3">
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
          <Button type="submit" size="lg" className="w-full" disabled={otpLoading || !email}>
            {otpLoading ? auth.sendingMagicLink : auth.sendMagicLink}
          </Button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="h-px flex-1 bg-gray-200" />
          {auth.dividerOr}
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        {/* Secondary: Google */}
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
      </CardContent>
    </Card>
  )
}
