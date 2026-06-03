import { toDiceBoxNotation } from './to-dice-box-notation'
import type { DiePool, RollResult } from './types'

const result = (pools: DiePool[]): RollResult => ({
  id: 'r',
  at: 0,
  pools,
  modifier: 0,
  total: 0,
})

describe('toDiceBoxNotation', () => {
  it('renders a pool as count, sides, and pinned face values', () => {
    expect(
      toDiceBoxNotation(
        result([{ sides: 6, count: 2, rolls: [[3], [5]], kept: [3, 5] }]),
      ),
    ).toBe('2d6@3,5')
  })

  it('joins multiple pools with a plus', () => {
    expect(
      toDiceBoxNotation(
        result([
          { sides: 6, count: 1, rolls: [[3]], kept: [3] },
          { sides: 20, count: 1, rolls: [[15]], kept: [15] },
        ]),
      ),
    ).toBe('1d6+1d20@3,15')
  })

  it('shows both physical dice for an advantage roll', () => {
    expect(
      toDiceBoxNotation(
        result([{ sides: 20, count: 1, rolls: [[10, 18]], kept: [18] }]),
      ),
    ).toBe('2d20@10,18')
  })

  it('includes the exploded faces', () => {
    expect(
      toDiceBoxNotation(
        result([
          { sides: 6, count: 1, rolls: [[6]], kept: [6], explosions: [[2]] },
        ]),
      ),
    ).toBe('2d6@6,2')
  })

  it('splits a d100 into a d100/d10 pair of tens and units', () => {
    expect(
      toDiceBoxNotation(
        result([{ sides: 100, count: 1, rolls: [[57]], kept: [57] }]),
      ),
    ).toBe('1d100+1d10@5,7')
  })

  it('feeds 0/0 for a d100 result of 100 (reads as 00 + 0)', () => {
    expect(
      toDiceBoxNotation(
        result([{ sides: 100, count: 1, rolls: [[100]], kept: [100] }]),
      ),
    ).toBe('1d100+1d10@0,0')
  })

  it('groups tens and units by set for multiple d100s', () => {
    expect(
      toDiceBoxNotation(
        result([{ sides: 100, count: 2, rolls: [[5], [56]], kept: [5, 56] }]),
      ),
    ).toBe('2d100+2d10@0,5,5,6')
  })

  it('returns an empty string when there are no pools', () => {
    expect(toDiceBoxNotation(result([]))).toBe('')
  })
})
