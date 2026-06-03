import { useReducer } from 'react'
import {
  createTrayState,
  isTrayEmpty,
  trayModifier,
  trayPoolList,
  trayReducer,
  trayToRequest,
  type Advantage,
  type DieSides,
  type ModifierKey,
  type RollRequest,
  type TrayState,
} from '@lambersond/3d-dice-core'

export type UseTray = {
  pools: TrayState['pools']
  modifiers: TrayState['modifiers']
  advantage: Advantage | undefined
  exploding: boolean
  modifier: number
  poolList: Array<{ sides: DieSides; count: number }>
  isEmpty: boolean
  toRequest: () => RollRequest
  incrementDie: (sides: DieSides) => void
  decrementDie: (sides: DieSides) => void
  clearDie: (sides: DieSides) => void
  bumpModifier: (key: ModifierKey) => void
  removeOneModifier: (key: ModifierKey) => void
  clearModifier: (key: ModifierKey) => void
  toggleAdvantage: (value: Advantage) => void
  toggleExploding: () => void
  clear: () => void
}

export function useTray(): UseTray {
  const [state, dispatch] = useReducer(trayReducer, undefined, createTrayState)

  return {
    pools: state.pools,
    modifiers: state.modifiers,
    advantage: state.advantage,
    exploding: state.exploding,
    modifier: trayModifier(state),
    poolList: trayPoolList(state),
    isEmpty: isTrayEmpty(state),
    toRequest: () => trayToRequest(state),
    incrementDie: sides => dispatch({ type: 'incrementDie', sides }),
    decrementDie: sides => dispatch({ type: 'decrementDie', sides }),
    clearDie: sides => dispatch({ type: 'clearDie', sides }),
    bumpModifier: key => dispatch({ type: 'bumpModifier', key }),
    removeOneModifier: key => dispatch({ type: 'removeOneModifier', key }),
    clearModifier: key => dispatch({ type: 'clearModifier', key }),
    toggleAdvantage: value => dispatch({ type: 'toggleAdvantage', value }),
    toggleExploding: () => dispatch({ type: 'toggleExploding' }),
    clear: () => dispatch({ type: 'clear' }),
  }
}
