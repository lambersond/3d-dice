import { combineD100, dieSlotResult } from './reroll'
import type {
  Advantage,
  DiePool,
  DieSides,
  DieSlot,
  RollRequest,
  RollResult,
  RolledDie,
} from './types'

export type PhysicalThrow = (notation: string) => Promise<RolledDie[]>

const EXPLOSION_CAP = 50
const MISSING_DIE: RolledDie = { value: 0, dieId: -1 }

type PoolPlan = {
  sides: DieSides
  count: number
  kind: 'plain' | 'adv' | 'd100'
  notation: string
  consume: number
}

// A die that is still exploding: its `sides` and a reference to the chain array
// stored on its pool, so appending a value updates the pool in place.
type PendingDie = { sides: DieSides; chain: number[] }

export async function executeNonDetRoll(
  request: RollRequest,
  throwDice: PhysicalThrow,
  options: { now?: number; id?: string } = {},
): Promise<RollResult> {
  const now = options.now ?? Date.now()
  const id = options.id ?? crypto.randomUUID()
  const { advantage, modifier } = request
  const exploding = request.exploding ?? false

  const plans = request.pools
    .filter(p => p.count > 0)
    .map(p => planPool(p.sides, p.count, advantage))

  const notation = plans.map(p => p.notation).join('+')
  const landed = notation ? await throwDice(notation) : []

  const { pools, explosionsByPool, pending } = collectPools(
    plans,
    landed,
    exploding,
    advantage,
  )

  // Every die at its max re-rolls together, one batched throw per round, until
  // none explode — instead of one die at a time.
  if (pending.length > 0) await resolveExplosions(pending, throwDice)

  for (const [p, pool] of pools.entries()) {
    const explosions = explosionsByPool[p]
    if (explosions.some(chain => chain.length > 0)) pool.explosions = explosions
  }

  return {
    id,
    at: now,
    pools,
    modifier,
    advantage,
    total: sumDice(pools) + modifier,
  }
}

// Slice the base throw into each pool, building its base result and collecting
// every die at its max into a flat pending list for the explosion rounds.
function collectPools(
  plans: PoolPlan[],
  landed: RolledDie[],
  exploding: boolean,
  advantage: Advantage | undefined,
): { pools: DiePool[]; explosionsByPool: number[][][]; pending: PendingDie[] } {
  const pools: DiePool[] = []
  const explosionsByPool: number[][][] = []
  const pending: PendingDie[] = []
  let cursor = 0

  for (const plan of plans) {
    const base = landed.slice(cursor, cursor + plan.consume)
    cursor += plan.consume
    const { pool, slots, explosions } = buildPoolBase(plan, base, advantage)
    // Exploding rolls omit the reroll breakdown so those dice don't rewrite the
    // logged result; non-exploding rolls keep their per-die slots.
    if (!exploding) pool.slots = slots
    pools.push(pool)
    explosionsByPool.push(explosions)
    if (exploding) collectPending(plan, pool, explosions, pending)
  }

  return { pools, explosionsByPool, pending }
}

function collectPending(
  plan: PoolPlan,
  pool: DiePool,
  explosions: number[][],
  pending: PendingDie[],
): void {
  for (let i = 0; i < plan.count; i += 1) {
    if (pool.kept[i] === plan.sides) {
      pending.push({ sides: plan.sides, chain: explosions[i] })
    }
  }
}

function planPool(
  sides: DieSides,
  count: number,
  advantage: Advantage | undefined,
): PoolPlan {
  if (advantage !== undefined && sides === 20) {
    return {
      sides,
      count,
      kind: 'adv',
      notation: `${2 * count}d20`,
      consume: 2 * count,
    }
  }
  if (sides === 100) {
    return {
      sides,
      count,
      kind: 'd100',
      notation: `${count}d100+${count}d10`,
      consume: 2 * count,
    }
  }
  return {
    sides,
    count,
    kind: 'plain',
    notation: `${count}d${sides}`,
    consume: count,
  }
}

// Map the physical dice that landed for one kept die into a slot, preserving
// each die's stable id so a later reroll can update the right value.
function slotForDie(
  plan: PoolPlan,
  advantage: Advantage | undefined,
  base: RolledDie[],
  i: number,
): DieSlot {
  if (plan.kind === 'adv') {
    const a = base[2 * i] ?? MISSING_DIE
    const b = base[2 * i + 1] ?? MISSING_DIE
    return { kind: advantage === 'dis' ? 'dis' : 'adv', parts: [a, b] }
  }
  if (plan.kind === 'd100') {
    const tens = base[i] ?? MISSING_DIE
    const ones = base[plan.count + i] ?? MISSING_DIE
    return { kind: 'd100', parts: [tens, ones] }
  }
  return { kind: 'plain', parts: [base[i] ?? MISSING_DIE] }
}

// Build a pool's base result (kept/rolls/slots) without resolving explosions,
// plus an empty chain per die for any later explosion rounds to fill.
function buildPoolBase(
  plan: PoolPlan,
  base: RolledDie[],
  advantage: Advantage | undefined,
): { pool: DiePool; slots: DieSlot[]; explosions: number[][] } {
  const { sides, count } = plan
  const slots: DieSlot[] = []
  const rolls: number[][] = []
  const kept: number[] = []

  for (let i = 0; i < count; i += 1) {
    const slot = slotForDie(plan, advantage, base, i)
    const { kept: keptValue, rolls: dieRolls } = dieSlotResult(slot)
    slots.push(slot)
    rolls.push(dieRolls)
    kept.push(keptValue)
  }

  const explosions = Array.from({ length: count }, () => [] as number[])
  return { pool: { sides, count, rolls, kept }, slots, explosions }
}

function sumDice(pools: DiePool[]): number {
  return pools.reduce((sum, pool) => sum + sumPool(pool), 0)
}

function sumPool(pool: DiePool): number {
  const kept = pool.kept.reduce((s, v) => s + v, 0)
  const exploded = (pool.explosions ?? []).reduce(
    (s, chain) => s + chain.reduce((c, v) => c + v, 0),
    0,
  )
  return kept + exploded
}

// Resolve explosions in batched rounds: each round re-rolls every still-exploding
// die in a single throw, appends the results, and carries forward the dice that
// hit their max again (capped per die).
async function resolveExplosions(
  pending: PendingDie[],
  throwDice: PhysicalThrow,
): Promise<void> {
  let active = pending
  let rounds = 0
  while (active.length > 0 && rounds < EXPLOSION_CAP) {
    rounds += 1
    const values = await rollBatch(active, throwDice)
    const next: PendingDie[] = []
    for (const [i, die] of active.entries()) {
      const value = values[i]
      die.chain.push(value)
      if (value === die.sides && die.chain.length < EXPLOSION_CAP) {
        next.push(die)
      }
    }
    active = next
  }
}

// Throw every active die at once: group by sides into one notation, then map the
// flat results back to each die's position (combining d100 tens/ones pairs).
async function rollBatch(
  active: PendingDie[],
  throwDice: PhysicalThrow,
): Promise<number[]> {
  const groups = new Map<DieSides, number[]>()
  for (const [i, die] of active.entries()) {
    const list = groups.get(die.sides) ?? []
    list.push(i)
    groups.set(die.sides, list)
  }

  const segments = [...groups.entries()].map(([sides, indices]) => ({
    sides,
    indices,
  }))
  const notation = segments
    .map(({ sides, indices }) =>
      sides === 100
        ? `${indices.length}d100+${indices.length}d10`
        : `${indices.length}d${sides}`,
    )
    .join('+')

  const landed = await throwDice(notation)
  const values = Array.from({ length: active.length }, () => 0)
  let cursor = 0
  for (const { sides, indices } of segments) {
    const k = indices.length
    if (sides === 100) {
      const tens = landed.slice(cursor, cursor + k)
      const ones = landed.slice(cursor + k, cursor + 2 * k)
      cursor += 2 * k
      for (const [j, activeIndex] of indices.entries()) {
        values[activeIndex] = combineD100(
          tens[j]?.value ?? 0,
          ones[j]?.value ?? 0,
        )
      }
    } else {
      const block = landed.slice(cursor, cursor + k)
      cursor += k
      for (const [j, activeIndex] of indices.entries()) {
        values[activeIndex] = block[j]?.value ?? 0
      }
    }
  }
  return values
}
