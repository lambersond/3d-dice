import type { DiePool, DieSlot, RollResult } from './types'

/** Combine a percentile pair (tens d100 + ones d10) into a 1-100 value. */
export function combineD100(tens: number, ones: number): number {
  const value = (tens % 100) + (ones % 10)
  return value === 0 ? 100 : value
}

/**
 * Derive a kept value and the per-die `rolls` display from a slot's current
 * physical faces. Mirrors how executeNonDetRoll builds `kept`/`rolls`, so a
 * recompute after a reroll stays consistent with the original throw.
 */
export function dieSlotResult(slot: DieSlot): {
  kept: number
  rolls: number[]
} {
  const values = slot.parts.map(part => part.value)
  switch (slot.kind) {
    case 'adv': {
      return { kept: Math.max(...values), rolls: values }
    }
    case 'dis': {
      return { kept: Math.min(...values), rolls: values }
    }
    case 'd100': {
      const combined = combineD100(values[0] ?? 0, values[1] ?? 0)
      return { kept: combined, rolls: [combined] }
    }
    default: {
      return { kept: values[0] ?? 0, rolls: [values[0] ?? 0] }
    }
  }
}

function poolTotal(pool: DiePool): number {
  const kept = pool.kept.reduce((sum, v) => sum + v, 0)
  const exploded = (pool.explosions ?? []).reduce(
    (sum, chain) => sum + chain.reduce((c, v) => c + v, 0),
    0,
  )
  return kept + exploded
}

function rollTotal(pools: DiePool[], modifier: number): number {
  return pools.reduce((sum, pool) => sum + poolTotal(pool), modifier)
}

/**
 * Return a copy of `result` with the given rerolls applied: each physical die
 * (matched by stable `dieId`) takes its new face value, the affected pool's
 * `kept`/`rolls` are recomputed via {@link dieSlotResult}, and `total` is
 * re-summed. Dice with no matching slot (exploding/deterministic rolls) are
 * left untouched. Extra fields on `result` (e.g. roller) are preserved.
 */
export function applyRerollToResult<T extends RollResult>(
  result: T,
  rerolls: ReadonlyArray<{ dieId: number; value: number }>,
): T {
  const byId = new Map(rerolls.map(r => [r.dieId, r.value]))
  let changed = false

  const pools = result.pools.map(pool => {
    if (!pool.slots) return pool
    let poolChanged = false

    const slots = pool.slots.map(slot => {
      let slotChanged = false
      const parts = slot.parts.map(part => {
        const next = byId.get(part.dieId)
        if (next === undefined || next === part.value) return part
        slotChanged = true
        return { ...part, value: next }
      })
      if (!slotChanged) return slot
      poolChanged = true
      return { ...slot, parts }
    })

    if (!poolChanged) return pool
    changed = true

    const kept = [...pool.kept]
    const rolls = pool.rolls.map(r => [...r])
    for (const [i, slot] of slots.entries()) {
      const recomputed = dieSlotResult(slot)
      kept[i] = recomputed.kept
      rolls[i] = recomputed.rolls
    }
    return { ...pool, slots, kept, rolls }
  })

  if (!changed) return result
  return { ...result, pools, total: rollTotal(pools, result.modifier) }
}
