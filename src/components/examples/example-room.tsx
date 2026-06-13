'use client'

import { useCallback, useMemo } from 'react'
import {
  combineD100,
  type DieEvent,
  type DiePool,
  type DieRoll,
  type DieSides,
} from '@lambersond/3d-dice-core'
import { useDiceRenderer } from '@lambersond/3d-dice-react'
import { Eraser } from 'lucide-react'
import { DicePreferencesButton } from '@/components/dice-preferences'
import { CustomActionsLayer } from '@/components/room/custom-actions-layer'
import { DiceInteractionLayer } from '@/components/room/dice-interaction-layer'
import { RoomView } from '@/components/room/room-view'
import { useFlickableRollLog } from '@/hooks/use-flickable-roll-log'
import { usePersistedChats } from '@/hooks/use-persisted-chats'
import { useRollExecutor } from '@/hooks/use-roll-executor'
import { useUserProfile } from '@/hooks/use-user-profile'
import type { ExampleConfig } from './examples-config'
import type { RollEntry, RollerInfo } from '@/types/roll'

// Build one log entry from a settle/reroll snapshot, grouping the dice by sides.
export function diceEntry(
  rolls: DieRoll[],
  roller: RollerInfo,
): RollEntry | undefined {
  if (rolls.length === 0) return undefined
  const bySides = new Map<number, DieRoll[]>()
  for (const roll of rolls) {
    const list = bySides.get(roll.sides) ?? []
    list.push(roll)
    bySides.set(roll.sides, list)
  }
  const pools: DiePool[] = [...bySides.entries()].map(([sides, list]) => ({
    sides: sides as DieSides,
    count: list.length,
    rolls: list.map(roll => [roll.value]),
    kept: list.map(roll => roll.value),
  }))
  return {
    id: crypto.randomUUID(),
    at: Date.now(),
    pools,
    modifier: 0,
    total: rolls.reduce((sum, roll) => sum + roll.value, 0),
    roller,
  }
}

// A single die grabbed mid-flight, logged the moment it's grabbed (its face).
function grabbedEntry(die: DieEvent, roller: RollerInfo): RollEntry {
  return {
    id: crypto.randomUUID(),
    at: Date.now(),
    pools: [
      {
        sides: die.sides as DieSides,
        count: 1,
        rolls: [[die.value]],
        kept: [die.value],
      },
    ],
    modifier: 0,
    total: die.value,
    roller,
    grabbed: true,
  }
}

function plainPool(die: DieRoll): DiePool {
  return {
    sides: die.sides as DieSides,
    count: 1,
    rolls: [[die.value]],
    kept: [die.value],
    slots: [{ kind: 'plain', parts: [{ dieId: die.dieId, value: die.value }] }],
  }
}

function percentilePool(tens: DieRoll, ones: DieRoll): DiePool {
  const value = combineD100(tens.value, ones.value)
  return {
    sides: 100,
    count: 1,
    rolls: [[value]],
    kept: [value],
    slots: [
      {
        kind: 'd100',
        parts: [
          { dieId: tens.dieId, value: tens.value },
          { dieId: ones.dieId, value: ones.value },
        ],
      },
    ],
  }
}

// A die (or percentile pair) added via grab-to-add, logged as its own entry with
// `slots` so a later flick updates it in place. One right-click adds one unit: a
// single die, or two dice (a percentile pair reported tens-then-ones).
function addedEntry(
  rolls: DieRoll[],
  roller: RollerInfo,
): RollEntry | undefined {
  if (rolls.length === 0) return undefined
  const pool =
    rolls.length === 2
      ? percentilePool(rolls[0], rolls[1])
      : plainPool(rolls[0])
  return {
    id: crypto.randomUUID(),
    at: Date.now(),
    pools: [pool],
    modifier: 0,
    total: pool.kept.reduce((sum, v) => sum + v, 0),
    roller,
  }
}

export function ExampleRoom({
  userId,
  example,
}: Readonly<{ userId: string; example: ExampleConfig }>) {
  const { profile } = useUserProfile()
  const {
    rolls,
    append: appendRoll,
    submitRoll,
    registerGrab,
    registerReroll,
  } = useFlickableRollLog(`dice-log:rolls:${example.slug}`)
  const { chats, append: appendChat } = usePersistedChats(
    `dice-log:chat:${example.slug}`,
  )

  // Flickable pages log one message per roll, but hold a roll whose die is
  // grabbed/flicked until that die re-settles (submitRoll); flicks then update
  // the owning message in place. Non-flickable pages append the throw result.
  const flickable = !!example.renderer.enableDiceDrag

  const { requestRoll, busy } = useRollExecutor({
    userId,
    onLocalResult: flickable ? submitRoll : appendRoll,
    deterministic: example.deterministic,
    removal: example.removal,
    enableFlickOnSettled: example.enableFlickOnSettled,
  })

  const roller = useMemo<RollerInfo>(
    () => ({ id: userId, name: profile?.name, image: profile?.image }),
    [userId, profile?.name, profile?.image],
  )

  // The moment a die is grabbed: post its grabbed badge entry and mark it
  // in-flight so its roll's message waits for the flick to settle.
  const handleGrabbed = useCallback(
    (die: DieEvent) => {
      registerGrab(die.dieId)
      appendRoll(grabbedEntry(die, roller))
    },
    [appendRoll, registerGrab, roller],
  )

  // A flick settled: feed the new face values back so the owning roll posts (or
  // updates) with the flicked value.
  const handleFlickReroll = useCallback(
    (dice: DieRoll[]) => registerReroll(dice),
    [registerReroll],
  )

  // A grab-to-add die settled: log it as its own entry (reroll-trackable).
  const handleAdded = useCallback(
    (dice: DieRoll[]) => {
      const entry = addedEntry(dice, roller)
      if (entry) appendRoll(entry)
    },
    [appendRoll, roller],
  )

  // Custom-actions reroll: log the rerolled die as its own entry.
  const handleCustomReroll = useCallback(
    (dice: DieRoll[]) => {
      const entry = diceEntry(dice, roller)
      if (entry) appendRoll(entry)
    },
    [appendRoll, roller],
  )

  const handleSendMessage = useCallback(
    (text: string) => {
      appendChat({
        id: crypto.randomUUID(),
        at: Date.now(),
        sender: { id: userId, name: profile?.name, image: profile?.image },
        text,
      })
    },
    [userId, profile?.name, profile?.image, appendChat],
  )

  return (
    <>
      <RoomView
        userId={userId}
        rolls={rolls}
        chats={chats}
        onRollRequest={requestRoll}
        onSendMessage={handleSendMessage}
        disabled={flickable ? false : busy}
        header={
          <ExampleHeader
            title={example.label}
            description={example.description}
            clearable={example.persistent}
          />
        }
      />
      {example.interaction === 'popover' && (
        <DiceInteractionLayer
          onGrabbed={flickable ? handleGrabbed : undefined}
          onReroll={flickable ? handleFlickReroll : undefined}
          onAdded={flickable ? handleAdded : undefined}
          flickable={flickable}
        />
      )}
      {example.interaction === 'custom' && (
        <CustomActionsLayer
          onReroll={handleCustomReroll}
          removal={example.removal}
        />
      )}
    </>
  )
}

export function ExampleHeader({
  title,
  description,
  clearable,
}: Readonly<{ title: string; description: string; clearable: boolean }>) {
  return (
    <header className='flex items-center justify-between gap-3 border-b border-border-light bg-appbar p-3'>
      <div className='min-w-0'>
        <h1 className='truncate text-sm font-semibold text-text-primary'>
          {title}
        </h1>
        <p className='truncate text-xs text-text-secondary'>{description}</p>
      </div>
      <div className='flex shrink-0 items-center gap-2'>
        {clearable && <ClearDiceButton />}
        <DicePreferencesButton />
      </div>
    </header>
  )
}

function ClearDiceButton() {
  const renderer = useDiceRenderer()
  return (
    <button
      type='button'
      onClick={() => renderer.clear()}
      aria-label='Clear dice from the table'
      title='Clear dice from the table'
      className='flex cursor-pointer items-center justify-center rounded-md border border-border-light p-2 text-text-secondary hover:bg-hover hover:text-text-primary'
    >
      <Eraser className='size-5' />
    </button>
  )
}
