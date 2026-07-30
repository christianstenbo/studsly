import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"

/**
 * Auth callback for both Google OAuth (PKCE `code`) and email magic links.
 * Magic links arrive either as `?code=` (default Supabase template, PKCE) or as
 * `?token_hash=&type=` (templates using {{ .TokenHash }}) — both handled here.
 * All failures redirect to /login with a normalized `error` code that the login
 * form maps to friendly copy; we never surface a raw Supabase message.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = searchParams.get("next") ?? "/"

  // Provider-side error (e.g. expired/used magic link comes back as
  // error=access_denied&error_code=otp_expired).
  const providerError = searchParams.get("error")
  const providerErrorCode = searchParams.get("error_code")
  if (providerError) {
    return NextResponse.redirect(`${origin}/login?error=${normalize(providerErrorCode ?? providerError)}`)
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

  // Magic link via token_hash template.
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error) {
      console.error("[auth/callback] verifyOtp failed:", error.message)
      return NextResponse.redirect(`${origin}/login?error=${normalize(error.message)}`)
    }
    return NextResponse.redirect(`${origin}${next}`)
  }

  // OAuth / magic link via PKCE code.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error("[auth/callback] code exchange failed:", error.message)
      return NextResponse.redirect(`${origin}/login?error=${normalize(error.message)}`)
    }
    return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/login?error=missing_code`)
}

/** Collapse provider error codes / messages into the login form's error keys. */
function normalize(raw: string): string {
  const s = raw.toLowerCase()
  if (s.includes("expired") || s === "otp_expired") return "link_expired"
  if (s.includes("already") || s.includes("used")) return "link_used"
  if (s.includes("rate")) return "rate_limited"
  // PKCE verifier is a cookie on the origin the link was requested from; a
  // cross-origin/cross-device open loses it. token_hash links avoid this.
  if (s.includes("verifier") || s.includes("code challenge") || s.includes("pkce")) {
    return "link_wrong_device"
  }
  if (s.includes("access_denied") || s.includes("invalid") || s.includes("otp")) return "link_invalid"
  return "generic"
}
