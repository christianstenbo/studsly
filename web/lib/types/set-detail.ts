/** An inventory_parts row for a set (official or MOD-added). */
export interface SetPart {
  id: string
  part_num: string
  part_name: string | null
  color_id: number | null
  color_name: string | null
  part_img_url: string | null
  qty_expected: number
  qty_present: number
  is_spare: boolean
  used_in_mod: boolean
}

/** An object_minifigs row for a set. */
export interface SetFig {
  id: string
  fig_num: string
  fig_name: string | null
  fig_img_url: string | null
  fig_num_parts: number
  qty_expected: number
  qty_present: number
  source: 'SET' | 'BAM' | 'CMF' | 'STANDALONE'
}

/** A free-pool part available to add to a MOD (v_free_parts, qty_free > 0). */
export interface ModFreePart {
  source_object_id: string
  part_num: string | null
  part_color_id: number | null
  part_color_name: string | null
  part_name: string | null
  location_name: string | null
  qty_free: number
}

/** An active allocation targeting this set (used to render/restore MOD-added parts). */
export interface SetAllocation {
  id: string
  source_object_id: string
  purpose: 'MISSING_PART' | 'REPLACEMENT_PART' | 'MOD_PART' | 'COMPONENT'
  quantity: number
  target_part_num: string | null
  target_color_id: number | null
}

/** A set's content component row (object_components). */
export interface SetComponent {
  id: string
  kind: string
  label: string | null
  is_present: boolean
  grade: string | null
  damage_tags: string[]
  note: string | null
  linked_object_id: string | null
}

/** A loose manual/box matching this set, available to allocate (v_free_components). */
export interface FreeComponent {
  source_object_id: string
  object_type: string
  name: string | null
  set_number: string | null
  condition_grade: string | null
}

/** This copy's place within its set_group (only when there are 2+ copies). */
export interface CopyInfo {
  index: number
  total: number
}
