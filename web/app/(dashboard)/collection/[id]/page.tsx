import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { strings } from "@/lib/i18n/strings"
import { imageUrl } from "@/lib/display"
import { SetDetailView } from "@/components/set-detail/set-detail-view"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from("objects").select("name").eq("id", id).single()
  return { title: strings.setDetail.pageTitle(data?.name ?? "Set") }
}

export default async function SetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: obj } = await supabase
    .from("objects")
    .select(
      `id, object_type, name, set_number, theme, subtheme, year, condition,
       is_built, build_status, is_modified, condition_grade, num_parts, num_minifigs,
       estimated_value_bl, value_tier, value_base_nok, value_override_nok,
       value_addback_box_nok, value_addback_manual_nok, value_grade_adjust_pct,
       value_restoration_cost_nok, has_instructions, has_original_box,
       ownership_id, created_at, image_filename`
    )
    .eq("id", id)
    .eq("status", "OWNED")
    .maybeSingle()

  if (!obj) notFound()

  const [{ data: components }, { data: completeness }] = await Promise.all([
    supabase
      .from("object_components")
      .select("kind, label, is_present, grade, note")
      .eq("object_id", id)
      .order("kind"),
    supabase
      .from("v_object_parts_completeness")
      .select(
        "pieces_expected, pieces_present, pieces_missing, percent_complete, minifigs_expected, minifigs_present"
      )
      .eq("object_id", id)
      .maybeSingle(),
  ])

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""

  return (
    <SetDetailView
      obj={obj}
      components={components ?? []}
      completeness={completeness ?? null}
      img={imageUrl(supabaseUrl, obj.image_filename)}
    />
  )
}
