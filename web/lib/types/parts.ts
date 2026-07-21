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

/** rb_color_id → BrickLink-farge, for want list-eksport. */
export interface BlColor {
  bl_color_id: number | null
  bl_color_name: string | null
}

export type BlColorMap = Record<number, BlColor>
