import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { qualityForRegistration } from "@/lib/quality"

/**
 * Flow 1 source — register a loose part into the free pool.
 *
 * The row lands in v_free_parts, nets against the buy list on (part_num,
 * color_id), and becomes allocatable to any set missing that piece.
 *
 * Two things this route must get right:
 *
 * 1. BATCH REGISTRATION IS ONE ROW WITH A COUNT (v4 M4), not N rows. Ten black
 *    1x2 bricks are one object with quantity = 10. v_free_parts derives qty_free
 *    as quantity minus active allocations, so the count has to live on the row.
 *
 * 2. ORDINARY INSERT, NEVER COPY. `objects.ownership_id` has NO column default —
 *    it is filled by a BEFORE INSERT trigger and guarded by a CHECK. A bulk
 *    COPY would bypass the trigger and violate the constraint. Everything that
 *    writes objects goes through a normal INSERT.
 *
 * Colour is required. `inventory_parts.color_id` is NOT NULL, so every target
 * slot has a colour; a loose part with a null colour can only ever be netted
 * through the "colour unconfirmed" bucket (M10 Finding 1), which is a recovery
 * path for legacy rows, not something new registrations should create.
 */

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

  const { partNum, colorId, colorName, name, quantity, locStr, subLocation } =
    await req.json()

  const part = typeof partNum === "string" ? partNum.trim() : ""
  if (!part) return NextResponse.json({ error: "Missing part number" }, { status: 400 })

  // colorId 0 is Black — a perfectly valid colour and a falsy number. Check for
  // null/undefined explicitly, never truthiness.
  if (colorId == null || !Number.isInteger(colorId)) {
    return NextResponse.json({ error: "Missing colour" }, { status: 400 })
  }

  const qty = Number.isInteger(quantity) && quantity > 0 ? quantity : 1

  const locId = locStr ? await getOrCreateLocation(supabase, locStr, user.id) : null

  const record = {
    user_id: user.id,
    status: "OWNED",
    object_type: "PART",
    part_num: part,
    part_color_id: colorId,
    part_color_name: (typeof colorName === "string" && colorName.trim()) || null,
    name: (typeof name === "string" && name.trim()) || null,
    quantity: qty,
    location_id: locId ?? null,
    sub_location: (typeof subLocation === "string" && subLocation.trim()) || null,
    registered_at: new Date().toISOString().split("T")[0],
    // A registration is a catalogue reference and nothing more (lib/quality.ts).
    quality_level: qualityForRegistration(),
  }

  // The trigger fills ownership_id; read it back in the same round-trip.
  const { data: obj, error } = await supabase
    .from("objects")
    .insert(record)
    .select("id, ownership_id")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    objectId: (obj?.id as string) ?? null,
    ownershipId: (obj?.ownership_id as string) ?? null,
  })
}
