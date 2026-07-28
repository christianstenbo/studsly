import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { setNumberCandidates } from "@/lib/set-number"

// Flow 4 — register a standalone instruction or original box. ownership_id is
// filled by the DB trigger (SL-, v4 M14). set_number is resolved against the
// user's owned sets and stored VERBATIM (never a stripped/guessed form), so
// Flow 3's raw set_number equality surfaces it in that set's Contents. A string
// strip rule can't tell 6399-1 (canonical) from CMF 71011-1 (identity), so we
// only use the -1 equivalence to LOOK UP, and persist the exact owned value.

const TYPES = ["INSTRUCTION", "ORIGINAL_BOX"] as const
const GRADES = ["MINT", "EXCELLENT", "GOOD", "FAIR", "POOR"] as const

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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { objectType, setNumber, name, locStr, grade } = await req.json()

  if (!TYPES.includes(objectType)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 })
  }
  const entered = typeof setNumber === "string" ? setNumber.trim() : ""
  if (!entered) return NextResponse.json({ error: "Missing set number" }, { status: 400 })

  // Resolve the entered number to one of the user's owned sets and store that
  // set's exact set_number. Prefer an exact match; else the -1 canonical
  // equivalent; else fall back to the entered value (a set not yet owned —
  // "register now, link later").
  const candidates = setNumberCandidates(entered)
  const { data: owned } = await supabase
    .from("objects")
    .select("set_number")
    .eq("user_id", user.id)
    .eq("object_type", "SET")
    .in("set_number", candidates)
  const stored =
    owned?.find((o) => o.set_number === entered)?.set_number ??
    (owned?.[0]?.set_number as string | undefined) ??
    entered

  const locId = locStr ? await getOrCreateLocation(supabase, locStr, user.id) : null

  const record = {
    user_id: user.id,
    status: "OWNED",
    object_type: objectType as string,
    set_number: stored,
    name: (typeof name === "string" && name.trim()) || null,
    location_id: locId ?? null,
    condition_grade: GRADES.includes(grade) ? (grade as string) : null,
    registered_at: new Date().toISOString().split("T")[0],
    quality_level: "BASIC",
  }

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
