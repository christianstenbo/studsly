'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import type { CollectionObject } from '@/lib/types/objects'
import type { FreePart, ActiveAllocation } from '@/lib/types/pool'
import { ALL_OFF as ALL_OFF_FLAGS, type Flags } from '@/lib/flags'
import { createClient } from '@/lib/supabase/client'
import { restore } from '@/lib/allocate'
import { strings } from '@/lib/i18n/strings'
import { formatNum, formatNok, statusBadge, themeYear, imageUrl } from '@/lib/display'

const t = strings.collectionExtra
const p = strings.pool

type Tab = 'Sets' | 'Figures' | 'Animals' | 'Parts' | 'MOCs'
type View = 'grid' | 'table'
type Sort =
  | 'valueDesc' | 'valueAsc' | 'recent' | 'nameAsc' | 'yearDesc' | 'partsDesc'

const SORTS: { key: Sort; label: string }[] = [
  { key: 'valueDesc', label: t.sortOptions.valueDesc },
  { key: 'valueAsc', label: t.sortOptions.valueAsc },
  { key: 'recent', label: t.sortOptions.recent },
  { key: 'nameAsc', label: t.sortOptions.nameAsc },
  { key: 'yearDesc', label: t.sortOptions.yearDesc },
  { key: 'partsDesc', label: t.sortOptions.partsDesc },
]

const comparators: Record<Sort, (a: CollectionObject, b: CollectionObject) => number> = {
  valueDesc: (a, b) => (b.estimated_value_bl ?? 0) - (a.estimated_value_bl ?? 0),
  valueAsc: (a, b) => (a.estimated_value_bl ?? 0) - (b.estimated_value_bl ?? 0),
  recent: (a, b) => (b.created_at > a.created_at ? 1 : -1),
  nameAsc: (a, b) => (a.name ?? '').localeCompare(b.name ?? ''),
  yearDesc: (a, b) => (b.year ?? 0) - (a.year ?? 0),
  partsDesc: (a, b) => (b.num_parts ?? 0) - (a.num_parts ?? 0),
}

export function CollectionView({
  objects,
  supabaseUrl,
  flags = ALL_OFF_FLAGS,
  freeParts = [],
  allocations = [],
}: {
  objects: CollectionObject[]
  supabaseUrl: string
  flags?: Flags
  freeParts?: FreePart[]
  allocations?: ActiveAllocation[]
}) {
  const [tab, setTab] = useState<Tab>('Sets')
  const [view, setView] = useState<View>('grid')
  const [sort, setSort] = useState<Sort>('valueDesc')
  const [sortOpen, setSortOpen] = useState(false)
  const [query, setQuery] = useState('')

  const sets = useMemo(() => objects.filter((o) => o.object_type === 'SET'), [objects])
  const mocs = useMemo(() => objects.filter((o) => o.object_type === 'MOC'), [objects])

  const totals = useMemo(() => {
    const value = objects.reduce((a, o) => a + (o.estimated_value_bl ?? 0), 0)
    const figures = objects.reduce((a, o) => a + (o.num_minifigs ?? 0), 0)
    const parts = objects.reduce((a, o) => a + (o.num_parts ?? 0), 0)
    return { value, figures, parts }
  }, [objects])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q
      ? sets.filter((o) =>
          [o.name, o.set_number, o.theme, o.subtheme, o.year?.toString()]
            .filter(Boolean)
            .some((f) => (f as string).toLowerCase().includes(q))
        )
      : sets
    return [...base].sort(comparators[sort])
  }, [sets, query, sort])

  // Resolve an allocation's target set to a display name (targets are sets,
  // already present in `objects`).
  const objectsById = useMemo(() => {
    const m = new Map<string, CollectionObject>()
    for (const o of objects) m.set(o.id, o)
    return m
  }, [objects])

  const tabCounts: Record<Tab, number> = {
    Sets: sets.length,
    Figures: totals.figures,
    Animals: 0,
    // With the pool on, Parts counts loose part rows; otherwise the piece total.
    Parts: flags.FF_POOL ? freeParts.length : totals.parts,
    MOCs: mocs.length,
  }

  return (
    <div className="sc-collection">
      <div className="collhead">
        <div>
          <h1>{strings.collection.title}</h1>
          <p className="sub">
            {t.summary(
              formatNum(sets.length),
              formatNum(totals.figures),
              '—',
              formatNok(totals.value)
            )}
          </p>
        </div>
        <Link className="btnP" href="/register">
          <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> {t.register}
        </Link>
      </div>

      {/* Global search (AI ask is Phase 2 — pill is presentational) */}
      <div className="searchbig">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={strings.collection.searchPlaceholder}
        />
        <span className="askpill">{t.aiPill}</span>
        {query && (
          <button className="sx" onClick={() => setQuery('')} aria-label="Clear search">✕</button>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs" role="tablist">
        {(Object.keys(tabCounts) as Tab[]).map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={tab === name}
            className={`tab${tab === name ? ' active' : ''}`}
            onClick={() => setTab(name)}
          >
            {t.tabs[name.toLowerCase() as keyof typeof t.tabs]}
            <span>{name === 'Animals' ? '—' : formatNum(tabCounts[name])}</span>
          </button>
        ))}
      </div>

      {tab === 'Sets' ? (
        <>
          <div className="controls">
            <span className="lenslabel">{t.view}</span>
            <div className="segmt" role="group" aria-label={t.view}>
              <button
                className={`seg${view === 'grid' ? ' active' : ''}`}
                onClick={() => setView('grid')}
                aria-pressed={view === 'grid'}
              >
                {t.grid}
              </button>
              <button
                className={`seg${view === 'table' ? ' active' : ''}`}
                onClick={() => setView('table')}
                aria-pressed={view === 'table'}
              >
                {t.table}
              </button>
            </div>
            <span className="spacer" />
            <div style={{ position: 'relative' }}>
              <button
                className="tbtn"
                onClick={() => setSortOpen((v) => !v)}
                aria-expanded={sortOpen}
              >
                {t.sort}:&nbsp;<b>{SORTS.find((x) => x.key === sort)?.label}</b> ▾
              </button>
              {sortOpen && (
                <div
                  style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 40,
                    background: '#fff', border: '1px solid var(--line)', borderRadius: 12,
                    boxShadow: '0 12px 30px rgba(15,23,42,.16)', minWidth: 212, padding: 6,
                  }}
                >
                  {SORTS.map((x) => (
                    <button
                      key={x.key}
                      onClick={() => { setSort(x.key); setSortOpen(false) }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left', background: 'transparent',
                        border: 0, font: 'inherit', fontSize: 13, fontWeight: 600,
                        color: x.key === sort ? 'var(--brandText)' : 'var(--ink2)',
                        padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
                      }}
                    >
                      {x.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="chips">
            <span className="count">{t.shown(filtered.length, sets.length)}</span>
          </div>

          {filtered.length === 0 ? (
            <div className="empty">
              <div className="ei" aria-hidden>▦</div>
              <div className="et">{t.noMatch}</div>
            </div>
          ) : view === 'grid' ? (
            <div className="grid">
              {filtered.map((o) => {
                const badge = statusBadge(o)
                const img = imageUrl(supabaseUrl, o.image_filename)
                return (
                  <Link key={o.id} className="setcard" href={`/collection/${o.id}`}>
                    <div className="thumb" aria-hidden>{img ? <img src={img} alt="" /> : '▦'}</div>
                    <div className="scname">{o.name ?? strings.common.unnamed}</div>
                    <div className="scmeta">{themeYear(o)}</div>
                    <div className="scfoot">
                      <span className="scval">{formatNok(o.estimated_value_bl)}</span>
                      <span className={`badge b-${badge.kind}`}>{badge.label}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="tablewrap scroll">
              <table className="stbl">
                <thead>
                  <tr>
                    <th>{t.columns.name}</th>
                    <th>{t.columns.theme}</th>
                    <th>{t.columns.year}</th>
                    <th>{t.columns.status}</th>
                    <th className="num">{t.columns.parts}</th>
                    <th className="num">{t.columns.value}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => {
                    const badge = statusBadge(o)
                    return (
                      <tr key={o.id}>
                        <td className="name">
                          <Link href={`/collection/${o.id}`} className="link" style={{ fontSize: 13 }}>
                            {o.name ?? strings.common.unnamed}
                          </Link>
                        </td>
                        <td>{o.theme ?? '—'}</td>
                        <td>{o.year ?? '—'}</td>
                        <td><span className={`badge b-${badge.kind}`}>{badge.label}</span></td>
                        <td className="num">{formatNum(o.num_parts)}</td>
                        <td className="val">{formatNok(o.estimated_value_bl)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="foot">
            <span>{t.showing(filtered.length, sets.length)}</span>
          </div>
        </>
      ) : tab === 'Parts' && flags.FF_POOL ? (
        <PoolTab
          freeParts={freeParts}
          allocations={allocations}
          objectsById={objectsById}
        />
      ) : (
        <div className="empty">
          <div className="ei" aria-hidden>▦</div>
          <div className="et">{t.tabPlaceholder(t.tabs[tab.toLowerCase() as keyof typeof t.tabs])}</div>
          <div className="es">{t.tabPlaceholderSub}</div>
        </div>
      )}
    </div>
  )
}

// ─── Free parts pool (FF_POOL) ──────────────────────────────────────────────

type ColourChoice = { id: number; name: string; rgb: string | null }

function PoolTab({
  freeParts,
  allocations,
  objectsById,
}: {
  freeParts: FreePart[]
  allocations: ActiveAllocation[]
  objectsById: Map<string, CollectionObject>
}) {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<FreePart[]>(freeParts)
  const [allocs, setAllocs] = useState<ActiveAllocation[]>(allocations)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [colourFor, setColourFor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const allocsBySource = useMemo(() => {
    const m = new Map<string, ActiveAllocation[]>()
    for (const a of allocs) {
      const list = m.get(a.source_object_id)
      if (list) list.push(a)
      else m.set(a.source_object_id, [a])
    }
    return m
  }, [allocs])

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Restore: free the allocation and hand the quantity back to the pool row.
  const onRestore = useCallback(
    async (a: ActiveAllocation) => {
      setBusy((b) => new Set(b).add(a.id))
      setError(null)
      const { error } = await restore(supabase, a.id)
      setBusy((b) => {
        const n = new Set(b)
        n.delete(a.id)
        return n
      })
      if (error) {
        setError(error)
        return
      }
      setAllocs((prev) => prev.filter((x) => x.id !== a.id))
      setRows((prev) =>
        prev.map((r) =>
          r.source_object_id === a.source_object_id
            ? {
                ...r,
                qty_free: r.qty_free + a.quantity,
                qty_allocated: Math.max(r.qty_allocated - a.quantity, 0),
              }
            : r
        )
      )
    },
    [supabase]
  )

  // Set colour on a loose part whose colour is unconfirmed (Finding 1).
  const onSetColour = useCallback(
    async (sourceId: string, choice: ColourChoice) => {
      setColourFor(null)
      const { error } = await supabase
        .from('objects')
        .update({ part_color_id: choice.id, part_color_name: choice.name })
        .eq('id', sourceId)
      if (error) {
        setError(strings.common.saveFailed)
        return
      }
      setRows((prev) =>
        prev.map((r) =>
          r.source_object_id === sourceId
            ? { ...r, part_color_id: choice.id, part_color_name: choice.name }
            : r
        )
      )
    },
    [supabase]
  )

  if (rows.length === 0) {
    return (
      <div className="empty">
        <div className="ei" aria-hidden>◱</div>
        <div className="et">{p.empty}</div>
        <div className="es">{p.emptySub}</div>
      </div>
    )
  }

  return (
    <>
      <p className="hint" style={{ margin: '0 0 12px' }}>{p.intro}</p>
      {error && (
        <p className="hint" role="alert" style={{ color: 'var(--brand)', marginBottom: 10 }}>
          {error}
        </p>
      )}
      <div className="tablewrap scroll">
        <table className="stbl">
          <thead>
            <tr>
              <th>{p.columns.part}</th>
              <th>{p.columns.colour}</th>
              <th className="num">{p.columns.owned}</th>
              <th className="num">{p.columns.free}</th>
              <th className="num">{p.columns.allocated}</th>
              <th>{p.columns.location}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const rowAllocs = allocsBySource.get(r.source_object_id) ?? []
              const isOpen = expanded.has(r.source_object_id)
              const unconfirmed = r.part_color_id == null
              const loc = r.location_name
                ? [r.location_name, r.sub_location].filter(Boolean).join(' · ')
                : p.noLocation
              return (
                <PoolRowGroup
                  key={r.source_object_id}
                  r={r}
                  loc={loc}
                  unconfirmed={unconfirmed}
                  isOpen={isOpen}
                  rowAllocs={rowAllocs}
                  busy={busy}
                  objectsById={objectsById}
                  colourOpen={colourFor === r.source_object_id}
                  onToggle={() => toggle(r.source_object_id)}
                  onOpenColour={() =>
                    setColourFor((c) =>
                      c === r.source_object_id ? null : r.source_object_id
                    )
                  }
                  onPickColour={(c) => onSetColour(r.source_object_id, c)}
                  onCloseColour={() => setColourFor(null)}
                  onRestore={onRestore}
                  supabase={supabase}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function PoolRowGroup({
  r,
  loc,
  unconfirmed,
  isOpen,
  rowAllocs,
  busy,
  objectsById,
  colourOpen,
  onToggle,
  onOpenColour,
  onPickColour,
  onCloseColour,
  onRestore,
  supabase,
}: {
  r: FreePart
  loc: string
  unconfirmed: boolean
  isOpen: boolean
  rowAllocs: ActiveAllocation[]
  busy: Set<string>
  objectsById: Map<string, CollectionObject>
  colourOpen: boolean
  onToggle: () => void
  onOpenColour: () => void
  onPickColour: (c: ColourChoice) => void
  onCloseColour: () => void
  onRestore: (a: ActiveAllocation) => void
  supabase: ReturnType<typeof createClient>
}) {
  return (
    <>
      <tr>
        <td className="name">
          <div>{r.part_name ?? r.part_num ?? strings.common.unnamed}</div>
          {r.part_num && (
            <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{r.part_num}</div>
          )}
        </td>
        <td>
          {unconfirmed ? (
            <span style={{ position: 'relative', display: 'inline-block' }}>
              <button className="chip-warn" onClick={onOpenColour} aria-expanded={colourOpen}>
                {p.colourUnconfirmed} ✎
              </button>
              {colourOpen && (
                <ColourPicker supabase={supabase} onPick={onPickColour} onClose={onCloseColour} />
              )}
            </span>
          ) : (
            r.part_color_name ?? p.unknownColour
          )}
        </td>
        <td className="num">{formatNum(r.qty_owned)}</td>
        <td className="num">{formatNum(r.qty_free)}</td>
        <td className="num">
          {r.qty_allocated > 0 ? (
            <button className="link" onClick={onToggle} aria-expanded={isOpen}>
              {formatNum(r.qty_allocated)} {isOpen ? '▴' : '▾'}
            </button>
          ) : (
            <span style={{ color: 'var(--faint)' }}>—</span>
          )}
        </td>
        <td>{loc}</td>
      </tr>
      {isOpen &&
        rowAllocs.map((a) => {
          const target = objectsById.get(a.target_object_id)
          return (
            <tr key={a.id} style={{ background: '#fbfafc' }}>
              <td colSpan={4} style={{ paddingLeft: 24, color: 'var(--muted)', fontSize: 12.5 }}>
                {p.allocatedTo}{' '}
                <b style={{ color: 'var(--ink2)' }}>
                  {target?.name ?? target?.set_number ?? a.target_object_id.slice(0, 8)}
                </b>{' '}
                · {formatNum(a.quantity)}
              </td>
              <td colSpan={2} style={{ textAlign: 'right' }}>
                <button
                  className="btnO"
                  style={{ padding: '5px 11px', fontSize: 12 }}
                  disabled={busy.has(a.id)}
                  onClick={() => onRestore(a)}
                >
                  {busy.has(a.id) ? strings.common.saving : strings.allocate.restore}
                </button>
              </td>
            </tr>
          )
        })}
    </>
  )
}

function ColourPicker({
  supabase,
  onPick,
  onClose,
}: {
  supabase: ReturnType<typeof createClient>
  onPick: (c: ColourChoice) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<ColourChoice[]>([])
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    const term = q.trim()
    const run = async () => {
      let query = supabase.from('rb_colors').select('id, name, rgb').order('name').limit(24)
      if (term) query = query.ilike('name', `%${term}%`)
      const { data } = await query
      if (!cancelled) setResults((data as ColourChoice[]) ?? [])
    }
    const timer = setTimeout(run, 180)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [q, supabase])

  return (
    <div
      ref={boxRef}
      role="group"
      aria-label={p.setColour}
      style={{
        position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
        background: '#fff', border: '1px solid var(--line)', borderRadius: 12,
        boxShadow: '0 12px 30px rgba(15,23,42,.16)', width: 240, padding: 8,
      }}
    >
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={p.setColour}
        style={{
          width: '100%', border: '1px solid var(--line)', borderRadius: 8,
          padding: '7px 9px', font: 'inherit', fontSize: 13, outline: 'none', marginBottom: 6,
        }}
      />
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {results.map((c) => (
          <button
            key={c.id}
            onClick={() => onPick(c)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
              background: 'transparent', border: 0, font: 'inherit', fontSize: 13,
              color: 'var(--ink2)', padding: '7px 8px', borderRadius: 8, cursor: 'pointer',
            }}
          >
            <i
              aria-hidden
              style={{
                width: 13, height: 13, borderRadius: 4, flex: '0 0 auto',
                background: c.rgb ? `#${c.rgb}` : 'var(--track)',
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.12)',
              }}
            />
            {c.name}
          </button>
        ))}
      </div>
    </div>
  )
}
