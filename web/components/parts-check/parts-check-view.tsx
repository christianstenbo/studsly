'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Clipboard,
  ClipboardCheck,
  RotateCcw,
  Search,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import type { BlColorMap, InventoryPart, SparePart } from '@/lib/types/parts'

// ─── Typer ────────────────────────────────────────────────────────────────────

type Tab = 'ALL' | 'MISSING' | 'SPARES'
type SortField = 'part_name' | 'color_name' | 'qty_expected' | 'qty_missing'
type SortDir = 'asc' | 'desc'

interface PartsCheckViewProps {
  objectId: string
  setName: string
  setNumber: string | null
  rbSetNum: string | null
  theme: string | null
  year: number | null
  parts: InventoryPart[]
  spares: SparePart[]
  blColors: BlColorMap
}

// ─── Hjelpere ─────────────────────────────────────────────────────────────────

const nf = new Intl.NumberFormat('nb-NO')

function clamp(value: number, max: number): number {
  if (Number.isNaN(value)) return 0
  return Math.min(Math.max(value, 0), max)
}

function partLabel(part: { part_name: string | null; part_num: string }): string {
  return part.part_name ?? part.part_num
}

// ─── Delbilde ─────────────────────────────────────────────────────────────────

function PartThumb({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return <div className="w-10 h-10 rounded bg-gray-100 flex-shrink-0" />
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="w-10 h-10 object-contain rounded bg-gray-50 flex-shrink-0"
      onError={() => setFailed(true)}
    />
  )
}

// ─── Sorteringsikon ───────────────────────────────────────────────────────────

function SortIcon({
  field,
  active,
  dir,
}: {
  field: SortField
  active: SortField
  dir: SortDir
}) {
  if (field !== active) return <ChevronUp size={13} className="text-gray-300 ml-1" />
  return dir === 'asc' ? (
    <ChevronUp size={13} className="text-gray-600 ml-1" />
  ) : (
    <ChevronDown size={13} className="text-gray-600 ml-1" />
  )
}

// ─── Kopieringsknapp ──────────────────────────────────────────────────────────

function CopyButton({
  label,
  getText,
  disabled,
}: {
  label: string
  getText: () => string
  disabled?: boolean
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(getText())
          setCopied(true)
        } catch {
          // Utklippstavlen kan være blokkert — ignorer stille
        }
      }}
      className="gap-1.5"
    >
      {copied ? <ClipboardCheck size={13} /> : <Clipboard size={13} />}
      {copied ? 'Kopiert' : label}
    </Button>
  )
}

// ─── Hovedkomponent ───────────────────────────────────────────────────────────

export function PartsCheckView({
  objectId,
  setName,
  setNumber,
  rbSetNum,
  theme,
  year,
  parts,
  spares,
  blColors,
}: PartsCheckViewProps) {
  const [rows, setRows] = useState<InventoryPart[]>(parts)
  const [tab, setTab] = useState<Tab>('ALL')
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('part_name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [saving, setSaving] = useState(0)
  const [saveError, setSaveError] = useState<string | null>(null)

  const supabase = useMemo(() => createClient(), [])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Rydd opp ventende lagringer når komponenten forsvinner
  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((t) => clearTimeout(t))
      pending.clear()
    }
  }, [])

  // ── Lagring ────────────────────────────────────────────────────────────────

  const persist = useCallback(
    async (rowId: string, qtyPresent: number) => {
      setSaving((n) => n + 1)
      const { error } = await supabase
        .from('inventory_parts')
        .update({ qty_present: qtyPresent })
        .eq('id', rowId)
      setSaving((n) => n - 1)
      setSaveError(error ? 'Kunne ikke lagre. Sjekk nettforbindelsen.' : null)
    },
    [supabase]
  )

  const setPresent = useCallback(
    (rowId: string, qtyPresent: number) => {
      setRows((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, qty_present: qtyPresent } : r))
      )
      const existing = timers.current.get(rowId)
      if (existing) clearTimeout(existing)
      timers.current.set(
        rowId,
        setTimeout(() => {
          timers.current.delete(rowId)
          void persist(rowId, qtyPresent)
        }, 400)
      )
    },
    [persist]
  )

  const setAll = useCallback(
    async (full: boolean) => {
      setRows((prev) =>
        prev.map((r) => ({ ...r, qty_present: full ? r.qty_expected : 0 }))
      )
      setSaving((n) => n + 1)
      const { error } = await supabase.rpc('set_all_parts_present', {
        p_object_id: objectId,
        p_full: full,
      })
      setSaving((n) => n - 1)
      setSaveError(error ? 'Kunne ikke lagre. Sjekk nettforbindelsen.' : null)
    },
    [objectId, supabase]
  )

  // ── Kompletthet ────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    let expected = 0
    let present = 0
    let lotsMissing = 0
    for (const r of rows) {
      expected += r.qty_expected
      present += Math.min(r.qty_present, r.qty_expected)
      if (r.qty_present < r.qty_expected) lotsMissing++
    }
    return {
      expected,
      present,
      missing: expected - present,
      lots: rows.length,
      lotsMissing,
      percent: expected === 0 ? 0 : (present / expected) * 100,
    }
  }, [rows])

  // ── Filtrering + sortering ─────────────────────────────────────────────────

  const visibleRows = useMemo(() => {
    let result = tab === 'MISSING' ? rows.filter((r) => r.qty_present < r.qty_expected) : rows

    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter(
        (r) =>
          (r.part_name ?? '').toLowerCase().includes(q) ||
          r.part_num.toLowerCase().includes(q) ||
          r.color_name.toLowerCase().includes(q)
      )
    }

    return [...result].sort((a, b) => {
      let valA: string | number
      let valB: string | number
      switch (sortField) {
        case 'color_name':
          valA = a.color_name.toLowerCase()
          valB = b.color_name.toLowerCase()
          break
        case 'qty_expected':
          valA = a.qty_expected
          valB = b.qty_expected
          break
        case 'qty_missing':
          valA = a.qty_expected - a.qty_present
          valB = b.qty_expected - b.qty_present
          break
        default:
          valA = partLabel(a).toLowerCase()
          valB = partLabel(b).toLowerCase()
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1
      if (valA > valB) return sortDir === 'asc' ? 1 : -1
      return a.part_num.localeCompare(b.part_num)
    })
  }, [rows, tab, search, sortField, sortDir])

  const visibleSpares = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return spares
    return spares.filter(
      (s) =>
        (s.part_name ?? '').toLowerCase().includes(q) ||
        s.part_num.toLowerCase().includes(q) ||
        (s.color_name ?? '').toLowerCase().includes(q)
    )
  }, [spares, search])

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortField(field)
      setSortDir(field === 'part_name' || field === 'color_name' ? 'asc' : 'desc')
    }
  }

  // ── Want list-eksport ──────────────────────────────────────────────────────

  const missingRows = useMemo(
    () => rows.filter((r) => r.qty_present < r.qty_expected),
    [rows]
  )

  const wantListText = useCallback(
    () =>
      missingRows
        .map((r) => {
          const bl = blColors[r.color_id]
          const blPart = bl?.bl_color_name
            ? `${bl.bl_color_name} (BL ${bl.bl_color_id})`
            : `${r.color_name} (ingen BL-farge)`
          return `${r.qty_expected - r.qty_present}x ${r.part_num} — ${partLabel(r)} — ${blPart}`
        })
        .join('\n'),
    [missingRows, blColors]
  )

  const wantListXml = useCallback(() => {
    const items = missingRows.map((r) => {
      const bl = blColors[r.color_id]
      const color = bl?.bl_color_id != null ? `\n    <COLOR>${bl.bl_color_id}</COLOR>` : ''
      return (
        `  <ITEM>\n    <ITEMTYPE>P</ITEMTYPE>\n    <ITEMID>${r.part_num}</ITEMID>` +
        `${color}\n    <MINQTY>${r.qty_expected - r.qty_present}</MINQTY>\n  </ITEM>`
      )
    })
    return `<INVENTORY>\n${items.join('\n')}\n</INVENTORY>`
  }, [missingRows, blColors])

  // ── Render ─────────────────────────────────────────────────────────────────

  const subtitle = [setNumber, theme, year ? String(year) : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="bg-white rounded-xl border border-gray-200 flex flex-col">
      {/* ── Topp ───────────────────────────────────────────────────────── */}
      <div className="px-6 pt-5 pb-4 border-b border-gray-100">
        <Link
          href="/collection"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={14} />
          Tilbake til samlingen
        </Link>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Delsjekk</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {setName}
              {subtitle && <span className="text-gray-400"> · {subtitle}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAll(true)} className="gap-1.5">
              <Check size={13} />
              Har alle
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAll(false)} className="gap-1.5">
              <RotateCcw size={13} />
              Nullstill
            </Button>
          </div>
        </div>

        {/* Kompletthet */}
        <div className="mt-4">
          <div className="flex items-end justify-between mb-1.5">
            <span className="text-3xl font-semibold text-gray-900 tabular-nums">
              {stats.percent.toFixed(1).replace('.', ',')} %
            </span>
            <span className="text-sm text-gray-500 tabular-nums">
              {nf.format(stats.present)} av {nf.format(stats.expected)} brikker ·{' '}
              {nf.format(stats.lots)} deletyper
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-[#2E5FA3] transition-[width] duration-300"
              style={{ width: `${Math.min(stats.percent, 100)}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-400">
            <span>
              Mangler {nf.format(stats.missing)} brikker i {nf.format(stats.lotsMissing)}{' '}
              deletyper
            </span>
            {rbSetNum && <span>Rebrickable: {rbSetNum}</span>}
            {saving > 0 && <span className="text-gray-500">Lagrer…</span>}
            {saveError && <span className="text-red-500">{saveError}</span>}
          </div>
        </div>
      </div>

      {/* ── Faner ──────────────────────────────────────────────────────── */}
      <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-1">
          {(
            [
              ['ALL', 'Deleliste', rows.length],
              ['MISSING', 'Mangler', stats.lotsMissing],
              ['SPARES', 'Reservedeler', spares.length],
            ] as [Tab, string, number][]
          ).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
              <span
                className={`ml-1.5 text-xs ${
                  tab === key ? 'text-gray-300' : 'text-gray-400'
                }`}
              >
                {nf.format(count)}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Søk på del, nummer, farge…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* ── Want list-eksport ──────────────────────────────────────────── */}
      {tab === 'MISSING' && (
        <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 mr-1">
            Handleliste ({nf.format(missingRows.length)} deletyper):
          </span>
          <CopyButton
            label="Kopier som tekst"
            getText={wantListText}
            disabled={missingRows.length === 0}
          />
          <CopyButton
            label="Kopier BrickLink-XML"
            getText={wantListXml}
            disabled={missingRows.length === 0}
          />
        </div>
      )}

      {/* ── Tabell ─────────────────────────────────────────────────────── */}
      <div className="overflow-auto max-h-[calc(100vh-22rem)]">
        {tab === 'SPARES' ? (
          <SparesTable spares={visibleSpares} />
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white border-b border-gray-100 z-10">
              <tr>
                <th className="w-12 px-6 py-3"></th>
                <th className="text-left px-3 py-3 font-medium text-gray-500">
                  <button
                    onClick={() => toggleSort('part_name')}
                    className="flex items-center hover:text-gray-800"
                  >
                    Del
                    <SortIcon field="part_name" active={sortField} dir={sortDir} />
                  </button>
                </th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 hidden sm:table-cell">
                  <button
                    onClick={() => toggleSort('color_name')}
                    className="flex items-center hover:text-gray-800"
                  >
                    Farge
                    <SortIcon field="color_name" active={sortField} dir={sortDir} />
                  </button>
                </th>
                <th className="text-right px-3 py-3 font-medium text-gray-500">
                  <button
                    onClick={() => toggleSort('qty_expected')}
                    className="flex items-center justify-end hover:text-gray-800 ml-auto"
                  >
                    Skal ha
                    <SortIcon field="qty_expected" active={sortField} dir={sortDir} />
                  </button>
                </th>
                <th className="text-right px-3 py-3 font-medium text-gray-500 w-32">Har</th>
                <th className="text-right px-6 py-3 font-medium text-gray-500 hidden md:table-cell">
                  <button
                    onClick={() => toggleSort('qty_missing')}
                    className="flex items-center justify-end hover:text-gray-800 ml-auto"
                  >
                    Mangler
                    <SortIcon field="qty_missing" active={sortField} dir={sortDir} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    {tab === 'MISSING'
                      ? 'Ingen deler mangler. 🎉'
                      : 'Ingen deler matcher søket.'}
                  </td>
                </tr>
              )}
              {visibleRows.map((row) => {
                const missing = row.qty_expected - row.qty_present
                const bl = blColors[row.color_id]
                return (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="pl-6 pr-2 py-2">
                      <PartThumb src={row.part_img_url} alt={partLabel(row)} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-gray-900 line-clamp-1">{partLabel(row)}</span>
                        <span className="text-xs text-gray-400">{row.part_num}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-gray-700">{row.color_name}</span>
                        {tab === 'MISSING' && (
                          <span className="text-xs text-gray-400">
                            {bl?.bl_color_id != null
                              ? `BL ${bl.bl_color_id} · ${bl.bl_color_name}`
                              : 'ingen BL-farge'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600 tabular-nums">
                      {row.qty_expected}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={row.qty_expected}
                          value={row.qty_present}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) =>
                            setPresent(
                              row.id,
                              clamp(parseInt(e.target.value, 10), row.qty_expected)
                            )
                          }
                          className="w-16 px-2 py-1 text-sm text-right border border-gray-200 rounded-md
                                     tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500
                                     focus:border-transparent"
                        />
                        <button
                          onClick={() => setPresent(row.id, row.qty_expected)}
                          disabled={missing === 0}
                          title="Har alle av denne"
                          className="p-1 rounded-md text-gray-400 hover:text-[#2E5FA3] hover:bg-gray-100
                                     disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <Check size={14} />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-2 text-right tabular-nums hidden md:table-cell">
                      {missing > 0 ? (
                        <span className="font-medium text-orange-600">{missing}</span>
                      ) : (
                        <span className="text-gray-300">–</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Bunn ───────────────────────────────────────────────────────── */}
      <div className="px-6 py-2.5 border-t border-gray-100 text-xs text-gray-400">
        {tab === 'SPARES'
          ? `${nf.format(visibleSpares.length)} reservedeler (teller ikke mot kompletthet)`
          : `Viser ${nf.format(visibleRows.length)} deletyper`}
      </div>
    </div>
  )
}

// ─── Reservedeler ─────────────────────────────────────────────────────────────

function SparesTable({ spares }: { spares: SparePart[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-white border-b border-gray-100 z-10">
        <tr>
          <th className="w-12 px-6 py-3"></th>
          <th className="text-left px-3 py-3 font-medium text-gray-500">Del</th>
          <th className="text-left px-3 py-3 font-medium text-gray-500 hidden sm:table-cell">
            Farge
          </th>
          <th className="text-right px-6 py-3 font-medium text-gray-500">Antall</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {spares.length === 0 && (
          <tr>
            <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
              Dette settet har ingen registrerte reservedeler.
            </td>
          </tr>
        )}
        {spares.map((s) => (
          <tr key={`${s.part_num}-${s.color_id}`} className="hover:bg-gray-50">
            <td className="pl-6 pr-2 py-2">
              <PartThumb src={s.part_img_url} alt={partLabel(s)} />
            </td>
            <td className="px-3 py-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-gray-900 line-clamp-1">{partLabel(s)}</span>
                <span className="text-xs text-gray-400">{s.part_num}</span>
              </div>
            </td>
            <td className="px-3 py-2 hidden sm:table-cell text-gray-700">
              {s.color_name ?? '–'}
            </td>
            <td className="px-6 py-2 text-right text-gray-600 tabular-nums">
              {s.qty_expected}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
