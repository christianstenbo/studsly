'use client'

import { useState } from 'react'
import { strings } from '@/lib/i18n/strings'

const i = strings.insights

export type BarRow = { label: string; value: number; display: string }

/**
 * A magnitude bar list (single raspberry hue) with an accessible
 * "Show as table" toggle — required for every Insights chart (a11y AA).
 */
export function InsightsBars({
  title,
  rows,
  valueHeader,
}: {
  title: string
  rows: BarRow[]
  valueHeader: string
}) {
  const [asTable, setAsTable] = useState(false)
  const max = Math.max(1, ...rows.map((r) => r.value))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <div className="sect" style={{ margin: 0 }}>{title}</div>
        <button
          className="link"
          style={{ marginLeft: 'auto' }}
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
        >
          {asTable ? i.showChart : i.showTable}
        </button>
      </div>

      {asTable ? (
        <table className="datatable">
          <thead>
            <tr>
              <th>{i.tableTheme}</th>
              <th style={{ textAlign: 'right' }}>{valueHeader}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className="num">{r.display}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="vbt">
          {rows.map((r) => (
            <div className="row" key={r.label}>
              <div className="top">
                <b>{r.label}</b>
                <span className="v">{r.display}</span>
              </div>
              <div className="mbar">
                <div className="f" style={{ width: `${Math.round((r.value / max) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
