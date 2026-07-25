'use client'

import { useState } from 'react'
import Link from 'next/link'
import { strings } from '@/lib/i18n/strings'
import { formatNum, formatNok, statusBadge } from '@/lib/display'

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

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch {
    return '—'
  }
}

export function SetDetailView({
  obj,
  components,
  completeness,
  img,
}: {
  obj: Obj
  components: Component[]
  completeness: Completeness
  img: string | null
}) {
  const [tab, setTab] = useState<Tab>('overview')
  const badge = statusBadge(obj)

  const thisCopy = obj.value_override_nok ?? obj.value_base_nok ?? obj.estimated_value_bl ?? null
  const currentStatus =
    obj.build_status === 'BUILT' || obj.is_built ? 'built'
    : obj.build_status === 'UNBUILT' ? 'unbuilt'
    : 'sealed'

  const hasCompleteness =
    completeness && (completeness.pieces_expected ?? 0) > 0

  const tierLabel =
    obj.value_tier === 'SEALED' ? d.ledger.tierSealed
    : obj.value_tier === 'USED_COMPLETE_CIB' ? d.ledger.tierCib
    : obj.value_tier === 'USED_INCOMPLETE' ? d.ledger.tierIncomplete
    : null

  const partsCheckHref = `/collection/${obj.id}/parts-check`

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
            <span className={`badge b-${badge.kind}`} style={{ fontSize: 11.5, padding: '4px 10px' }}>
              {badge.label}
            </span>
            {obj.is_modified && (
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
            <div className="statusctl" aria-label={d.buildStatus}>
              <button className={currentStatus === 'sealed' ? 'on' : ''} disabled>
                {d.status.sealed}
              </button>
              <button className={currentStatus === 'unbuilt' ? 'on' : ''} disabled>
                {d.status.unbuilt}
              </button>
              <button className={currentStatus === 'built' ? 'on' : ''} disabled>
                {d.status.built}
              </button>
            </div>
            <div className="hint" style={{ marginTop: 12 }}>{d.statusReadonly}</div>
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
                <Link className="link" href={partsCheckHref}>{d.goToParts}</Link>
              </div>
            )}
          </div>

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
      )}

      {/* FIGURES */}
      {tab === 'figures' && (
        <div className="empty">
          <div className="ei" aria-hidden>🧙</div>
          <div className="et">{d.figuresTabEmpty}</div>
        </div>
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
