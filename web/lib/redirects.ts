import { NextResponse } from 'next/server'

/**
 * Host-relative redirects for middleware and route handlers.
 *
 * Why this exists: `NextResponse.redirect()` requires an ABSOLUTE URL, so every
 * server-side redirect in this app used to name a host — one built from
 * `request.url` / `request.nextUrl`, i.e. from whatever `x-forwarded-host` the
 * proxy in front of us supplied. That is a host the app does not control. If it
 * is ever rewritten, internal navigation silently walks off the deployment you
 * were testing and onto another one, where every FF_* flag is off and the
 * collection looks like someone else's. Reported 2026-08-08: starting on a
 * preview deploy and navigating ended up on production.
 *
 * A relative `Location` header removes the possibility. RFC 7231 §7.1.2 allows
 * a relative reference and every browser resolves it against the current URL,
 * so the host CANNOT change across a redirect — there is no host in the
 * response to get it wrong.
 *
 * Rule for this codebase: no internal navigation names a host. `<Link href>`,
 * `router.push` and `redirect()` are already relative; these helpers close the
 * one remaining gap.
 */

/** 307, preserving method and body. The default for auth and gating redirects. */
export function redirectRelative(path: string, status: 307 | 308 = 307) {
  return new NextResponse(null, {
    status,
    headers: { Location: toInternalPath(path) },
  })
}

/**
 * Force a value to a same-origin path. Anything that could point off-origin —
 * an absolute URL, a protocol-relative `//evil.example.com`, a backslash form
 * some parsers normalise to `//` — collapses to `/`. Used for every `next=`
 * style parameter so a query string can never become an open redirect.
 */
export function toInternalPath(path: string): string {
  if (!path.startsWith('/')) return '/'
  // `//host` and `/\host` both resolve to a different origin in browsers.
  if (path.startsWith('//') || path.startsWith('/\\')) return '/'
  return path
}

/** Build an internal path with query parameters, host-free by construction. */
export function internalPath(
  path: string,
  params?: Record<string, string | null | undefined>
): string {
  const base = toInternalPath(path)
  if (!params) return base
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') search.set(key, value)
  }
  const qs = search.toString()
  return qs ? `${base}?${qs}` : base
}
