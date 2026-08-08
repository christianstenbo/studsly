'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { strings } from '@/lib/i18n/strings'

const o = strings.onboarding

/**
 * Three screens, shown once, to a user with nothing registered.
 *
 * Where "once" is remembered matters. localStorage would forget on a new
 * browser, a new phone, or a cleared cache — and this is a product people will
 * open on a laptop after signing in on a phone (that is the whole premise of
 * Point 1). So completion is stored on the USER, in Supabase auth user
 * metadata, via `updateUser({ data: { onboarded_at } })`. It follows the account
 * across every device and needs no table and no migration.
 *
 * Skipping counts as done. Someone who skips has told us they do not want this;
 * showing it again on their next visit would ignore that.
 */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  const screens = o.screens
  const last = step === screens.length - 1
  const screen = screens[step]

  const complete = useCallback(
    async (thenRegister: boolean) => {
      setSaving(true)
      const supabase = createClient()
      // Best effort: if the write fails the user still gets through — being shown
      // onboarding twice is a far smaller failure than being trapped behind it.
      const { error } = await supabase.auth.updateUser({
        data: { onboarded_at: new Date().toISOString() },
      })
      if (error) console.error('[onboarding] could not save completion:', error.message)
      onDone()
      if (thenRegister) router.push('/register')
      router.refresh()
    },
    [onDone, router]
  )

  return (
    <div className="onbwrap" role="dialog" aria-modal="true" aria-label={screen.title}>
      <div className="onbcard">
        <div className="onbtop">
          <span className="onbstep">{o.stepOf(step + 1, screens.length)}</span>
          <button
            type="button"
            className="onbskip"
            onClick={() => void complete(false)}
            disabled={saving}
          >
            {o.skip}
          </button>
        </div>

        <div className="onbicon" aria-hidden>{screen.icon}</div>
        <h2 className="onbtitle">{screen.title}</h2>
        <p className="onbbody">{screen.body}</p>
        <p className="onbnote">{screen.note}</p>

        <div className="onbdots" aria-hidden>
          {screens.map((s, i) => (
            <i key={s.title} className={i === step ? 'on' : undefined} />
          ))}
        </div>

        <div className="onbactions">
          {/* .btnP / .btnO, not the shadcn Button: the design system's primary is
              raspberry (--brand), and the shadcn default renders blue — which put
              a blue CTA next to raspberry progress dots on the very first screen
              a new user sees. */}
          {step > 0 && (
            <button type="button" className="btnO" onClick={() => setStep((n) => n - 1)}>
              {o.back}
            </button>
          )}
          {last ? (
            // Ends on the action, not on an empty dashboard.
            <button
              type="button"
              className="btnP grow"
              disabled={saving}
              onClick={() => void complete(true)}
            >
              {o.finish}
            </button>
          ) : (
            <button
              type="button"
              className="btnP grow"
              onClick={() => setStep((n) => n + 1)}
            >
              {o.next}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
