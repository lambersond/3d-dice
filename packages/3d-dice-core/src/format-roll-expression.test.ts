import { formatRollExpression } from './format-roll-expression'
import type { RollRequest } from './types'

const request = (over: Partial<RollRequest> = {}): RollRequest => ({
  pools: [{ sides: 6, count: 2 }],
  modifier: 0,
  ...over,
})

describe('formatRollExpression', () => {
  it('joins pools and a positive modifier with a plus', () => {
    expect(formatRollExpression(request({ modifier: 3 }))).toBe('2d6 + 3')
  })

  it('renders a negative modifier as a minus', () => {
    expect(formatRollExpression(request({ modifier: -2 }))).toBe('2d6 - 2')
  })

  it('omits a zero modifier', () => {
    expect(formatRollExpression(request())).toBe('2d6')
  })

  it('appends a bang to exploding pools', () => {
    expect(
      formatRollExpression(
        request({ pools: [{ sides: 6, count: 1 }], exploding: true }),
      ),
    ).toBe('1d6!')
  })

  it('joins multiple pools', () => {
    expect(
      formatRollExpression(
        request({
          pools: [
            { sides: 6, count: 2 },
            { sides: 20, count: 1 },
          ],
        }),
      ),
    ).toBe('2d6 + 1d20')
  })

  it('drops zero-count pools and falls back to a dash when empty', () => {
    expect(
      formatRollExpression(request({ pools: [{ sides: 6, count: 0 }] })),
    ).toBe('-')
  })

  it('annotates advantage and disadvantage', () => {
    const pools = [{ sides: 20, count: 1 }] as const
    expect(formatRollExpression(request({ pools, advantage: 'adv' }))).toBe(
      '1d20 (adv)',
    )
    expect(formatRollExpression(request({ pools, advantage: 'dis' }))).toBe(
      '1d20 (dis)',
    )
  })
})
