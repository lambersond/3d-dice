import type {
  Advantage,
  DiePool,
  DieSides,
  RollRequest,
  RollResult,
} from './types'

export type PhysicalThrow = (notation: string) => Promise<number[]>

const EXPLOSION_CAP = 50

type PoolPlan = {
  sides: DieSides
  count: number
  kind: 'plain' | 'adv' | 'd100'
  notation: string
  consume: number
}

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

  const pools: DiePool[] = []
  let cursor = 0
  for (const plan of plans) {
    const base = landed.slice(cursor, cursor + plan.consume)
    cursor += plan.consume
    pools.push(await buildPool(plan, base, advantage, exploding, throwDice))
  }

  const diceTotal = pools.reduce(
    (sum, pool) =>
      sum +
      pool.kept.reduce((s, v) => s + v, 0) +
      (pool.explosions ?? []).reduce(
        (s, chain) => s + chain.reduce((c, v) => c + v, 0),
        0,
      ),
    0,
  )

  return {
    id,
    at: now,
    pools,
    modifier,
    advantage,
    total: diceTotal + modifier,
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

async function buildPool(
  plan: PoolPlan,
  base: number[],
  advantage: Advantage | undefined,
  exploding: boolean,
  throwDice: PhysicalThrow,
): Promise<DiePool> {
  const { sides, count, kind } = plan
  const rolls: number[][] = []
  const kept: number[] = []
  const explosions: number[][] = []
  let anyExplosion = false

  for (let i = 0; i < count; i += 1) {
    let keptValue: number
    if (kind === 'adv') {
      const a = base[2 * i] ?? 0
      const b = base[2 * i + 1] ?? 0
      rolls.push([a, b])
      keptValue = advantage === 'adv' ? Math.max(a, b) : Math.min(a, b)
    } else if (kind === 'd100') {
      const value = combineD100(base[i] ?? 0, base[count + i] ?? 0)
      rolls.push([value])
      keptValue = value
    } else {
      const value = base[i] ?? 0
      rolls.push([value])
      keptValue = value
    }
    kept.push(keptValue)

    const chain = exploding
      ? await explodeChain(sides, keptValue, throwDice)
      : []
    explosions.push(chain)
    if (chain.length > 0) anyExplosion = true
  }

  const pool: DiePool = { sides, count, rolls, kept }
  if (anyExplosion) pool.explosions = explosions
  return pool
}

async function explodeChain(
  sides: DieSides,
  seed: number,
  throwDice: PhysicalThrow,
): Promise<number[]> {
  const chain: number[] = []
  let last = seed
  while (last === sides && chain.length < EXPLOSION_CAP) {
    const next = await rollOne(sides, throwDice)
    chain.push(next)
    last = next
  }
  return chain
}

async function rollOne(
  sides: DieSides,
  throwDice: PhysicalThrow,
): Promise<number> {
  if (sides === 100) {
    const landed = await throwDice('1d100+1d10')
    return combineD100(landed[0] ?? 0, landed[1] ?? 0)
  }
  const landed = await throwDice(`1d${sides}`)
  return landed[0] ?? 0
}

function combineD100(tens: number, ones: number): number {
  const value = (tens % 100) + (ones % 10)
  return value === 0 ? 100 : value
}
