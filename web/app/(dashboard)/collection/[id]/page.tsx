import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { strings } from "@/lib/i18n/strings"
import { imageUrl } from "@/lib/display"
import { resolveFlags, ALL_OFF } from "@/lib/flags"
import { SetDetailView } from "@/components/set-detail/set-detail-view"
import type { SetPart, SetFig, ModFreePart, SetAllocation } from "@/lib/types/set-detail"

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

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const flags = user ? resolveFlags(user.email) : ALL_OFF

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

  // The inline Parts/Figures tab and the MOD editor are only wired — and only
  // fetched — when FF_MOD is on for this user. Flag off → the view falls back to
  // the Phase 1a launcher, so none of this is needed.
  let parts: SetPart[] = []
  let figs: SetFig[] = []
  let freeParts: ModFreePart[] = []
  let allocations: SetAllocation[] = []
  if (flags.FF_MOD && user) {
    const [partsRes, figsRes, freeRes, allocRes] = await Promise.all([
      supabase
        .from("inventory_parts")
        .select(
          "id, part_num, part_name, color_id, color_name, part_img_url, qty_expected, qty_present, is_spare, used_in_mod"
        )
        .eq("object_id", id)
        .eq("is_spare", false)
        .order("part_name"),
      supabase
        .from("object_minifigs")
        .select(
          "id, fig_num, fig_name, fig_img_url, fig_num_parts, qty_expected, qty_present, source"
        )
        .eq("object_id", id)
        .order("fig_name"),
      supabase
        .from("v_free_parts")
        .select(
          "source_object_id, part_num, part_color_id, part_color_name, part_name, location_name, qty_free"
        )
        .eq("user_id", user.id)
        .gt("qty_free", 0)
        .order("part_name"),
      supabase
        .from("allocations")
        .select("id, source_object_id, purpose, quantity, target_part_num, target_color_id")
        .eq("user_id", user.id)
        .eq("target_object_id", id)
        .is("released_at", null),
    ])
    parts = (partsRes.data as SetPart[]) ?? []
    figs = (figsRes.data as SetFig[]) ?? []
    freeParts = (freeRes.data as ModFreePart[]) ?? []
    allocations = (allocRes.data as SetAllocation[]) ?? []
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""

  return (
    <SetDetailView
      obj={obj}
      components={components ?? []}
      completeness={completeness ?? null}
      img={imageUrl(supabaseUrl, obj.image_filename)}
      flags={flags}
      userId={user?.id ?? null}
      parts={parts}
      figs={figs}
      freeParts={freeParts}
      allocations={allocations}
    />
  )
}
