'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react'
import { DiceRenderer, type DiceRendererConfig } from '@lambersond/3d-dice-core'

// The value carries a `version` that bumps on every renderer notification so
// context consumers re-render (the renderer instance itself stays stable).
type DiceRendererContextValue = {
  renderer: DiceRenderer
  version: number
}

const DiceRendererContext = createContext<DiceRendererContextValue | undefined>(
  undefined,
)

let containerSeq = 0

/**
 * Provide a `DiceRenderer` scoped to this subtree. The instance is created once
 * (from `config`) and disposed on unmount, so different views can run different
 * renderer configs and navigating away tears down the canvas/dice. Each instance
 * gets a unique container id by default so overlapping overlays during a route
 * transition can't collide.
 */
export function DiceRendererProvider({
  config,
  children,
}: Readonly<{ config?: DiceRendererConfig; children: ReactNode }>) {
  const [renderer] = useState(() => {
    containerSeq += 1
    return new DiceRenderer({
      containerId: `dice-canvas-threejs-${containerSeq}`,
      ...config,
    })
  })
  const [version, bump] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    const unsubscribe = renderer.subscribe(bump)
    renderer.ensure()
    return () => {
      unsubscribe()
      renderer.dispose()
    }
  }, [renderer])

  const value = useMemo(() => ({ renderer, version }), [renderer, version])

  return (
    <DiceRendererContext.Provider value={value}>
      {children}
    </DiceRendererContext.Provider>
  )
}

/** Read the renderer from the nearest {@link DiceRendererProvider}. */
export function useDiceRenderer(): DiceRenderer {
  const value = useContext(DiceRendererContext)
  if (!value) {
    throw new Error(
      'useDiceRenderer must be used within a <DiceRendererProvider>',
    )
  }
  return value.renderer
}
