import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data } = await supabase
    .from("locations")
    .select("name")
    .eq("user_id", user.id)

  // Parse location strings ("Bod / Hylle A / 1") into per-level suggestion lists
  const byLevel: Record<number, Set<string>> = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set() }

  for (const row of data ?? []) {
    const parts = (row.name as string)
      .split("/")
      .map((p: string) => p.trim())
      .filter(Boolean)
    parts.slice(0, 4).forEach((p: string, i: number) => {
      byLevel[i + 1].add(p)
    })
  }

  return NextResponse.json({
    l1: [...byLevel[1]].sort(),
    l2: [...byLevel[2]].sort(),
    l3: [...byLevel[3]].sort(),
    l4: [...byLevel[4]].sort(),
  })
}
