import { type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { EmailOtpType } from "@supabase/supabase-js"
import { normalizeAuthError } from "@/lib/auth-errors"
import { redirectRelative, internalPath, toInternalPath } from "@/lib/redirects"

/**
 * Magic-link confirmation that works from any device (Point 1b).
 *
 * The PKCE flow at /auth/callback cannot do this, and no amount of copy makes it
 * possible: `exchangeCodeForSession` needs the code verifier that the SDK wrote
 * to browser storage on the origin that REQUESTED the link. Open the link on a
 * different device — or even the same device in a different browser — and the
 * verifier is not there. Supabase still burns the one-time token on /verify, so
 * the user ends up neither signed in nor holding a usable link. That is exactly
 * what happened to +tom2 (email_confirmed_at set, last_sign_in_at null, zero
 * rows in auth.sessions).
 *
 * This route takes `token_hash` instead and calls `verifyOtp` on the SERVER.
 * There is no verifier in the exchange at all, so where the link is opened
 * stops mattering; the session cookie is written by @supabase/ssr on the
 * response. People read email on their phones — this is the path that assumes
 * they will.
 *
 * The email template points here. /auth/callback keeps its own token_hash branch
 * for links already sitting in inboxes.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get("token_hash")
  const type = (searchParams.get("type") as EmailOtpType | null) ?? "email"
  // Same-origin path only — a query parameter must never become an open
  // redirect, and no redirect from here names a host at all (lib/redirects.ts).
  const next = toInternalPath(searchParams.get("next") ?? "/")

  // Supabase can bounce here with its own error (expired/used token) instead of
  // a token_hash. Surface the reason rather than a generic failure.
  const providerError = searchParams.get("error_code") ?? searchParams.get("error")
  if (providerError) {
    return redirectRelative(
      internalPath("/login", { error: normalizeAuthError(providerError) })
    )
  }

  if (!tokenHash) {
    return redirectRelative(internalPath("/login", { error: "missing_code" }))
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

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
  if (error) {
    console.error("[auth/confirm] verifyOtp failed:", error.message)
    return redirectRelative(
      internalPath("/login", { error: normalizeAuthError(error.message) })
    )
  }

  return redirectRelative(next)
}
