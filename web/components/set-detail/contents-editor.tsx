'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { strings } from '@/lib/i18n/strings'
import { createClient } from '@/lib/supabase/client'
import { allocateComponent, restore } from '@/lib/allocate'
import type { SetComponent, FreeComponent, CopyInfo } from '@/lib/types/set-detail'

const c = strings.setDetail.contentsUI
const dmg = strings.setDetail.damage
const GRADE_LABELS = strings.setDetail.grades

// Canonical content components shown as a fixed checklist, so a box can be added
// even when no row exists yet. INSTRUCTIONS/ORIGINAL_BOX can be allocated from
// loose inventory; the others are simple present/condition rows.
const CANON: { kind: string; icon: string; allocatable: boolean; objectType?: string }[] = [
  { kind: 'INSTRUCTIONS', icon: '📘', allocatable: true, objectType: 'INSTRUCTION' },
  { kind: 'ORIGINAL_BOX', icon: '📦', allocatable: true, objectType: 'ORIGINAL_BOX' },
  { kind: 'STICKER_SHEET', icon: '🏷️', allocatable: false },
  { kind: 'EXTRAS', icon: '➕', allocatable: false },
]
const GRADES = ['MINT', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR'] as const
const DAMAGE_TAGS = [
  'UV_YELLOWING', 'SCRATCHED', 'BITE_MARKS', 'STRESS_CRACKS',
  'PRINT_WORN', 'PRINT_MISSING', 'DISCOLOURED', 'WARPED', 'OTHER',
] as const

export function ContentsEditor({
  objectId,
  userId,
  initialComponents,
  freeComponents,
  initialGrade,
  completenessPct,
  copyInfo,
  onValueTab,
}: {
  objectId: string
  userId: string | null
  initialComponents: SetComponent[]
  freeComponents: FreeComponent[]
  initialGrade: string | null
  completenessPct: number | null
  copyInfo: CopyInfo | null
  onValueTab: () => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [comps, setComps] = useState<Map<string, SetComponent>>(() => {
    const m = new Map<string, SetComponent>()
    for (const row of initialComponents) if (!m.has(row.kind)) m.set(row.kind, row)
    return m
  })
  const [free, setFree] = useState<FreeComponent[]>(freeComponents)
  const [grade, setGrade] = useState<string | null>(initialGrade)
  const [openCond, setOpenCond] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const freeByType = useMemo(() => {
    const m = new Map<string, FreeComponent[]>()
    for (const f of free) {
      const list = m.get(f.object_type)
      if (list) list.push(f)
      else m.set(f.object_type, [f])
    }
    return m
  }, [free])

  // Create the object_components row for a kind if it doesn't exist yet.
  const ensureRow = useCallback(
    async (kind: string, patch: Partial<SetComponent>): Promise<SetComponent | null> => {
      if (!userId) return null
      const existing = comps.get(kind)
      if (existing) {
        const { error } = await supabase.from('object_components').update(patch).eq('id', existing.id)
        if (error) { setError(strings.common.saveFailed); return null }
        const next = { ...existing, ...patch }
        setComps((prev) => new Map(prev).set(kind, next))
        return next
      }
      const { data, error } = await supabase
        .from('object_components')
        .insert({
          object_id: objectId, user_id: userId, kind,
          is_present: false, damage_tags: [], ...patch,
        })
        .select('id, kind, label, is_present, grade, damage_tags, note, linked_object_id')
        .single()
      if (error || !data) { setError(strings.common.saveFailed); return null }
      const row = data as SetComponent
      setComps((prev) => new Map(prev).set(kind, row))
      return row
    },
    [comps, objectId, userId, supabase]
  )

  const togglePresent = useCallback(
    async (kind: string) => {
      setError(null)
      const cur = comps.get(kind)
      await ensureRow(kind, { is_present: !(cur?.is_present ?? false) })
    },
    [comps, ensureRow]
  )

  const saveCondition = useCallback(
    async (kind: string, g: string | null, tags: string[], note: string) => {
      setError(null)
      await ensureRow(kind, { grade: g, damage_tags: tags, note: note || null })
    },
    [ensureRow]
  )

  // Allocate a loose manual/box to this copy (COMPONENT allocation).
  const allocate = useCallback(
    async (kind: string, objectType: string) => {
      if (!userId) return
      const candidate = (freeByType.get(objectType) ?? [])[0]
      if (!candidate) return
      setBusy(true)
      setError(null)
      const row = await ensureRow(kind, {})
      if (!row) { setBusy(false); return }
      const res = await allocateComponent(supabase, {
        sourceObjectId: candidate.source_object_id,
        targetObjectId: objectId,
        componentId: row.id,
      })
      setBusy(false)
      if (res.error) { setError(res.error); return }
      // The RPC set is_present + linked_object_id on the row.
      setComps((prev) => {
        const cur = prev.get(kind)
        if (!cur) return prev
        return new Map(prev).set(kind, { ...cur, is_present: true, linked_object_id: candidate.source_object_id })
      })
      setFree((prev) => prev.filter((f) => f.source_object_id !== candidate.source_object_id))
    },
    [freeByType, ensureRow, supabase, objectId, userId]
  )

  // Restore an allocated component back to the loose pool.
  const restoreComponent = useCallback(
    async (kind: string) => {
      const row = comps.get(kind)
      if (!row?.linked_object_id) return
      setBusy(true)
      setError(null)
      // Find the active COMPONENT allocation for this component row.
      const { data: alloc } = await supabase
        .from('allocations')
        .select('id')
        .eq('target_component_id', row.id)
        .is('released_at', null)
        .maybeSingle()
      if (alloc?.id) {
        const { error } = await restore(supabase, alloc.id as string)
        if (error) { setBusy(false); setError(error); return }
      }
      setComps((prev) => new Map(prev).set(kind, { ...row, is_present: false, linked_object_id: null }))
      setBusy(false)
    },
    [comps, supabase]
  )

  const setOverall = useCallback(
    async (g: string) => {
      const next = g === grade ? null : g
      setGrade(next)
      const { error } = await supabase.from('objects').update({ condition_grade: next }).eq('id', objectId)
      if (error) setError(strings.common.saveFailed)
    },
    [grade, objectId, supabase]
  )

  const hasInstr = comps.get('INSTRUCTIONS')?.is_present ?? false
  const hasBox = comps.get('ORIGINAL_BOX')?.is_present ?? false

  return (
    <div className="card2">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div className="sect" style={{ margin: 0 }}>{strings.setDetail.contents}</div>
        {copyInfo && <span className="badge b-used">{c.copyBadge(copyInfo.index, copyInfo.total)}</span>}
        <button className="link" style={{ marginLeft: 'auto' }} onClick={onValueTab}>{c.valueImpact}</button>
      </div>

      <div className="contents">
        {CANON.map(({ kind, icon, allocatable, objectType }) => {
          const row = comps.get(kind)
          const present = row?.is_present ?? false
          const linked = row?.linked_object_id != null
          const freeCount = objectType ? (freeByType.get(objectType)?.length ?? 0) : 0
          const word = c.word[kind] ?? c.kinds[kind]
          return (
            <div className="crow" key={kind}>
              <div className="ci" aria-hidden>{icon}</div>
              <div className="cb">
                <div className="cn">{c.kinds[kind]}</div>
                <div className={`cs${!present ? ' miss2' : ''}`}>
                  {present
                    ? (linked ? c.allocated : c.present)
                    : allocatable && freeCount > 0
                      ? c.looseAvailable(freeCount, word)
                      : c.notPresent}
                </div>
              </div>

              {present ? (
                <>
                  <button className="cchip cond" onClick={() => setOpenCond(kind)}>
                    {row?.grade ? (GRADE_LABELS[row.grade as keyof typeof GRADE_LABELS] ?? row.grade) : c.condition}
                    {row && row.damage_tags.length > 0 && ` · ${row.damage_tags.length}`}
                  </button>
                  {linked && (
                    <button className="btnG" style={{ padding: '4px 6px' }} disabled={busy} onClick={() => restoreComponent(kind)}>
                      ↩ {strings.allocate.restore}
                    </button>
                  )}
                  <PresentSwitch on onToggle={() => togglePresent(kind)} />
                </>
              ) : allocatable && freeCount > 0 ? (
                <button className="alloc" disabled={busy} onClick={() => allocate(kind, objectType!)}>
                  {c.allocate(word)}
                </button>
              ) : (
                <PresentSwitch on={false} onToggle={() => togglePresent(kind)} />
              )}

              {openCond === kind && (
                <ConditionPopover
                  grade={row?.grade ?? null}
                  tags={row?.damage_tags ?? []}
                  note={row?.note ?? ''}
                  onClose={() => setOpenCond(null)}
                  onSave={(g, tags, note) => { void saveCondition(kind, g, tags, note); setOpenCond(null) }}
                />
              )}
            </div>
          )
        })}
      </div>

      <div className="gradewrap">
        <span className="lbl3">{c.overall}</span>
        <GradeControl value={grade} onChange={setOverall} />
      </div>

      {error && <p className="hint" role="alert" style={{ color: 'var(--brand)', marginTop: 8 }}>{error}</p>}

      <div className="cibline">
        <b>{c.cibPrefix}</b>{' '}
        {completenessPct != null && <><b>{c.cibParts(`${Math.round(completenessPct)}%`)}</b> · </>}
        {hasInstr ? c.cibInstr : <b style={{ color: 'var(--amber)' }}>{c.cibNoInstr}</b>}
        {' · '}
        {hasBox ? c.cibBox : <b style={{ color: 'var(--amber)' }}>{c.cibNoBox}</b>}
        . {c.cibHint}
      </div>
    </div>
  )
}

// ─── Present toggle ──────────────────────────────────────────────────────────

function PresentSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <label className="switch" style={{ flex: '0 0 auto' }}>
      <input type="checkbox" checked={on} onChange={onToggle} aria-label={c.togglePresent} />
      <span className="sl" />
    </label>
  )
}

// ─── Grade control (5-segment) ───────────────────────────────────────────────

function GradeControl({
  value, onChange, compact,
}: {
  value: string | null
  onChange: (g: string) => void
  compact?: boolean
}) {
  return (
    <div className="statusctl" aria-label={c.overall} style={compact ? { padding: 2 } : undefined}>
      {GRADES.map((g) => (
        <button
          key={g}
          className={value === g ? 'on' : ''}
          aria-pressed={value === g}
          onClick={() => onChange(g)}
          style={compact ? { padding: '5px 9px', fontSize: 12 } : undefined}
        >
          {GRADE_LABELS[g as keyof typeof GRADE_LABELS]}
        </button>
      ))}
    </div>
  )
}

// ─── Condition & damage popover (grade + tags + note) ────────────────────────

function ConditionPopover({
  grade, tags, note, onClose, onSave,
}: {
  grade: string | null
  tags: string[]
  note: string
  onClose: () => void
  onSave: (grade: string | null, tags: string[], note: string) => void
}) {
  const [g, setG] = useState<string | null>(grade)
  const [t, setT] = useState<string[]>(tags)
  const [n, setN] = useState<string>(note)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onDown = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) onClose() }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onDown) }
  }, [onClose])

  const toggleTag = (tag: string) =>
    setT((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]))

  return (
    <div ref={boxRef} className="condpop" role="group" aria-label={dmg.title}>
      <div className="condpop-t">{dmg.title}</div>
      <GradeControl value={g} onChange={(x) => setG((cur) => (cur === x ? null : x))} compact />
      <div className="tagchips">
        {DAMAGE_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            className={`tagchip${t.includes(tag) ? ' on' : ''}`}
            aria-pressed={t.includes(tag)}
            onClick={() => toggleTag(tag)}
          >
            {tag === 'UV_YELLOWING' && '⭐ '}{dmg.tags[tag]}
          </button>
        ))}
      </div>
      <textarea
        className="condnote"
        value={n}
        onChange={(e) => setN(e.target.value)}
        placeholder={dmg.notePlaceholder}
        rows={2}
      />
      <div className="condpop-act">
        <button className="btnG" onClick={() => { setG(null); setT([]); setN('') }}>{dmg.clear}</button>
        <button className="btnP" style={{ padding: '7px 13px' }} onClick={() => onSave(g, t, n)}>{dmg.done}</button>
      </div>
    </div>
  )
}
