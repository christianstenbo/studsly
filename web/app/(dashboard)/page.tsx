import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata = {
  title: "Samling — Studsly",
}

export default async function DashboardPage() {
  const supabase = await createClient()

  // Quick stats from existing objects table
  const { count: totalObjects } = await supabase
    .from("objects")
    .select("*", { count: "exact", head: true })

  const { count: totalSets } = await supabase
    .from("objects")
    .select("*", { count: "exact", head: true })
    .eq("type", "SET")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Samlingen din</h1>
        <p className="text-sm text-gray-500 mt-1">Oversikt over alle registrerte objekter</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Totalt</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{totalObjects ?? "—"}</p>
            <p className="text-xs text-gray-400 mt-1">objekter</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Sett</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{totalSets ?? "—"}</p>
            <p className="text-xs text-gray-400 mt-1">registrerte sett</p>
          </CardContent>
        </Card>

        <Card className="col-span-2 sm:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold text-[#2E5FA3]">Phase 1 — Reboot</p>
            <p className="text-xs text-gray-400 mt-1">Next.js frontend aktiv</p>
          </CardContent>
        </Card>
      </div>

      {/* Placeholder for collection list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Objekter</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            Samlingslisten bygges i neste steg. Supabase-tilkobling er aktiv.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
