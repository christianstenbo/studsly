import { strings } from '@/lib/i18n/strings'

/**
 * One place that turns any auth failure into a cause the user can act on.
 *
 * The rule (Point 1e): every auth error names its reason. "Something went wrong
 * signing in" is reserved for failures we genuinely cannot classify — it is a
 * last resort, not a default. Raw Supabase messages are never shown.
 *
 * Used by /auth/callback, /auth/confirm (which pass a code through the URL) and
 * by the login form (which classifies SDK errors directly).
 */

const auth = strings.common.auth

/** Collapse a provider error code or SDK message into one of our error keys. */
export function normalizeAuthError(raw: string): string {
  const s = raw.toLowerCase()

  if (s.includes('expired') || s === 'otp_expired') return 'link_expired'
  if (s.includes('already') || s.includes('used')) return 'link_used'
  if (s.includes('rate') || s.includes('too many') || s.includes('429')) {
    return 'rate_limited'
  }
  // Cross-origin PKCE. The verifier lives in browser storage on the origin that
  // asked for the link, so a different origin can never complete the exchange —
  // this is a fact about the flow, not a transient fault. Route it to copy that
  // sends the user to the six-digit code instead.
  if (
    s.includes('verifier') ||
    s.includes('code challenge') ||
    s.includes('pkce') ||
    s.includes('bad_code_verifier')
  ) {
    return 'link_wrong_device'
  }
  if (s.includes('failed to fetch') || s.includes('network') || s.includes('timeout')) {
    return 'network'
  }
  if (s.includes('token') && s.includes('missing')) return 'missing_code'
  if (s.includes('access_denied') || s.includes('invalid') || s.includes('otp')) {
    return 'link_invalid'
  }
  return 'generic'
}

/**
 * Classify an error thrown by the Supabase JS client. `status` is more reliable
 * than the message for rate limiting, so it is checked first.
 */
export function classifySdkError(err: unknown): string {
  const e = err as { status?: number; message?: string } | null
  if (e?.status === 429) return 'rate_limited'
  if (e?.status === 403) return 'link_invalid'
  if (e?.message) return normalizeAuthError(e.message)
  return 'generic'
}

/** Friendly copy for an error key. Unknown keys fall back to the generic line. */
export function authErrorMessage(key?: string | null): string | null {
  if (!key) return null
  return auth.errors[key] ?? auth.errors.generic
}
