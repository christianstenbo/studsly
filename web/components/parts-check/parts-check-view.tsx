'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clipboard,
  ClipboardCheck,
  RotateCcw,
  Search,
  User,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import type {
  BlColorMap,
  InventoryPart,
  MinifigPart,
  ObjectMinifig,
  ResolvedSetInfo,
  SparePart,
} from '@/lib/types/parts'
import { strings } from '@/lib/i18n/strings'

const t = strings.partsCheck

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'ALL' | 'MISSING' | 'SPARES'
type SortField = 'part_name' | 'color_name' | 'qty_expected' | 'qty_missing'
type SortDir = 'asc' | 'desc'

interface PartsCheckViewProps {
  objectId: string
  setName: string
  setNumber: string | null
  theme: string | null
  year: number | null
  setImageUrl: string | null
  resolved: ResolvedSetInfo
  parts: InventoryPart[]
  spares: SparePart[]
  minifigs: ObjectMinifig[]
  figParts: MinifigPart[]
  blColors: BlColorMap
}

/** What the part detail popup shows. */
interface PartDetail {
  imgUrl: string | null
  name: string
  partNum: string
  colorName: string | null
  blColorId: number | null
  blColorName: string | null
  qtyExpected: number
  qtyPresent?: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const nf = new Intl.NumberFormat('en-US')

function clamp(value: number, max: number): number {
  if (Number.isNaN(value)) return 0
  return Math.min(Math.max(value, 0), max)
}

function partLabel(part: { part_name: string | null; part_num: string }): string {
  return part.part_name ?? part.part_num
}

function figLabel(fig: { fig_name: string | null; fig_num: string }): string {
  return fig.fig_name ?? fig.fig_num
}

// ─── Images ───────────────────────────────────────────────────────────────────

function PartThumb({
  src,
  alt,
  size = 'md',
  onClick,
}: {
  src: string | null
  alt: string
  size?: 'md' | 'lg'
  onClick?: () => void
}) {
  const [failed, setFailed] = useState(false)
  const box = size === 'lg' ? 'w-14 h-14' : 'w-10 h-10'

  if (!src || failed) {
    return <div className={`${box} rounded bg-gray-100 flex-shrink-0`} />
  }

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`${box} object-contain rounded bg-gray-50 flex-shrink-0`}
      onError={() => setFailed(true)}
    />
  )

  if (!onClick) return img

  return (
    <button
      onClick={onClick}
      title={t.detail.enlarge}
      className="rounded hover:ring-2 hover:ring-[#2E5FA3]/40 transition-shadow"
    >
      {img}
    </button>
  )
}

/** Popup with a large image and key facts about the part. */
function PartDetailDialog({
  detail,
  onClose,
}: {
  detail: PartDetail
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="pr-4">
            <h3 className="font-medium text-gray-900 leading-snug">{detail.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{detail.partNum}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            aria-label={t.detail.close}
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 flex justify-center bg-gray-50">
          {detail.imgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={detail.imgUrl}
              alt={detail.name}
              className="max-h-64 object-contain"
            />
          ) : (
            <div className="h-40 flex items-center justify-center text-sm text-gray-400">
              {t.detail.noImage}
            </div>
          )}
        </div>

        <dl className="px-5 py-4 text-sm grid grid-cols-2 gap-y-2">
          <dt className="text-gray-500">{t.detail.color}</dt>
          <dd className="text-gray-900 text-right">
            {detail.colorName ?? strings.common.none}
          </dd>

          <dt className="text-gray-500">{t.detail.blColor}</dt>
          <dd className="text-gray-900 text-right">
            {detail.blColorId != null
              ? `${detail.blColorName} (${detail.blColorId})`
              : strings.common.none}
          </dd>

          <dt className="text-gray-500">{t.detail.expected}</dt>
          <dd className="text-gray-900 text-right tabular-nums">{detail.qtyExpected}</dd>

          {detail.qtyPresent !== undefined && (
            <>
              <dt className="text-gray-500">{t.detail.have}</dt>
              <dd className="text-gray-900 text-right tabular-nums">{detail.qtyPresent}</dd>
            </>
          )}
        </dl>
      </div>
    </div>
  )
}

// ─── Sort icon ───────────────────────────────────────────────────────────

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

// ─── Copy button ──────────────────────────────────────────────────────────

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
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
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
          // The clipboard can be blocked — fail silently
        }
      }}
      className="gap-1.5"
    >
      {copied ? <ClipboardCheck size={13} /> : <Clipboard size={13} />}
      {copied ? t.copied : label}
    </Button>
  )
}

// ─── Minifigure block ───────────────────────────────────────────────────────────

function MinifigRow({
  fig,
  parts,
  expanded,
  onToggle,
  onSetPresent,
  onShowPart,
}: {
  fig: ObjectMinifig
  parts: MinifigPart[]
  expanded: boolean
  onToggle: () => void
  onSetPresent: (qty: number) => void
  onShowPart: (detail: PartDetail) => void
}) {
  const complete = fig.qty_present >= fig.qty_expected

  return (
    <div className="border-b border-gray-50 last:border-b-0">
      <div className="flex items-center gap-3 px-6 py-2.5 hover:bg-gray-50 transition-colors">
        <button
          onClick={onToggle}
          className="p-0.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          aria-label={expanded ? t.minifigHideParts : t.minifigShowParts}
        >
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>

        <PartThumb
          src={fig.fig_img_url}
          alt={figLabel(fig)}
          size="lg"
          onClick={() =>
            onShowPart({
              imgUrl: fig.fig_img_url,
              name: figLabel(fig),
              partNum: fig.fig_num,
              colorName: t.minifigSources[fig.source],
              blColorId: null,
              blColorName: null,
              qtyExpected: fig.qty_expected,
              qtyPresent: fig.qty_present,
            })
          }
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-gray-900 line-clamp-1">{figLabel(fig)}</span>
            {complete && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-green-100 text-green-700">
                {t.minifigComplete}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>{fig.fig_num}</span>
            <span>·</span>
            <span>{t.minifigPartsCount(fig.fig_num_parts)}</span>
            <span>·</span>
            <span>{t.minifigSources[fig.source]}</span>
          </div>
        </div>

        <span className="text-sm text-gray-600 tabular-nums">{fig.qty_expected}</span>

        <div className="flex items-center gap-1.5 w-32 justify-end">
          <input
            type="number"
            min={0}
            max={fig.qty_expected}
            value={fig.qty_present}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) =>
              onSetPresent(clamp(parseInt(e.target.value, 10), fig.qty_expected))
            }
            className="w-16 px-2 py-1 text-sm text-right border border-gray-200 rounded-md
                       tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500
                       focus:border-transparent"
          />
          <button
            onClick={() => onSetPresent(fig.qty_expected)}
            disabled={complete}
            title={t.minifigHaveAll}
            className="p-1 rounded-md text-gray-400 hover:text-[#2E5FA3] hover:bg-gray-100
                       disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Check size={14} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="bg-gray-50/70 px-6 py-2 border-t border-gray-100">
          {parts.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">
              {t.minifigNoParts}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {parts.map((p, i) => (
                <li
                  key={`${p.part_num}-${p.color_id}-${i}`}
                  className="flex items-center gap-3 py-1.5"
                >
                  <PartThumb
                    src={p.part_img_url}
                    alt={partLabel(p)}
                    onClick={() =>
                      onShowPart({
                        imgUrl: p.part_img_url,
                        name: partLabel(p),
                        partNum: p.part_num,
                        colorName: p.color_name,
                        blColorId: null,
                        blColorName: null,
                        qtyExpected: p.quantity,
                      })
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-700 line-clamp-1">
                      {partLabel(p)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {p.part_num} · {p.color_name ?? strings.common.none}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500 tabular-nums">
                    {p.quantity}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PartsCheckView({
  objectId,
  setName,
  setNumber,
  theme,
  year,
  setImageUrl,
  resolved,
  parts,
  spares,
  minifigs,
  figParts,
  blColors,
}: PartsCheckViewProps) {
  const [rows, setRows] = useState<InventoryPart[]>(parts)
  const [figs, setFigs] = useState<ObjectMinifig[]>(minifigs)
  const [tab, setTab] = useState<Tab>('ALL')
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('part_name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [expandedFigs, setExpandedFigs] = useState<Set<string>>(new Set())
  const [detail, setDetail] = useState<PartDetail | null>(null)
  const [saving, setSaving] = useState(0)
  const [saveError, setSaveError] = useState<string | null>(null)

  const supabase = useMemo(() => createClient(), [])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((t) => clearTimeout(t))
      pending.clear()
    }
  }, [])

  // ── Saving ────────────────────────────────────────────────────────────────

  const persist = useCallback(
    async (table: 'inventory_parts' | 'object_minifigs', rowId: string, qty: number) => {
      setSaving((n) => n + 1)
      const { error } = await supabase
        .from(table)
        .update({ qty_present: qty })
        .eq('id', rowId)
      setSaving((n) => n - 1)
      setSaveError(error ? strings.common.saveFailed : null)
    },
    [supabase]
  )

  const schedule = useCallback(
    (table: 'inventory_parts' | 'object_minifigs', rowId: string, qty: number) => {
      const key = `${table}:${rowId}`
      const existing = timers.current.get(key)
      if (existing) clearTimeout(existing)
      timers.current.set(
        key,
        setTimeout(() => {
          timers.current.delete(key)
          void persist(table, rowId, qty)
        }, 400)
      )
    },
    [persist]
  )

  const setPartPresent = useCallback(
    (rowId: string, qty: number) => {
      setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, qty_present: qty } : r)))
      schedule('inventory_parts', rowId, qty)
    },
    [schedule]
  )

  const setFigPresent = useCallback(
    (figId: string, qty: number) => {
      setFigs((prev) => prev.map((f) => (f.id === figId ? { ...f, qty_present: qty } : f)))
      schedule('object_minifigs', figId, qty)
    },
    [schedule]
  )

  const setAll = useCallback(
    async (full: boolean) => {
      setRows((prev) => prev.map((r) => ({ ...r, qty_present: full ? r.qty_expected : 0 })))
      setFigs((prev) => prev.map((f) => ({ ...f, qty_present: full ? f.qty_expected : 0 })))
      setSaving((n) => n + 1)
      const { error } = await supabase.rpc('set_all_parts_present', {
        p_object_id: objectId,
        p_full: full,
      })
      setSaving((n) => n - 1)
      setSaveError(error ? strings.common.saveFailed : null)
    },
    [objectId, supabase]
  )

  // ── Completeness (loose parts + minifigure parts) ──────────────────────────────

  const stats = useMemo(() => {
    let looseExpected = 0
    let loosePresent = 0
    let lotsMissing = 0
    for (const r of rows) {
      looseExpected += r.qty_expected
      loosePresent += Math.min(r.qty_present, r.qty_expected)
      if (r.qty_present < r.qty_expected) lotsMissing++
    }

    let figsExpected = 0
    let figsPresent = 0
    let figPiecesExpected = 0
    let figPiecesPresent = 0
    for (const f of figs) {
      const present = Math.min(f.qty_present, f.qty_expected)
      figsExpected += f.qty_expected
      figsPresent += present
      figPiecesExpected += f.qty_expected * f.fig_num_parts
      figPiecesPresent += present * f.fig_num_parts
    }

    const expected = looseExpected + figPiecesExpected
    const present = loosePresent + figPiecesPresent

    return {
      expected,
      present,
      missing: expected - present,
      lots: rows.length,
      lotsMissing,
      looseExpected,
      figsExpected,
      figsPresent,
      percent: expected === 0 ? 0 : (present / expected) * 100,
    }
  }, [rows, figs])

  // ── Filtering + sorting ─────────────────────────────────────────────────

  const query = search.trim().toLowerCase()

  const visibleRows = useMemo(() => {
    let result = tab === 'MISSING' ? rows.filter((r) => r.qty_present < r.qty_expected) : rows

    if (query) {
      result = result.filter(
        (r) =>
          (r.part_name ?? '').toLowerCase().includes(query) ||
          r.part_num.toLowerCase().includes(query) ||
          r.color_name.toLowerCase().includes(query)
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
      // Secondary sort: color mode groups by part name and vice versa, so
      // identical rows always land next to each other
      return sortField === 'color_name'
        ? partLabel(a).localeCompare(partLabel(b))
        : a.color_name.localeCompare(b.color_name)
    })
  }, [rows, tab, query, sortField, sortDir])

  const visibleFigs = useMemo(() => {
    if (!query) return figs
    return figs.filter(
      (f) =>
        (f.fig_name ?? '').toLowerCase().includes(query) ||
        f.fig_num.toLowerCase().includes(query)
    )
  }, [figs, query])

  const visibleSpares = useMemo(() => {
    if (!query) return spares
    return spares.filter(
      (s) =>
        (s.part_name ?? '').toLowerCase().includes(query) ||
        s.part_num.toLowerCase().includes(query) ||
        (s.color_name ?? '').toLowerCase().includes(query)
    )
  }, [spares, query])

  const partsByFig = useMemo(() => {
    const map = new Map<string, MinifigPart[]>()
    for (const p of figParts) {
      const list = map.get(p.fig_num)
      if (list) list.push(p)
      else map.set(p.fig_num, [p])
    }
    return map
  }, [figParts])

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortField(field)
      setSortDir(field === 'part_name' || field === 'color_name' ? 'asc' : 'desc')
    }
  }

  function toggleFig(figNum: string) {
    setExpandedFigs((prev) => {
      const next = new Set(prev)
      if (next.has(figNum)) next.delete(figNum)
      else next.add(figNum)
      return next
    })
  }

  // ── Want list export ──────────────────────────────────────────────────────

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
            : `${r.color_name} (${t.noBlColor})`
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

  const metaLine = [setNumber, theme, year ? String(year) : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="bg-white rounded-xl border border-gray-200 flex flex-col">
      {/* ── Header: set image + key facts ───────────────────────────────── */}
      <div className="px-6 pt-5 pb-4 border-b border-gray-100">
        <Link
          href="/collection"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={14} />
          {t.back}
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            {setImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={setImageUrl}
                alt={setName}
                className="w-24 h-24 object-contain rounded-lg bg-gray-50 border border-gray-100 flex-shrink-0"
              />
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                {t.eyebrow}
              </p>
              <h1 className="text-2xl font-semibold text-gray-900 leading-tight mt-0.5">
                {setName}
              </h1>
              {metaLine && <p className="text-sm text-gray-500 mt-0.5">{metaLine}</p>}
              <p className="text-sm text-gray-600 mt-1.5">
                {t.partsCount(nf.format(stats.looseExpected))}
                {stats.figsExpected > 0 && (
                  <>
                    {' · '}
                    <span className="inline-flex items-center gap-1">
                      <User size={12} className="text-gray-400" />
                      {t.minifigCount(nf.format(stats.figsExpected))}
                    </span>
                  </>
                )}
              </p>
              {resolved.rb_set_num && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {t.catalogRef(resolved.rb_set_num)}
                  {resolved.rb_name && ` — ${resolved.rb_name}`}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAll(true)} className="gap-1.5">
              <Check size={13} />
              {t.haveAll}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAll(false)} className="gap-1.5">
              <RotateCcw size={13} />
              {t.reset}
            </Button>
          </div>
        </div>

        {/* Completeness */}
        <div className="mt-4">
          <div className="flex items-end justify-between mb-1.5">
            <span className="text-3xl font-semibold text-gray-900 tabular-nums">
              {stats.percent.toFixed(1)}%
            </span>
            <span className="text-sm text-gray-500 tabular-nums">
              {t.piecesOf(nf.format(stats.present), nf.format(stats.expected))}
              {stats.figsExpected > 0 &&
                ` · ${t.figuresOf(
                  nf.format(stats.figsPresent),
                  nf.format(stats.figsExpected)
                )}`}
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
              {t.missingSummary(
                nf.format(stats.missing),
                nf.format(stats.lotsMissing)
              )}
            </span>
            {saving > 0 && <span className="text-gray-500">{strings.common.saving}</span>}
            {saveError && <span className="text-red-500">{saveError}</span>}
          </div>
        </div>
      </div>

      {/* ── Tabs + search + sorting ────────────────────────────────────── */}
      <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-1">
          {(
            [
              ['ALL', t.tabs.all, rows.length + figs.length],
              ['MISSING', t.tabs.missing, stats.lotsMissing],
              ['SPARES', t.tabs.spares, spares.length],
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

        <div className="flex items-center gap-3">
          {/* BrickLink-style sorting: by part name or by color */}
          {tab !== 'SPARES' && (
            <div className="flex items-center rounded-lg border border-gray-200 p-0.5">
              {(
                [
                  ['part_name', t.sortBy.name],
                  ['color_name', t.sortBy.color],
                ] as [SortField, string][]
              ).map(([field, label]) => (
                <button
                  key={field}
                  onClick={() => toggleSort(field)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    sortField === field
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {label}
                  {sortField === field && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                </button>
              ))}
            </div>
          )}

          <div className="relative w-full sm:w-56">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         placeholder:text-gray-400"
            />
          </div>
        </div>
      </div>

      {/* ── Want list export ──────────────────────────────────────────── */}
      {tab === 'MISSING' && (
        <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 mr-1">
            {t.wantListLabel(nf.format(missingRows.length))}
          </span>
          <CopyButton
            label={t.copyAsText}
            getText={wantListText}
            disabled={missingRows.length === 0}
          />
          <CopyButton
            label={t.copyBrickLinkXml}
            getText={wantListXml}
            disabled={missingRows.length === 0}
          />
        </div>
      )}

      <div className="overflow-auto max-h-[calc(100vh-26rem)]">
        {/* ── Minifigures ────────────────────────────────────────────── */}
        {tab === 'ALL' && visibleFigs.length > 0 && (
          <div className="border-b border-gray-100">
            <div className="px-6 py-2 bg-gray-50/70 flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <User size={12} />
              {t.minifigsHeading} ({nf.format(visibleFigs.length)})
            </div>
            {visibleFigs.map((fig) => (
              <MinifigRow
                key={fig.id}
                fig={fig}
                parts={partsByFig.get(fig.fig_num) ?? []}
                expanded={expandedFigs.has(fig.fig_num)}
                onToggle={() => toggleFig(fig.fig_num)}
                onSetPresent={(qty) => setFigPresent(fig.id, qty)}
                onShowPart={setDetail}
              />
            ))}
          </div>
        )}

        {/* ── Parts ──────────────────────────────────────────────────── */}
        {tab === 'SPARES' ? (
          <SparesTable spares={visibleSpares} onShowPart={setDetail} />
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white border-b border-gray-100 z-10">
              <tr>
                <th className="w-16 px-6 py-3"></th>
                <th className="text-left px-3 py-3 font-medium text-gray-500">
                  <button
                    onClick={() => toggleSort('part_name')}
                    className="flex items-center hover:text-gray-800"
                  >
                    {t.columns.part}
                    <SortIcon field="part_name" active={sortField} dir={sortDir} />
                  </button>
                </th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 hidden sm:table-cell">
                  <button
                    onClick={() => toggleSort('color_name')}
                    className="flex items-center hover:text-gray-800"
                  >
                    {t.columns.color}
                    <SortIcon field="color_name" active={sortField} dir={sortDir} />
                  </button>
                </th>
                <th className="text-right px-3 py-3 font-medium text-gray-500">
                  <button
                    onClick={() => toggleSort('qty_expected')}
                    className="flex items-center justify-end hover:text-gray-800 ml-auto"
                  >
                    {t.columns.expected}
                    <SortIcon field="qty_expected" active={sortField} dir={sortDir} />
                  </button>
                </th>
                <th className="text-right px-3 py-3 font-medium text-gray-500 w-32">{t.columns.have}</th>
                <th className="text-right px-6 py-3 font-medium text-gray-500 hidden md:table-cell">
                  <button
                    onClick={() => toggleSort('qty_missing')}
                    className="flex items-center justify-end hover:text-gray-800 ml-auto"
                  >
                    {t.columns.missing}
                    <SortIcon field="qty_missing" active={sortField} dir={sortDir} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center">
                    {tab !== 'MISSING' ? (
                      <span className="text-gray-400">{t.noPartsMatch}</span>
                    ) : stats.present === 0 ? (
                      // Nothing counted yet is NOT the same as nothing missing.
                      // Saying "nothing missing" here would be a lie of omission
                      // — it is why set 40370 sat at 0/184 looking complete.
                      <>
                        <div className="font-semibold text-gray-700">{t.notCountedYet}</div>
                        <div className="mt-1 text-sm text-gray-400">{t.notCountedYetSub}</div>
                      </>
                    ) : (
                      <>
                        <div className="font-semibold text-gray-700">{t.nothingMissing}</div>
                        <div className="mt-1 text-sm text-gray-400">{t.nothingMissingSub}</div>
                      </>
                    )}
                  </td>
                </tr>
              )}
              {visibleRows.map((row) => {
                const missing = row.qty_expected - row.qty_present
                const bl = blColors[row.color_id]
                return (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="pl-6 pr-2 py-2">
                      <PartThumb
                        src={row.part_img_url}
                        alt={partLabel(row)}
                        size="lg"
                        onClick={() =>
                          setDetail({
                            imgUrl: row.part_img_url,
                            name: partLabel(row),
                            partNum: row.part_num,
                            colorName: row.color_name,
                            blColorId: bl?.bl_color_id ?? null,
                            blColorName: bl?.bl_color_name ?? null,
                            qtyExpected: row.qty_expected,
                            qtyPresent: row.qty_present,
                          })
                        }
                      />
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
                              : t.noBlColorParen}
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
                            setPartPresent(
                              row.id,
                              clamp(parseInt(e.target.value, 10), row.qty_expected)
                            )
                          }
                          className="w-16 px-2 py-1 text-sm text-right border border-gray-200 rounded-md
                                     tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500
                                     focus:border-transparent"
                        />
                        <button
                          onClick={() => setPartPresent(row.id, row.qty_expected)}
                          disabled={missing === 0}
                          title={t.haveAllOfThis}
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

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="px-6 py-2.5 border-t border-gray-100 text-xs text-gray-400">
        {tab === 'SPARES'
          ? t.footer.spares(nf.format(visibleSpares.length))
          : tab === 'ALL' && visibleFigs.length > 0
            ? t.footer.partsAndFigs(
                nf.format(visibleRows.length),
                nf.format(visibleFigs.length)
              )
            : t.footer.parts(nf.format(visibleRows.length))}
      </div>

      {detail && <PartDetailDialog detail={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

// ─── Spare parts ─────────────────────────────────────────────────────────────

function SparesTable({
  spares,
  onShowPart,
}: {
  spares: SparePart[]
  onShowPart: (detail: PartDetail) => void
}) {
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-white border-b border-gray-100 z-10">
        <tr>
          <th className="w-16 px-6 py-3"></th>
          <th className="text-left px-3 py-3 font-medium text-gray-500">{t.columns.part}</th>
          <th className="text-left px-3 py-3 font-medium text-gray-500 hidden sm:table-cell">
            {t.columns.color}
          </th>
          <th className="text-right px-6 py-3 font-medium text-gray-500">
            {t.columns.quantity}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {spares.length === 0 && (
          <tr>
            <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
              {t.noSpares}
            </td>
          </tr>
        )}
        {spares.map((s) => (
          <tr key={`${s.part_num}-${s.color_id}`} className="hover:bg-gray-50">
            <td className="pl-6 pr-2 py-2">
              <PartThumb
                src={s.part_img_url}
                alt={partLabel(s)}
                size="lg"
                onClick={() =>
                  onShowPart({
                    imgUrl: s.part_img_url,
                    name: partLabel(s),
                    partNum: s.part_num,
                    colorName: s.color_name,
                    blColorId: null,
                    blColorName: null,
                    qtyExpected: s.qty_expected,
                  })
                }
              />
            </td>
            <td className="px-3 py-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-gray-900 line-clamp-1">{partLabel(s)}</span>
                <span className="text-xs text-gray-400">{s.part_num}</span>
              </div>
            </td>
            <td className="px-3 py-2 hidden sm:table-cell text-gray-700">
              {s.color_name ?? strings.common.none}
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
