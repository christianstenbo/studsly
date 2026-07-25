import type { createClient } from '@/lib/supabase/client'
import { strings } from '@/lib/i18n/strings'

/**
 * The one Allocate/Restore code path (build-brief v4 §7.6).
 *
 * Three call sites — a missing part row, a "to replace" row, and the buy list —
 * all go through `allocatePart`. Loose manuals/boxes go through
 * `allocateComponent`. `restore` frees any active allocation. There is exactly
 * one function per kind; do not add per-call-site variants.
 *
 * Each wraps a transactional Postgres RPC (M11) so the allocation row and the
 * receiving inventory_parts / object_components row move together. The pool can
 * never go negative — the M5 guard trigger rejects over-allocation inside the
 * same transaction, and its error surfaces here as `overAllocated`.
 */

type Supabase = ReturnType<typeof createClient>

export type PartPurpose = 'MISSING_PART' | 'REPLACEMENT_PART' | 'MOD_PART'

export interface AllocatePartInput {
  /** The free PART object supplying the piece(s). */
  sourceObjectId: string
  /** The set copy receiving the piece(s). */
  targetObjectId: string
  purpose: PartPurpose
  quantity: number
  /** Which inventory_parts row on the target receives the allocation. */
  targetPartNum: string
  targetColorId: number | null
  note?: string | null
}

export interface AllocateComponentInput {
  /** The free INSTRUCTION / ORIGINAL_BOX object. */
  sourceObjectId: string
  /** The set copy receiving the component. */
  targetObjectId: string
  /** The object_components checklist row being fulfilled. */
  componentId: string
  note?: string | null
}

export interface AllocateResult {
  allocationId: string | null
  error: string | null
}

const a = strings.allocate

/** Turn a Postgres error into a user-facing message; over-allocation is special. */
function toMessage(message: string | undefined): string {
  if (message && message.toLowerCase().includes('over-allocation')) {
    return a.overAllocated
  }
  return a.failed
}

export async function allocatePart(
  supabase: Supabase,
  input: AllocatePartInput
): Promise<AllocateResult> {
  const { data, error } = await supabase.rpc('allocate_part', {
    p_source: input.sourceObjectId,
    p_target: input.targetObjectId,
    p_purpose: input.purpose,
    p_quantity: input.quantity,
    p_part_num: input.targetPartNum,
    p_color_id: input.targetColorId,
    p_note: input.note ?? null,
  })
  if (error) return { allocationId: null, error: toMessage(error.message) }
  return { allocationId: (data as string) ?? null, error: null }
}

export async function allocateComponent(
  supabase: Supabase,
  input: AllocateComponentInput
): Promise<AllocateResult> {
  const { data, error } = await supabase.rpc('allocate_component', {
    p_source: input.sourceObjectId,
    p_target: input.targetObjectId,
    p_component_id: input.componentId,
    p_note: input.note ?? null,
  })
  if (error) return { allocationId: null, error: toMessage(error.message) }
  return { allocationId: (data as string) ?? null, error: null }
}

/** Restore = free an active allocation; the piece/component returns to the pool. */
export async function restore(
  supabase: Supabase,
  allocationId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('restore_allocation', {
    p_id: allocationId,
  })
  return { error: error ? a.restoreFailed : null }
}
