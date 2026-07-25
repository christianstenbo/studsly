import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { strings } from "@/lib/i18n/strings"
import { formatNum, formatNok, statusBadge, themeYear, imageUrl } from "@/lib/display"

export const metadata = { title: strings.home.pageTitle }

const s = strings.home

type Row = {
  id: string
  object_type: string
  set_number: string | null
  name: string | null
  theme: string | null
  year: number | null
  condition: string | null
  is_built: boolean | null
  build_status: string | null
  num_parts: number | null
  num_minifigs: number | null
  estimated_value_bl: number | null
  image_filename: string | null
  created_at: string
}

function firstName(email: string | undefined): string {
  if (!email) return "there"
  const local = email.split("@")[0].split(/[._-]/)[0]
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : "there"
}

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""

  const [{ data: rows }, { count: catalogSets }, { data: checklistRows }] =
    await Promise.all([
      supabase
        .from("objects")
        .select(
          `id, object_type, set_number, name, theme, year, condition, is_built,
           build_status, num_parts, num_minifigs, estimated_value_bl,
           image_filename, created_at`
        )
        .eq("status", "OWNED")
        .order("created_at", { ascending: false }),
      supabase.from("rb_sets").select("*", { count: "exact", head: true }),
      supabase.from("inventory_parts").select("object_id"),
    ])

  const objects = (rows ?? []) as Row[]
  const sets = objects.filter((o) => o.object_type === "SET")

  const totalValue = objects.reduce((a, o) => a + (o.estimated_value_bl ?? 0), 0)
  const totalParts = objects.reduce((a, o) => a + (o.num_parts ?? 0), 0)
  const totalMinifigs = objects.reduce((a, o) => a + (o.num_minifigs ?? 0), 0)

  const counts = { new: 0, unbuilt: 0, built: 0 }
  for (const o of sets) {
    const b = o.build_status
    if (b === "BUILT" || o.is_built) counts.built++
    else if (b === "UNBUILT") counts.unbuilt++
    else counts.new++ // SEALED / NEW / unmigrated
  }
  const setTotal = sets.length || 1
  const pct = (n: number) => Math.round((n / setTotal) * 100)

  const uniqueSets = new Set(sets.map((o) => o.set_number).filter(Boolean)).size
  const uniquePct =
    catalogSets && catalogSets > 0
      ? `${((uniqueSets / catalogSets) * 100).toFixed(1)}%`
      : "—"

  const withChecklist = new Set((checklistRows ?? []).map((r) => r.object_id))
  const notCounted = sets.filter((o) => !withChecklist.has(o.id)).length

  const recent = sets.slice(0, 4)

  return (
    <div className="sc-home">
      <h1 className="hi">{s.greeting(firstName(user?.email))}</h1>

      {/* Ask Studsly (Phase 2 — presentational) */}
      <div className="ask">
        <h2>
          <span className="sp" aria-hidden>✦</span> {s.ask.title}
        </h2>
        <div className="askin">
          <input placeholder={s.ask.placeholder} disabled aria-label={s.ask.title} />
          <button className="go" type="button" disabled>{s.ask.button}</button>
        </div>
        <div className="askhint">{s.ask.hint}</div>
      </div>

      <div style={{ height: 18 }} />

      {/* KPIs */}
      <div className="kpis">
        <div className="kpi">
          <div className="kl">
            {s.kpi.value} <span className="klc">{s.kpi.valueUnit}</span>
          </div>
          <div className="kn brand">{formatNum(totalValue)}</div>
          <div className="ks">{s.kpi.valueSub}</div>
        </div>

        <div className="kpi">
          <div className="kl">{s.kpi.parts}</div>
          <div className="kn">{formatNum(totalParts)}</div>
          <div className="kslist">
            <span>{s.kpi.setsUnit(formatNum(sets.length))}</span>
            <span>{s.kpi.figsUnit(formatNum(totalMinifigs))}</span>
          </div>
        </div>

        <div className="kpi">
          <div className="kl">{s.kpi.buildStatus}</div>
          <div className="kn">
            {pct(counts.new)}%<span className="knu">{s.kpi.newSuffix}</span>
          </div>
          <div className="statebar" aria-hidden>
            <span className="s-new" style={{ width: `${pct(counts.new)}%` }} />
            <span className="s-unb" style={{ width: `${pct(counts.unbuilt)}%` }} />
            <span className="s-blt" style={{ width: `${pct(counts.built)}%` }} />
          </div>
          <div className="statelegend">
            <span><i className="new" />{s.kpi.new} {formatNum(counts.new)}</span>
            <span><i className="unb" />{s.kpi.unbuilt} {formatNum(counts.unbuilt)}</span>
            <span><i className="blt" />{s.kpi.built} {formatNum(counts.built)}</span>
          </div>
        </div>

        <div className="kpi">
          <div className="kl">{s.kpi.uniqueSets}</div>
          <div className="kn">{formatNum(uniqueSets)}</div>
          <div className="ks">{s.kpi.uniqueSub(uniquePct)}</div>
        </div>
      </div>

      <div style={{ height: 18 }} />

      {/* Attention + closest */}
      <div className="grid3">
        <div className="card">
          <div className="sect" style={{ marginBottom: 6 }}>{s.attention.title}</div>
          {notCounted > 0 ? (
            <div className="task">
              <div className="ti brand" aria-hidden>◱</div>
              <div className="tb">
                <div className="tt">{s.attention.notCounted(formatNum(notCounted))}</div>
                <div className="tsu">{s.attention.notCountedSub}</div>
              </div>
              <Link className="tbtn pri" href="/collection">{s.attention.start}</Link>
            </div>
          ) : (
            <p className="hint" style={{ marginTop: 6 }}>{s.attention.empty}</p>
          )}
        </div>

        <div className="card">
          <div className="sect">{s.closest.title}</div>
          <p className="hint">{s.closest.empty}</p>
          <div style={{ marginTop: 12 }}>
            <Link className="link" href="/insights">{s.closest.seeAll}</Link>
          </div>
        </div>
      </div>

      <div style={{ height: 18 }} />

      {/* Recently added */}
      <div className="card prev">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div className="sect" style={{ margin: 0 }}>{s.recent.title}</div>
          <Link className="link" href="/collection">{s.recent.openFull}</Link>
        </div>
        {recent.length === 0 ? (
          <p className="hint" style={{ marginTop: 8 }}>{s.recent.empty}</p>
        ) : (
          recent.map((o) => {
            const badge = statusBadge(o)
            const img = imageUrl(supabaseUrl, o.image_filename)
            return (
              <Link key={o.id} className="prow" href={`/collection/${o.id}`}>
                <div className="thumb" aria-hidden>
                  {img ? <img src={img} alt="" /> : "▦"}
                </div>
                <div>
                  <div className="pn">{o.name ?? strings.common.unnamed}</div>
                  <div className="pm">{themeYear(o)}</div>
                </div>
                <div className="pv">
                  <div className="pval">{formatNok(o.estimated_value_bl)}</div>
                  <span className={`badge b-${badge.kind}`}>{badge.label}</span>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
