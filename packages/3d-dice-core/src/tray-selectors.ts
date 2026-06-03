import type { DieSides, RollRequest, TrayState } from './types'

export function trayModifier(state: TrayState): number {
  const m = state.modifiers
  return (m.plusFive - m.minusFive) * 5 + m.plusOne - m.minusOne
}

export function trayPoolList(
  state: TrayState,
): Array<{ sides: DieSides; count: number }> {
  return [...state.pools.entries()]
    .filter(([, count]) => count > 0)
    .map(([sides, count]) => ({ sides, count }))
}

export function trayToRequest(state: TrayState): RollRequest {
  return {
    pools: trayPoolList(state),
    modifier: trayModifier(state),
    advantage: state.advantage,
    exploding: state.exploding,
  }
}

export function isTrayEmpty(state: TrayState): boolean {
  const m = state.modifiers
  const noModifiers = m.plusOne + m.minusOne + m.plusFive + m.minusFive === 0
  return (
    trayPoolList(state).length === 0 &&
    noModifiers &&
    state.advantage === undefined &&
    !state.exploding
  )
}
