import { createClient } from '@/lib/supabase/server'
import { CollectionView } from '@/components/collection/collection-view'
import type { CollectionObject } from '@/lib/types/objects'
import type { FreePart, ActiveAllocation } from '@/lib/types/pool'
import { getFlagsFor } from '@/lib/flags-server'
import { strings } from '@/lib/i18n/strings'

export const metadata = {
  title: strings.collection.pageTitle,
}

export default async function CollectionPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const flags = await getFlagsFor(supabase, user)

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

  // The free parts pool + its active allocations are only needed — and only
  // fetched — when the FF_POOL flow is on for this user (fallback: no tab).
  let freeParts: FreePart[] = []
  let allocations: ActiveAllocation[] = []
  if (flags.FF_POOL && user) {
    const [freeRes, allocRes] = await Promise.all([
      supabase
        .from('v_free_parts')
        .select(
          `source_object_id, part_num, part_color_id, part_color_name,
           part_name, location_name, sub_location, qty_owned, qty_allocated, qty_free`
        )
        .eq('user_id', user.id)
        .order('part_name'),
      supabase
        .from('allocations')
        .select('id, source_object_id, target_object_id, purpose, quantity')
        .eq('user_id', user.id)
        .is('released_at', null),
    ])
    freeParts = (freeRes.data as FreePart[]) ?? []
    allocations = (allocRes.data as ActiveAllocation[]) ?? []
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  return (
    <CollectionView
      objects={(objects as CollectionObject[]) ?? []}
      supabaseUrl={supabaseUrl}
      flags={flags}
      freeParts={freeParts}
      allocations={allocations}
    />
  )
}
