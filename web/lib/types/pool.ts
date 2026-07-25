/** A row of the free parts pool (v_free_parts) — one loose PART object. */
export interface FreePart {
  source_object_id: string
  part_num: string | null
  part_color_id: number | null
  part_color_name: string | null
  part_name: string | null
  location_name: string | null
  sub_location: string | null
  qty_owned: number
  qty_allocated: number
  qty_free: number
}

/** An active (unreleased) allocation row. Target name is resolved client-side. */
export interface ActiveAllocation {
  id: string
  source_object_id: string
  target_object_id: string
  purpose: 'MISSING_PART' | 'REPLACEMENT_PART' | 'MOD_PART' | 'COMPONENT'
  quantity: number
}
