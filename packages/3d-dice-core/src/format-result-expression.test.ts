import { formatResultExpression } from './format-result-expression'
import type { DiePool, RollResult } from './types'

const result = (pools: DiePool[], modifier = 0): RollResult => ({
  id: 'r',
  at: 0,
  pools,
  modifier,
  total: 0,
})

describe('formatResultExpression', () => {
  it('rebuilds the expression from the rolled pools', () => {
    const expression = formatResultExpression(
      result([{ sides: 6, count: 2, rolls: [[3], [4]], kept: [3, 4] }], 3),
    )
    expect(expression).toBe('2d6 + 3')
  })

  it('marks the expression as exploding when a pool exploded', () => {
    const expression = formatResultExpression(
      result([
        { sides: 6, count: 1, rolls: [[6]], kept: [6], explosions: [[2]] },
      ]),
    )
    expect(expression).toBe('1d6!')
  })

  it('is not exploding when explosion chains are empty', () => {
    const expression = formatResultExpression(
      result([
        { sides: 6, count: 1, rolls: [[4]], kept: [4], explosions: [[]] },
      ]),
    )
    expect(expression).toBe('1d6')
  })
})
