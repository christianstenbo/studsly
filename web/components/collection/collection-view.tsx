'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { CollectionObject } from '@/lib/types/objects'
import { strings } from '@/lib/i18n/strings'
import { formatNum, formatNok, statusBadge, themeYear, imageUrl } from '@/lib/display'

const t = strings.collectionExtra

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
}: {
  objects: CollectionObject[]
  supabaseUrl: string
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

  const tabCounts: Record<Tab, number> = {
    Sets: sets.length,
    Figures: totals.figures,
    Animals: 0,
    Parts: totals.parts,
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
