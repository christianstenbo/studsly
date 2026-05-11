import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"

async function getNextOwnershipId(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from("objects")
    .select("ownership_id")
    .like("ownership_id", "ST-%")
    .order("ownership_id", { ascending: false })
    .limit(1)

  if (!data || data.length === 0) return "ST-0000001"
  const last = data[0].ownership_id as string
  const num = parseInt(last.split("-")[1]) + 1
  return `ST-${num.toString().padStart(7, "0")}`
}

async function getOrCreateLocation(
  supabase: SupabaseClient,
  name: string,
  userId: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("locations")
    .select("id")
    .eq("name", name)
    .eq("user_id", userId)
    .limit(1)

  if (existing && existing.length > 0) return existing[0].id as string

  const { data: created, error } = await supabase
    .from("locations")
    .insert({ name, user_id: userId })
    .select("id")
    .single()

  if (error) return null
  return (created?.id as string) ?? null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { setData, condition, wearLevel, locStr } = await req.json()

  const ownershipId = await getNextOwnershipId(supabase)
  const locId = locStr ? await getOrCreateLocation(supabase, locStr, user.id) : null
  const today = new Date().toISOString().split("T")[0]

  const record = {
    user_id: user.id,
    ownership_id: ownershipId,
    status: "OWNED",
    object_type: (setData.obj_type as string) || "SET",
    set_number: setData.set_num ?? null,
    name: setData.name ?? null,
    year: setData.year ?? null,
    num_parts: setData.num_parts ?? null,
    condition: condition ?? "BUILT",
    wear_level: wearLevel ?? null,
    location_id: locId ?? null,
    registered_at: today,
    quality_level: "BASIC",
  }

  const { error } = await supabase.from("objects").insert(record)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch the UUID for future image upload
  const { data: obj } = await supabase
    .from("objects")
    .select("id")
    .eq("ownership_id", ownershipId)
    .single()

  return NextResponse.json({ ownershipId, objectId: (obj?.id as string) ?? null })
}
