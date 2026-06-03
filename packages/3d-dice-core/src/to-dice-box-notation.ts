import type { RollResult } from './types'

export function toDiceBoxNotation(result: RollResult): string {
  const notationParts: string[] = []
  const allValues: number[] = []
  for (const pool of result.pools) {
    const initial = pool.rolls.flat()
    const explosionsFlat = (pool.explosions ?? []).flat()
    const faceValues = [...initial, ...explosionsFlat]

    if (pool.sides === 100) {
      notationParts.push(`${faceValues.length}d100`, `${faceValues.length}d10`)
      allValues.push(
        ...faceValues.map(v => Math.floor(v / 10) % 10),
        ...faceValues.map(v => v % 10),
      )
    } else {
      notationParts.push(`${faceValues.length}d${pool.sides}`)
      allValues.push(...faceValues)
    }
  }
  const dice = notationParts.join('+')
  return allValues.length > 0 ? `${dice}@${allValues.join(',')}` : dice
}
