'use client'

import { useEffect, useRef } from 'react'
import { useDiceRenderer } from './dice-renderer-provider'
import type { DieEvent, DieRoll } from '@lambersond/3d-dice-core'

export type DieEventHandlers = {
  onHover?: (die: DieEvent | null) => void
  onClick?: (die: DieEvent) => void
  /** Fires whenever dice settle from a reroll or drag-flick, with new values. */
  onReroll?: (rolls: DieRoll[]) => void
}

/**
 * Subscribe to hover/click/reroll on visible dice. Requires the renderer to be
 * created with `enableDiceSelection` / `enableDiceDrag` (pass to the first
 * `useDiceRenderer` call, since that instance is shared). Handlers may be inline
 * closures: the latest is always invoked and changing their identity does not
 * re-subscribe.
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
    const unsubscribeReroll = renderer.onDieReroll(rolls =>
      handlersRef.current.onReroll?.(rolls),
    )
    return () => {
      unsubscribeHover()
      unsubscribeClick()
      unsubscribeReroll()
    }
  }, [renderer])
}
