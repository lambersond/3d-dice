import { act, renderHook } from '@testing-library/react'
import { DiceRendererProvider, useDiceRenderer } from './dice-renderer-provider'
import type { ReactNode } from 'react'

// Stand in for the core DiceRenderer so the provider can be tested without
// WebGL. It records its config and exposes subscribe/ensure/dispose/notify.
jest.mock('@lambersond/3d-dice-core', () => {
  class FakeRenderer {
    config: unknown
    subscribers = new Set<() => void>()
    ensure = jest.fn()
    dispose = jest.fn()
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
  config: { containerId?: string; assetPath?: string }
  subscribers: Set<() => void>
  ensure: jest.Mock
  dispose: jest.Mock
  subscribe: jest.Mock
  emit: () => void
}

const asFake = (renderer: unknown) => renderer as unknown as FakeRenderer

function wrapper(config?: { assetPath?: string }) {
  return ({ children }: { children: ReactNode }) => (
    <DiceRendererProvider config={config}>{children}</DiceRendererProvider>
  )
}

describe('DiceRendererProvider / useDiceRenderer', () => {
  it('builds the renderer with the config (plus a container id) and drives it', () => {
    const { result, unmount } = renderHook(() => useDiceRenderer(), {
      wrapper: wrapper({ assetPath: '/assets/' }),
    })
    const renderer = asFake(result.current)
    expect(renderer.config.assetPath).toBe('/assets/')
    expect(renderer.config.containerId).toMatch(/^dice-canvas-threejs-/)
    expect(renderer.ensure).toHaveBeenCalledTimes(1)
    expect(renderer.subscribe).toHaveBeenCalledTimes(1)

    unmount()
    expect(renderer.dispose).toHaveBeenCalledTimes(1)
    expect(renderer.subscribers.size).toBe(0)
  })

  it('throws when used without a provider', () => {
    expect(() => renderHook(() => useDiceRenderer())).toThrow(
      /DiceRendererProvider/,
    )
  })

  it('re-renders consumers when the renderer notifies', () => {
    let renders = 0
    const { result } = renderHook(
      () => {
        renders += 1
        return useDiceRenderer()
      },
      { wrapper: wrapper() },
    )
    const before = renders
    act(() => asFake(result.current).emit())
    expect(renders).toBeGreaterThan(before)
  })
})
