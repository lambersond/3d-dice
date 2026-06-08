'use client'

import { useState } from 'react'
import { useDieEvents } from '@lambersond/3d-dice-react'
import type { DieEvent, DieRoll } from '@lambersond/3d-dice-core'

/**
 * Floating layer for the 3D dice. Shows a result popover while hovering a
 * settled die; the grab/flick (and tap) gesture itself lives in the engine, so
 * this only forwards each flick's settled values via `onReroll` for logging.
 * Renders nothing until a die is hovered.
 */
export function DiceInteractionLayer({
  onReroll,
  flickable = true,
}: Readonly<{ onReroll?: (rolls: DieRoll[]) => void; flickable?: boolean }>) {
  const [hovered, setHovered] = useState<DieEvent | undefined>()

  useDieEvents({
    onHover: die => setHovered(die ?? undefined),
    onReroll: rolls => onReroll?.(rolls),
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
        {flickable && (
          <span className='text-[10px] text-text-tertiary'>Drag to flick</span>
        )}
      </div>
    </div>
  )
}
