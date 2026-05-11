import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"

// ─── Local DB helpers ─────────────────────────────────────────────────────────

type RbSet = {
  set_num: string
  name: string
  year: number | null
  num_parts: number | null
  img_url: string | null
}

type RbMinifig = {
  fig_num: string
  name: string
  num_parts: number | null
  img_url: string | null
}

async function localSearchSets(supabase: SupabaseClient, baseNum: string): Promise<RbSet[]> {
  const { data } = await supabase
    .from("rb_sets")
    .select("set_num, name, year, num_parts, img_url")
    .ilike("set_num", `${baseNum}-%`)
    .order("set_num")
    .limit(20)
  return (data as RbSet[]) ?? []
}

async function localGetSet(supabase: SupabaseClient, setNum: string): Promise<RbSet | null> {
  // Try exact match first (e.g. '75192-1')
  const { data: exact } = await supabase
    .from("rb_sets")
    .select("set_num, name, year, num_parts, img_url")
    .eq("set_num", setNum)
    .limit(1)
  if (exact?.length) return exact[0] as RbSet

  // Try with '-1' suffix (AI often returns bare number)
  const { data: v1 } = await supabase
    .from("rb_sets")
    .select("set_num, name, year, num_parts, img_url")
    .eq("set_num", `${setNum}-1`)
    .limit(1)
  if (v1?.length) return v1[0] as RbSet

  return null
}

async function localGetMinifig(supabase: SupabaseClient, figNum: string): Promise<RbMinifig | null> {
  const { data } = await supabase
    .from("rb_minifigs")
    .select("fig_num, name, num_parts, img_url")
    .eq("fig_num", figNum)
    .limit(1)
  if (data?.length) return data[0] as RbMinifig
  return null
}

// ─── AI vision prompt ─────────────────────────────────────────────────────────

const IDENTIFY_PROMPT = `Du er ekspert på LEGO. Se på dette bildet og identifiser hva det viser.

Bildet kan vise ET AV DISSE:
- SET: en LEGO-eske, ferdig bygget sett eller uåpnet pakke
- MINIFIG: én eller flere minifigurer
- PART: én eller noen få løse LEGO-deler (klosser, plater, skinner etc.)
- BULK: en boks, pose eller haug med blandet LEGO
- INSTRUCTION: en instruksjonsbok/-hefte
- BOX: en tom LEGO-eske uten innhold
- GEAR: LEGO merchandise (klær, vesker, klokker etc.)
- CATALOG: LEGO-katalog
- MOC: tydelig egenbygd modell (ikke fra offisiell eske)
- OTHER: ukjent

Gjør disse vurderingene:
1. Hvilken type er dette? (type_guess)
2. SET/MINIFIG: identifiser settnummer hvis mulig.
3. PART: beskriv delen (form, studmønster, kategori) og en kort søketerm egnet for Rebrickable (f.eks. '2x4 brick' eller 'curved slope 2x1').
4. Anslå år hvis relevant.
5. Slitasjegrad (kun for åpne/byggede objekter, null for forseglede).

VIKTIG — reissue-regel for SET: foretrekk nyeste utgave MED MINDRE bildet viser vintage-eske eller vintage-klossfarger.

Svar KUN med JSON, ingen annen tekst:
{"type_guess":"SET","set_number":"75192","name":"Millennium Falcon","year":2017,"wear_level":"NEAR_MINT","wear_note":"Lett støv","part_description":null,"part_search_query":null,"part_color_bl":null,"confidence":"high"}

Felt-regler:
KRITISK DISTINKSJON — PART vs MOC:
- PART = én enkelt støpt LEGO-komponent, uansett hvor kompleks formen er. Spør deg selv: 'Kom dette ut av én form?' → PART.
- MOC = noe et menneske har montert av FLERE deler. Ser du skjøter mellom klosser eller deler i ulike farger satt sammen? → MOC.
Tvilstilfelle: velg PART.

type_guess: én av SET|MINIFIG|PART|BULK|INSTRUCTION|BOX|GEAR|CATALOG|MOC|OTHER
set_number: tall og bindestrek kun, f.eks. '75192' eller '71011-8', ellers null
wear_level: én av MINT|NEAR_MINT|VERY_GOOD|GOOD|FAIR|null
confidence: én av high|medium|low`

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { imageBase64, mediaType } = await req.json()

  // 1. AI identification via Claude Haiku
  let aiResult: Record<string, unknown> = { type_guess: "OTHER", confidence: "low" }

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 350,
          temperature: 0,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: { type: "base64", media_type: mediaType, data: imageBase64 },
                },
                { type: "text", text: IDENTIFY_PROMPT },
              ],
            },
          ],
        }),
      })

      if (anthropicRes.ok) {
        const data = await anthropicRes.json()
        const raw: string = data.content?.[0]?.text ?? "{}"
        try {
          aiResult = JSON.parse(raw)
        } catch {
          // keep default
        }
      }
    } catch {
      // keep default
    }
  }

  // 2. If high/medium confidence SET or MINIFIG with a set number → look up in local DB
  const typ = aiResult.type_guess as string
  const sn = aiResult.set_number as string | undefined
  const conf = aiResult.confidence as string

  if ((typ === "SET" || typ === "MINIFIG") && sn && (conf === "high" || conf === "medium")) {
    try {
      // MINIFIG with explicit fig-XXXXXX identifier
      if (typ === "MINIFIG" && sn.startsWith("fig-")) {
        const minifig = await localGetMinifig(supabase, sn)
        if (minifig) {
          return NextResponse.json({
            aiResult,
            setData: {
              set_num: minifig.fig_num,
              name: minifig.name,
              year: null,
              num_parts: minifig.num_parts ?? null,
              set_img_url: minifig.img_url ?? null,
              obj_type: "MINIFIG" as const,
            },
            screen: 3,
          })
        }
      } else {
        // SET or MINIFIG with numeric set number
        const base = sn.split("-")[0]
        const variants = await localSearchSets(supabase, base)
        if (variants.length > 0) {
          const match =
            variants.find((v) => v.set_num === sn) ??
            variants.find((v) => v.set_num === `${sn}-1`) ??
            variants[variants.length - 1]
          return NextResponse.json({
            aiResult,
            setData: {
              set_num: match.set_num,
              name: match.name,
              year: match.year ?? null,
              num_parts: match.num_parts ?? null,
              set_img_url: match.img_url ?? null,
              obj_type: typ as "SET" | "MINIFIG",
            },
            screen: 3,
          })
        }

        // Fallback: try direct lookup if no variants found via prefix search
        const direct = await localGetSet(supabase, sn)
        if (direct) {
          return NextResponse.json({
            aiResult,
            setData: {
              set_num: direct.set_num,
              name: direct.name,
              year: direct.year ?? null,
              num_parts: direct.num_parts ?? null,
              set_img_url: direct.img_url ?? null,
              obj_type: typ as "SET" | "MINIFIG",
            },
            screen: 3,
          })
        }
      }
    } catch {
      // fall through to screen 5
    }
  }

  return NextResponse.json({ aiResult, setData: null, screen: 5 })
}
