import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * The one empty state in the app.
 *
 * Every empty list owes the reader three things, in this order:
 *   1. what this is        — the title
 *   2. why it is empty     — the body, stated as a cause, not an apology
 *   3. the obvious next step — exactly one action
 *
 * "No data" is not an empty state. Neither is a bare 0. If a screen cannot say
 * why it is empty, that is a sign the screen does not know what it is for.
 *
 * `action` is optional because some screens are legitimately empty with nothing
 * to do about it yet — Animals cannot be filled in because the data model has no
 * animal flag, and no button changes that. In those cases the body carries the
 * explanation and no button is offered, rather than a button that does nothing.
 */
export function EmptyState({
  icon = '▦',
  title,
  body,
  action,
  children,
}: {
  icon?: string
  title: string
  body?: string
  action?: { href: string; label: string }
  children?: ReactNode
}) {
  return (
    <div className="empty">
      <div className="ei" aria-hidden>
        {icon}
      </div>
      <div className="et">{title}</div>
      {body && <div className="es">{body}</div>}
      {action && (
        <Link className="btnP" href={action.href} style={{ marginTop: 12 }}>
          {action.label}
        </Link>
      )}
      {children}
    </div>
  )
}
