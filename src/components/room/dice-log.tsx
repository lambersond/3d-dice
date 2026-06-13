'use client'

import { Fragment, useEffect, useMemo, useRef } from 'react'
import { ChatEntry, LogEntry } from './log-entry'
import type { ChatMessage } from '@/types/chat'
import type { RollEntry } from '@/types/roll'

type Props = {
  rolls: readonly RollEntry[]
  chats: readonly ChatMessage[]
  myRollerId: string
}

type LogItem =
  | { kind: 'roll'; data: RollEntry }
  | { kind: 'chat'; data: ChatMessage }

export function DiceLog({ rolls, chats, myRollerId }: Readonly<Props>) {
  const ref = useRef<HTMLDivElement>(null)

  const items: readonly LogItem[] = useMemo(() => {
    // `rolls` and `chats` each arrive in append order. Merge them into one
    // timeline that keeps that order within each stream — so a flickable roll's
    // grabbed badge stays where it was added rather than being re-sorted to the
    // bottom by its (later) timestamp — and uses `at` only to decide which
    // stream's next entry comes first.
    const merged: LogItem[] = []
    let i = 0
    let j = 0
    while (i < rolls.length && j < chats.length) {
      if (rolls[i].at <= chats[j].at) {
        merged.push({ kind: 'roll', data: rolls[i++] })
      } else {
        merged.push({ kind: 'chat', data: chats[j++] })
      }
    }
    while (i < rolls.length) merged.push({ kind: 'roll', data: rolls[i++] })
    while (j < chats.length) merged.push({ kind: 'chat', data: chats[j++] })
    return merged
  }, [rolls, chats])

  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [items.length])

  return (
    <div
      ref={ref}
      className='flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-2'
    >
      {items.length === 0 ? (
        <p className='mt-8 text-center text-sm text-text-secondary'>
          No rolls yet — pick some dice and tap Roll, or say hi.
        </p>
      ) : (
        items.map(item => (
          <Fragment key={item.data.id}>
            {item.kind === 'roll' ? (
              <LogEntry
                roll={item.data}
                isMine={item.data.roller.id === myRollerId}
              />
            ) : (
              <ChatEntry
                message={item.data}
                isMine={item.data.sender.id === myRollerId}
              />
            )}
          </Fragment>
        ))
      )}
    </div>
  )
}
