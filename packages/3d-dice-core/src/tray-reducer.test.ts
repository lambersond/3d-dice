import { createTrayState, trayReducer } from './tray-reducer'
import {
  isTrayEmpty,
  trayModifier,
  trayPoolList,
  trayToRequest,
} from './tray-selectors'
import type { TrayAction, TrayState } from './types'

const run = (...actions: TrayAction[]): TrayState => {
  let state = createTrayState()
  for (const action of actions) state = trayReducer(state, action)
  return state
}

describe('tray-reducer', () => {
  it('starts empty', () => {
    const state = createTrayState()
    expect(isTrayEmpty(state)).toBe(true)
    expect(trayToRequest(state).pools).toEqual([])
  })

  it('accumulates dice and keeps first-added order', () => {
    const state = run(
      { type: 'incrementDie', sides: 20 },
      { type: 'incrementDie', sides: 6 },
      { type: 'incrementDie', sides: 20 },
    )
    expect(trayPoolList(state)).toEqual([
      { sides: 20, count: 2 },
      { sides: 6, count: 1 },
    ])
  })

  it('decrement removes the die type when it hits zero', () => {
    const state = run(
      { type: 'incrementDie', sides: 8 },
      { type: 'decrementDie', sides: 8 },
    )
    expect(trayPoolList(state)).toEqual([])
  })

  it('clearDie drops the whole stack', () => {
    const state = run(
      { type: 'incrementDie', sides: 8 },
      { type: 'incrementDie', sides: 8 },
      { type: 'clearDie', sides: 8 },
    )
    expect(state.pools.get(8)).toBeUndefined()
  })

  it('nets opposing modifiers (a +1 cancels a −1 tap first)', () => {
    const state = run(
      { type: 'bumpModifier', key: 'plusFive' },
      { type: 'bumpModifier', key: 'plusOne' },
      { type: 'bumpModifier', key: 'minusOne' }, // cancels the +1
    )
    expect(state.modifiers.plusOne).toBe(0)
    expect(trayModifier(state)).toBe(5)
  })

  it('removeOneModifier floors at zero; clearModifier zeroes it', () => {
    const removed = run(
      { type: 'bumpModifier', key: 'plusOne' },
      { type: 'removeOneModifier', key: 'plusOne' },
      { type: 'removeOneModifier', key: 'plusOne' },
    )
    expect(removed.modifiers.plusOne).toBe(0)

    const cleared = run(
      { type: 'bumpModifier', key: 'plusFive' },
      { type: 'bumpModifier', key: 'plusFive' },
      { type: 'clearModifier', key: 'plusFive' },
    )
    expect(cleared.modifiers.plusFive).toBe(0)
  })

  it('toggles advantage off when re-selected', () => {
    expect(run({ type: 'toggleAdvantage', value: 'adv' }).advantage).toBe('adv')
    expect(
      run(
        { type: 'toggleAdvantage', value: 'adv' },
        { type: 'toggleAdvantage', value: 'adv' },
      ).advantage,
    ).toBeUndefined()
  })

  it('builds a full roll request', () => {
    const state = run(
      { type: 'incrementDie', sides: 20 },
      { type: 'bumpModifier', key: 'plusFive' },
      { type: 'toggleAdvantage', value: 'adv' },
      { type: 'toggleExploding' },
    )
    expect(trayToRequest(state)).toEqual({
      pools: [{ sides: 20, count: 1 }],
      modifier: 5,
      advantage: 'adv',
      exploding: true,
    })
  })

  it('clear resets everything', () => {
    const state = run(
      { type: 'incrementDie', sides: 20 },
      { type: 'bumpModifier', key: 'plusFive' },
      { type: 'toggleExploding' },
      { type: 'clear' },
    )
    expect(isTrayEmpty(state)).toBe(true)
  })
})
