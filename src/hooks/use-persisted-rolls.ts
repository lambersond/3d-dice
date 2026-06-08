'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { applyRerollToResult } from '@lambersond/3d-dice-core'
import type { RollEntry } from '@/types/roll'

const DEFAULT_MAX = 200

// Whether a logged roll contains the physical die with this stable id (only
// non-exploding physical rolls carry the `slots` breakdown that records it).
function rollOwnsDie(entry: RollEntry, dieId: number): boolean {
  for (const pool of entry.pools) {
    for (const slot of pool.slots ?? []) {
      if (slot.parts.some(part => part.dieId === dieId)) return true
    }
  }
  return false
}

const isRollEntry = (value: unknown): value is RollEntry => {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<RollEntry>
  return (
    typeof v.id === 'string' &&
    typeof v.at === 'number' &&
    typeof v.total === 'number' &&
    Array.isArray(v.pools) &&
    typeof v.modifier === 'number' &&
    !!v.roller &&
    typeof v.roller.id === 'string'
  )
}

export function usePersistedRolls(
  storageKey: string,
  max: number = DEFAULT_MAX,
) {
  const [rolls, setRolls] = useState<RollEntry[]>([])
  const loadedRef = useRef(false)

  // Load once per key
  useEffect(() => {
    loadedRef.current = false
    try {
      const raw = globalThis.localStorage?.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as unknown
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(isRollEntry)
          setRolls(valid.slice(-max))
        } else {
          setRolls([])
        }
      } else {
        setRolls([])
      }
    } catch {
      setRolls([])
    } finally {
      loadedRef.current = true
    }
  }, [storageKey, max])

  useEffect(() => {
    if (!loadedRef.current) return
    try {
      globalThis.localStorage?.setItem(storageKey, JSON.stringify(rolls))
    } catch {
      // quota or private mode — log stays in-memory only
    }
  }, [storageKey, rolls])

  const append = useCallback(
    (result: RollEntry) => {
      setRolls(prev => {
        if (prev.some(r => r.id === result.id)) return prev
        const next = [...prev, result]
        return next.length > max ? next.slice(-max) : next
      })
    },
    [max],
  )

  const clear = useCallback(() => {
    setRolls([])
  }, [])

  // Adopt a rerolled die's new value into whichever logged roll owns it
  // (matched by the die's stable id), recomputing that roll's kept and total.
  const applyReroll = useCallback((dieId: number, value: number) => {
    setRolls(prev =>
      prev.map(entry =>
        rollOwnsDie(entry, dieId)
          ? applyRerollToResult(entry, [{ dieId, value }])
          : entry,
      ),
    )
  }, [])

  return { rolls, append, clear, applyReroll }
}
