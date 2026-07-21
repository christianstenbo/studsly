'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Search,
  ChevronUp,
  ChevronDown,
  Package,
  Layers,
  User,
  ListChecks,
} from 'lucide-react'
import type {
  CollectionObject,
  ObjectType,
} from '@/lib/types/objects'
import { ALL_OBJECT_TYPES } from '@/lib/types/objects'
import { strings } from '@/lib/i18n/strings'

const t = strings.collection

// ─── Types ────────────────────────────────────────────────────────────────────

type SortField =
  | 'name'
  | 'year'
  | 'theme'
  | 'num_parts'
  | 'num_minifigs'
  | 'estimated_value_bl'
type SortDir = 'asc' | 'desc'
type FilterType = 'ALL' | ObjectType

// ─── Helpers ──────────────────────────────────────────────────────────────────

function conditionColor(condition: string): string {
  switch (condition) {
    case 'NEW':
    case 'SEALED':
      return 'bg-green-100 text-green-800'
    case 'BUILT':
      return 'bg-blue-100 text-blue-800'
    case 'OPENED':
      return 'bg-sky-100 text-sky-800'
    case 'USED':
      return 'bg-amber-100 text-amber-800'
    case 'INCOMPLETE':
      return 'bg-orange-100 text-orange-800'
    case 'DAMAGED':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

function displayName(obj: CollectionObject): string {
  return obj.name ?? obj.name_bl ?? strings.common.unnamed
}

function displayId(obj: CollectionObject): string {
  if (obj.set_number) return obj.set_number
  if (obj.bl_item_no) return obj.bl_item_no
  return strings.common.none
}

function imageUrl(supabaseUrl: string, filename: string | null): string | null {
  if (!filename) return null
  return `${supabaseUrl}/storage/v1/object/public/object-images/${filename}`
}

function formatNok(value: number | null): string {
  if (value === null || value === undefined) return strings.common.none
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  }).format(Number(value))
}

function typeIcon(type: ObjectType) {
  switch (type) {
    case 'SET':
    case 'MOC':
    case 'MOD':
      return <Package size={14} className="text-gray-400" />
    case 'MINIFIG':
      return <User size={14} className="text-gray-400" />
    default:
      return <Layers size={14} className="text-gray-400" />
  }
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function ObjectThumbnail({
  src,
  name,
  type,
}: {
  src: string | null
  name: string
  type: ObjectType
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className="w-10 h-10 object-contain rounded bg-gray-50"
        onError={(e) => {
          ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          ;(e.currentTarget.nextSibling as HTMLElement).style.display = 'flex'
        }}
      />
    )
  }
  return <PlaceholderIcon type={type} />
}

function PlaceholderIcon({ type }: { type: ObjectType }) {
  return (
    <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
      {type === 'MINIFIG' ? (
        <User size={18} className="text-gray-400" />
      ) : type === 'PART' || type === 'BULK' ? (
        <Layers size={18} className="text-gray-400" />
      ) : (
        <Package size={18} className="text-gray-400" />
      )}
    </div>
  )
}

function SortIcon({
  field,
  active,
  dir,
}: {
  field: SortField
  active: SortField
  dir: SortDir
}) {
  if (field !== active) return <ChevronUp size={13} className="text-gray-300 ml-1" />
  return dir === 'asc' ? (
    <ChevronUp size={13} className="text-gray-600 ml-1" />
  ) : (
    <ChevronDown size={13} className="text-gray-600 ml-1" />
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface CollectionViewProps {
  objects: CollectionObject[]
  supabaseUrl: string
}

export function CollectionView({ objects, supabaseUrl }: CollectionViewProps) {
  const [activeType, setActiveType] = useState<FilterType>('ALL')
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Counts per type
  const typeCounts = useMemo(() => {
    const counts: Partial<Record<ObjectType, number>> = {}
    for (const obj of objects) {
      counts[obj.object_type] = (counts[obj.object_type] ?? 0) + 1
    }
    return counts
  }, [objects])

  // Total BL value
  const totalValue = useMemo(
    () =>
      objects.reduce((sum, o) => sum + (Number(o.estimated_value_bl) || 0), 0),
    [objects]
  )

  // Filtered + sorted objects
  const filtered = useMemo(() => {
    let result = objects

    if (activeType !== 'ALL') {
      result = result.filter((o) => o.object_type === activeType)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (o) =>
          displayName(o).toLowerCase().includes(q) ||
          (o.set_number ?? '').toLowerCase().includes(q) ||
          (o.bl_item_no ?? '').toLowerCase().includes(q) ||
          (o.theme ?? '').toLowerCase().includes(q)
      )
    }

    result = [...result].sort((a, b) => {
      let valA: string | number | null = null
      let valB: string | number | null = null

      switch (sortField) {
        case 'name':
          valA = displayName(a).toLowerCase()
          valB = displayName(b).toLowerCase()
          break
        case 'year':
          valA = a.year ?? 0
          valB = b.year ?? 0
          break
        case 'theme':
          valA = (a.theme ?? '').toLowerCase()
          valB = (b.theme ?? '').toLowerCase()
          break
        case 'num_parts':
          valA = a.num_parts ?? 0
          valB = b.num_parts ?? 0
          break
        case 'num_minifigs':
          valA = a.num_minifigs ?? 0
          valB = b.num_minifigs ?? 0
          break
        case 'estimated_value_bl':
          valA = Number(a.estimated_value_bl) || 0
          valB = Number(b.estimated_value_bl) || 0
          break
      }

      if (valA === null) valA = ''
      if (valB === null) valB = ''

      if (valA < valB) return sortDir === 'asc' ? -1 : 1
      if (valA > valB) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [objects, activeType, search, sortField, sortDir])

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const typesWithObjects = ALL_OBJECT_TYPES.filter(
    (type) => (typeCounts[type] ?? 0) > 0
  )

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{t.title}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {t.summary(objects.length, formatNok(totalValue))}
            </p>
          </div>
        </div>

        {/* Type tabs */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setActiveType('ALL')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeType === 'ALL'
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.allTab}
            <span
              className={`ml-1.5 text-xs ${
                activeType === 'ALL' ? 'text-gray-300' : 'text-gray-400'
              }`}
            >
              {objects.length}
            </span>
          </button>

          {typesWithObjects.map((type) => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeType === type
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.objectTypes[type]}
              <span
                className={`ml-1.5 text-xs ${
                  activeType === type ? 'text-gray-300' : 'text-gray-400'
                }`}
              >
                {typeCounts[type] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Search ────────────────────────────────────────────────────── */}
      <div className="px-6 py-3 border-b border-gray-100">
        <div className="relative max-w-sm">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white border-b border-gray-100 z-10">
            <tr>
              <th className="text-left px-6 py-3 font-medium text-gray-500 w-12"></th>
              <th className="text-left px-3 py-3 font-medium text-gray-500">
                <button
                  onClick={() => toggleSort('name')}
                  className="flex items-center hover:text-gray-800"
                >
                  {t.columns.name}
                  <SortIcon field="name" active={sortField} dir={sortDir} />
                </button>
              </th>
              <th className="text-left px-3 py-3 font-medium text-gray-500 hidden md:table-cell">
                <button
                  onClick={() => toggleSort('theme')}
                  className="flex items-center hover:text-gray-800"
                >
                  {t.columns.theme}
                  <SortIcon field="theme" active={sortField} dir={sortDir} />
                </button>
              </th>
              <th className="text-left px-3 py-3 font-medium text-gray-500 hidden lg:table-cell">
                <button
                  onClick={() => toggleSort('year')}
                  className="flex items-center hover:text-gray-800"
                >
                  {t.columns.year}
                  <SortIcon field="year" active={sortField} dir={sortDir} />
                </button>
              </th>
              <th className="text-left px-3 py-3 font-medium text-gray-500 hidden sm:table-cell">
                {t.columns.condition}
              </th>
              <th className="text-right px-3 py-3 font-medium text-gray-500 hidden lg:table-cell">
                <button
                  onClick={() => toggleSort('num_parts')}
                  className="flex items-center justify-end hover:text-gray-800 ml-auto"
                >
                  {t.columns.parts}
                  <SortIcon field="num_parts" active={sortField} dir={sortDir} />
                </button>
              </th>
              <th className="text-right px-3 py-3 font-medium text-gray-500 hidden lg:table-cell">
                <button
                  onClick={() => toggleSort('num_minifigs')}
                  className="flex items-center justify-end hover:text-gray-800 ml-auto"
                  title={t.minifigCountTitle}
                >
                  {t.columns.minifigs}
                  <SortIcon field="num_minifigs" active={sortField} dir={sortDir} />
                </button>
              </th>
              <th className="text-right px-3 py-3 font-medium text-gray-500">
                <button
                  onClick={() => toggleSort('estimated_value_bl')}
                  className="flex items-center justify-end hover:text-gray-800 ml-auto"
                >
                  {t.columns.blValue}
                  <SortIcon
                    field="estimated_value_bl"
                    active={sortField}
                    dir={sortDir}
                  />
                </button>
              </th>
              <th className="pl-3 pr-6 py-3 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-gray-400">
                  {t.empty}
                </td>
              </tr>
            )}
            {filtered.map((obj) => (
              <tr
                key={obj.id}
                className="hover:bg-gray-50 transition-colors"
              >
                {/* Thumbnail */}
                <td className="pl-6 pr-2 py-3">
                  <div className="flex items-center justify-center">
                    <ObjectThumbnail
                      src={imageUrl(supabaseUrl, obj.image_filename)}
                      name={displayName(obj)}
                      type={obj.object_type}
                    />
                  </div>
                </td>

                {/* Name + ID */}
                <td className="px-3 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-gray-900 line-clamp-1">
                      {displayName(obj)}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      {typeIcon(obj.object_type)}
                      <span>{displayId(obj)}</span>
                    </div>
                  </div>
                </td>

                {/* Theme */}
                <td className="px-3 py-3 hidden md:table-cell">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-700">{obj.theme ?? strings.common.none}</span>
                    {obj.subtheme && (
                      <span className="text-xs text-gray-400">{obj.subtheme}</span>
                    )}
                  </div>
                </td>

                {/* Year */}
                <td className="px-3 py-3 hidden lg:table-cell text-gray-600">
                  {obj.year ?? strings.common.none}
                </td>

                {/* Condition */}
                <td className="px-3 py-3 hidden sm:table-cell">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${conditionColor(
                      obj.condition
                    )}`}
                  >
                    {t.conditions[obj.condition] ?? obj.condition}
                  </span>
                </td>

                {/* Num parts */}
                <td className="px-3 py-3 hidden lg:table-cell text-right text-gray-600 tabular-nums">
                  {obj.num_parts?.toLocaleString('en-US') ?? strings.common.none}
                </td>

                {/* Antall minifigurer */}
                <td className="px-3 py-3 hidden lg:table-cell text-right text-gray-600 tabular-nums">
                  {obj.num_minifigs ? (
                    <span className="inline-flex items-center gap-1 justify-end">
                      <User size={12} className="text-gray-400" />
                      {obj.num_minifigs.toLocaleString('en-US')}
                    </span>
                  ) : (
                    <span className="text-gray-300">{strings.common.none}</span>
                  )}
                </td>

                {/* BL value */}
                <td className="px-3 py-3 text-right text-gray-700 tabular-nums font-medium">
                  {formatNok(obj.estimated_value_bl)}
                </td>

                {/* Delsjekk – kun for sett */}
                <td className="pl-3 pr-6 py-3 text-right">
                  {obj.object_type === 'SET' && (
                    <Link
                      href={`/collection/${obj.id}/parts-check`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs
                                 font-medium text-gray-500 hover:text-[#2E5FA3] hover:bg-[#2E5FA3]/10
                                 transition-colors"
                      title={t.partsCheck}
                    >
                      <ListChecks size={13} />
                      <span className="hidden lg:inline">{t.partsCheck}</span>
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Footer count ──────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="px-6 py-2.5 border-t border-gray-100 text-xs text-gray-400 flex justify-between">
          <span>{t.footer.showing(filtered.length, objects.length)}</span>
          <span>
            {t.footer.total(
              formatNok(
                filtered.reduce((s, o) => s + (Number(o.estimated_value_bl) || 0), 0)
              )
            )}
          </span>
        </div>
      )}
    </div>
  )
}
