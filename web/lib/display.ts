import type { CollectionObject } from '@/lib/types/objects'

/** Thousands-separated integer, e.g. 262312 -> "262,312". */
export function formatNum(n: number | null | undefined): string {
  if (n == null) return '—'
  return Math.round(n).toLocaleString('en-US')
}

/** NOK value, e.g. 4200 -> "kr 4,200". Null-safe. */
export function formatNok(n: number | null | undefined): string {
  if (n == null) return '—'
  return `kr ${Math.round(n).toLocaleString('en-US')}`
}

export type BadgeKind = 'seal' | 'built' | 'used' | 'anim' | 'mod'

/**
 * Build-status badge for a set, using the vocabulary from the mockups
 * (Sealed / Built / Used). build_status is the source of truth once
 * migrated (v4 M8); condition/is_built are the legacy fallback.
 */
export function statusBadge(o: {
  build_status?: string | null
  condition?: string | null
  is_built?: boolean | null
}): { label: string; kind: BadgeKind } {
  const bs = o.build_status
  if (bs === 'BUILT' || o.is_built) return { label: 'Built', kind: 'built' }
  if (bs === 'SEALED' || bs === 'NEW' || o.condition === 'SEALED')
    return { label: 'Sealed', kind: 'seal' }
  if (bs === 'UNBUILT') return { label: 'Used', kind: 'used' }
  // Legacy fallback
  if (o.condition === 'BUILT') return { label: 'Built', kind: 'built' }
  return { label: 'Used', kind: 'used' }
}

/** "Theme · Year" meta line, skipping missing parts. */
export function themeYear(o: Pick<CollectionObject, 'theme' | 'year'>): string {
  return [o.theme, o.year].filter(Boolean).join(' · ')
}

/** Public URL for a stored object image, or null. */
export function imageUrl(
  supabaseUrl: string,
  filename: string | null | undefined
): string | null {
  if (!filename || !supabaseUrl) return null
  if (filename.startsWith('http')) return filename
  return `${supabaseUrl}/storage/v1/object/public/object-images/${filename}`
}
