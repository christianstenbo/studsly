/**
 * `quality_level` — how much an object's data is actually worth trusting.
 *
 * The ladder is locked. It is not a rating of the LEGO; it rates the RECORD:
 *
 *   BASIC       Registered. Catalogue reference only. This is where everything
 *               starts, by any route, including bulk import.
 *   VERIFIED    Counted for real — every row on the object was touched.
 *   DOCUMENTED  Carries your own photograph of the actual item.
 *
 * WHY THIS EXISTS AT ALL
 *
 * "Have all" writes qty_present = qty_expected on every row. A real count of a
 * 184-piece set writes exactly the same numbers. Afterwards the two are
 * byte-identical in inventory_parts — there is no way to tell "I own this set"
 * from "I counted 184 parts and they were all there". For an insurance record
 * that difference is the whole point.
 *
 * quality_level is the field that separates them, and until now nothing wrote
 * it: one hardcoded "BASIC" in the Quick Scan save route, and 585 BASIC + 1
 * DOCUMENTED + 0 VERIFIED in the live database.
 *
 * THE RULE (locked)
 *
 *   Registration, any route, incl. bulk import   -> BASIC
 *   "Have all"                                   -> stays BASIC. It is a CLAIM,
 *                                                   not a count. This is the
 *                                                   whole reason the field
 *                                                   exists; do not "improve" it.
 *   Counting where every row is touched          -> VERIFIED
 *   A photo attached to the object               -> DOCUMENTED
 *
 * The last two are wired here but not yet reachable from the UI. They are built
 * now so the write path does not have to be torn open later.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** In the Postgres enum's own order — lowest to highest. */
export const QUALITY_LEVELS = ['BASIC', 'DOCUMENTED', 'VERIFIED'] as const
export type QualityLevel = (typeof QUALITY_LEVELS)[number]

/** Every registration starts here, whatever the route. */
export const REGISTRATION_QUALITY: QualityLevel = 'BASIC'

/**
 * What an action implies about the record.
 *
 * `haveAll` is deliberately absent from this map rather than mapped to BASIC:
 * claiming completeness must not TOUCH quality_level at all, so that a set
 * already promoted to VERIFIED by a genuine count is not silently demoted by
 * someone later hitting "Have all". Callers express that by not calling.
 */
const IMPLIED: Record<'register' | 'countedEveryRow' | 'photoAttached', QualityLevel> = {
  register: 'BASIC',
  countedEveryRow: 'VERIFIED',
  photoAttached: 'DOCUMENTED',
}

export type QualityEvent = keyof typeof IMPLIED

/**
 * Rank for comparison, matching the ORDER OF THE POSTGRES ENUM itself:
 * quality_level = {BASIC, DOCUMENTED, VERIFIED}. The schema author put VERIFIED
 * highest and the Insights breakdown already renders it that way
 * (basic - catalogue reference / documented - your own photo / verified).
 *
 * Caught by proving the ladder against the live row: set 40370 is the one
 * DOCUMENTED object in the database, and an earlier draft of this table ranked
 * DOCUMENTED above VERIFIED — which would have silently refused to promote the
 * only set anyone is likely to count first. Rank follows the schema, not
 * intuition about which is "better evidence".
 *
 * The honest limitation: quality_level is a single column, so an object cannot
 * be both counted and photographed. Whichever is higher wins. If those ever need
 * to coexist they want two columns, not a reshuffled ladder.
 */
const RANK: Record<QualityLevel, number> = { BASIC: 0, DOCUMENTED: 1, VERIFIED: 2 }

/**
 * The level an object should hold after `event`, given where it is now.
 *
 * Monotonic on purpose: quality only ever goes up. A record that has been
 * counted does not become less trustworthy because someone re-saved it, and a
 * documented one does not lose its photograph. Returns `null` when nothing
 * should be written, so callers can omit the column entirely rather than
 * writing a value equal to the one already there.
 */
export function nextQualityLevel(
  current: QualityLevel | null | undefined,
  event: QualityEvent
): QualityLevel | null {
  const target = IMPLIED[event]
  if (!current) return target
  return RANK[target] > RANK[current] ? target : null
}

/**
 * The `quality_level` for a newly registered object. A separate named export
 * from `nextQualityLevel` because registration has no "current" to compare
 * against, and because every registration route should be greppable to one
 * symbol rather than to a string literal.
 */
export function qualityForRegistration(): QualityLevel {
  return REGISTRATION_QUALITY
}

/**
 * Promote an object's quality_level after `event`, if the event earns it.
 *
 * Reads the current value first so the write is monotonic and idempotent — a
 * counter who touches the last row twice does not generate a second UPDATE, and
 * nothing can demote a record. Returns the level now held, or null if the write
 * failed (the caller carries on: a missed promotion is a smaller problem than
 * blocking someone mid-count, and the next touch retries it).
 *
 * Deliberately NOT called by "Have all". Claiming completeness must leave
 * quality_level untouched — that is the one distinction this whole file exists
 * to preserve.
 */
export async function promoteObjectQuality(
  supabase: SupabaseClient,
  objectId: string,
  event: QualityEvent
): Promise<QualityLevel | null> {
  const { data } = await supabase
    .from('objects')
    .select('quality_level')
    .eq('id', objectId)
    .maybeSingle()

  const current = (data?.quality_level ?? null) as QualityLevel | null
  const next = nextQualityLevel(current, event)
  if (!next) return current

  const { error } = await supabase
    .from('objects')
    .update({ quality_level: next })
    .eq('id', objectId)
  if (error) {
    console.error('[quality] could not promote:', error.message)
    return null
  }
  return next
}
