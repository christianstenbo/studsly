"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { strings } from "@/lib/i18n/strings"

const c = strings.register.part

type Colour = { id: number; name: string; rgb: string | null }

/**
 * Flow 1 source — register a loose part into the free pool.
 *
 * Colour is required, not optional. `inventory_parts.color_id` is NOT NULL, so
 * every slot a part could fill has a colour; a loose part registered without one
 * can only ever be matched through the "colour unconfirmed" bucket, which exists
 * to rescue legacy rows, not to be fed by new ones.
 *
 * Quantity is a count on ONE row, not N rows (v4 M4). Ten black 1x2 bricks are
 * one object with quantity = 10.
 */
export function PartForm() {
  const router = useRouter()
  const supabase = useState(() => createClient())[0]

  const [partNum, setPartNum] = useState("")
  const [name, setName] = useState("")
  const [nameTouched, setNameTouched] = useState(false)
  const [colour, setColour] = useState<Colour | null>(null)
  const [colourQuery, setColourQuery] = useState("")
  const [colours, setColours] = useState<Colour[]>([])
  const [colourOpen, setColourOpen] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [locStr, setLocStr] = useState("")
  const [subLocation, setSubLocation] = useState("")
  const [lookup, setLookup] = useState<string | null>(null)
  const [noMatch, setNoMatch] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const colourBox = useRef<HTMLDivElement>(null)

  // Colour list from the catalogue. Loaded up front so the field is usable
  // before typing; filtered server-side once there is a query.
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      let q = supabase.from("rb_colors").select("id, name, rgb").order("name").limit(30)
      const term = colourQuery.trim()
      if (term) q = q.ilike("name", `%${term}%`)
      const { data } = await q
      if (!cancelled) setColours((data as Colour[]) ?? [])
    }, 180)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [colourQuery, supabase])

  // Part name lookup from the catalogue — prefill only, never authoritative.
  useEffect(() => {
    const q = partNum.trim()
    if (!q) {
      setLookup(null)
      setNoMatch(false)
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("rb_parts")
        .select("part_num, name")
        .eq("part_num", q)
        .maybeSingle()
      if (cancelled) return
      if (data?.name) {
        setLookup(data.name as string)
        setNoMatch(false)
        if (!nameTouched) setName(data.name as string)
      } else {
        setLookup(null)
        setNoMatch(true)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [partNum, nameTouched, supabase])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (colourBox.current && !colourBox.current.contains(e.target as Node)) {
        setColourOpen(false)
      }
    }
    window.addEventListener("mousedown", onDown)
    return () => window.removeEventListener("mousedown", onDown)
  }, [])

  const reset = () => {
    setPartNum("")
    setName("")
    setNameTouched(false)
    setColour(null)
    setColourQuery("")
    setQuantity(1)
    setSubLocation("")
    setLookup(null)
    setNoMatch(false)
    setError(null)
    setDone(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!partNum.trim()) {
      setError(c.missingPart)
      return
    }
    // colour.id can legitimately be 0 (Black) — check the object, not the id.
    if (!colour) {
      setError(c.missingColour)
      return
    }
    setSubmitting(true)
    const res = await fetch("/api/register/part", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partNum,
        colorId: colour.id,
        colorName: colour.name,
        name,
        quantity,
        locStr,
        subLocation,
      }),
    })
    setSubmitting(false)
    if (!res.ok) {
      setError(c.saveFailed)
      return
    }
    const data = await res.json()
    setDone(data.ownershipId ?? null)
    router.refresh()
  }

  if (done !== null) {
    return (
      <div className="sc-register">
        <div className="sheet" style={{ textAlign: "center" }}>
          <div className="sheetbody" style={{ padding: 28 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>◱</div>
            <div className="tt" style={{ marginBottom: 6 }}>{c.success}</div>
            <div className="hint" style={{ marginBottom: 16 }}>
              {done ? c.successId(done) : c.successSub}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="btnP" onClick={reset}>{c.addAnother}</button>
              <Link className="btnO" href="/collection">{c.viewPool}</Link>
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
          {/* Part number */}
          <div>
            <label className="lbl3" htmlFor="partnum">{c.partLabel}</label>
            <input
              id="partnum"
              className="rfield"
              value={partNum}
              onChange={(e) => setPartNum(e.target.value)}
              placeholder={c.partPlaceholder}
              autoFocus
              required
            />
            <div className="hint" style={{ marginTop: 4 }}>
              {lookup ? c.partFound(lookup) : noMatch ? c.partNotFound : c.partHint}
            </div>
          </div>

          {/* Colour — required */}
          <div ref={colourBox} style={{ position: "relative" }}>
            <label className="lbl3">{c.colourLabel}</label>
            <button
              type="button"
              className="rfield"
              onClick={() => setColourOpen((v) => !v)}
              aria-expanded={colourOpen}
              style={{ display: "flex", alignItems: "center", gap: 8, textAlign: "left", cursor: "pointer" }}
            >
              {colour ? (
                <>
                  <i
                    aria-hidden
                    style={{
                      width: 13, height: 13, borderRadius: 4, flex: "0 0 auto",
                      background: colour.rgb ? `#${colour.rgb}` : "var(--track)",
                      boxShadow: "inset 0 0 0 1px rgba(0,0,0,.12)",
                    }}
                  />
                  {colour.name}
                </>
              ) : (
                <span style={{ color: "var(--faint)" }}>{c.colourPlaceholder}</span>
              )}
            </button>
            <div className="hint" style={{ marginTop: 4 }}>{c.colourHint}</div>

            {colourOpen && (
              <div
                style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                  background: "#fff", border: "1px solid var(--line)", borderRadius: 12,
                  boxShadow: "0 12px 30px rgba(15,23,42,.16)", padding: 8, marginTop: 4,
                }}
              >
                <input
                  autoFocus
                  value={colourQuery}
                  onChange={(e) => setColourQuery(e.target.value)}
                  placeholder={c.colourSearch}
                  className="rfield"
                  style={{ marginBottom: 6 }}
                />
                <div style={{ maxHeight: 220, overflowY: "auto" }}>
                  {colours.map((col) => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => {
                        setColour(col)
                        setColourOpen(false)
                        setColourQuery("")
                      }}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, width: "100%",
                        textAlign: "left", background: "transparent", border: 0, font: "inherit",
                        fontSize: 13, color: "var(--ink2)", padding: "7px 8px", borderRadius: 8,
                        cursor: "pointer",
                      }}
                    >
                      <i
                        aria-hidden
                        style={{
                          width: 13, height: 13, borderRadius: 4, flex: "0 0 auto",
                          background: col.rgb ? `#${col.rgb}` : "var(--track)",
                          boxShadow: "inset 0 0 0 1px rgba(0,0,0,.12)",
                        }}
                      />
                      {col.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="lbl3" htmlFor="pname">{c.nameLabel}</label>
            <input
              id="pname"
              className="rfield"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setNameTouched(true)
              }}
              placeholder={c.namePlaceholder}
            />
          </div>

          {/* Quantity — one row with a count, not N rows */}
          <div>
            <label className="lbl3" htmlFor="pqty">{c.quantityLabel}</label>
            <input
              id="pqty"
              className="rfield"
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
              style={{ maxWidth: 120 }}
            />
            <div className="hint" style={{ marginTop: 4 }}>{c.quantityHint}</div>
          </div>

          {/* Location */}
          <div>
            <label className="lbl3" htmlFor="ploc">{c.locationLabel}</label>
            <input
              id="ploc"
              className="rfield"
              value={locStr}
              onChange={(e) => setLocStr(e.target.value)}
              placeholder={c.locationPlaceholder}
            />
          </div>

          <div>
            <label className="lbl3" htmlFor="psub">{c.subLocationLabel}</label>
            <input
              id="psub"
              className="rfield"
              value={subLocation}
              onChange={(e) => setSubLocation(e.target.value)}
              placeholder={c.subLocationPlaceholder}
            />
          </div>

          {error && (
            <p className="hint" role="alert" style={{ color: "var(--brand)" }}>{error}</p>
          )}

          <button
            className="btnP"
            type="submit"
            disabled={submitting || !partNum.trim() || !colour}
          >
            {submitting ? c.submitting : c.submit}
          </button>
        </form>
      </div>
    </div>
  )
}
