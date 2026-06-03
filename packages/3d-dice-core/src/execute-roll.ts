import { rollPool } from './utils'
import type { ExecuteRollOptions, RollRequest, RollResult } from './types'

export function executeRoll(
  request: RollRequest,
  options: ExecuteRollOptions = {},
): RollResult {
  const {
    rng = Math.random,
    now = Date.now(),
    id = crypto.randomUUID(),
  } = options

  const pools = request.pools
    .filter(p => p.count > 0)
    .map(p =>
      rollPool(
        p.sides,
        p.count,
        request.advantage,
        request.exploding ?? false,
        rng,
      ),
    )

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
    modifier: request.modifier,
    advantage: request.advantage,
    total: diceTotal + request.modifier,
  }
}
