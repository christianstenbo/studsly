import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { strings } from "@/lib/i18n/strings"
import { formatNum, formatNok } from "@/lib/display"
import { InsightsBars, type BarRow } from "@/components/insights/insights-bars"

export const metadata = { title: strings.insights.pageTitle }

const i = strings.insights

type Row = {
  id: string
  object_type: string
  name: string | null
  theme: string | null
  year: number | null
  build_status: string | null
  is_built: boolean | null
  num_parts: number | null
  num_minifigs: number | null
  estimated_value_bl: number | null
  quality_level: string | null
}

function topBy(
  rows: Row[],
  key: (r: Row) => number,
  n = 5
): { theme: string; total: number }[] {
  const byTheme = new Map<string, number>()
  for (const r of rows) {
    const theme = r.theme ?? "Other"
    byTheme.set(theme, (byTheme.get(theme) ?? 0) + key(r))
  }
  return [...byTheme.entries()]
    .map(([theme, total]) => ({ theme, total }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, n)
}

export default async function InsightsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("objects")
    .select(
      `id, object_type, name, theme, year, build_status, is_built,
       num_parts, num_minifigs, estimated_value_bl, quality_level`
    )
    .eq("status", "OWNED")

  const objects = (data ?? []) as Row[]
  const sets = objects.filter((o) => o.object_type === "SET")

  const totalValue = objects.reduce((a, o) => a + (o.estimated_value_bl ?? 0), 0)
  const totalParts = objects.reduce((a, o) => a + (o.num_parts ?? 0), 0)
  const totalFigures = objects.reduce((a, o) => a + (o.num_minifigs ?? 0), 0)

  const bs = { new: 0, unbuilt: 0, built: 0 }
  for (const o of sets) {
    if (o.build_status === "BUILT" || o.is_built) bs.built++
    else if (o.build_status === "UNBUILT") bs.unbuilt++
    else bs.new++
  }
  const setTotal = sets.length || 1
  const pct = (n: number) => Math.round((n / setTotal) * 100)

  const valueByTheme: BarRow[] = topBy(sets, (r) => r.estimated_value_bl ?? 0).map((x) => ({
    label: x.theme,
    value: x.total,
    display: formatNok(x.total),
  }))
  const setsByTheme: BarRow[] = topBy(sets, () => 1).map((x) => ({
    label: x.theme,
    value: x.total,
    display: formatNum(x.total),
  }))

  const mostValuable = [...sets]
    .sort((a, b) => (b.estimated_value_bl ?? 0) - (a.estimated_value_bl ?? 0))
    .slice(0, 5)

  const doc = { basic: 0, documented: 0, verified: 0 }
  for (const o of sets) {
    if (o.quality_level === "VERIFIED") doc.verified++
    else if (o.quality_level === "DOCUMENTED") doc.documented++
    else doc.basic++
  }
  const docPct = (n: number) => Math.round((n / setTotal) * 100)

  const hasValue = totalValue > 0

  return (
    <div className="sc-insights">
      <div className="ihead">
        <div>
          <h1>{i.title}</h1>
          <p className="sub">
            {i.subtitle(formatNum(sets.length), formatNum(totalParts), formatNok(totalValue))}
          </p>
        </div>
        <button className="btnO" disabled>{i.exportReport}</button>
      </div>

      {/* PORTFOLIO VALUE */}
      <div className="sectlbl">{i.sections.portfolioValue}</div>
      <div className="card">
        {hasValue ? (
          <div className="valuewrap">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span className="bigval">{formatNok(totalValue)}</span>
              </div>
              <div className="hint" style={{ marginTop: 12 }}>{i.valueChartNote}</div>
            </div>
            <div>
              <InsightsBars title={i.valueByTheme} rows={valueByTheme} valueHeader={i.tableValue} />
              {valueByTheme.length === 0 && <p className="hint">—</p>}
            </div>
          </div>
        ) : (
          <p className="hint">{i.emptyValue}</p>
        )}
      </div>

      {/* MAKE-UP */}
      <div className="sectlbl">{i.sections.makeUp}</div>
      <div className="grid3">
        <div className="card">
          <div className="sect">{i.buildStatus}</div>
          <div className="statebar" aria-hidden>
            <span className="s-new" style={{ width: `${pct(bs.new)}%` }} />
            <span className="s-unb" style={{ width: `${pct(bs.unbuilt)}%` }} />
            <span className="s-blt" style={{ width: `${pct(bs.built)}%` }} />
          </div>
          <div className="legend">
            <div className="li"><i className="s-new" /><span className="nm">New / Sealed</span><span className="vv">{formatNum(bs.new)}</span><span className="pc">{pct(bs.new)}%</span></div>
            <div className="li"><i className="s-unb" /><span className="nm">Unbuilt (opened)</span><span className="vv">{formatNum(bs.unbuilt)}</span><span className="pc">{pct(bs.unbuilt)}%</span></div>
            <div className="li"><i className="s-blt" /><span className="nm">Built</span><span className="vv">{formatNum(bs.built)}</span><span className="pc">{pct(bs.built)}%</span></div>
          </div>
          <div className="hint" style={{ marginTop: 12 }}>{i.buildStatusNote}</div>
        </div>

        <div className="card">
          <div className="sect">{i.whatsInIt}</div>
          <div className="tiles">
            <div className="tile"><div className="tl">{i.tiles.sets}</div><div className="tn">{formatNum(sets.length)}</div></div>
            <div className="tile"><div className="tl">{i.tiles.figures}</div><div className="tn">{formatNum(totalFigures)}</div></div>
            <div className="tile"><div className="tl">{i.tiles.animals}</div><div className="tn">—</div></div>
            <div className="tile"><div className="tl">{i.tiles.parts}</div><div className="tn">{formatNum(totalParts)}</div></div>
          </div>
          <div className="hint" style={{ marginTop: 12 }}>{i.whatsInItNote}</div>
        </div>

        <div className="card">
          <InsightsBars title={i.setsByTheme} rows={setsByTheme} valueHeader={i.tableCount} />
        </div>
      </div>

      {/* COMPLETION */}
      <div className="sectlbl">{i.sections.completion}</div>
      <div className="grid2">
        <div className="card">
          <div className="sect">{i.closestSeries}</div>
          <p className="hint">{i.closestSeriesEmpty}</p>
        </div>
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
            <div className="sect" style={{ margin: 0 }}>{i.finishThese}</div>
            <span className="hint" style={{ marginLeft: "auto", textTransform: "none" }}>{i.finishTheseSub}</span>
          </div>
          <p className="hint" style={{ marginTop: 8 }}>{i.finishTheseEmpty}</p>
        </div>
      </div>

      {/* LEADERS & MOVERS */}
      <div className="sectlbl">{i.sections.leaders}</div>
      <div className="grid2">
        <div className="card">
          <div className="sect">{i.mostValuable}</div>
          {mostValuable.map((o, idx) => (
            <Link className="lrow" key={o.id} href={`/collection/${o.id}`}>
              <span className="rk">{idx + 1}</span>
              <div className="lth" aria-hidden>▦</div>
              <div className="lb">
                <div className="ln">{o.name ?? strings.common.unnamed}</div>
                <div className="lm">{[o.theme, o.year].filter(Boolean).join(" · ")}</div>
              </div>
              <span className="lv">{formatNok(o.estimated_value_bl)}</span>
            </Link>
          ))}
          <div style={{ marginTop: 12 }}>
            <Link className="link" href="/collection">{i.openFull}</Link>
          </div>
        </div>
        <div className="card">
          <div className="sect">{i.movers}</div>
          <p className="hint">{i.moversEmpty}</p>
        </div>
      </div>

      {/* INSURANCE READINESS */}
      <div className="sectlbl">{i.sections.insurance}</div>
      <div className="card">
        <div className="ins">
          <div>
            <div className="sect">{i.documentation}</div>
            <div className="docbar" aria-hidden>
              <span className="d-basic" style={{ width: `${docPct(doc.basic)}%` }} />
              <span className="d-doc" style={{ width: `${docPct(doc.documented)}%` }} />
              <span className="d-ver" style={{ width: `${docPct(doc.verified)}%` }} />
            </div>
            <div className="legend">
              <div className="li"><i className="d-basic" /><span className="nm">{i.docBasic}</span><span className="vv">{formatNum(doc.basic)}</span><span className="pc">{docPct(doc.basic)}%</span></div>
              <div className="li"><i className="d-doc" /><span className="nm">{i.docDocumented}</span><span className="vv">{formatNum(doc.documented)}</span><span className="pc">{docPct(doc.documented)}%</span></div>
              <div className="li"><i className="d-ver" /><span className="nm">{i.docVerified}</span><span className="vv">{formatNum(doc.verified)}</span><span className="pc">{docPct(doc.verified)}%</span></div>
            </div>
          </div>
          <div className="insCta">
            <div>
              <div className="bigval" style={{ fontSize: 26 }}>{formatNok(totalValue)}</div>
              <div className="hint" style={{ marginTop: 4 }}>
                {i.coveredValue(formatNum(sets.length), formatNum(sets.length))}
              </div>
            </div>
            <button className="btnP" style={{ justifyContent: "center" }} disabled>{i.exportReport}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
