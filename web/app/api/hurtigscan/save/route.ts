import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"

// ownership_id is assigned by the DB (objects BEFORE INSERT trigger,
// generate_ownership_id -> SL-XXXXXX, v4 M14). This route no longer mints ids;
// it omits the column and reads back what the trigger produced.

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

  const locId = locStr ? await getOrCreateLocation(supabase, locStr, user.id) : null
  const today = new Date().toISOString().split("T")[0]

  const record = {
    user_id: user.id,
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

  // The trigger fills ownership_id; read both back in the same round-trip.
  const { data: obj, error } = await supabase
    .from("objects")
    .insert(record)
    .select("id, ownership_id")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ownershipId: (obj?.ownership_id as string) ?? null,
    objectId: (obj?.id as string) ?? null,
  })
}
