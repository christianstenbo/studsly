import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { strings } from "@/lib/i18n/strings"
import { getFlagsFor } from "@/lib/flags-server"

export const metadata = { title: strings.register.pageTitle }

const r = strings.register

/**
 * Register — the "Choose" step (register v5). Scan / A set / A figure route to
 * the existing Quick Scan register flow. Instructions or a box is Flow 4
 * (FF_COMPONENTS): when the flag is on it links to /register/component, else it
 * stays "Coming soon". Individual parts and MOC import remain Phase 1b stubs.
 */
export default async function RegisterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const flags = await getFlagsFor(supabase, user)

  return (
    <div className="sc-register">
      <Link className="rback" href="/collection">{r.back}</Link>

      <div className="rhead">
        <h1>{strings.nav.register}</h1>
      </div>

      <div className="sheet">
        <div className="sheethead">
          <div className="tt">{r.title}</div>
          <div className="ts">{r.subtitle}</div>
        </div>
        <div className="sheetbody">
          <Link className="scanhero" href="/hurtigscan">
            <div className="si" aria-hidden>
              <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
                <path d="M4.5 7h2l1.1-1.7a1 1 0 0 1 .84-.45h7.12a1 1 0 0 1 .84.45L17.5 7h2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-9A1.5 1.5 0 0 1 4.5 7Z" stroke="#fff" strokeWidth="1.7" />
                <circle cx="12" cy="12.8" r="3.1" stroke="#fff" strokeWidth="1.7" />
              </svg>
            </div>
            <div>
              <div className="st1">{r.scan.title}</div>
              <div className="st2">{r.scan.desc}</div>
            </div>
            <span className="sgo" aria-hidden>›</span>
          </Link>

          <div className="ordiv">{r.orByType}</div>

          <div className="methods">
            <Link className="method" href="/hurtigscan">
              <span className="mi" aria-hidden>▦</span>
              <span>
                <span className="mt">{r.methods.set.title}</span>
                <span className="md">{r.methods.set.desc}</span>
              </span>
            </Link>

            <Link className="method" href="/hurtigscan">
              <span className="mi" aria-hidden>🐘</span>
              <span>
                <span className="mt">{r.methods.figure.title}</span>
                <span className="md">{r.methods.figure.desc}</span>
              </span>
            </Link>

            {flags.FF_POOL ? (
              <Link className="method" href="/register/part">
                <span className="mi" aria-hidden>◱</span>
                <span>
                  <span className="mt">{r.methods.parts.title}</span>
                  <span className="md">{r.methods.parts.desc}</span>
                </span>
              </Link>
            ) : (
              <div className="method" aria-disabled="true">
                <span className="mi" aria-hidden>◱</span>
                <span>
                  <span className="mt">{r.methods.parts.title}</span>
                  <span className="md">{r.methods.parts.desc}</span>
                  <span className="soon">{r.notEnabled}</span>
                </span>
              </div>
            )}

            {flags.FF_COMPONENTS ? (
              <Link className="method" href="/register/component">
                <span className="mi" aria-hidden>📘</span>
                <span>
                  <span className="mt">{r.methods.comp.title}</span>
                  <span className="md">{r.methods.comp.desc}</span>
                </span>
              </Link>
            ) : (
              <div className="method" aria-disabled="true">
                <span className="mi" aria-hidden>📘</span>
                <span>
                  <span className="mt">{r.methods.comp.title}</span>
                  <span className="md">{r.methods.comp.desc}</span>
                  <span className="soon">{r.notEnabled}</span>
                </span>
              </div>
            )}

            <div className="method" aria-disabled="true">
              <span className="mi" aria-hidden>✎</span>
              <span>
                <span className="mt">{r.methods.moc.title}</span>
                <span className="md">{r.methods.moc.desc}</span>
                <span className="soon">{r.comingSoon}</span>
              </span>
            </div>
          </div>

          <div className="picknote">
            <span className="pi" aria-hidden>✦</span>
            <span className="hint">{r.note}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
