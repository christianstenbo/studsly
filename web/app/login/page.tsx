import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { LoginForm } from "./login-form"
import { strings } from "@/lib/i18n/strings"

export const metadata = {
  title: strings.common.auth.pageTitle,
  description: strings.common.auth.pageDescription,
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Already logged in — go to dashboard
  if (user) redirect("/")

  // `email` is carried back by /auth/callback so a failed link can drop the user
  // straight onto the code step without retyping their address.
  const { error, email } = await searchParams

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo + wordmark */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#2E5FA3] mb-2">
            {/* Stud icon — simple SVG */}
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <circle cx="14" cy="14" r="10" fill="white" fillOpacity="0.25" />
              <circle cx="14" cy="14" r="6" fill="white" fillOpacity="0.5" />
              <circle cx="14" cy="14" r="3" fill="white" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {strings.common.appName}
          </h1>
          <p className="text-sm text-gray-500">{strings.common.auth.tagline}</p>
        </div>

        {/* Login card */}
        <LoginForm error={error} emailHint={email} />

        <p className="text-center text-xs text-gray-400">
          {strings.common.auth.legalPrefix}{" "}
          <a href="#" className="underline hover:text-gray-600">
            {strings.common.auth.terms}
          </a>{" "}
          {strings.common.auth.legalConjunction}{" "}
          <a href="#" className="underline hover:text-gray-600">
            {strings.common.auth.privacy}
          </a>
          .
        </p>
      </div>
    </main>
  )
}
