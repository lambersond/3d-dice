import { formatRollExpression } from './format-roll-expression'
import type { RollResult } from './types'

export function formatResultExpression(result: RollResult): string {
  return formatRollExpression({
    pools: result.pools.map(p => ({ sides: p.sides, count: p.count })),
    modifier: result.modifier,
    advantage: result.advantage,
    exploding: result.pools.some(p =>
      (p.explosions ?? []).some(c => c.length > 0),
    ),
  })
}
