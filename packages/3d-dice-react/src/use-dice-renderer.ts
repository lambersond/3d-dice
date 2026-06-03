import { useEffect, useReducer } from 'react'
import { DiceRenderer, type DiceRendererConfig } from '@lambersond/3d-dice-core'

let shared: DiceRenderer | undefined

export function useDiceRenderer(config?: DiceRendererConfig): DiceRenderer {
  shared ??= new DiceRenderer(config)
  const renderer = shared

  const [, forceRender] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    const unsubscribe = renderer.subscribe(forceRender)
    renderer.ensure()
    return unsubscribe
  }, [renderer])

  return renderer
}
