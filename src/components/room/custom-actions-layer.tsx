'use client'

import { useCallback, useRef, useState } from 'react'
import { useDiceRenderer, useDieEvents } from '@lambersond/3d-dice-react'
import type {
  DieEvent,
  DieRoll,
  RemovalOptions,
} from '@lambersond/3d-dice-core'

const CLOSE_DELAY_MS = 250
// Where set-aside dice are parked: a row near the top, wrapping downward. Kept
// clear of the left edge so the parked dice are plainly visible.
const PARK_COLS = 5
const PARK_STEP = 0.22
const PARK_X0 = -0.45
const PARK_Y0 = 0.8

/**
 * Example of a custom hover UI: hovering a settled die opens an interactive
 * popover with Reroll and Set aside actions wired to the engine. The popover
 * sits above the die and is kept open while the pointer is over it (hover
 * intent), so its buttons are clickable. Reroll results flow out via `onReroll`.
 */
export function CustomActionsLayer({
  onReroll,
  removal,
}: Readonly<{
  onReroll?: (rolls: DieRoll[]) => void
  removal: RemovalOptions
}>) {
  const renderer = useDiceRenderer()
  const [hovered, setHovered] = useState<DieEvent | undefined>()
  const overPopover = useRef(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const setAsideCount = useRef(0)

  const clearCloseTimer = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = undefined
  }

  useDieEvents({
    onHover: die => {
      // Parked (set-aside) dice carry reason 'placed'; don't re-open the popover
      // on them, so they stay put.
      if (die && die.reason !== 'placed') {
        clearCloseTimer()
        setHovered(die)
      } else if (!overPopover.current) {
        // Give the pointer a moment to travel from the die onto the popover.
        clearCloseTimer()
        closeTimer.current = setTimeout(() => {
          if (!overPopover.current) setHovered(undefined)
        }, CLOSE_DELAY_MS)
      }
    },
    onReroll: rolls => onReroll?.(rolls),
  })

  const close = useCallback(() => {
    clearCloseTimer()
    overPopover.current = false
    setHovered(undefined)
  }, [])

  const reroll = useCallback(() => {
    if (hovered) renderer.reroll([hovered.id], { removal }).catch(() => {})
    close()
  }, [hovered, renderer, removal, close])

  // Park the die: take the original off the table (immediate feedback) and drop a
  // persistent copy at the next set-aside slot (a row near the top, wrapping down).
  const setAside = useCallback(() => {
    const die = hovered
    close()
    if (!die) return
    renderer.remove([die.id]).catch(() => {})
    const i = setAsideCount.current++
    const placed = renderer.placeDie({
      type: die.type,
      value: die.value,
      x: PARK_X0 + (i % PARK_COLS) * PARK_STEP,
      y: PARK_Y0 - Math.floor(i / PARK_COLS) * PARK_STEP,
      orientation: 0,
    })
    if (!placed) {
      setAsideCount.current--
      console.warn('[custom-actions] set aside: placeDie placed nothing')
    }
  }, [hovered, renderer, close])

  if (!hovered) return <></>

  return (
    <div
      // pb-3 extends the hover area down to the die so there's no dead zone to
      // cross between the die and the buttons (which would flicker it closed).
      className='fixed z-[100001] -translate-x-1/2 -translate-y-full pb-3'
      style={{ left: hovered.screenPosition.x, top: hovered.screenPosition.y }}
      onMouseEnter={() => {
        overPopover.current = true
        clearCloseTimer()
      }}
      onMouseLeave={close}
    >
      <div className='flex w-32 flex-col gap-1 rounded-lg border border-border-dark bg-paper p-2 shadow-lg'>
        <div className='pb-1 text-center'>
          <span className='font-mono text-[10px] uppercase text-text-secondary'>
            d{hovered.sides}
          </span>{' '}
          <span className='font-mono text-base font-bold tabular-nums text-text-primary'>
            {hovered.value}
          </span>
        </div>
        <button
          type='button'
          onPointerDown={e => {
            if (e.button !== 0) return
            e.preventDefault()
            reroll()
          }}
          className='cursor-pointer rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary/90'
        >
          Reroll
        </button>
        <button
          type='button'
          onPointerDown={e => {
            if (e.button !== 0) return
            e.preventDefault()
            setAside()
          }}
          className='cursor-pointer rounded-md border border-border-light px-3 py-1.5 text-sm text-text-primary hover:bg-hover'
        >
          Set aside
        </button>
      </div>
    </div>
  )
}
