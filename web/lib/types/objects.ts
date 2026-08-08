/**
 * Mirrors the Postgres `object_type` enum for the members the app handles.
 * The component types (INSTRUCTION, ORIGINAL_BOX, STICKER_SHEET) are standalone
 * objects that reach the Allocate track through v_free_components — they are
 * NOT parts, and must never land in the free-parts pool.
 */
export type ObjectType =
  | 'SET'
  | 'MINIFIG'
  | 'PART'
  | 'BULK'
  | 'MOC'
  | 'MOD'
  | 'INSTRUCTION'
  | 'ORIGINAL_BOX'
  | 'STICKER_SHEET'

export type ObjectCondition =
  | 'NEW'
  | 'SEALED'
  | 'BUILT'
  | 'OPENED'
  | 'USED'
  | 'INCOMPLETE'
  | 'DAMAGED'

export type ObjectStatus = 'OWNED' | 'SOLD' | 'WISHLIST' | 'LOANED'

export interface CollectionObject {
  id: string
  object_type: ObjectType
  set_number: string | null
  bl_item_no: string | null
  name: string | null
  name_bl: string | null
  theme: string | null
  subtheme: string | null
  year: number | null
  condition: ObjectCondition
  status: ObjectStatus
  is_built: boolean
  num_parts: number | null
  num_minifigs: number | null
  image_filename: string | null
  total_cost_nok: number | null
  estimated_value_bl: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export const ALL_OBJECT_TYPES: ObjectType[] = [
  'SET',
  'MINIFIG',
  'PART',
  'BULK',
  'MOC',
  'MOD',
  'INSTRUCTION',
  'ORIGINAL_BOX',
  'STICKER_SHEET',
]
