import type { RollRequest } from './types'

export function formatRollExpression(request: RollRequest): string {
  const explSuffix = request.exploding ? '!' : ''
  const parts = request.pools
    .filter(p => p.count > 0)
    .map(p => `${p.count}d${p.sides}${explSuffix}`)

  if (request.modifier > 0) parts.push(`+${request.modifier}`)
  else if (request.modifier < 0) parts.push(`${request.modifier}`)

  let expression = parts
    .join(' + ')
    .replaceAll(' + +', ' + ')
    .replaceAll(' + -', ' - ')
  if (!expression) expression = '-'

  if (request.advantage === 'adv') expression += ' (adv)'
  else if (request.advantage === 'dis') expression += ' (dis)'

  return expression
}
