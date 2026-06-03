import { parseRollExpression } from './parse-roll'

const parsed = (input: string) => {
  const result = parseRollExpression(input)
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`)
  return result.request
}

describe('parseRollExpression', () => {
  it('rejects an empty or whitespace-only expression', () => {
    expect(parseRollExpression('')).toEqual({
      ok: false,
      error: 'Empty expression',
    })
    expect(parseRollExpression('   ')).toEqual({
      ok: false,
      error: 'Empty expression',
    })
  })

  it('parses dice, a default count, and a modifier', () => {
    expect(parsed('2d6 + 3')).toEqual({
      pools: [{ sides: 6, count: 2 }],
      modifier: 3,
      advantage: undefined,
      exploding: false,
    })
    expect(parsed('d20').pools).toEqual([{ sides: 20, count: 1 }])
  })

  it('sums signed modifiers', () => {
    expect(parsed('1d20 + 5 - 2').modifier).toBe(3)
  })

  it('combines repeated dice and sorts pools by side count', () => {
    expect(parsed('1d20 + 1d6 + 2d20').pools).toEqual([
      { sides: 6, count: 1 },
      { sides: 20, count: 3 },
    ])
  })

  it('reads advantage and disadvantage keywords', () => {
    expect(parsed('1d20 adv').advantage).toBe('adv')
    expect(parsed('1d20 disadvantage').advantage).toBe('dis')
  })

  it('lets the later of adv/dis win when both appear', () => {
    expect(parsed('dis adv 1d20').advantage).toBe('adv')
    expect(parsed('adv dis 1d20').advantage).toBe('dis')
  })

  it('detects exploding via any keyword or a trailing bang', () => {
    expect(parsed('2d6 exp').exploding).toBe(true)
    expect(parsed('2d6 explode').exploding).toBe(true)
    expect(parsed('2d6 exploding').exploding).toBe(true)
    expect(parsed('1d6!').exploding).toBe(true)
  })

  it('is case-insensitive across dice, keywords, and flags', () => {
    expect(parsed('1D20+5 ADV EXP')).toEqual({
      pools: [{ sides: 20, count: 1 }],
      modifier: 5,
      advantage: 'adv',
      exploding: true,
    })
  })

  it('rejects unsupported dice and non-positive counts', () => {
    expect(parseRollExpression('1d7')).toEqual({
      ok: false,
      error: 'Unsupported die: d7',
    })
    expect(parseRollExpression('0d6')).toEqual({
      ok: false,
      error: 'Invalid dice count: 0',
    })
  })

  it('rejects an expression with no dice', () => {
    expect(parseRollExpression('advantage + 5')).toEqual({
      ok: false,
      error: 'No dice in expression',
    })
  })
})
