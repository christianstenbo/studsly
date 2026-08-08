'use client'

import { useState } from 'react'
import { Onboarding } from './onboarding'

/**
 * Decides nothing — the server already decided (see app/(dashboard)/layout.tsx).
 * This only holds the "dismissed in this render" state so the overlay can
 * disappear immediately on skip/finish without waiting for a round trip.
 */
export function OnboardingGate() {
  const [done, setDone] = useState(false)
  if (done) return null
  return <Onboarding onDone={() => setDone(true)} />
}
