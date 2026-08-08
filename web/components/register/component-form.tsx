"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { strings } from "@/lib/i18n/strings"

const c = strings.register.component
const GRADES = ["MINT", "EXCELLENT", "GOOD", "FAIR", "POOR"] as const
const GRADE_LABELS = strings.setDetail.grades

type ObjType = "INSTRUCTION" | "ORIGINAL_BOX"

export function ComponentForm() {
  const router = useRouter()
  const [objectType, setObjectType] = useState<ObjType>("INSTRUCTION")
  const [setNumber, setSetNumber] = useState("")
  const [name, setName] = useState("")
  const [nameTouched, setNameTouched] = useState(false)
  const [locStr, setLocStr] = useState("")
  const [grade, setGrade] = useState<string | null>(null)
  const [match, setMatch] = useState<string | null>(null)
  const [noMatch, setNoMatch] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<ObjType | null>(null)

  // Debounced catalog lookup: prefill the name and confirm the set.
  useEffect(() => {
    const q = setNumber.trim()
    if (!q) { setMatch(null); setNoMatch(false); return }
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/hurtigscan/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
        })
        const data = await res.json()
        if (cancelled) return
        const first = data.results?.[0]
        if (first?.name) {
          setMatch(first.name)
          setNoMatch(false)
          if (!nameTouched) setName(first.name)
        } else {
          setMatch(null)
          setNoMatch(true)
        }
      } catch {
        if (!cancelled) { setMatch(null); setNoMatch(false) }
      }
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [setNumber, nameTouched])

  const reset = () => {
    setObjectType("INSTRUCTION"); setSetNumber(""); setName(""); setNameTouched(false)
    setLocStr(""); setGrade(null); setMatch(null); setNoMatch(false); setError(null); setDone(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!setNumber.trim()) { setError(c.missingSet); return }
    setSubmitting(true)
    const res = await fetch("/api/register/component", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectType, setNumber, name, locStr, grade }),
    })
    setSubmitting(false)
    if (!res.ok) { setError(c.saveFailed); return }
    setDone(objectType)
    router.refresh()
  }

  if (done) {
    return (
      <div className="sc-register">
        <div className="sheet" style={{ textAlign: "center" }}>
          <div className="sheetbody" style={{ padding: 28 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>
              {done === "INSTRUCTION" ? "📘" : "📦"}
            </div>
            <div className="tt" style={{ marginBottom: 16 }}>
              {done === "INSTRUCTION" ? c.successInstruction : c.successBox}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="btnP" onClick={reset}>{c.addAnother}</button>
              <Link className="btnO" href="/register">{c.done}</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sc-register">
      <Link className="rback" href="/register">{c.back}</Link>

      <div className="sheet">
        <div className="sheethead">
          <div className="tt">{c.title}</div>
          <div className="ts">{c.subtitle}</div>
        </div>

        <form className="sheetbody" onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          {/* Type */}
          <div>
            <label className="lbl3">{c.typeLabel}</label>
            <div className="segmt" role="group" aria-label={c.typeLabel} style={{ marginTop: 6 }}>
              <button
                type="button"
                className={`seg${objectType === "INSTRUCTION" ? " active" : ""}`}
                aria-pressed={objectType === "INSTRUCTION"}
                onClick={() => setObjectType("INSTRUCTION")}
              >
                {c.typeInstruction}
              </button>
              <button
                type="button"
                className={`seg${objectType === "ORIGINAL_BOX" ? " active" : ""}`}
                aria-pressed={objectType === "ORIGINAL_BOX"}
                onClick={() => setObjectType("ORIGINAL_BOX")}
              >
                {c.typeBox}
              </button>
            </div>
          </div>

          {/* Set number */}
          <div>
            <label className="lbl3" htmlFor="setnum">{c.setLabel}</label>
            <input
              id="setnum"
              className="rfield"
              value={setNumber}
              onChange={(e) => setSetNumber(e.target.value)}
              placeholder={c.setPlaceholder}
              inputMode="numeric"
              required
            />
            <div className="hint" style={{ marginTop: 4 }}>
              {match ? c.setFound(match) : noMatch ? c.setNotFound : c.setHint}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="lbl3" htmlFor="cname">{c.nameLabel}</label>
            <input
              id="cname"
              className="rfield"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameTouched(true) }}
              placeholder={c.namePlaceholder}
            />
          </div>

          {/* Location */}
          <div>
            <label className="lbl3" htmlFor="cloc">{c.locationLabel}</label>
            <input
              id="cloc"
              className="rfield"
              value={locStr}
              onChange={(e) => setLocStr(e.target.value)}
              placeholder={c.locationPlaceholder}
            />
          </div>

          {/* Grade */}
          <div>
            <label className="lbl3">{c.gradeLabel}</label>
            <div className="statusctl" style={{ marginTop: 6 }}>
              {GRADES.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={grade === g ? "on" : ""}
                  aria-pressed={grade === g}
                  onClick={() => setGrade((cur) => (cur === g ? null : g))}
                >
                  {GRADE_LABELS[g]}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="hint" role="alert" style={{ color: "var(--brand)" }}>{error}</p>
          )}

          <button className="btnP" type="submit" disabled={submitting || !setNumber.trim()}>
            {submitting ? c.submitting : c.submit}
          </button>
        </form>
      </div>
    </div>
  )
}
