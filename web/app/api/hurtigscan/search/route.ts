import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  set_num: string
  name: string
  year?: number | null
  num_parts?: number | null
  set_img_url?: string | null
}

// ─── Local DB helpers ─────────────────────────────────────────────────────────

function looksLikeSetNumber(q: string): boolean {
  return /^\d+(?:-\d+)?$/.test(q.trim())
}

function looksLikeFigNumber(q: string): boolean {
  return /^fig-\d+$/i.test(q.trim())
}

async function searchSetsByNum(
  supabase: SupabaseClient,
  baseNum: string
): Promise<SearchResult[]> {
  const { data } = await supabase
    .from("rb_sets")
    .select("set_num, name, year, num_parts, img_url")
    .ilike("set_num", `${baseNum}-%`)
    .order("set_num")
    .limit(20)
  return (data ?? []).map((s: Record<string, unknown>) => ({
    set_num: s.set_num as string,
    name: s.name as string,
    year: (s.year as number | null) ?? null,
    num_parts: (s.num_parts as number | null) ?? null,
    set_img_url: (s.img_url as string | null) ?? null,
  }))
}

async function searchSetsByName(
  supabase: SupabaseClient,
  query: string,
  limit = 10
): Promise<SearchResult[]> {
  const { data } = await supabase
    .from("rb_sets")
    .select("set_num, name, year, num_parts, img_url")
    .ilike("name", `%${query}%`)
    .order("year", { ascending: false })
    .limit(limit)
  return (data ?? []).map((s: Record<string, unknown>) => ({
    set_num: s.set_num as string,
    name: s.name as string,
    year: (s.year as number | null) ?? null,
    num_parts: (s.num_parts as number | null) ?? null,
    set_img_url: (s.img_url as string | null) ?? null,
  }))
}

async function searchMinifigsByName(
  supabase: SupabaseClient,
  query: string,
  limit = 6
): Promise<SearchResult[]> {
  const { data } = await supabase
    .from("rb_minifigs")
    .select("fig_num, name, num_parts, img_url")
    .ilike("name", `%${query}%`)
    .limit(limit)
  return (data ?? []).map((f: Record<string, unknown>) => ({
    set_num: f.fig_num as string,      // reuse set_num field for fig_num
    name: f.name as string,
    year: null,
    num_parts: (f.num_parts as number | null) ?? null,
    set_img_url: (f.img_url as string | null) ?? null,
  }))
}

async function getMinifigByNum(
  supabase: SupabaseClient,
  figNum: string
): Promise<SearchResult | null> {
  const { data } = await supabase
    .from("rb_minifigs")
    .select("fig_num, name, num_parts, img_url")
    .eq("fig_num", figNum.toLowerCase())
    .limit(1)
  if (!data?.length) return null
  const f = data[0] as Record<string, unknown>
  return {
    set_num: f.fig_num as string,
    name: f.name as string,
    year: null,
    num_parts: (f.num_parts as number | null) ?? null,
    set_img_url: (f.img_url as string | null) ?? null,
  }
}

// ─── Norwegian → English translation via Haiku ────────────────────────────────

async function translateQuery(query: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY || looksLikeSetNumber(query)) return query
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 60,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: `Oversett dette LEGO-søket til BrickLink/Rebrickable-terminologi på engelsk. Svar KUN med den oversatte søketermen — ingen forklaringer:\n${query}`,
          },
        ],
      }),
    })
    if (res.ok) {
      const data = await res.json()
      const text: string = data.content?.[0]?.text ?? ""
      return text.trim().replace(/^["']|["']$/g, "") || query
    }
  } catch {
    // fall through
  }
  return query
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { query } = await req.json()
  if (!query?.trim()) return NextResponse.json({ results: [] })

  const q = (query as string).trim()
  let results: SearchResult[] = []

  if (looksLikeFigNumber(q)) {
    // Direct fig-number lookup
    const fig = await getMinifigByNum(supabase, q)
    if (fig) results = [fig]
  } else if (looksLikeSetNumber(q)) {
    // Set number prefix search
    results = await searchSetsByNum(supabase, q.split("-")[0])
    if (!results.length) {
      // Fallback: name search in case the number is part of a set name
      results = await searchSetsByName(supabase, q)
    }
  } else {
    // Free-text search: translate Norwegian → English, search sets + minifigs
    const qEn = await translateQuery(q)
    const [sets, figs] = await Promise.all([
      searchSetsByName(supabase, qEn, 10),
      searchMinifigsByName(supabase, qEn, 4),
    ])
    results = [...sets, ...figs]

    // Fallback: if translation produced nothing, try original term
    if (!results.length && qEn !== q) {
      const [setsOrig, figsOrig] = await Promise.all([
        searchSetsByName(supabase, q, 10),
        searchMinifigsByName(supabase, q, 4),
      ])
      results = [...setsOrig, ...figsOrig]
    }
  }

  return NextResponse.json({ results })
}
