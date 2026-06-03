import type { Advantage, DiePool, DieSides, Rng } from './types'

const EXPLOSION_CAP = 50

const rollDie = (sides: number, rng: Rng) => Math.floor(rng() * sides) + 1

function rollExplosionChain(
  sides: DieSides,
  seedValue: number,
  rng: Rng,
): number[] {
  const chain: number[] = []
  let last = seedValue
  while (last === sides && chain.length < EXPLOSION_CAP) {
    const next = rollDie(sides, rng)
    chain.push(next)
    last = next
  }
  return chain
}

export function rollPool(
  sides: DieSides,
  count: number,
  advantage: Advantage | undefined,
  exploding: boolean,
  rng: Rng,
): DiePool {
  const useAdvDis = advantage !== undefined && sides === 20

  const rolls: number[][] = []
  const kept: number[] = []
  const explosions: number[][] = []
  let anyExplosion = false

  for (let i = 0; i < count; i += 1) {
    let keptValue: number
    if (useAdvDis) {
      const a = rollDie(20, rng)
      const b = rollDie(20, rng)
      rolls.push([a, b])
      keptValue = advantage === 'adv' ? Math.max(a, b) : Math.min(a, b)
    } else {
      const v = rollDie(sides, rng)
      rolls.push([v])
      keptValue = v
    }
    kept.push(keptValue)

    const chain = exploding ? rollExplosionChain(sides, keptValue, rng) : []
    explosions.push(chain)
    if (chain.length > 0) anyExplosion = true
  }

  const pool: DiePool = { sides, count, rolls, kept }
  if (anyExplosion) pool.explosions = explosions
  return pool
}
