import { executeRoll } from './execute-roll'
import type { RollRequest, Rng } from './types'

const faceRng = (face: number, sides: number) => (face - 0.5) / sides

const seq = (...values: number[]): Rng => {
  let i = 0
  return () => values[i++ % values.length]
}

const fixed = { now: 1000, id: 'roll-1' }

const roll = (request: RollRequest, rng: Rng) =>
  executeRoll(request, { rng, ...fixed })

describe('executeRoll', () => {
  it('sums kept dice plus the modifier', () => {
    const result = roll(
      { pools: [{ sides: 6, count: 2 }], modifier: 3 },
      seq(faceRng(4, 6), faceRng(2, 6)),
    )
    expect(result.pools[0].kept).toEqual([4, 2])
    expect(result.total).toBe(4 + 2 + 3)
  })

  it('stamps the id and timestamp from options', () => {
    const result = roll(
      { pools: [{ sides: 6, count: 1 }], modifier: 0 },
      seq(faceRng(5, 6)),
    )
    expect(result.id).toBe('roll-1')
    expect(result.at).toBe(1000)
  })

  it('keeps the higher of two d20 with advantage', () => {
    const result = roll(
      { pools: [{ sides: 20, count: 1 }], modifier: 0, advantage: 'adv' },
      seq(faceRng(10, 20), faceRng(18, 20)),
    )
    expect(result.pools[0].rolls).toEqual([[10, 18]])
    expect(result.pools[0].kept).toEqual([18])
    expect(result.total).toBe(18)
  })

  it('keeps the lower of two d20 with disadvantage', () => {
    const result = roll(
      { pools: [{ sides: 20, count: 1 }], modifier: 0, advantage: 'dis' },
      seq(faceRng(10, 20), faceRng(18, 20)),
    )
    expect(result.pools[0].kept).toEqual([10])
  })

  it('ignores advantage on non-d20 dice', () => {
    const result = roll(
      { pools: [{ sides: 6, count: 1 }], modifier: 0, advantage: 'adv' },
      seq(faceRng(3, 6)),
    )
    expect(result.pools[0].rolls).toEqual([[3]])
    expect(result.pools[0].kept).toEqual([3])
  })

  it('explodes on a max face and adds the chain to the total', () => {
    const result = roll(
      { pools: [{ sides: 6, count: 1 }], modifier: 0, exploding: true },
      seq(faceRng(6, 6), faceRng(6, 6), faceRng(3, 6)),
    )
    expect(result.pools[0].kept).toEqual([6])
    expect(result.pools[0].explosions).toEqual([[6, 3]])
    expect(result.total).toBe(6 + 6 + 3)
  })

  it('omits the explosions field when nothing explodes', () => {
    const result = roll(
      { pools: [{ sides: 6, count: 1 }], modifier: 0, exploding: true },
      seq(faceRng(4, 6)),
    )
    expect(result.pools[0].explosions).toBeUndefined()
  })

  it('caps a runaway explosion chain', () => {
    const result = roll(
      { pools: [{ sides: 6, count: 1 }], modifier: 0, exploding: true },
      seq(faceRng(6, 6)),
    )
    expect(result.pools[0].explosions?.[0]).toHaveLength(50)
  })

  it('explodes only the kept die when advantage is also active', () => {
    const result = roll(
      {
        pools: [{ sides: 20, count: 1 }],
        modifier: 0,
        advantage: 'adv',
        exploding: true,
      },
      seq(faceRng(11, 20), faceRng(20, 20), faceRng(5, 20)),
    )
    expect(result.pools[0].rolls).toEqual([[11, 20]])
    expect(result.pools[0].kept).toEqual([20])
    expect(result.pools[0].explosions).toEqual([[5]])
    expect(result.total).toBe(20 + 5)
  })

  it('drops pools with a zero count', () => {
    const result = roll(
      {
        pools: [
          { sides: 6, count: 1 },
          { sides: 8, count: 0 },
        ],
        modifier: 0,
      },
      seq(faceRng(3, 6)),
    )
    expect(result.pools).toHaveLength(1)
    expect(result.pools[0].sides).toBe(6)
  })

  it('rolls a d100 like any other die', () => {
    const result = roll(
      { pools: [{ sides: 100, count: 1 }], modifier: 0 },
      seq(faceRng(57, 100)),
    )
    expect(result.pools[0].kept).toEqual([57])
    expect(result.total).toBe(57)
  })
})
