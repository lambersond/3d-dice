import { act, renderHook } from '@testing-library/react'
import { useTray } from './use-tray'

describe('useTray', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useTray())
    expect(result.current.isEmpty).toBe(true)
    expect(result.current.modifier).toBe(0)
    expect(result.current.poolList).toEqual([])
    expect(result.current.advantage).toBeUndefined()
    expect(result.current.exploding).toBe(false)
  })

  it('adds dice and exposes them via pools and poolList', () => {
    const { result } = renderHook(() => useTray())
    act(() => {
      result.current.incrementDie(20)
      result.current.incrementDie(20)
      result.current.incrementDie(6)
    })
    expect(result.current.pools.get(20)).toBe(2)
    expect(result.current.poolList).toEqual([
      { sides: 20, count: 2 },
      { sides: 6, count: 1 },
    ])
    expect(result.current.isEmpty).toBe(false)
  })

  it('decrements and clears a die', () => {
    const { result } = renderHook(() => useTray())
    act(() => {
      result.current.incrementDie(8)
      result.current.incrementDie(8)
    })
    act(() => result.current.decrementDie(8))
    expect(result.current.pools.get(8)).toBe(1)
    act(() => result.current.clearDie(8))
    expect(result.current.pools.get(8)).toBeUndefined()
  })

  it('nets static modifiers', () => {
    const { result } = renderHook(() => useTray())
    act(() => {
      result.current.bumpModifier('plusFive')
      result.current.bumpModifier('plusOne')
      result.current.bumpModifier('minusOne')
    })
    expect(result.current.modifier).toBe(5)
  })

  it('toggles advantage and exploding off when reselected', () => {
    const { result } = renderHook(() => useTray())
    act(() => result.current.toggleAdvantage('adv'))
    expect(result.current.advantage).toBe('adv')
    act(() => result.current.toggleAdvantage('adv'))
    expect(result.current.advantage).toBeUndefined()

    act(() => result.current.toggleExploding())
    expect(result.current.exploding).toBe(true)
  })

  it('assembles a roll request from the tray', () => {
    const { result } = renderHook(() => useTray())
    act(() => {
      result.current.incrementDie(20)
      result.current.bumpModifier('plusFive')
      result.current.toggleAdvantage('adv')
      result.current.toggleExploding()
    })
    expect(result.current.toRequest()).toEqual({
      pools: [{ sides: 20, count: 1 }],
      modifier: 5,
      advantage: 'adv',
      exploding: true,
    })
  })

  it('clears everything', () => {
    const { result } = renderHook(() => useTray())
    act(() => {
      result.current.incrementDie(20)
      result.current.bumpModifier('plusFive')
    })
    act(() => result.current.clear())
    expect(result.current.isEmpty).toBe(true)
  })
})
