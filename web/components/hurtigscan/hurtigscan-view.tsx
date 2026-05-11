"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle, Zap, ChevronRight, ArrowLeft, MapPin, X } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = 1 | 2 | 3 | 4 | 5
type Mode = "SET" | "MINIFIG"

interface Location {
  l1: string
  l2: string
  l3: string
  l4: string
}

interface SetData {
  set_num: string
  name: string
  year?: number | null
  num_parts?: number | null
  set_img_url?: string | null
  obj_type: Mode
}

interface AiResult {
  type_guess: string
  set_number?: string | null
  confidence: "high" | "medium" | "low"
  wear_level?: string | null
}

interface SearchResult {
  set_num: string
  name: string
  year?: number | null
  num_parts?: number | null
  set_img_url?: string | null
}

interface HsSession {
  screen: Screen
  mode: Mode
  loc: Location
  imgDataUrl: string | null
  imgBase64: string | null
  mediaType: string | null
  aiResult: AiResult | null
  setData: SetData | null
  condition: string
  wearLevel: string | null
  searchQuery: string
  searchResults: SearchResult[] | null
  lastOwnershipId: string | null
  lastSetName: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONDITIONS: Record<string, string> = {
  SEALED: "Forseglet",
  OPENED: "Ubygget (åpnet)",
  BUILT: "Bygget",
  USED: "Brukt",
  INCOMPLETE: "Ufullstendig",
}

const WEAR_LEVELS: Record<string, string> = {
  MINT: "Som ny",
  NEAR_MINT: "Nesten som ny",
  VERY_GOOD: "Meget god",
  GOOD: "God",
  FAIR: "Akseptabel",
}

const WEAR_RELEVANT = new Set(["OPENED", "BUILT", "USED", "INCOMPLETE"])

const INIT: HsSession = {
  screen: 1,
  mode: "SET",
  loc: { l1: "", l2: "", l3: "", l4: "" },
  imgDataUrl: null,
  imgBase64: null,
  mediaType: null,
  aiResult: null,
  setData: null,
  condition: "BUILT",
  wearLevel: null,
  searchQuery: "",
  searchResults: null,
  lastOwnershipId: null,
  lastSetName: null,
}

function buildLocStr(loc: Location): string {
  return [loc.l1, loc.l2, loc.l3, loc.l4].filter(Boolean).join(" / ")
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function HurtigscanView() {
  const [session, setSession] = useState<HsSession>(INIT)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locSuggestions, setLocSuggestions] = useState<Record<string, string[]>>({
    l1: [],
    l2: [],
    l3: [],
    l4: [],
  })

  const update = useCallback((patch: Partial<HsSession>) => {
    setSession((s) => ({ ...s, ...patch }))
  }, [])

  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((data) => {
        if (data.l1) setLocSuggestions(data)
      })
      .catch(() => {})
  }, [])

  const clearScan = () => {
    update({
      imgDataUrl: null,
      imgBase64: null,
      mediaType: null,
      aiResult: null,
      setData: null,
      condition: "BUILT",
      wearLevel: null,
      searchQuery: "",
      searchResults: null,
    })
  }

  const endSession = () => setSession(INIT)

  // ── Image upload → AI identification ────────────────────────────────────────
  const handleImage = (file: File) => {
    setLoading(true)
    setError(null)
    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
      const base64 = dataUrl.split(",")[1]
      const mediaType = file.type || "image/jpeg"

      update({ imgDataUrl: dataUrl, imgBase64: base64, mediaType, screen: 2 })

      try {
        const res = await fetch("/api/hurtigscan/identify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mediaType }),
        })
        const data = await res.json()
        update({
          aiResult: data.aiResult,
          setData: data.setData ?? null,
          wearLevel: data.aiResult?.wear_level ?? null,
          screen: data.screen,
        })
      } catch {
        setError("Klarte ikke å analysere bildet. Prøv igjen.")
        update({ screen: 2 })
      } finally {
        setLoading(false)
      }
    }
    reader.readAsDataURL(file)
  }

  // ── Text search ──────────────────────────────────────────────────────────────
  const handleSearch = async (query: string) => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/hurtigscan/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      })
      const data = await res.json()
      update({ searchResults: data.results ?? [], searchQuery: query, screen: 5 })
    } catch {
      setError("Søket feilet. Prøv igjen.")
    } finally {
      setLoading(false)
    }
  }

  // ── Pick result from Screen 5 ────────────────────────────────────────────────
  const handlePickResult = (result: SearchResult) => {
    const setData: SetData = {
      set_num: result.set_num,
      name: result.name,
      year: result.year,
      num_parts: result.num_parts,
      set_img_url: result.set_img_url,
      obj_type: session.mode,
    }
    update({
      setData,
      condition: session.mode === "MINIFIG" ? "USED" : "BUILT",
      screen: 3,
    })
  }

  // ── Save to Supabase ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!session.setData) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/hurtigscan/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setData: session.setData,
          condition: session.condition,
          wearLevel: WEAR_RELEVANT.has(session.condition) ? session.wearLevel : null,
          locStr: buildLocStr(session.loc),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      update({
        lastOwnershipId: data.ownershipId,
        lastSetName: session.setData.name,
        screen: 4,
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Ukjent feil"
      setError(`Lagring feilet: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  const handleNext = () => {
    clearScan()
    update({ lastOwnershipId: null, lastSetName: null, screen: 2 })
  }

  return (
    <div className="max-w-2xl mx-auto">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="shrink-0 hover:opacity-70"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {session.screen === 1 && (
        <Screen1
          session={session}
          update={update}
          locSuggestions={locSuggestions}
        />
      )}
      {session.screen === 2 && (
        <Screen2
          session={session}
          loading={loading}
          onImage={handleImage}
          onSearch={handleSearch}
          onEnd={endSession}
          update={update}
        />
      )}
      {session.screen === 3 && (
        <Screen3
          session={session}
          loading={loading}
          onSave={handleSave}
          onCorrect={() =>
            update({ setData: null, searchResults: null, searchQuery: "", screen: 5 })
          }
          onEnd={endSession}
          update={update}
        />
      )}
      {session.screen === 4 && (
        <Screen4 session={session} onNext={handleNext} onEnd={endSession} />
      )}
      {session.screen === 5 && (
        <Screen5
          session={session}
          loading={loading}
          onSearch={handleSearch}
          onPick={handlePickResult}
          onBack={() => update({ searchResults: null, searchQuery: "", screen: 2 })}
          onEnd={endSession}
          update={update}
        />
      )}
    </div>
  )
}

// ─── LocationChips ────────────────────────────────────────────────────────────

function LocationChips({ loc }: { loc: Location }) {
  const parts = [loc.l1, loc.l2, loc.l3, loc.l4].filter(Boolean)
  if (!parts.length) return null
  return (
    <div className="flex items-center flex-wrap gap-1 min-w-0">
      <MapPin size={13} className="text-[#2E5FA3] shrink-0" />
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="bg-[#2E5FA3]/10 text-[#2E5FA3] rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap">
            {p}
          </span>
          {i < parts.length - 1 && (
            <ChevronRight size={12} className="text-gray-400 shrink-0" />
          )}
        </span>
      ))}
    </div>
  )
}

// ─── Screen 1: Session + Location ────────────────────────────────────────────

function Screen1({
  session,
  update,
  locSuggestions,
}: {
  session: HsSession
  update: (p: Partial<HsSession>) => void
  locSuggestions: Record<string, string[]>
}) {
  const hasL1 = Boolean(session.loc.l1.trim())

  const locInput = (
    level: keyof Location,
    label: string,
    placeholder: string,
    required?: boolean
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type="text"
        list={`loc-${level}-list`}
        value={session.loc[level]}
        onChange={(e) => update({ loc: { ...session.loc, [level]: e.target.value } })}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5FA3]/30 focus:border-[#2E5FA3] bg-white"
      />
      <datalist id={`loc-${level}-list`}>
        {locSuggestions[level]?.map((s) => <option key={s} value={s} />)}
      </datalist>
    </div>
  )

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Zap size={20} className="text-[#2E5FA3]" />
        <h1 className="text-xl font-semibold text-gray-900">Hurtigscan</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Lokasjonen du velger gjelder for alle objekter i denne sesjonen.
      </p>

      {/* Mode selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Hva skal registreres?
        </label>
        <div className="flex gap-2">
          {(["SET", "MINIFIG"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => update({ mode: m })}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border transition-colors ${
                session.mode === m
                  ? "bg-[#2E5FA3] text-white border-[#2E5FA3]"
                  : "bg-white text-gray-700 border-gray-200 hover:border-[#2E5FA3]/40"
              }`}
            >
              {m === "SET" ? "🧱 Sett" : "👾 Minifig"}
            </button>
          ))}
        </div>
      </div>

      {/* Location pickers */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Velg lokasjon
        </label>
        <div className="grid grid-cols-2 gap-3">
          {locInput("l1", "Sted", "Bod, Stue, Kontor …", true)}
          {locInput("l2", "Enhet", "Hylle A, Vitrineskap …")}
          {locInput("l3", "Posisjon", "1, 2, Rad 2 …")}
          {locInput("l4", "Beholder", "Eske A, Pose 3 …")}
        </div>
      </div>

      {session.loc.l1 && (
        <div className="mb-4">
          <LocationChips loc={session.loc} />
        </div>
      )}

      <Button onClick={() => update({ screen: 2 })} disabled={!hasL1} className="w-full">
        Start registrering
      </Button>
      {!hasL1 && (
        <p className="text-xs text-gray-400 text-center mt-2">
          Sted er obligatorisk for å starte
        </p>
      )}
    </div>
  )
}

// ─── Screen 2: Input ──────────────────────────────────────────────────────────

function Screen2({
  session,
  loading,
  onImage,
  onSearch,
  onEnd,
  update,
}: {
  session: HsSession
  loading: boolean
  onImage: (f: File) => void
  onSearch: (q: string) => void
  onEnd: () => void
  update: (p: Partial<HsSession>) => void
}) {
  const [query, setQuery] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const modeLabel = session.mode === "SET" ? "sett" : "minifig"
  const placeholder =
    session.mode === "SET"
      ? "Settnummer eller navn (norsk støttes) …"
      : "Figurkode eller navn (f.eks. 'sw0001' eller 'Darth Vader') …"

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <LocationChips loc={session.loc} />
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => update({ screen: 1 })}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
          >
            Endre
          </button>
          <button
            onClick={onEnd}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
          >
            Avslutt
          </button>
        </div>
      </div>
      <hr className="border-gray-100 mb-5" />

      {/* Image upload area */}
      <p className="text-sm font-medium text-gray-700 mb-2">📷 Skann {modeLabel}</p>
      <button
        onClick={() => fileRef.current?.click()}
        disabled={loading}
        className="w-full border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-[#2E5FA3]/40 hover:bg-[#2E5FA3]/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="text-sm text-gray-500">Analyserer bilde …</span>
        ) : (
          <>
            <div className="text-3xl mb-1">📷</div>
            <p className="text-sm text-gray-600">Ta bilde eller velg fra bibliotek</p>
            <p className="text-xs text-gray-400 mt-1">JPG · PNG · WebP</p>
          </>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onImage(e.target.files[0])}
      />

      {/* Divider */}
      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-100" />
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 bg-gray-50 text-xs text-gray-400">eller søk manuelt</span>
        </div>
      </div>

      {/* Text search */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch(query)}
          placeholder={placeholder}
          disabled={loading}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5FA3]/30 focus:border-[#2E5FA3] disabled:opacity-50"
        />
        <Button
          onClick={() => onSearch(query)}
          disabled={loading || !query.trim()}
        >
          Søk
        </Button>
      </div>
    </div>
  )
}

// ─── Screen 3: ID Card ────────────────────────────────────────────────────────

function Screen3({
  session,
  loading,
  onSave,
  onCorrect,
  onEnd,
  update,
}: {
  session: HsSession
  loading: boolean
  onSave: () => void
  onCorrect: () => void
  onEnd: () => void
  update: (p: Partial<HsSession>) => void
}) {
  const sd = session.setData
  if (!sd) return null

  const conf = session.aiResult?.confidence
  const confLabel =
    conf === "high"
      ? "Bildekvalitet: God"
      : conf === "medium"
        ? "Bildekvalitet: Middels"
        : conf === "low"
          ? "Bildekvalitet: Lav"
          : null
  const confColor =
    conf === "high"
      ? "bg-green-700"
      : conf === "medium"
        ? "bg-orange-600"
        : "bg-red-700"

  const showWear = WEAR_RELEVANT.has(session.condition)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <LocationChips loc={session.loc} />
        <button
          onClick={onEnd}
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 shrink-0"
        >
          Avslutt
        </button>
      </div>
      <hr className="border-gray-100 mb-4" />

      {confLabel && (
        <span
          className={`inline-block ${confColor} text-white text-xs rounded-full px-2.5 py-0.5 mb-3`}
        >
          {confLabel}
        </span>
      )}

      {/* Images side by side */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-xs text-gray-400 mb-1.5">Ditt bilde</p>
          {session.imgDataUrl ? (
            <img
              src={session.imgDataUrl}
              alt="Opplastet"
              className="w-full rounded-lg object-cover aspect-square"
            />
          ) : (
            <div className="w-full rounded-lg bg-gray-100 aspect-square flex items-center justify-center text-gray-400 text-sm">
              Ingen bilde
            </div>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1.5">Referansebilde</p>
          {sd.set_img_url ? (
            <img
              src={sd.set_img_url}
              alt="Referanse"
              className="w-full rounded-lg object-contain aspect-square bg-gray-50"
            />
          ) : (
            <div className="w-full rounded-lg bg-gray-100 aspect-square flex items-center justify-center text-gray-400 text-sm">
              Ingen bilde
            </div>
          )}
        </div>
      </div>

      {/* Set info */}
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">{sd.name}</h2>
        <p className="text-sm text-gray-500">
          {[sd.set_num, sd.year, sd.num_parts ? `${sd.num_parts} deler` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      {/* Condition + Wear */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tilstand</label>
          <select
            value={session.condition}
            onChange={(e) => update({ condition: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5FA3]/30"
          >
            {Object.entries(CONDITIONS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Slitasje</label>
          <select
            value={showWear ? (session.wearLevel ?? "") : ""}
            onChange={(e) => update({ wearLevel: e.target.value || null })}
            disabled={!showWear}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5FA3]/30 disabled:opacity-40 disabled:bg-gray-50"
          >
            <option value="">– Ikke satt –</option>
            {Object.entries(WEAR_LEVELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onCorrect}
          disabled={loading}
          className="flex-1"
        >
          Korriger
        </Button>
        <Button onClick={onSave} disabled={loading} className="flex-[2]">
          {loading ? "Lagrer …" : "OK →"}
        </Button>
      </div>
    </div>
  )
}

// ─── Screen 4: Confirmation ───────────────────────────────────────────────────

function Screen4({
  session,
  onNext,
  onEnd,
}: {
  session: HsSession
  onNext: () => void
  onEnd: () => void
}) {
  return (
    <div className="text-center py-10">
      <div className="flex justify-center mb-5">
        <CheckCircle size={80} className="text-green-500" strokeWidth={1.5} />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">{session.lastSetName}</h2>
      <p className="text-sm text-gray-500 mb-1">📍 {buildLocStr(session.loc)}</p>
      <p className="text-sm font-semibold text-[#2E5FA3] mb-10">
        Registrert som {session.lastOwnershipId}
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onEnd} className="flex-1">
          Avslutt
        </Button>
        <Button onClick={onNext} className="flex-[2]">
          Registrer neste
        </Button>
      </div>
    </div>
  )
}

// ─── Screen 5: Not Found / Manual Search ─────────────────────────────────────

function Screen5({
  session,
  loading,
  onSearch,
  onPick,
  onBack,
  onEnd,
}: {
  session: HsSession
  loading: boolean
  onSearch: (q: string) => void
  onPick: (r: SearchResult) => void
  onBack: () => void
  onEnd: () => void
  update: (p: Partial<HsSession>) => void
}) {
  const [query, setQuery] = useState(session.searchQuery ?? "")

  const objLabel = session.mode === "SET" ? "settet" : "minifiguren"
  const placeholder =
    session.mode === "SET"
      ? "Settnummer eller navn (f.eks. 'Ringenes Herre') …"
      : "Figurkode eller navn (f.eks. 'sw0001' eller 'Darth Vader') …"

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <LocationChips loc={session.loc} />
        <button
          onClick={onEnd}
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 shrink-0"
        >
          Avslutt
        </button>
      </div>
      <hr className="border-gray-100 mb-5" />

      {session.imgDataUrl && (
        <div className="flex items-start gap-3 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <img
            src={session.imgDataUrl}
            alt=""
            className="w-12 h-12 rounded object-cover shrink-0"
          />
          <p className="text-sm text-amber-800">
            Vi gjenkjente ikke {objLabel} fra bildet. Søk manuelt nedenfor.
          </p>
        </div>
      )}

      <p className="text-sm font-medium text-gray-700 mb-2">Søk etter {objLabel}</p>
      <div className="flex gap-2 mb-5">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch(query)}
          placeholder={placeholder}
          disabled={loading}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5FA3]/30 focus:border-[#2E5FA3] disabled:opacity-50"
        />
        <Button onClick={() => onSearch(query)} disabled={loading || !query.trim()}>
          Søk
        </Button>
      </div>

      {/* No results */}
      {session.searchResults !== null && session.searchResults.length === 0 && (
        <div className="text-center py-6 text-gray-500">
          <p className="text-sm font-medium">Ikke funnet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Dette ble ikke lagret. Prøv et annet søkeord.
          </p>
        </div>
      )}

      {/* Results list */}
      {session.searchResults && session.searchResults.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-3">
            {session.searchResults.length} treff — velg riktig {objLabel}:
          </p>
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
            {session.searchResults.map((r) => (
              <div key={r.set_num} className="flex items-center gap-3 p-3 bg-white">
                {r.set_img_url ? (
                  <img
                    src={r.set_img_url}
                    alt=""
                    className="w-12 h-12 object-contain rounded bg-gray-50 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-lg shrink-0">
                    🧱
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                  <p className="text-xs text-gray-500">
                    {r.set_num}
                    {r.year ? ` · ${r.year}` : ""}
                    {r.num_parts ? ` · ${r.num_parts} deler` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onPick(r)}
                  disabled={loading}
                >
                  Velg
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onBack}
        className="flex items-center gap-1.5 mt-5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={14} />
        Tilbake til skanning
      </button>
    </div>
  )
}
