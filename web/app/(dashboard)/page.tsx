import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { strings } from "@/lib/i18n/strings"

export const metadata = {
  title: strings.common.dashboard.pageTitle,
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
        <h1 className="text-2xl font-bold text-gray-900">{strings.common.dashboard.title}</h1>
        <p className="text-sm text-gray-500 mt-1">{strings.common.dashboard.subtitle}</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{strings.common.dashboard.totalCard}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{totalObjects ?? "—"}</p>
            <p className="text-xs text-gray-400 mt-1">{strings.common.dashboard.totalUnit}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{strings.common.dashboard.setsCard}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{totalSets ?? "—"}</p>
            <p className="text-xs text-gray-400 mt-1">{strings.common.dashboard.setsUnit}</p>
          </CardContent>
        </Card>

        <Card className="col-span-2 sm:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{strings.common.dashboard.statusCard}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold text-[#2E5FA3]">{strings.common.dashboard.statusValue}</p>
            <p className="text-xs text-gray-400 mt-1">{strings.common.dashboard.statusNote}</p>
          </CardContent>
        </Card>
      </div>

      {/* Placeholder for collection list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{strings.common.dashboard.objectsCard}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            {strings.common.dashboard.objectsPlaceholder}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
