/** The minimum a row must carry to be counted. Both the Collection view's
 *  CollectionObject and the Home page's narrower Row satisfy these. */
export interface CountableObject {
  object_type: string
}
export interface AggregatableObject {
  num_parts: number | null
  num_minifigs: number | null
  estimated_value_bl: number | null
}

/**
 * What every number on the Collection screen means. One file, so a counter can
 * never quietly drift from its definition.
 *
 * THE RULE: a tab's number is the number of rows that tab lists. Nothing else.
 * If a tab lists nothing, it shows no number — never a zero, and never a figure
 * borrowed from somewhere else. A counter you cannot reproduce by opening the
 * tab and counting is a counter that lies.
 *
 * What it replaced, and why it had to go:
 *
 *   Figures showed `sum(num_minifigs)` = 1,127. That is the CATALOGUE figure
 *   count of the sets you own — how many minifigures those 578 sets contain
 *   according to Rebrickable. It is not a count of anything you can open. The
 *   `object_minifigs` table holds exactly 1 row, and the Figures tab rendered a
 *   placeholder. So the app confidently displayed 1,127 next to a tab that could
 *   show you one thing.
 *
 *   Parts showed `sum(num_parts)` = 257,139 — the catalogue piece total, again
 *   not a list. Rendered through `toLocaleString`, it also reads as "257 139",
 *   which is one number and was mistaken for two.
 *
 * The two-denominator rule from the data model still holds, and this is where it
 * lives: an assembly/figure counts as ONE entity in its own tab, and its pieces
 * explode into the piece total. The two are different denominators on purpose.
 * They are never added together and never substituted for one another.
 */

/** A tab count of `null` means: this tab lists nothing, so it shows no number. */
export interface CollectionCounts {
  /** Owned SET objects. The Sets tab lists exactly these. */
  sets: number
  /** Owned MINIFIG objects — figures and creatures registered as entities. */
  figures: number
  /**
   * Always null. Studsly has no animal/creature flag: the data model treats an
   * elephant, a dragon and a minifigure as the same kind of entity
   * (object_type = MINIFIG), so animals cannot be separated out. A number here
   * would be invented.
   */
  animals: null
  /** Rows in the free-parts pool, or null when FF_POOL is off (no list). */
  parts: number | null
  /** Owned MOC objects. */
  mocs: number
}

/**
 * Collection-wide aggregates. These are NOT tab counts — they are sums over the
 * catalogue, shown in the header where they are labelled as such.
 */
export interface CollectionAggregates {
  /**
   * Total catalogue pieces across owned objects: sum of `num_parts`.
   * An UNDERSTATEMENT — see `piecesUnknownFor`. Standalone figures and loose
   * parts carry no `num_parts`, so they contribute nothing here either.
   */
  cataloguePieces: number
  /** Owned objects with no `num_parts`, whose pieces are missing from the total. */
  piecesUnknownFor: number
  /**
   * Figures the catalogue says are inside your sets: sum of `num_minifigs`.
   * This is the number that used to sit on the Figures tab. It is a property of
   * the sets, not a list of entities — which is exactly why it lives here now.
   */
  cataloguePiecesFigures: number
  /** Estimated BrickLink value across owned objects. */
  value: number
}

export function collectionCounts(
  objects: CountableObject[],
  opts: { poolRows: number | null }
): CollectionCounts {
  let sets = 0
  let figures = 0
  let mocs = 0
  for (const o of objects) {
    if (o.object_type === 'SET') sets++
    else if (o.object_type === 'MINIFIG') figures++
    else if (o.object_type === 'MOC') mocs++
  }
  return { sets, figures, animals: null, parts: opts.poolRows, mocs }
}

export function collectionAggregates(
  objects: AggregatableObject[]
): CollectionAggregates {
  let cataloguePieces = 0
  let piecesUnknownFor = 0
  let cataloguePiecesFigures = 0
  let value = 0
  for (const o of objects) {
    if (o.num_parts == null) piecesUnknownFor++
    else cataloguePieces += o.num_parts
    cataloguePiecesFigures += o.num_minifigs ?? 0
    value += o.estimated_value_bl ?? 0
  }
  return { cataloguePieces, piecesUnknownFor, cataloguePiecesFigures, value }
}
