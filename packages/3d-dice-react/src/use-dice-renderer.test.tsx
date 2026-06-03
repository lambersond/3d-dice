import { act, renderHook } from '@testing-library/react'
import { useDiceRenderer } from './use-dice-renderer'

// Stand in for the core DiceRenderer so the hook can be tested without WebGL.
// It only needs to record its config and expose subscribe/ensure/notify.
jest.mock('@lambersond/3d-dice-core', () => {
  class FakeRenderer {
    config: unknown
    subscribers = new Set<() => void>()
    ensure = jest.fn()
    subscribe = jest.fn((cb: () => void) => {
      this.subscribers.add(cb)
      return () => {
        this.subscribers.delete(cb)
      }
    })
    constructor(config?: unknown) {
      this.config = config
    }
    emit() {
      for (const cb of this.subscribers) cb()
    }
  }
  return { DiceRenderer: FakeRenderer }
})

type FakeRenderer = {
  config: unknown
  subscribers: Set<() => void>
  ensure: jest.Mock
  subscribe: jest.Mock
  emit: () => void
}

const asFake = (renderer: unknown) => renderer as FakeRenderer

describe('useDiceRenderer', () => {
  // The first consumer to mount builds the shared renderer; this test runs
  // first, so it owns that construction and its config.
  it('builds the renderer with the first config and drives it on mount', () => {
    const { result, unmount } = renderHook(() =>
      useDiceRenderer({ assetPath: '/assets/' }),
    )
    const renderer = asFake(result.current)
    expect(renderer.config).toEqual({ assetPath: '/assets/' })
    expect(renderer.ensure).toHaveBeenCalledTimes(1)
    expect(renderer.subscribe).toHaveBeenCalledTimes(1)

    unmount()
    expect(renderer.subscribers.size).toBe(0)
  })

  it('returns the same shared instance for every consumer', () => {
    const first = renderHook(() => useDiceRenderer())
    const second = renderHook(() => useDiceRenderer({ assetPath: '/ignored/' }))
    expect(second.result.current).toBe(first.result.current)
  })

  it('re-renders the consumer when the renderer notifies', () => {
    let renders = 0
    const { result } = renderHook(() => {
      renders += 1
      return useDiceRenderer()
    })
    const before = renders
    act(() => asFake(result.current).emit())
    expect(renders).toBeGreaterThan(before)
  })
})
