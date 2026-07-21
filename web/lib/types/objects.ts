export type ObjectType = 'SET' | 'MINIFIG' | 'PART' | 'BULK' | 'MOC' | 'MOD'

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
]
