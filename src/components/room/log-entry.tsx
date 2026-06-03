'use client'

import { useState } from 'react'
import { formatResultExpression, type DiePool } from '@lambersond/3d-dice-core'
import clsx from 'clsx'
import { Avatar } from '@/components/avatar'
import { useRelativeTime } from '@/hooks/use-relative-time'
import type { ChatMessage } from '@/types/chat'
import type { RollEntry } from '@/types/roll'

type Props = {
  roll: RollEntry
  isMine?: boolean
}

export function LogEntry({ roll, isMine = false }: Readonly<Props>) {
  const when = useRelativeTime(roll.at)
  const [showAbsolute, setShowAbsolute] = useState(false)
  const absolute = new Date(roll.at).toLocaleString()
  return (
    <div
      className={clsx(
        'rounded-lg border p-3',
        isMine
          ? 'border-primary/40 bg-primary/5'
          : 'border-border-light bg-paper',
      )}
    >
      <div className='flex items-center gap-2'>
        <Avatar
          name={roll.roller.name}
          image={roll.roller.image}
          seed={roll.roller.id}
          className='size-8'
        />
        <div className='min-w-0 flex-1'>
          <div className='flex items-baseline gap-2'>
            <p className='truncate text-sm font-semibold text-text-primary'>
              {roll.roller.name ?? 'Anonymous'}
            </p>
            <button
              type='button'
              onClick={() => setShowAbsolute(v => !v)}
              title={absolute}
              className='shrink-0 cursor-pointer text-[10px] text-text-tertiary hover:text-text-secondary'
            >
              {showAbsolute ? absolute : when}
            </button>
          </div>
          <p className='truncate font-mono text-xs text-text-secondary'>
            {formatResultExpression(roll)}
          </p>
        </div>
        <div className='font-mono text-2xl font-bold tabular-nums text-text-primary'>
          {roll.total}
        </div>
      </div>
      <div className='mt-2 flex flex-wrap items-center gap-x-3 gap-y-1'>
        {roll.pools.map(pool => (
          <PoolDisplay key={pool.sides} pool={pool} />
        ))}
        {roll.modifier !== 0 && (
          <span className='font-mono text-xs text-text-secondary'>
            {roll.modifier > 0 ? `+${roll.modifier}` : roll.modifier}
          </span>
        )}
      </div>
    </div>
  )
}

type ChatProps = {
  message: ChatMessage
  isMine?: boolean
}

export function ChatEntry({ message, isMine = false }: Readonly<ChatProps>) {
  return (
    <div
      className={clsx(
        'rounded-lg border p-3',
        isMine
          ? 'border-primary/40 bg-primary/5'
          : 'border-border-light bg-paper',
      )}
    >
      <div className='flex items-start gap-2'>
        <Avatar
          name={message.sender.name}
          image={message.sender.image}
          seed={message.sender.id}
          className='size-8'
        />
        <div className='min-w-0 flex-1'>
          <p className='truncate text-sm font-semibold text-text-primary'>
            {message.sender.name ?? 'Anonymous'}
          </p>
          <p className='whitespace-pre-wrap break-words text-sm text-text-primary'>
            {message.text}
          </p>
        </div>
      </div>
    </div>
  )
}

function dieValueClass(
  value: number,
  kept: number,
  hasAdvDis: boolean,
): string {
  if (value !== kept)
    return 'border-border-light text-text-tertiary line-through'
  if (hasAdvDis)
    return 'border-primary bg-primary/10 font-semibold text-primary'
  return 'border-border-dark font-semibold text-text-primary'
}

function PoolDisplay({ pool }: Readonly<{ pool: DiePool }>) {
  // Precompute a stable id per die so the key prop isn't an array-index
  // expression. A roll result is immutable, so id-by-position is stable.
  const dice = pool.rolls.map((dieRolls, i) => ({
    id: `${pool.sides}-${i}`,
    rolls: dieRolls,
    kept: pool.kept[i],
    chain: pool.explosions?.[i] ?? [],
  }))

  return (
    <div className='flex items-center gap-1'>
      <span className='font-mono text-[10px] uppercase text-text-secondary'>
        d{pool.sides}
      </span>
      <div className='flex flex-wrap gap-1'>
        {dice.map(die => (
          <div key={die.id} className='flex items-center gap-px'>
            {die.rolls.map((value, j) => (
              <span
                key={`${die.id}-r${j}`}
                className={clsx(
                  'inline-flex size-6 items-center justify-center rounded border text-xs',
                  dieValueClass(value, die.kept, die.rolls.length > 1),
                )}
              >
                {value}
              </span>
            ))}
            {die.chain.map((value, k) => (
              <span
                key={`${die.id}-x${k}`}
                className='inline-flex items-center text-warning'
              >
                <span className='font-mono text-[10px]'>!</span>
                <span className='inline-flex size-6 items-center justify-center rounded border border-warning bg-warning/10 text-xs font-semibold'>
                  {value}
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
