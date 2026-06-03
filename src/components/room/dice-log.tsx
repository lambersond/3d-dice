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
    const merged: LogItem[] = [
      ...rolls.map<LogItem>(r => ({ kind: 'roll', data: r })),
      ...chats.map<LogItem>(c => ({ kind: 'chat', data: c })),
    ]
    merged.sort((a, b) => a.data.at - b.data.at)
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
