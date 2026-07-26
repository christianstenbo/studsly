'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { strings } from '@/lib/i18n/strings'
import { formatNum, formatNok, statusBadge } from '@/lib/display'
import { createClient } from '@/lib/supabase/client'
import { allocatePart, restore } from '@/lib/allocate'
import type { Flags } from '@/lib/flags'
import type { SetPart, SetFig, ModFreePart, SetAllocation } from '@/lib/types/set-detail'

const d = strings.setDetail

type Obj = {
  id: string
  name: string | null
  set_number: string | null
  theme: string | null
  subtheme: string | null
  year: number | null
  condition: string | null
  is_built: boolean | null
  build_status: string | null
  is_modified: boolean | null
  condition_grade: string | null
  num_parts: number | null
  num_minifigs: number | null
  estimated_value_bl: number | null
  value_tier: string | null
  value_base_nok: number | null
  value_override_nok: number | null
  value_addback_box_nok: number | null
  value_addback_manual_nok: number | null
  value_grade_adjust_pct: number | null
  value_restoration_cost_nok: number | null
  has_instructions: boolean | null
  has_original_box: boolean | null
  ownership_id: string | null
  created_at: string
}
type Component = {
  kind: string
  label: string | null
  is_present: boolean
  grade: string | null
  note: string | null
}
type Completeness = {
  pieces_expected: number | null
  pieces_present: number | null
  pieces_missing: number | null
  percent_complete: number | null
  minifigs_expected: number | null
  minifigs_present: number | null
} | null

type Tab = 'overview' | 'parts' | 'figures' | 'value'

const COMPONENT_ICON: Record<string, string> = {
  INSTRUCTIONS: '📘', ORIGINAL_BOX: '📦', STICKER_SHEET: '🏷️',
  INNER_BAGS: '🧷', EXTRAS: '➕', OTHER: '▦',
}
const COMPONENT_LABEL: Record<string, string> = {
  INSTRUCTIONS: d.component.instructions, ORIGINAL_BOX: d.component.box,
  STICKER_SHEET: d.component.stickers, INNER_BAGS: d.component.innerBags,
  EXTRAS: d.component.extras, OTHER: d.component.other,
}
const GRADES: [string, string][] = [
  ['MINT', d.grades.MINT], ['EXCELLENT', d.grades.EXCELLENT], ['GOOD', d.grades.GOOD],
  ['FAIR', d.grades.FAIR], ['POOR', d.grades.POOR],
]

// Build-status order. Moving to New/Sealed from Unbuilt/Built (claiming a set is
// factory-sealed after it has been opened or built) is the guarded direction.
const BUILD_STATES = ['NEW', 'SEALED', 'UNBUILT', 'BUILT'] as const

function clamp(value: number, max: number): number {
  if (Number.isNaN(value)) return 0
  return Math.min(Math.max(value, 0), max)
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch {
    return '—'
  }
}

// ─── Stepper ─────────────────────────────────────────────────────────────────

function Stepper({
  value, max, onChange, incLabel, decLabel,
}: {
  value: number
  max: number
  onChange: (n: number) => void
  incLabel: string
  decLabel: string
}) {
  return (
    <span className="stepper">
      <button
        type="button"
        aria-label={decLabel}
        disabled={value <= 0}
        onClick={() => onChange(clamp(value - 1, max))}
      >
        −
      </button>
      <input
        className="hv"
        inputMode="numeric"
        aria-label={incLabel}
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => onChange(clamp(parseInt(e.target.value, 10), max))}
      />
      <button
        type="button"
        aria-label={incLabel}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + 1, max))}
      >
        +
      </button>
    </span>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function SetDetailView({
  obj,
  components,
  completeness,
  img,
  flags,
  userId,
  parts,
  figs,
  freeParts,
  allocations,
}: {
  obj: Obj
  components: Component[]
  completeness: Completeness
  img: string | null
  flags: Flags
  userId: string | null
  parts: SetPart[]
  figs: SetFig[]
  freeParts: ModFreePart[]
  allocations: SetAllocation[]
}) {
  const [tab, setTab] = useState<Tab>('overview')
  const badge = statusBadge(obj)
  const modOn = flags.FF_MOD

  // Live-editable set-level state (build status + modified flag).
  const [buildStatus, setBuildStatus] = useState<string | null>(obj.build_status)
  const [isModified, setIsModified] = useState<boolean>(obj.is_modified ?? false)

  const thisCopy = obj.value_override_nok ?? obj.value_base_nok ?? obj.estimated_value_bl ?? null

  const hasCompleteness = completeness && (completeness.pieces_expected ?? 0) > 0

  const tierLabel =
    obj.value_tier === 'SEALED' ? d.ledger.tierSealed
    : obj.value_tier === 'USED_COMPLETE_CIB' ? d.ledger.tierCib
    : obj.value_tier === 'USED_INCOMPLETE' ? d.ledger.tierIncomplete
    : null

  const partsCheckHref = `/collection/${obj.id}/parts-check`

  const badgeLabel = modOn
    ? (buildStatus && d.statusLabels[buildStatus]) || badge.label
    : badge.label
  const badgeKind = modOn && buildStatus
    ? (buildStatus === 'BUILT' ? 'built' : buildStatus === 'UNBUILT' ? 'used' : 'seal')
    : badge.kind

  return (
    <div className="sc-set">
      <Link className="dback" href="/collection">{d.back}</Link>

      {/* HERO */}
      <div className="dhero">
        <div className="dimg" aria-hidden>{img ? <img src={img} alt="" /> : '▦'}</div>
        <div className="dinfo">
          <div className="dtop">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="dtitle">{obj.name ?? strings.common.unnamed}</h1>
              {obj.set_number && <div className="dnum">{obj.set_number}</div>}
              <p className="dmeta">
                {[obj.theme, obj.year, obj.ownership_id].filter(Boolean).join(' · ')}
              </p>
            </div>
            <span className={`badge b-${badgeKind}`} style={{ fontSize: 11.5, padding: '4px 10px' }}>
              {badgeLabel}
            </span>
            {(modOn ? isModified : obj.is_modified) && (
              <span className="badge b-mod" style={{ fontSize: 11.5, padding: '4px 10px' }}>
                {d.modified}
              </span>
            )}
          </div>
          <div className="dfacts">
            <div className="dfact">
              <div className="fl">{d.facts.value}</div>
              <div className="fv">{formatNok(thisCopy)}</div>
            </div>
            <div className="dfact">
              <div className="fl">{d.facts.pieces}</div>
              <div className="fv">{formatNum(obj.num_parts)}</div>
            </div>
            <div className="dfact">
              <div className="fl">{d.facts.figures}</div>
              <div className="fv">{formatNum(obj.num_minifigs)}</div>
            </div>
          </div>
          <div className="dactions">
            <button className="btnO" disabled>{d.edit}</button>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="dtabs" role="tablist">
        {(['overview', 'parts', 'figures', 'value'] as Tab[]).map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={tab === name}
            className={`dtab${tab === name ? ' active' : ''}`}
            onClick={() => setTab(name)}
          >
            {d.tabs[name]}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <>
          <div className="card2">
            <div className="sect" style={{ marginBottom: 10 }}>{d.buildStatus}</div>
            {modOn ? (
              <BuildStatusControl
                objectId={obj.id}
                value={buildStatus}
                onChange={setBuildStatus}
              />
            ) : (
              <ReadonlyBuildStatus obj={obj} />
            )}
            {hasCompleteness && (
              <div className="meterrow" style={{ marginTop: 16 }}>
                <span className="mn">
                  {d.partsMeter(
                    formatNum(completeness!.pieces_present),
                    formatNum(completeness!.pieces_expected)
                  )}
                </span>
                <div className="track">
                  <div className="fill" style={{ width: `${completeness!.percent_complete ?? 0}%` }} />
                </div>
                {(completeness!.pieces_missing ?? 0) > 0 ? (
                  <span className="mm">{d.partsMissing(formatNum(completeness!.pieces_missing))}</span>
                ) : (
                  <span className="mm done">✓</span>
                )}
                {modOn ? (
                  <button className="link" onClick={() => setTab('parts')}>{d.goToParts}</button>
                ) : (
                  <Link className="link" href={partsCheckHref}>{d.goToParts}</Link>
                )}
              </div>
            )}
            {modOn && (
              <ModToggle
                objectId={obj.id}
                value={isModified}
                onChange={setIsModified}
              />
            )}
          </div>

          {modOn && isModified && (
            <ModSummary added={parts.filter((p) => p.used_in_mod).length} onManage={() => setTab('parts')} />
          )}

          <div className="card2">
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <div className="sect" style={{ margin: 0 }}>{d.contents}</div>
            </div>
            {components.length === 0 ? (
              <p className="hint">{d.contentsEmpty}</p>
            ) : (
              <div className="contents">
                {components.map((c, i) => (
                  <div className="crow" key={i}>
                    <div className="ci" aria-hidden>{COMPONENT_ICON[c.kind] ?? '▦'}</div>
                    <div className="cb">
                      <div className="cn">{c.label || COMPONENT_LABEL[c.kind] || c.kind}</div>
                      <div className="cs">
                        {c.is_present ? d.component.present : d.component.notPresent}
                      </div>
                    </div>
                    {c.grade ? (
                      <span className="cchip cond">{d.grades[c.grade as keyof typeof d.grades] ?? c.grade}</span>
                    ) : (
                      <span className={`cchip${c.is_present ? '' : ' miss'}`}>
                        {c.is_present ? d.component.present : d.component.notPresent}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="gradewrap">
              <span className="lbl3">{d.overallCondition}</span>
              <div className="statusctl" aria-label={d.overallCondition}>
                {GRADES.map(([key, label]) => (
                  <button key={key} className={obj.condition_grade === key ? 'on' : ''} disabled>
                    {label}
                  </button>
                ))}
              </div>
              {!obj.condition_grade && <span className="hint">{d.notGraded}</span>}
            </div>
          </div>

          <div className="card2" style={{ marginBottom: 0 }}>
            <div className="sect">{d.provenance}</div>
            <div className="kv"><span className="k">{d.prov.entryId}</span><span className="v mono">{obj.ownership_id ?? '—'}</span></div>
            <div className="kv"><span className="k">{d.prov.added}</span><span className="v">{fmtDate(obj.created_at)}</span></div>
            <div className="kv"><span className="k">{d.prov.condition}</span><span className="v">{obj.condition ?? '—'}</span></div>
            <div className="kv"><span className="k">{d.prov.theme}</span><span className="v">{obj.theme ?? '—'}</span></div>
          </div>
        </>
      )}

      {/* PARTS */}
      {tab === 'parts' && (
        modOn ? (
          <PartsTab
            objectId={obj.id}
            userId={userId}
            initialParts={parts}
            freeParts={freeParts}
            initialAllocations={allocations}
            modified={isModified}
            partsCheckHref={partsCheckHref}
          />
        ) : (
          hasCompleteness ? (
            <>
              <div className="barbig">
                <div className="bt">
                  {d.partsMeter(
                    formatNum(completeness!.pieces_present),
                    formatNum(completeness!.pieces_expected)
                  )}
                  {(completeness!.pieces_missing ?? 0) > 0 && (
                    <> · <span className="mm">{d.partsMissing(formatNum(completeness!.pieces_missing))}</span></>
                  )}
                </div>
                <span className="sp" />
                <Link className="btnO" href={partsCheckHref}>{d.openPartsCheck}</Link>
              </div>
              <div className="meterrow">
                <div className="track">
                  <div className="fill" style={{ width: `${completeness!.percent_complete ?? 0}%` }} />
                </div>
              </div>
            </>
          ) : (
            <div className="empty">
              <div className="ei" aria-hidden>◱</div>
              <div className="et">{d.partsTabEmpty}</div>
              <div className="es"><Link className="link" href={partsCheckHref}>{d.openPartsCheck}</Link></div>
            </div>
          )
        )
      )}

      {/* FIGURES */}
      {tab === 'figures' && (
        modOn ? (
          <FiguresTab initialFigs={figs} />
        ) : (
          <div className="empty">
            <div className="ei" aria-hidden>🧙</div>
            <div className="et">{d.figuresTabEmpty}</div>
          </div>
        )
      )}

      {/* VALUE & INSURANCE */}
      {tab === 'value' && (
        <div className="card2" style={{ marginBottom: 0 }}>
          <div className="sect">{d.valueSection}</div>
          <div className="ledger">
            <div className="lgr">
              <span className="lk">{tierLabel ? d.ledger.base(tierLabel) : d.ledger.base('—')}</span>
              <span className="lv">{formatNok(obj.value_base_nok ?? obj.estimated_value_bl)}</span>
            </div>
            {obj.value_addback_box_nok != null && !obj.has_original_box && (
              <div className="lgr">
                <span className="lk">{d.ledger.noBox}</span>
                <span className="lv neg">− {formatNok(obj.value_addback_box_nok)}</span>
              </div>
            )}
            {obj.value_addback_manual_nok != null && !obj.has_instructions && (
              <div className="lgr">
                <span className="lk">{d.ledger.noManual}</span>
                <span className="lv neg">− {formatNok(obj.value_addback_manual_nok)}</span>
              </div>
            )}
            {obj.condition_grade && (
              <div className="lgr">
                <span className="lk">{d.ledger.grade(d.grades[obj.condition_grade as keyof typeof d.grades] ?? obj.condition_grade)}</span>
                <span className="lv q">{obj.value_grade_adjust_pct != null ? `${obj.value_grade_adjust_pct}%` : '—'}</span>
              </div>
            )}
            <div className="lgr">
              <span className="lk">{d.ledger.restoration}</span>
              <span className="lv q">{d.ledger.restorationPhase2}</span>
            </div>
            <div className="lgr total">
              <span className="lk">{d.ledger.thisCopy}</span>
              <span className="lv">{formatNok(thisCopy)}</span>
            </div>
          </div>
          <div className="hint" style={{ marginTop: 12 }}>{d.valueNote}</div>
        </div>
      )}
    </div>
  )
}

// ─── Build status (read-only fallback, Phase 1a) ─────────────────────────────

function ReadonlyBuildStatus({ obj }: { obj: Obj }) {
  const current =
    obj.build_status === 'BUILT' || obj.is_built ? 'built'
    : obj.build_status === 'UNBUILT' ? 'unbuilt'
    : 'sealed'
  return (
    <>
      <div className="statusctl" aria-label={d.buildStatus}>
        <button className={current === 'sealed' ? 'on' : ''} disabled>{d.status.sealed}</button>
        <button className={current === 'unbuilt' ? 'on' : ''} disabled>{d.status.unbuilt}</button>
        <button className={current === 'built' ? 'on' : ''} disabled>{d.status.built}</button>
      </div>
      <div className="hint" style={{ marginTop: 12 }}>{d.statusReadonly}</div>
    </>
  )
}

// ─── Build status (editable, FF_MOD) — writes ONLY objects.build_status ───────

function BuildStatusControl({
  objectId, value, onChange,
}: {
  objectId: string
  value: string | null
  onChange: (v: string) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [pending, setPending] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedTick, setSavedTick] = useState(false)

  const save = useCallback(
    async (next: string) => {
      const prev = value
      onChange(next)
      setPending(next)
      setError(null)
      const { error } = await supabase
        .from('objects')
        .update({ build_status: next })
        .eq('id', objectId)
      setPending(null)
      if (error) {
        onChange(prev ?? '')
        setError(strings.common.saveFailed)
      } else {
        setSavedTick(true)
        setTimeout(() => setSavedTick(false), 1600)
      }
    },
    [objectId, supabase, value, onChange]
  )

  const pick = (next: string) => {
    if (next === value) return
    // Guard: claiming factory-sealed/new after a set has been opened or built.
    if ((next === 'NEW' || next === 'SEALED') && (value === 'UNBUILT' || value === 'BUILT')) {
      setConfirm(next)
      return
    }
    void save(next)
  }

  return (
    <>
      <div className="statusctl" aria-label={d.buildStatus}>
        {BUILD_STATES.map((s) => (
          <button
            key={s}
            className={value === s ? 'on' : ''}
            aria-pressed={value === s}
            disabled={pending !== null}
            onClick={() => pick(s)}
          >
            {d.statusLabels[s]}
          </button>
        ))}
      </div>
      <div className="hint" style={{ marginTop: 12 }}>
        {d.statusEdit.hint}
        {savedTick && <b style={{ color: 'var(--green)', marginLeft: 8 }}>✓ {d.statusEdit.saved}</b>}
        {error && <b style={{ color: 'var(--brand)', marginLeft: 8 }}>{error}</b>}
      </div>

      {confirm && (
        <ConfirmDialog
          title={d.statusEdit.confirmTitle}
          body={d.statusEdit.confirmBody(d.statusLabels[value ?? ''] ?? '—')}
          cancelLabel={d.statusEdit.cancel}
          confirmLabel={d.statusEdit.confirm}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const next = confirm
            setConfirm(null)
            void save(next)
          }}
        />
      )}
    </>
  )
}

function ConfirmDialog({
  title, body, cancelLabel, confirmLabel, onCancel, onConfirm,
}: {
  title: string
  body: string
  cancelLabel: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="modalback" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="modalbox" onClick={(e) => e.stopPropagation()}>
        <div className="modalt">{title}</div>
        <p className="modalb">{body}</p>
        <div className="modalact">
          <button className="btnO" onClick={onCancel}>{cancelLabel}</button>
          <button className="btnP" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

// ─── MOD toggle + summary ────────────────────────────────────────────────────

function ModToggle({
  objectId, value, onChange,
}: {
  objectId: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [saving, setSaving] = useState(false)

  const toggle = async () => {
    const next = !value
    onChange(next)
    setSaving(true)
    const { error } = await supabase.from('objects').update({ is_modified: next }).eq('id', objectId)
    setSaving(false)
    if (error) onChange(!next)
  }

  return (
    <div className="modtoggle">
      <label className="switch">
        <input type="checkbox" checked={value} onChange={toggle} disabled={saving} aria-label={d.mod.toggleLabel} />
        <span className="sl" />
      </label>
      <div>
        <div className="mtl">{d.mod.toggleLabel}</div>
        <div className="mts">{d.mod.toggleDesc}</div>
      </div>
    </div>
  )
}

function ModSummary({ added, onManage }: { added: number; onManage: () => void }) {
  return (
    <div className="card2">
      <div className="modh">
        <div className="sect" style={{ margin: 0 }}>{d.mod.summaryTitle}</div>
        <span className="badge b-mod">MOD</span>
        <button className="link" style={{ marginLeft: 'auto' }} onClick={onManage}>{d.mod.manage}</button>
      </div>
      <div className="hint" style={{ marginTop: 8 }}>{d.mod.summaryLine(added)}</div>
    </div>
  )
}

// ─── Parts tab (FF_MOD) ──────────────────────────────────────────────────────

const pui = strings.setDetail.partsUI

function PartsTab({
  objectId, userId, initialParts, freeParts, initialAllocations, modified, partsCheckHref,
}: {
  objectId: string
  userId: string | null
  initialParts: SetPart[]
  freeParts: ModFreePart[]
  initialAllocations: SetAllocation[]
  modified: boolean
  partsCheckHref: string
}) {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<SetPart[]>(initialParts)
  const [pool, setPool] = useState<ModFreePart[]>(freeParts)
  const [allocs, setAllocs] = useState<SetAllocation[]>(initialAllocations)
  const [saving, setSaving] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const pending = timers.current
    return () => { pending.forEach((t) => clearTimeout(t)); pending.clear() }
  }, [])

  const official = useMemo(() => rows.filter((r) => !r.used_in_mod), [rows])
  const modRows = useMemo(() => rows.filter((r) => r.used_in_mod), [rows])

  const stats = useMemo(() => {
    let expected = 0, present = 0, missingLots = 0
    for (const r of official) {
      expected += r.qty_expected
      present += Math.min(r.qty_present, r.qty_expected)
      if (r.qty_present < r.qty_expected) missingLots++
    }
    return { expected, present, missing: expected - present, missingLots }
  }, [official])

  const persist = useCallback(
    async (id: string, qty: number) => {
      setSaving((n) => n + 1)
      const { error } = await supabase.from('inventory_parts').update({ qty_present: qty }).eq('id', id)
      setSaving((n) => n - 1)
      if (error) setError(strings.common.saveFailed)
    },
    [supabase]
  )

  const setHave = useCallback(
    (id: string, qty: number) => {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, qty_present: qty } : r)))
      const key = id
      const existing = timers.current.get(key)
      if (existing) clearTimeout(existing)
      timers.current.set(key, setTimeout(() => { timers.current.delete(key); void persist(id, qty) }, 400))
    },
    [persist]
  )

  const markAll = useCallback(
    async (full: boolean) => {
      setRows((prev) => prev.map((r) => (r.used_in_mod ? r : { ...r, qty_present: full ? r.qty_expected : 0 })))
      setSaving((n) => n + 1)
      const { error } = await supabase.rpc('set_all_parts_present', { p_object_id: objectId, p_full: full })
      setSaving((n) => n - 1)
      if (error) setError(strings.common.saveFailed)
    },
    [objectId, supabase]
  )

  if (rows.length === 0) {
    return (
      <div className="empty">
        <div className="ei" aria-hidden>◱</div>
        <div className="et">{pui.noChecklistTitle}</div>
        <div className="es"><Link className="link" href={partsCheckHref}>{pui.noChecklistSub}</Link></div>
      </div>
    )
  }

  return (
    <>
      <div className="barbig">
        <div className="bt">
          {pui.bar(formatNum(stats.present), formatNum(stats.expected))}
          {stats.missing > 0 && <> · <span className="mm">{pui.missing(formatNum(stats.missing))}</span></>}
        </div>
        <span className="sp" />
        {saving > 0 && <span className="hint">{strings.common.saving}</span>}
        {error && <span className="hint" style={{ color: 'var(--brand)' }}>{error}</span>}
        <button className="btnO" onClick={() => markAll(true)}>{pui.markAll}</button>
        <button className="btnG" onClick={() => markAll(false)}>{pui.reset}</button>
      </div>
      <p className="hint" style={{ margin: '-4px 0 12px' }}>{pui.intro}</p>

      {modified && (
        <ModEditor
          objectId={objectId}
          userId={userId}
          rows={rows}
          setRows={setRows}
          pool={pool}
          setPool={setPool}
          modRows={modRows}
          allocs={allocs}
          setAllocs={setAllocs}
          onError={setError}
        />
      )}

      {modified && modRows.length > 0 && (
        <>
          <div className="lbl2" style={{ margin: '2px 0 8px' }}>{d.mod.officialTitle}</div>
        </>
      )}
      <PartsTable rows={official} onHave={setHave} />
    </>
  )
}

function PartsTable({ rows, onHave }: { rows: SetPart[]; onHave: (id: string, qty: number) => void }) {
  return (
    <div className="tablewrap scroll">
      <table className="stbl">
        <thead>
          <tr>
            <th>{pui.colPart}</th>
            <th>{pui.colColour}</th>
            <th className="num">{pui.colInSet}</th>
            <th className="mid">{pui.colHave}</th>
            <th className="mid">{pui.colStatus}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const have = Math.min(r.qty_present, r.qty_expected)
            const missing = r.qty_expected - have
            return (
              <tr key={r.id}>
                <td>
                  <div className="pcell">
                    <div className="pth" aria-hidden>{r.part_img_url ? <img src={r.part_img_url} alt="" /> : '▦'}</div>
                    <div>
                      <div className="pn">{r.part_name ?? r.part_num}</div>
                      <div className="pid">{r.part_num}</div>
                    </div>
                  </div>
                </td>
                <td>{r.color_name}</td>
                <td className="num">{r.qty_expected}</td>
                <td className="mid">
                  <Stepper
                    value={r.qty_present}
                    max={r.qty_expected}
                    onChange={(n) => onHave(r.id, n)}
                    incLabel={pui.incDecInc}
                    decLabel={pui.incDecDec}
                  />
                </td>
                <td className="mid st">
                  {missing > 0
                    ? <span className="miss">{pui.missingStatus(String(missing))}</span>
                    : <span className="ok">✓ {pui.complete}</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── MOD editor ──────────────────────────────────────────────────────────────

function ModEditor({
  objectId, userId, rows, setRows, pool, setPool, modRows, allocs, setAllocs, onError,
}: {
  objectId: string
  userId: string | null
  rows: SetPart[]
  setRows: React.Dispatch<React.SetStateAction<SetPart[]>>
  pool: ModFreePart[]
  setPool: React.Dispatch<React.SetStateAction<ModFreePart[]>>
  modRows: SetPart[]
  allocs: SetAllocation[]
  setAllocs: React.Dispatch<React.SetStateAction<SetAllocation[]>>
  onError: (e: string | null) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [source, setSource] = useState<'inv' | 'new'>('inv')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)

  const query = q.trim().toLowerCase()
  const matches = useMemo(() => {
    if (!query) return pool.slice(0, 8)
    return pool
      .filter((f) =>
        (f.part_name ?? '').toLowerCase().includes(query) ||
        (f.part_num ?? '').toLowerCase().includes(query)
      )
      .slice(0, 8)
  }, [pool, query])

  // Add N of a free part into this mod: ensure a used_in_mod row exists, then
  // allocate from the pool (allocatePart bumps qty_present via the RPC).
  const addFromInventory = useCallback(
    async (fp: ModFreePart, qty: number) => {
      if (!userId || fp.part_color_id == null) return
      setBusy(true)
      onError(null)
      const colorId = fp.part_color_id
      const colorName = fp.part_color_name ?? strings.pool.unknownColour
      const existing = rows.find((r) => r.part_num === fp.part_num && r.color_id === colorId)

      let rowId = existing?.id
      if (existing) {
        // Grow the existing row's target count; keep its official/mod classification.
        const { error } = await supabase
          .from('inventory_parts')
          .update({ qty_expected: existing.qty_expected + qty })
          .eq('id', existing.id)
        if (error) { setBusy(false); onError(strings.common.saveFailed); return }
      } else {
        const { data, error } = await supabase
          .from('inventory_parts')
          .insert({
            object_id: objectId, user_id: userId, part_num: fp.part_num, color_id: colorId,
            color_name: colorName, part_name: fp.part_name, qty_expected: qty, qty_present: 0,
            used_in_mod: true, is_spare: false,
          })
          .select('id')
          .single()
        if (error || !data) { setBusy(false); onError(strings.common.saveFailed); return }
        rowId = data.id as string
      }

      const res = await allocatePart(supabase, {
        sourceObjectId: fp.source_object_id,
        targetObjectId: objectId,
        purpose: 'MOD_PART',
        quantity: qty,
        targetPartNum: fp.part_num!,
        targetColorId: colorId,
      })
      setBusy(false)
      if (res.error || !res.allocationId) { onError(res.error ?? strings.common.saveFailed); return }

      // Reflect locally: row present up, pool free down, allocation recorded.
      setRows((prev) => {
        const idx = prev.findIndex((r) => r.id === rowId)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = {
            ...next[idx],
            qty_expected: existing ? existing.qty_expected + qty : qty,
            qty_present: next[idx].qty_present + qty,
          }
          return next
        }
        return [
          ...prev,
          {
            id: rowId!, part_num: fp.part_num!, part_name: fp.part_name, color_id: colorId,
            color_name: colorName, part_img_url: null, qty_expected: qty, qty_present: qty,
            is_spare: false, used_in_mod: true,
          },
        ]
      })
      setPool((prev) =>
        prev
          .map((f) => (f.source_object_id === fp.source_object_id ? { ...f, qty_free: f.qty_free - qty } : f))
          .filter((f) => f.qty_free > 0)
      )
      setAllocs((prev) => [
        ...prev,
        { id: res.allocationId!, source_object_id: fp.source_object_id, purpose: 'MOD_PART', quantity: qty, target_part_num: fp.part_num, target_color_id: colorId },
      ])
    },
    [objectId, userId, rows, supabase, onError, setRows, setPool, setAllocs]
  )

  // Register a brand-new part, then allocate it straight into the mod.
  const registerNew = useCallback(
    async (input: { partNum: string; name: string; colorId: number; colorName: string; qty: number }) => {
      if (!userId) return
      setBusy(true)
      onError(null)
      const { data: srcObj, error: objErr } = await supabase
        .from('objects')
        .insert({
          object_type: 'PART', user_id: userId, part_num: input.partNum,
          part_color_id: input.colorId, part_color_name: input.colorName,
          name: input.name || input.partNum, quantity: input.qty, status: 'OWNED',
        })
        .select('id')
        .single()
      if (objErr || !srcObj) { setBusy(false); onError(strings.common.saveFailed); return }

      const { data: row, error: rowErr } = await supabase
        .from('inventory_parts')
        .insert({
          object_id: objectId, user_id: userId, part_num: input.partNum, color_id: input.colorId,
          color_name: input.colorName, part_name: input.name || input.partNum, qty_expected: input.qty,
          qty_present: 0, used_in_mod: true, is_spare: false,
        })
        .select('id')
        .single()
      if (rowErr || !row) { setBusy(false); onError(strings.common.saveFailed); return }

      const res = await allocatePart(supabase, {
        sourceObjectId: srcObj.id as string,
        targetObjectId: objectId,
        purpose: 'MOD_PART',
        quantity: input.qty,
        targetPartNum: input.partNum,
        targetColorId: input.colorId,
      })
      setBusy(false)
      if (res.error || !res.allocationId) { onError(res.error ?? strings.common.saveFailed); return }

      setRows((prev) => [
        ...prev,
        {
          id: row.id as string, part_num: input.partNum, part_name: input.name || input.partNum,
          color_id: input.colorId, color_name: input.colorName, part_img_url: null,
          qty_expected: input.qty, qty_present: input.qty, is_spare: false, used_in_mod: true,
        },
      ])
      setAllocs((prev) => [
        ...prev,
        { id: res.allocationId!, source_object_id: srcObj.id as string, purpose: 'MOD_PART', quantity: input.qty, target_part_num: input.partNum, target_color_id: input.colorId },
      ])
    },
    [objectId, userId, supabase, onError, setRows, setAllocs]
  )

  // Restore a mod-added part: release its MOD_PART allocations (pool refilled by
  // the RPC), then unwind the mod row's In-mod count; drop the row when empty.
  const restoreMod = useCallback(
    async (r: SetPart) => {
      setBusy(true)
      onError(null)
      const mine = allocs.filter(
        (a) => a.purpose === 'MOD_PART' && a.target_part_num === r.part_num && a.target_color_id === r.color_id
      )
      let restoredQty = 0
      for (const a of mine) {
        const { error } = await restore(supabase, a.id)
        if (error) { setBusy(false); onError(error); return }
        restoredQty += a.quantity
      }
      const newExpected = Math.max(r.qty_expected - restoredQty, 0)
      if (newExpected === 0) {
        await supabase.from('inventory_parts').delete().eq('id', r.id)
        setRows((prev) => prev.filter((x) => x.id !== r.id))
      } else {
        await supabase.from('inventory_parts').update({ qty_expected: newExpected }).eq('id', r.id)
        setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, qty_expected: newExpected, qty_present: Math.max(x.qty_present - restoredQty, 0) } : x)))
      }
      // Return freed quantity to the pool rows locally.
      const bySource = new Map<string, number>()
      for (const a of mine) bySource.set(a.source_object_id, (bySource.get(a.source_object_id) ?? 0) + a.quantity)
      setPool((prev) => {
        const next = [...prev]
        for (const [sid, qty] of bySource) {
          const idx = next.findIndex((f) => f.source_object_id === sid)
          if (idx >= 0) next[idx] = { ...next[idx], qty_free: next[idx].qty_free + qty }
        }
        return next
      })
      setAllocs((prev) => prev.filter((a) => !mine.some((m) => m.id === a.id)))
      setBusy(false)
    },
    [allocs, supabase, onError, setRows, setPool, setAllocs]
  )

  return (
    <>
      <div className="modeditor">
        <div className="medhd">
          <div className="sect" style={{ margin: 0 }}>{d.mod.editorTitle}</div>
          <span className="badge b-mod">MOD</span>
        </div>
        <div className="lbl2">{d.mod.addTitle}</div>
        <div className="statusctl" role="tablist" aria-label={d.mod.addTitle}>
          <button className={source === 'inv' ? 'on' : ''} onClick={() => setSource('inv')}>{d.mod.srcInv}</button>
          <button className={source === 'new' ? 'on' : ''} onClick={() => setSource('new')}>{d.mod.srcNew}</button>
        </div>

        {source === 'inv' ? (
          <>
            <div className="modsearch">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={d.mod.searchPlaceholder} />
            </div>
            <div className="hint" style={{ marginTop: 9 }}>{d.mod.hintInv}</div>
            <div className="modmatches">
              {matches.map((f) => (
                <ModMatch key={f.source_object_id} f={f} busy={busy} onAdd={addFromInventory} />
              ))}
            </div>
          </>
        ) : (
          <RegisterNewForm busy={busy} onSubmit={registerNew} />
        )}
      </div>

      {modRows.length > 0 && (
        <>
          <div className="lbl2" style={{ margin: '2px 0 8px' }}>{d.mod.addedTitle}</div>
          <div className="tablewrap scroll" style={{ marginBottom: 14 }}>
            <table className="stbl">
              <thead>
                <tr>
                  <th>{d.mod.colAddedPart}</th>
                  <th>{pui.colColour}</th>
                  <th className="num">{d.mod.colInMod}</th>
                  <th className="mid">{pui.colHave}</th>
                  <th className="mid" />
                </tr>
              </thead>
              <tbody>
                {modRows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="pcell">
                        <div className="pth" aria-hidden>▦</div>
                        <div>
                          <div className="pn">{r.part_name ?? r.part_num}</div>
                          <div className="pid">{r.part_num}</div>
                        </div>
                      </div>
                    </td>
                    <td>{r.color_name}</td>
                    <td className="num">{r.qty_expected}</td>
                    <td className="num">{r.qty_present}</td>
                    <td className="mid">
                      <button className="btnO" style={{ padding: '5px 11px', fontSize: 12 }} disabled={busy} onClick={() => restoreMod(r)}>
                        ↩ {strings.allocate.restore}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint" style={{ margin: '0 0 14px' }}>{d.mod.removeHint}</p>
        </>
      )}
    </>
  )
}

function ModMatch({
  f, busy, onAdd,
}: {
  f: ModFreePart
  busy: boolean
  onAdd: (f: ModFreePart, qty: number) => void
}) {
  const [qty, setQty] = useState(1)
  const unconfirmed = f.part_color_id == null
  return (
    <div className="modmatch">
      <div className="pcell">
        <div className="pth" aria-hidden>▦</div>
        <div>
          <div className="pn">{f.part_name ?? f.part_num}</div>
          <div className="pid">
            {f.part_num}
            {unconfirmed
              ? <> · <span style={{ color: 'var(--amber)' }}>{strings.pool.colourUnconfirmed}</span></>
              : ` · ${f.part_color_name}`}
          </div>
        </div>
      </div>
      <span className="hint" style={{ marginLeft: 'auto' }}>{d.mod.poolFree(f.qty_free, f.location_name)}</span>
      {unconfirmed ? (
        <Link className="link" href="/collection">{strings.pool.setColour} →</Link>
      ) : (
        <>
          <Stepper value={qty} max={f.qty_free} onChange={setQty} incLabel="+" decLabel="−" />
          <button className="btnP" style={{ padding: '7px 12px' }} disabled={busy || qty < 1} onClick={() => onAdd(f, qty)}>
            {d.mod.allocate}
          </button>
        </>
      )}
    </div>
  )
}

function RegisterNewForm({
  busy, onSubmit,
}: {
  busy: boolean
  onSubmit: (input: { partNum: string; name: string; colorId: number; colorName: string; qty: number }) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [partNum, setPartNum] = useState('')
  const [name, setName] = useState('')
  const [qty, setQty] = useState(1)
  const [colour, setColour] = useState<{ id: number; name: string } | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const rn = strings.setDetail.registerNew

  const canSubmit = partNum.trim() !== '' && colour != null && qty >= 1 && !busy

  return (
    <div className="regnew">
      <div className="regrow">
        <label className="reglbl">{rn.partNum}
          <input value={partNum} onChange={(e) => setPartNum(e.target.value)} placeholder="3001" />
        </label>
        <label className="reglbl">{rn.name}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Brick 2×4" />
        </label>
      </div>
      <div className="regrow">
        <div className="reglbl" style={{ position: 'relative' }}>{rn.colour}
          <button type="button" className="regcolour" onClick={() => setPickerOpen((v) => !v)}>
            {colour ? colour.name : rn.pickColour} ▾
          </button>
          {pickerOpen && (
            <RbColourPicker
              supabase={supabase}
              onPick={(c) => { setColour(c); setPickerOpen(false) }}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </div>
        <label className="reglbl">{rn.quantity}
          <span style={{ display: 'block', marginTop: 4 }}>
            <Stepper value={qty} max={999} onChange={setQty} incLabel="+" decLabel="−" />
          </span>
        </label>
      </div>
      <button
        className="btnP"
        style={{ marginTop: 12 }}
        disabled={!canSubmit}
        onClick={() => colour && onSubmit({ partNum: partNum.trim(), name: name.trim(), colorId: colour.id, colorName: colour.name, qty })}
      >
        {rn.add}
      </button>
    </div>
  )
}

function RbColourPicker({
  supabase, onPick, onClose,
}: {
  supabase: ReturnType<typeof createClient>
  onPick: (c: { id: number; name: string }) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<{ id: number; name: string; rgb: string | null }[]>([])
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onDown = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) onClose() }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onDown) }
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    const term = q.trim()
    const run = async () => {
      let query = supabase.from('rb_colors').select('id, name, rgb').order('name').limit(24)
      if (term) query = query.ilike('name', `%${term}%`)
      const { data } = await query
      if (!cancelled) setResults((data as { id: number; name: string; rgb: string | null }[]) ?? [])
    }
    const timer = setTimeout(run, 180)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [q, supabase])

  return (
    <div ref={boxRef} role="group" aria-label={strings.setDetail.registerNew.pickColour} className="rbpick">
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={strings.setDetail.registerNew.pickColour} />
      <div className="rblist">
        {results.map((c) => (
          <button key={c.id} onClick={() => onPick({ id: c.id, name: c.name })}>
            <i aria-hidden style={{ background: c.rgb ? `#${c.rgb}` : 'var(--track)' }} />
            {c.name}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Figures tab (FF_MOD) ────────────────────────────────────────────────────

const fui = strings.setDetail.figuresUI

function FiguresTab({ initialFigs }: { initialFigs: SetFig[] }) {
  const supabase = useMemo(() => createClient(), [])
  const [figs, setFigs] = useState<SetFig[]>(initialFigs)
  const [saving, setSaving] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const pending = timers.current
    return () => { pending.forEach((t) => clearTimeout(t)); pending.clear() }
  }, [])

  const stats = useMemo(() => {
    let expected = 0, present = 0
    for (const f of figs) { expected += f.qty_expected; present += Math.min(f.qty_present, f.qty_expected) }
    return { expected, present, missing: expected - present }
  }, [figs])

  const persist = useCallback(
    async (id: string, qty: number) => {
      setSaving((n) => n + 1)
      const { error } = await supabase.from('object_minifigs').update({ qty_present: qty }).eq('id', id)
      setSaving((n) => n - 1)
      if (error) setError(strings.common.saveFailed)
    },
    [supabase]
  )

  const setHave = useCallback(
    (id: string, qty: number) => {
      setFigs((prev) => prev.map((f) => (f.id === id ? { ...f, qty_present: qty } : f)))
      const existing = timers.current.get(id)
      if (existing) clearTimeout(existing)
      timers.current.set(id, setTimeout(() => { timers.current.delete(id); void persist(id, qty) }, 400))
    },
    [persist]
  )

  if (figs.length === 0) {
    return (
      <div className="empty">
        <div className="ei" aria-hidden>🧙</div>
        <div className="et">{fui.empty}</div>
      </div>
    )
  }

  const figSource = strings.partsCheck.minifigSources

  return (
    <>
      <div className="barbig">
        <div className="bt">
          {fui.bar(formatNum(stats.present), formatNum(stats.expected))}
          {stats.missing > 0 && <> · <span className="mm">{pui.missing(formatNum(stats.missing))}</span></>}
        </div>
        <span className="sp" />
        {saving > 0 && <span className="hint">{strings.common.saving}</span>}
        {error && <span className="hint" style={{ color: 'var(--brand)' }}>{error}</span>}
      </div>
      <div className="tablewrap scroll">
        <table className="stbl">
          <thead>
            <tr>
              <th>{fui.colFigure}</th>
              <th className="mid">{fui.colType}</th>
              <th className="num">{pui.colInSet}</th>
              <th className="mid">{pui.colHave}</th>
              <th className="mid">{pui.colStatus}</th>
            </tr>
          </thead>
          <tbody>
            {figs.map((f) => {
              const have = Math.min(f.qty_present, f.qty_expected)
              const missing = f.qty_expected - have
              return (
                <tr key={f.id}>
                  <td>
                    <div className="pcell">
                      <div className="pth" aria-hidden>{f.fig_img_url ? <img src={f.fig_img_url} alt="" /> : '🧙'}</div>
                      <div><div className="pn">{f.fig_name ?? f.fig_num}</div><div className="pid">{f.fig_num}</div></div>
                    </div>
                  </td>
                  <td className="mid"><span style={{ color: 'var(--muted)', fontWeight: 600 }}>{figSource[f.source]}</span></td>
                  <td className="num">{f.qty_expected}</td>
                  <td className="mid">
                    <Stepper value={f.qty_present} max={f.qty_expected} onChange={(n) => setHave(f.id, n)} incLabel={fui.incFig} decLabel={fui.decFig} />
                  </td>
                  <td className="mid st">
                    {missing > 0
                      ? <span className="miss">{pui.missingStatus(String(missing))}</span>
                      : <span className="ok">✓ {pui.complete}</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
