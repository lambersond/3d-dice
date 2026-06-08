'use client'

import { useState } from 'react'
import { useDiceRenderer, useDieEvents } from '@lambersond/3d-dice-react'
import type { DieEvent } from '@lambersond/3d-dice-core'

// Match the dwell used for the original throw so a rerolled die lingers just as
// long before it leaves the table.
const REROLL_REMOVAL = { style: 'shrink' as const, dwellMs: 3000 }

/**
 * Floating layer for the 3D dice: shows a result popover while hovering a
 * settled die and rerolls it on click. Renders nothing until a die is hovered.
 * `onReroll` is called with the die's stable id and new value once the reroll
 * settles, so the logged result can adopt it.
 */
export function DiceInteractionLayer({
  onReroll,
}: Readonly<{ onReroll?: (dieId: number, value: number) => void }>) {
  const renderer = useDiceRenderer()
  const [hovered, setHovered] = useState<DieEvent | undefined>()

  useDieEvents({
    onHover: die => setHovered(die ?? undefined),
    onClick: die => {
      renderer
        .reroll([die.id], { removal: REROLL_REMOVAL })
        .then(results => {
          const next = results[0]?.value
          if (next !== undefined) onReroll?.(die.dieId, next)
        })
        .catch(() => {})
      setHovered(undefined)
    },
  })

  if (!hovered) return <></>

  return (
    <div
      role='status'
      aria-live='polite'
      className='pointer-events-none fixed z-[100001] -translate-x-1/2 -translate-y-[calc(100%+12px)]'
      style={{ left: hovered.screenPosition.x, top: hovered.screenPosition.y }}
    >
      <div className='flex flex-col items-center gap-0.5 rounded-lg border border-border-dark bg-paper px-3 py-2 shadow-lg'>
        <div className='flex items-baseline gap-2'>
          <span className='font-mono text-[10px] uppercase text-text-secondary'>
            d{hovered.sides}
          </span>
          <span className='font-mono text-xl font-bold tabular-nums text-text-primary'>
            {hovered.value}
          </span>
        </div>
        <span className='text-[10px] text-text-tertiary'>Click to reroll</span>
      </div>
    </div>
  )
}
