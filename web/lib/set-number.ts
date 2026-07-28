/**
 * Rebrickable numbers are `<base>-<variant>`. For a regular set, `-1` is the
 * canonical first variant, so `6399` and `6399-1` denote the same set. For CMF
 * bags and polybags the suffix IS the identity — `71002-5` (Island Warrior),
 * `71002-7` (Holiday Elf) and `71011-1` (Farmer) must NEVER be collapsed to
 * their base. The string alone cannot tell `6399-1` (strippable) from `71011-1`
 * (a CMF figure) apart, so never transform a number to store it: resolve it
 * against real data and persist that exact value.
 *
 * This helper only produces the candidate forms to LOOK UP (never to store):
 * the entered value plus its `-1` canonical equivalent, and nothing else. A
 * value with a non-`-1` suffix (e.g. `71002-5`) yields only itself.
 *
 * Flow 5 (CMF registration) must reuse this — never split('-')[0], never strip a
 * non-`-1` suffix.
 */
export function setNumberCandidates(input: string): string[] {
  const s = input.trim()
  if (!s) return []
  const out = [s]
  if (/-1$/.test(s)) out.push(s.replace(/-1$/, "")) // 6399-1 -> also try 6399
  else if (!s.includes("-")) out.push(`${s}-1`) // 6399 -> also try 6399-1
  return out
}
