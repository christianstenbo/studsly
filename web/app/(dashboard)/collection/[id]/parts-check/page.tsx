import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, PackageX } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PartsCheckView } from '@/components/parts-check/parts-check-view'
import type { BlColorMap, InventoryPart, SparePart } from '@/lib/types/parts'

export const metadata = {
  title: 'Delsjekk – Studsly',
}

const PAGE_SIZE = 1000

type PagedResult = { data: unknown[] | null; error: { message: string } | null }

/** Henter alle rader i sider, siden PostgREST kapper svaret på 1000 rader. */
async function fetchAllPages<T>(
  makeQuery: (from: number, to: number) => PromiseLike<PagedResult>
): Promise<T[]> {
  const rows: T[] = []
  for (let page = 0; ; page++) {
    const { data, error } = await makeQuery(
      page * PAGE_SIZE,
      page * PAGE_SIZE + PAGE_SIZE - 1
    )
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE_SIZE) break
  }
  return rows
}

function BackLink() {
  return (
    <Link
      href="/collection"
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
    >
      <ArrowLeft size={14} />
      Tilbake til samlingen
    </Link>
  )
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-100">
        <BackLink />
      </div>
      <div className="px-6 py-16 flex flex-col items-center text-center">
        <PackageX size={32} className="text-gray-300 mb-3" />
        <h2 className="text-base font-medium text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">{message}</p>
      </div>
    </div>
  )
}

export default async function PartsCheckPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: obj } = await supabase
    .from('objects')
    .select('id, object_type, set_number, name, name_bl, theme, year')
    .eq('id', id)
    .maybeSingle()

  if (!obj) notFound()

  const setName = obj.name ?? obj.name_bl ?? '(uten navn)'

  if (obj.object_type !== 'SET') {
    return (
      <EmptyState
        title="Delsjekk er kun for sett"
        message={`«${setName}» er ikke registrert som et sett, og har derfor ingen offisiell deleliste.`}
      />
    )
  }

  // Slå opp mot Rebrickable: bart settnummer først, deretter «-1»-suffiks.
  // Ved flere inventarversjoner velges den høyeste.
  const { data: resolved } = await supabase
    .from('v_owned_set_resolved')
    .select('rb_set_num, inventory_id')
    .eq('object_id', id)
    .maybeSingle()

  if (!resolved?.inventory_id) {
    return (
      <EmptyState
        title="Ingen offisiell deleliste tilgjengelig"
        message={`Vi fant ikke ${obj.set_number ?? 'settet'} i Rebrickable-katalogen. Det kan være nyere enn katalogen, eller mangle registrert delelager (f.eks. CMF-esker).`}
      />
    )
  }

  // Idempotent: oppretter listen første gang, oppdaterer fasit ved senere besøk.
  // Opptalte antall (qty_present) bevares.
  const { error: genError } = await supabase.rpc('generate_parts_checklist', {
    p_object_id: id,
  })

  if (genError) {
    console.error('generate_parts_checklist failed:', genError)
    return (
      <EmptyState
        title="Kunne ikke lage delelisten"
        message="Noe gikk galt ved henting av delelisten fra katalogen. Prøv igjen."
      />
    )
  }

  const [parts, spares, colorMapRows, rbColorRows] = await Promise.all([
    fetchAllPages<InventoryPart>((from, to) =>
      supabase
        .from('inventory_parts')
        .select(
          'id, part_num, part_name, color_id, color_name, qty_expected, qty_present, part_img_url'
        )
        .eq('object_id', id)
        .eq('is_spare', false)
        .order('part_num')
        .range(from, to)
    ),
    fetchAllPages<SparePart>((from, to) =>
      supabase
        .from('v_set_expected_parts')
        .select('part_num, part_name, color_id, color_name, qty_expected, part_img_url')
        .eq('object_id', id)
        .eq('is_spare', true)
        .order('part_num')
        .range(from, to)
    ),
    supabase.from('color_map').select('rb_color_id, bl_color_id, bl_color_name'),
    supabase.from('rb_colors').select('id, bl_color_id, bl_color_name'),
  ])

  // BrickLink-farger til want list: color_map er fasit, rb_colors er reserve.
  const blColors: BlColorMap = {}
  for (const c of rbColorRows.data ?? []) {
    if (c.bl_color_id != null) {
      blColors[c.id] = { bl_color_id: c.bl_color_id, bl_color_name: c.bl_color_name }
    }
  }
  for (const c of colorMapRows.data ?? []) {
    if (c.bl_color_id != null) {
      blColors[c.rb_color_id] = {
        bl_color_id: c.bl_color_id,
        bl_color_name: c.bl_color_name,
      }
    }
  }

  return (
    <PartsCheckView
      objectId={id}
      setName={setName}
      setNumber={obj.set_number}
      rbSetNum={resolved.rb_set_num}
      theme={obj.theme}
      year={obj.year}
      parts={parts}
      spares={spares}
      blColors={blColors}
    />
  )
}
