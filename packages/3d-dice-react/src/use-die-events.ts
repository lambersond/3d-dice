'use client'

import { useEffect, useRef } from 'react'
import { useDiceRenderer } from './use-dice-renderer'
import type { DieEvent } from '@lambersond/3d-dice-core'

export type DieEventHandlers = {
  onHover?: (die: DieEvent | null) => void
  onClick?: (die: DieEvent) => void
}

/**
 * Subscribe to hover/click on visible dice. Requires the renderer to be created
 * with `enableDiceSelection: true` (pass it to the first `useDiceRenderer` call,
 * since that instance is shared). Handlers may be inline closures: the latest is
 * always invoked and changing their identity does not re-subscribe.
 */
export function useDieEvents(handlers: DieEventHandlers): void {
  const renderer = useDiceRenderer()
  const handlersRef = useRef(handlers)

  useEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    const unsubscribeHover = renderer.onDieHover(die =>
      handlersRef.current.onHover?.(die),
    )
    const unsubscribeClick = renderer.onDieClick(die =>
      handlersRef.current.onClick?.(die),
    )
    return () => {
      unsubscribeHover()
      unsubscribeClick()
    }
  }, [renderer])
}
