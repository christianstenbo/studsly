/** En rad i avkryssingslisten (inventory_parts) for et sett. */
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

/** En reservedel fra Rebrickable-fasiten (lagres ikke, vises kun). */
export interface SparePart {
  part_num: string
  part_name: string | null
  color_id: number
  color_name: string | null
  qty_expected: number
  part_img_url: string | null
}

/** Hvor en minifigur kommer fra. */
export type MinifigSource = 'SET' | 'BAM' | 'CMF' | 'STANDALONE'

export const MINIFIG_SOURCE_LABELS: Record<MinifigSource, string> = {
  SET: 'Fra sett',
  BAM: 'Bygg en figur',
  CMF: 'Samlefigur',
  STANDALONE: 'Løs figur',
}

/**
 * En minifigur som hører til et objekt. Figurens deler ligger kun her —
 * aldri i inventory_parts — så ingen del blir talt to ganger.
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

/** En del som inngår i en minifigur (fra katalogen, ikke lagret). */
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

/** Katalogdata om settet objektet er slått opp mot. */
export interface ResolvedSetInfo {
  rb_set_num: string | null
  rb_name: string | null
  rb_year: number | null
  rb_num_parts: number | null
  rb_img_url: string | null
}

/** rb_color_id → BrickLink-farge, for want list-eksport. */
export interface BlColor {
  bl_color_id: number | null
  bl_color_name: string | null
}

export type BlColorMap = Record<number, BlColor>
