import { executeNonDetRoll, type PhysicalThrow } from './execute-non-det-roll'
import type { RollRequest } from './types'

function scripted(responses: number[][]): {
  throwDice: PhysicalThrow
  calls: string[]
} {
  const queue = [...responses]
  const calls: string[] = []
  let nextId = 0
  const throwDice: PhysicalThrow = notation => {
    calls.push(notation)
    const values = queue.shift() ?? []
    return Promise.resolve(values.map(value => ({ value, dieId: nextId++ })))
  }
  return { throwDice, calls }
}

const opts = { now: 0, id: 'test' }

describe('executeNonDetRoll', () => {
  it('builds a plain pool from the landed values', async () => {
    const request: RollRequest = {
      pools: [{ sides: 6, count: 3 }],
      modifier: 0,
    }
    const { throwDice, calls } = scripted([[2, 5, 6]])

    const result = await executeNonDetRoll(request, throwDice, opts)

    expect(calls).toEqual(['3d6'])
    expect(result.pools[0].kept).toEqual([2, 5, 6])
    expect(result.pools[0].rolls).toEqual([[2], [5], [6]])
    expect(result.pools[0].explosions).toBeUndefined()
    expect(result.total).toBe(13)
  })

  it('adds the modifier to the total', async () => {
    const request: RollRequest = {
      pools: [{ sides: 8, count: 1 }],
      modifier: 3,
    }
    const { throwDice } = scripted([[5]])

    const result = await executeNonDetRoll(request, throwDice, opts)

    expect(result.total).toBe(8)
    expect(result.modifier).toBe(3)
  })

  it('throws two d20s for advantage and keeps the higher', async () => {
    const request: RollRequest = {
      pools: [{ sides: 20, count: 1 }],
      modifier: 0,
      advantage: 'adv',
    }
    const { throwDice, calls } = scripted([[7, 18]])

    const result = await executeNonDetRoll(request, throwDice, opts)

    expect(calls).toEqual(['2d20'])
    expect(result.pools[0].rolls).toEqual([[7, 18]])
    expect(result.pools[0].kept).toEqual([18])
    expect(result.total).toBe(18)
  })

  it('keeps the lower of two d20s for disadvantage', async () => {
    const request: RollRequest = {
      pools: [{ sides: 20, count: 1 }],
      modifier: 0,
      advantage: 'dis',
    }
    const { throwDice } = scripted([[7, 18]])

    const result = await executeNonDetRoll(request, throwDice, opts)

    expect(result.pools[0].kept).toEqual([7])
  })

  it('only doubles d20 for advantage, leaving other pools single', async () => {
    const request: RollRequest = {
      pools: [{ sides: 6, count: 2 }],
      modifier: 0,
      advantage: 'adv',
    }
    const { throwDice, calls } = scripted([[3, 4]])

    const result = await executeNonDetRoll(request, throwDice, opts)

    expect(calls).toEqual(['2d6'])
    expect(result.pools[0].rolls).toEqual([[3], [4]])
    expect(result.pools[0].kept).toEqual([3, 4])
  })

  it('throws follow-up dice while a die shows its max (exploding)', async () => {
    const request: RollRequest = {
      pools: [{ sides: 6, count: 1 }],
      modifier: 0,
      exploding: true,
    }
    const { throwDice, calls } = scripted([[6], [6], [2]])

    const result = await executeNonDetRoll(request, throwDice, opts)

    expect(calls).toEqual(['1d6', '1d6', '1d6'])
    expect(result.pools[0].kept).toEqual([6])
    expect(result.pools[0].explosions).toEqual([[6, 2]])
    expect(result.total).toBe(14)
  })

  it('does not explode a die that is not a max', async () => {
    const request: RollRequest = {
      pools: [{ sides: 6, count: 1 }],
      modifier: 0,
      exploding: true,
    }
    const { throwDice, calls } = scripted([[4]])

    const result = await executeNonDetRoll(request, throwDice, opts)

    expect(calls).toEqual(['1d6'])
    expect(result.pools[0].explosions).toBeUndefined()
    expect(result.total).toBe(4)
  })

  it('combines a d100 (tens) and d10 (ones) into a percentile', async () => {
    const request: RollRequest = {
      pools: [{ sides: 100, count: 1 }],
      modifier: 0,
    }
    const { throwDice, calls } = scripted([[70, 3]])

    const result = await executeNonDetRoll(request, throwDice, opts)

    expect(calls).toEqual(['1d100+1d10'])
    expect(result.pools[0].kept).toEqual([73])
    expect(result.total).toBe(73)
  })

  it('treats a landed 00 + 0 d100 as 100', async () => {
    const request: RollRequest = {
      pools: [{ sides: 100, count: 1 }],
      modifier: 0,
    }
    const { throwDice } = scripted([[100, 10]])

    const result = await executeNonDetRoll(request, throwDice, opts)

    expect(result.pools[0].kept).toEqual([100])
  })

  it('pairs multiple d100 dice by tens-then-ones order', async () => {
    const request: RollRequest = {
      pools: [{ sides: 100, count: 2 }],
      modifier: 0,
    }
    const { throwDice, calls } = scripted([[70, 10, 3, 5]])

    const result = await executeNonDetRoll(request, throwDice, opts)

    expect(calls).toEqual(['2d100+2d10'])
    expect(result.pools[0].kept).toEqual([73, 15])
  })

  it('combines multiple pools into one base throw, in order', async () => {
    const request: RollRequest = {
      pools: [
        { sides: 6, count: 2 },
        { sides: 20, count: 1 },
      ],
      modifier: 1,
    }
    const { throwDice, calls } = scripted([[3, 4, 15]])

    const result = await executeNonDetRoll(request, throwDice, opts)

    expect(calls).toEqual(['2d6+1d20'])
    expect(result.pools[0].kept).toEqual([3, 4])
    expect(result.pools[1].kept).toEqual([15])
    expect(result.total).toBe(23)
  })

  it('skips empty pools', async () => {
    const request: RollRequest = {
      pools: [
        { sides: 6, count: 0 },
        { sides: 8, count: 1 },
      ],
      modifier: 0,
    }
    const { throwDice, calls } = scripted([[5]])

    const result = await executeNonDetRoll(request, throwDice, opts)

    expect(calls).toEqual(['1d8'])
    expect(result.pools).toHaveLength(1)
    expect(result.pools[0].sides).toBe(8)
  })
})
