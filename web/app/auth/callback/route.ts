import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { type NextRequest } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { normalizeAuthError } from "@/lib/auth-errors"
import { redirectRelative, internalPath, toInternalPath } from "@/lib/redirects"

/**
 * Auth callback for Google OAuth (PKCE `code`) and for magic links that still
 * carry `?code=` or `?token_hash=`.
 *
 * Point 1c: the PKCE path is deliberately unchanged — clicking the link in the
 * same browser you asked from must keep working, and it does.
 *
 * Point 1d: when a PKCE exchange fails there is no fallback to try. In
 * particular there is no falling back to Google OAuth: that produced an "Access
 * denied" screen two steps downstream of the real cause and told the user
 * nothing. Every failure now redirects to /login with a code naming the cause,
 * and for the cross-origin case the login form opens the six-digit code field —
 * which does work from anywhere — instead of leaving a dead end.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const emailHint = searchParams.get("email")
  // Same-origin path only; a query parameter must never become an open
  // redirect, and no redirect from here names a host (lib/redirects.ts).
  const next = toInternalPath(searchParams.get("next") ?? "/")

  /**
   * Back to /login with a named cause. `code` is carried so the form can open
   * the code field pre-filled with the address that was used — the user should
   * not have to retype it to recover.
   */
  const toLogin = (errorCode: string) =>
    redirectRelative(internalPath("/login", { error: errorCode, email: emailHint }))

  // Provider-side error (an expired/used magic link arrives as
  // error=access_denied&error_code=otp_expired).
  const providerError = searchParams.get("error")
  const providerErrorCode = searchParams.get("error_code")
  if (providerError) {
    return toLogin(normalizeAuthError(providerErrorCode ?? providerError))
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  // Magic link via token_hash template. No PKCE verifier, so device-independent.
  // /auth/confirm is where the template points now; this branch stays for links
  // already sitting in inboxes.
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error) {
      console.error("[auth/callback] verifyOtp failed:", error.message)
      return toLogin(normalizeAuthError(error.message))
    }
    return redirectRelative(next)
  }

  // OAuth / magic link via PKCE code.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      // Log the origin too: a bad_code_verifier here almost always means the
      // link came back to a different host than the one that requested it,
      // which is a redirect-allowlist problem, not a user mistake.
      console.error(
        `[auth/callback] code exchange failed on host ${request.headers.get("host")}:`,
        error.message
      )
      return toLogin(normalizeAuthError(error.message))
    }
    return redirectRelative(next)
  }

  return toLogin("missing_code")
}
