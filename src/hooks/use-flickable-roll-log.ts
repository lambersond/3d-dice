'use client'

import { useCallback, useRef } from 'react'
import { applyRerollToResult, type DieRoll } from '@lambersond/3d-dice-core'
import { usePersistedRolls } from './use-persisted-rolls'
import type { RollEntry } from '@/types/roll'

// Whether a logged roll owns the physical die with this stable id. Only
// non-exploding physical rolls carry the `slots` breakdown that records it.
function rollOwnsDie(entry: RollEntry, dieId: number): boolean {
  return entry.pools.some(pool =>
    (pool.slots ?? []).some(slot =>
      slot.parts.some(part => part.dieId === dieId),
    ),
  )
}

function ownsAny(entry: RollEntry, dieIds: ReadonlySet<number>): boolean {
  return entry.pools.some(pool =>
    (pool.slots ?? []).some(slot =>
      slot.parts.some(part => dieIds.has(part.dieId)),
    ),
  )
}

function hasSlots(entry: RollEntry): boolean {
  return entry.pools.some(pool => (pool.slots?.length ?? 0) > 0)
}

/**
 * Per-roll logging for flickable examples, with a wait-then-post buffer so a
 * roll whose die gets grabbed/flicked doesn't post until that die re-settles.
 *
 * Wraps {@link usePersistedRolls}: each roll resolves on its own (one message
 * per roll), and a flick updates the owning message by stable `dieId`. A roll
 * that owns a die currently in-flight (grabbed, not yet re-settled) is held back
 * and posts once the flick lands with the final value; an already-posted roll
 * (flick of a resting die) is updated in place instead.
 */
export function useFlickableRollLog(storageKey: string) {
  const { rolls, append, applyReroll } = usePersistedRolls(storageKey)

  // dieIds grabbed and not yet re-settled (mid-flick), and the roll entries held
  // back until the in-flight dice they own come to rest.
  const inFlight = useRef(new Set<number>())
  const held = useRef<RollEntry[]>([])

  // A die was grabbed: it's in-flight until its flick (or tap) settles.
  const registerGrab = useCallback((dieId: number) => {
    inFlight.current.add(dieId)
  }, [])

  // A roll resolved. Hold it if it owns a die that's currently in-flight (so the
  // message waits for the flick); otherwise post now. Entries without `slots`
  // (exploding) can't be tracked by dieId, so they always post immediately.
  const submitRoll = useCallback(
    (entry: RollEntry) => {
      if (hasSlots(entry) && ownsAny(entry, inFlight.current)) {
        held.current.push(entry)
      } else {
        append(entry)
      }
    },
    [append],
  )

  // A flick (or tap) settled with new face values: update any posted entry in
  // place, clear those dice from in-flight, then release held entries whose
  // in-flight dice have all come to rest.
  const registerReroll = useCallback(
    (dieRolls: DieRoll[]) => {
      for (const roll of dieRolls) {
        applyReroll(roll.dieId, roll.value)
        inFlight.current.delete(roll.dieId)
      }
      const stillHeld: RollEntry[] = []
      for (const entry of held.current) {
        let updated = entry
        for (const roll of dieRolls) {
          if (rollOwnsDie(updated, roll.dieId)) {
            updated = applyRerollToResult(updated, [
              { dieId: roll.dieId, value: roll.value },
            ])
          }
        }
        if (ownsAny(updated, inFlight.current)) stillHeld.push(updated)
        else append(updated)
      }
      held.current = stillHeld
    },
    [append, applyReroll],
  )

  return { rolls, append, submitRoll, registerGrab, registerReroll }
}
