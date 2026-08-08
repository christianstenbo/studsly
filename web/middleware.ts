import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — MUST be called before any route logic
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Public routes — no auth required. /auth/confirm must be here: it is the
  // route that CREATES the session from a magic link, so requiring one first
  // would bounce every cross-device sign-in straight back to /login.
  const publicRoutes = ["/login", "/auth/callback", "/auth/confirm"]
  const isPublic = publicRoutes.some((route) => pathname.startsWith(route))

  // Both gates must keep you on the deployment you are testing. Building the
  // target with `new URL(path, request.url)` makes it same-origin, and Next
  // then emits a RELATIVE `Location: /login` — measured, including with
  // `Host` and `x-forwarded-host` both spoofed to www.studsly.com, where the
  // header stayed relative. Do not reintroduce `request.nextUrl.clone()` with a
  // mutated pathname: that reads the proxy's host back into the response and is
  // how internal navigation can walk off a preview deploy onto production.
  const redirectTo = (path: string) => {
    const response = NextResponse.redirect(new URL(path, request.url))
    // Carry over any cookies the session refresh just set. Dropping them would
    // throw away a rotated refresh token and sign the user out on the next hop.
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie)
    })
    return response
  }

  if (!user && !isPublic) {
    return redirectTo("/login")
  }

  if (user && pathname === "/login") {
    return redirectTo("/")
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico, sitemap.xml, robots.txt
     * - public folder assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
