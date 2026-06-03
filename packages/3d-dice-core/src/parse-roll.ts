import { DIE_SIDES } from './constants'
import type { Advantage, DieSides, ParseRollResult } from './types'

export function parseRollExpression(input: string): ParseRollResult {
  const trimmed = input.trim()
  if (!trimmed) return { ok: false, error: 'Empty expression' }

  let working = trimmed
  let advantage: Advantage | undefined

  const advIndex = working.search(/\b(?:adv|advantage)\b/i)
  const disIndex = working.search(/\b(?:dis|disadvantage)\b/i)
  if (advIndex !== -1 || disIndex !== -1) {
    advantage = advIndex > disIndex ? 'adv' : 'dis'
  }
  working = working
    .replaceAll(/\b(?:adv|advantage)\b/gi, ' ')
    .replaceAll(/\b(?:dis|disadvantage)\b/gi, ' ')

  const exploding =
    /\b(?:exp|explode|exploding)\b/i.test(working) || working.includes('!')
  working = working
    .replaceAll(/\b(?:exp|explode|exploding)\b/gi, ' ')
    .replaceAll('!', ' ')

  const poolMap = new Map<DieSides, number>()
  for (const match of working.matchAll(/(\d{0,4})d(\d{1,4})/gi)) {
    const count = match[1] ? Number.parseInt(match[1], 10) : 1
    const sides = Number.parseInt(match[2], 10)
    if (count <= 0) {
      return { ok: false, error: `Invalid dice count: ${count}` }
    }
    if (!DIE_SIDES.includes(sides as DieSides)) {
      return { ok: false, error: `Unsupported die: d${sides}` }
    }
    const typed = sides as DieSides
    poolMap.set(typed, (poolMap.get(typed) ?? 0) + count)
  }

  if (poolMap.size === 0) {
    return { ok: false, error: 'No dice in expression' }
  }

  const remaining = working
    .replaceAll(/(\d{0,4})d(\d{1,4})/gi, ' ')
    .replaceAll(/\s+/g, '')
  let modifier = 0
  for (const match of remaining.matchAll(/[+-]?\d{1,6}/g)) {
    modifier += Number.parseInt(match[0], 10)
  }

  const pools = [...poolMap.entries()]
    .toSorted(([a], [b]) => a - b)
    .map(([sides, count]) => ({ sides, count }))

  return {
    ok: true,
    request: { pools, modifier, advantage, exploding },
  }
}
