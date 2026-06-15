'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { themeToBoxConfig, type DieRoll } from '@lambersond/3d-dice-core'
import {
  useDicePreferences,
  useDiceRenderer,
  useDieEvents,
} from '@lambersond/3d-dice-react'
import { ExampleHeader, diceEntry } from './example-room'
import { DiceInteractionLayer } from '@/components/room/dice-interaction-layer'
import { RoomView } from '@/components/room/room-view'
import { usePersistedRolls } from '@/hooks/use-persisted-rolls'
import { useUserProfile } from '@/hooks/use-user-profile'
import type { ExampleConfig } from './examples-config'
import type { RollerInfo } from '@/types/roll'

// A palette of every die type rests along the bottom, each showing its max
// face. You grab one to roll it; placed (resting) dice carry reason 'placed' so
// they can be told apart from a roll.
const PALETTE: ReadonlyArray<{ type: string; value: number }> = [
  { type: 'd4', value: 4 },
  { type: 'd6', value: 6 },
  { type: 'd8', value: 8 },
  { type: 'd10', value: 10 },
  { type: 'd12', value: 12 },
  { type: 'd20', value: 20 },
]
const PALETTE_Y = -0.85

/**
 * Tray-less example: a palette of d4–d20 sits along the bottom center, each
 * showing its max value. Grab one (right-click while holding to add more of that
 * die in a ring) and flick/drop — once the table settles the roll is recorded as
 * one combined entry, the table is cleared, and the palette is restored.
 */
export function SeedFlickRoom({
  userId,
  example,
}: Readonly<{ userId: string; example: ExampleConfig }>) {
  const { profile } = useUserProfile()
  const { rolls, append } = usePersistedRolls(`dice-log:rolls:${example.slug}`)
  const { theme } = useDicePreferences()
  const renderer = useDiceRenderer()
  const ready = renderer.isReady

  const roller = useMemo<RollerInfo>(
    () => ({ id: userId, name: profile?.name, image: profile?.image }),
    [userId, profile?.name, profile?.image],
  )

  const placed = useRef(false)

  // Lay the full die palette along the bottom, evenly spread and centered.
  const placePalette = useCallback(() => {
    const last = PALETTE.length - 1
    for (const [i, die] of PALETTE.entries()) {
      const x = -0.6 + (i * 1.2) / last
      renderer.placeDie({
        type: die.type,
        value: die.value,
        x,
        y: PALETTE_Y,
        grabbable: true,
      })
    }
  }, [renderer])

  // Place the palette once the renderer is ready — but only after applying the
  // current theme, so the placed dice are created with the selected colorset
  // rather than the box's default (which the async theme load would otherwise
  // miss for these already-created dice).
  useEffect(() => {
    if (!ready || placed.current) return
    placed.current = true
    renderer
      .updateConfig(themeToBoxConfig(theme))
      .then(placePalette, placePalette)
  }, [ready, theme, renderer, placePalette])

  // A drop settled: record only the dice that actually rolled (the grabbed die
  // and any added ring) — resting palette dice keep reason 'placed' — then clear
  // and restore the palette.
  const handleSettled = useCallback(
    (dice: DieRoll[]) => {
      const rolled = dice.filter(die => die.reason !== 'placed')
      if (rolled.length === 0) return
      const entry = diceEntry(rolled, roller)
      if (entry) append(entry)
      renderer.clear()
      placePalette()
    },
    [append, renderer, roller, placePalette],
  )

  useDieEvents({ onSettled: handleSettled })

  return (
    <>
      <RoomView
        userId={userId}
        rolls={rolls}
        chats={[]}
        showTray={false}
        header={
          <ExampleHeader
            title={example.label}
            description={example.description}
            clearable={false}
          />
        }
      />
      <DiceInteractionLayer flickable />
    </>
  )
}
