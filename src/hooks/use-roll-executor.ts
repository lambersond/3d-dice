'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  executeNonDetRoll,
  executeRoll,
  themeToBoxConfig,
  toDiceBoxNotation,
  type PhysicalThrow,
  type RemovalOptions,
  type RollRequest,
} from '@lambersond/3d-dice-core'
import { useDicePreferences, useDiceRenderer } from '@lambersond/3d-dice-react'
import { withTimeout } from '@/utils/with-timeout'
import type { RollEntry, RollerInfo } from '@/types/roll'

const FRESH_ROLL_WINDOW_MS = 30_000
const ANIMATION_TIMEOUT_MS = 30_000
const DICE_REMOVAL: RemovalOptions = { style: 'shrink', dwellMs: 1000 }

type Options = {
  userId: string
  name?: string
  image?: string
  onLocalResult: (result: RollEntry) => void
  onSettled?: (result: RollEntry) => void
  deterministic?: boolean
}

export function useRollExecutor({
  userId,
  name,
  image,
  onLocalResult,
  onSettled,
  deterministic = true,
}: Options) {
  const { theme } = useDicePreferences()
  const renderer = useDiceRenderer()
  const [pendingRolls, setPendingRolls] = useState(0)
  const busy = pendingRolls > 0

  const roller = useMemo<RollerInfo>(
    () => ({ id: userId, name, image }),
    [userId, name, image],
  )

  const themeRef = useRef(theme)
  useEffect(() => {
    themeRef.current = theme
  }, [theme])

  const playRoll = useCallback(
    async (result: RollEntry) => {
      if (!renderer.isReady) return
      await withTimeout(
        renderer.roll(toDiceBoxNotation(result), {
          theme: result.theme ? themeToBoxConfig(result.theme) : undefined,
          removal: DICE_REMOVAL,
        }),
        ANIMATION_TIMEOUT_MS,
        'dice animation',
      )
    },
    [renderer],
  )

  const throwDice = useCallback<PhysicalThrow>(
    notation =>
      withTimeout(
        renderer.roll(notation, {
          theme: themeRef.current
            ? themeToBoxConfig(themeRef.current)
            : undefined,
          removal: DICE_REMOVAL,
        }),
        ANIMATION_TIMEOUT_MS,
        'dice animation',
      ),
    [renderer],
  )

  const requestRoll = useCallback(
    async (request: RollRequest) => {
      setPendingRolls(n => n + 1)

      try {
        if (deterministic) {
          const result: RollEntry = {
            ...executeRoll(request),
            roller,
            theme: themeRef.current,
          }
          onLocalResult(result)
          await playRoll(result)
          onSettled?.(result)
        } else if (renderer.isReady) {
          const base = await executeNonDetRoll(request, throwDice)
          const result: RollEntry = { ...base, roller, theme: themeRef.current }
          onLocalResult(result)
          onSettled?.(result)
        }
      } catch (error_) {
        console.error('Dice roll failed', error_)
      } finally {
        setPendingRolls(n => n - 1)
      }
    },
    [
      deterministic,
      onLocalResult,
      onSettled,
      playRoll,
      renderer,
      roller,
      throwDice,
    ],
  )

  const playRemote = useCallback(
    async (result: RollEntry) => {
      if (Date.now() - result.at > FRESH_ROLL_WINDOW_MS) return
      await playRoll(result).catch(error_ => {
        console.error('Remote dice animation failed', error_)
      })
    },
    [playRoll],
  )

  return { requestRoll, playRemote, busy }
}
