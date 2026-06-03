import {
  isTrayEmpty,
  trayModifier,
  trayPoolList,
  trayToRequest,
} from './tray-selectors'
import type { DieSides, ModifierCounts, TrayState } from './types'

const counts = (over: Partial<ModifierCounts> = {}): ModifierCounts => ({
  plusOne: 0,
  minusOne: 0,
  plusFive: 0,
  minusFive: 0,
  ...over,
})

const state = (over: Partial<TrayState> = {}): TrayState => ({
  pools: new Map<DieSides, number>(),
  modifiers: counts(),
  exploding: false,
  ...over,
})

describe('tray selectors', () => {
  it('weights fives and ones into a net modifier', () => {
    const value = trayModifier(
      state({ modifiers: counts({ plusFive: 1, plusOne: 2, minusOne: 1 }) }),
    )
    expect(value).toBe(5 + 2 - 1)
  })

  it('lists only non-empty pools in insertion order', () => {
    const pools = new Map<DieSides, number>([
      [20, 2],
      [6, 0],
      [8, 1],
    ])
    expect(trayPoolList(state({ pools }))).toEqual([
      { sides: 20, count: 2 },
      { sides: 8, count: 1 },
    ])
  })

  it('assembles a roll request from the tray', () => {
    const pools = new Map<DieSides, number>([[20, 1]])
    expect(
      trayToRequest(
        state({
          pools,
          modifiers: counts({ plusFive: 1 }),
          advantage: 'adv',
          exploding: true,
        }),
      ),
    ).toEqual({
      pools: [{ sides: 20, count: 1 }],
      modifier: 5,
      advantage: 'adv',
      exploding: true,
    })
  })

  it('is empty only with no dice, modifiers, advantage, or exploding', () => {
    expect(isTrayEmpty(state())).toBe(true)
    expect(isTrayEmpty(state({ pools: new Map([[6, 1]]) }))).toBe(false)
    expect(isTrayEmpty(state({ modifiers: counts({ plusOne: 1 }) }))).toBe(
      false,
    )
    expect(isTrayEmpty(state({ advantage: 'adv' }))).toBe(false)
    expect(isTrayEmpty(state({ exploding: true }))).toBe(false)
  })
})
