/** A row in the checklist (inventory_parts) for a set. */
export interface InventoryPart {
  id: string
  part_num: string
  part_name: string | null
  color_id: number
  color_name: string
  qty_expected: number
  qty_present: number
  part_img_url: string | null
}

/** A spare part from the Rebrickable reference data (displayed, never stored). */
export interface SparePart {
  part_num: string
  part_name: string | null
  color_id: number
  color_name: string | null
  qty_expected: number
  part_img_url: string | null
}

/** Where a minifigure came from. */
export type MinifigSource = 'SET' | 'BAM' | 'CMF' | 'STANDALONE'

/**
 * A minifigure belonging to an object. Its parts live only here — never in
 * inventory_parts — so no part is ever counted twice.
 */
export interface ObjectMinifig {
  id: string
  fig_num: string
  fig_name: string | null
  fig_img_url: string | null
  fig_num_parts: number
  qty_expected: number
  qty_present: number
  is_assembled: boolean
  source: MinifigSource
}

/** A part belonging to a minifigure (from the catalog, not stored). */
export interface MinifigPart {
  fig_num: string
  part_num: string
  part_name: string | null
  color_id: number
  color_name: string | null
  quantity: number
  is_spare: boolean
  part_img_url: string | null
}

/** Catalog data for the set an object resolved to. */
export interface ResolvedSetInfo {
  rb_set_num: string | null
  rb_name: string | null
  rb_year: number | null
  rb_num_parts: number | null
  rb_img_url: string | null
}

/** rb_color_id → BrickLink color, for want list export. */
export interface BlColor {
  bl_color_id: number | null
  bl_color_name: string | null
}

export type BlColorMap = Record<number, BlColor>
