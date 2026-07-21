import { createClient } from '@/lib/supabase/server'
import { CollectionView } from '@/components/collection/collection-view'
import type { CollectionObject } from '@/lib/types/objects'
import { strings } from '@/lib/i18n/strings'

export const metadata = {
  title: strings.collection.pageTitle,
}

export default async function CollectionPage() {
  const supabase = await createClient()

  const { data: objects, error } = await supabase
    .from('objects')
    .select(
      `id, object_type, set_number, bl_item_no, name, name_bl,
       theme, subtheme, year, condition, status, is_built,
       num_parts, num_minifigs, image_filename,
       total_cost_nok, estimated_value_bl, notes,
       created_at, updated_at`
    )
    .eq('status', 'OWNED')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching collection:', error)
    return (
      <div className="p-6 text-red-500">{strings.collection.loadFailed}</div>
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  return (
    <CollectionView
      objects={(objects as CollectionObject[]) ?? []}
      supabaseUrl={supabaseUrl}
    />
  )
}
