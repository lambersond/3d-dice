import type { ModifierKey, TrayAction, TrayState } from './types'

const OPPOSITE: Record<ModifierKey, ModifierKey> = {
  plusOne: 'minusOne',
  minusOne: 'plusOne',
  plusFive: 'minusFive',
  minusFive: 'plusFive',
}

export function createTrayState(): TrayState {
  return {
    pools: new Map(),
    modifiers: { plusOne: 0, minusOne: 0, plusFive: 0, minusFive: 0 },
    advantage: undefined,
    exploding: false,
  }
}

export function trayReducer(state: TrayState, action: TrayAction): TrayState {
  switch (action.type) {
    case 'incrementDie': {
      const pools = new Map(state.pools)
      pools.set(action.sides, (pools.get(action.sides) ?? 0) + 1)
      return { ...state, pools }
    }
    case 'decrementDie': {
      const pools = new Map(state.pools)
      const current = pools.get(action.sides) ?? 0
      if (current <= 1) pools.delete(action.sides)
      else pools.set(action.sides, current - 1)
      return { ...state, pools }
    }
    case 'clearDie': {
      const pools = new Map(state.pools)
      pools.delete(action.sides)
      return { ...state, pools }
    }
    case 'bumpModifier': {
      const opposite = OPPOSITE[action.key]
      const modifiers = { ...state.modifiers }
      if (modifiers[opposite] > 0) modifiers[opposite] -= 1
      else modifiers[action.key] += 1
      return { ...state, modifiers }
    }
    case 'removeOneModifier': {
      const modifiers = { ...state.modifiers }
      modifiers[action.key] = Math.max(modifiers[action.key] - 1, 0)
      return { ...state, modifiers }
    }
    case 'clearModifier': {
      return { ...state, modifiers: { ...state.modifiers, [action.key]: 0 } }
    }
    case 'toggleAdvantage': {
      return {
        ...state,
        advantage: state.advantage === action.value ? undefined : action.value,
      }
    }
    case 'toggleExploding': {
      return { ...state, exploding: !state.exploding }
    }
    case 'clear': {
      return createTrayState()
    }
  }
}
