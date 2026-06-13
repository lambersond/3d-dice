'use client'

import { type ReactNode } from 'react'
import { DiceLog } from './dice-log'
import { DiceTray } from './dice-tray'
import { useDiceThemeSync } from '@/hooks/use-dice-theme-sync'
import type { ChatMessage } from '@/types/chat'
import type { RollEntry } from '@/types/roll'
import type { RollRequest } from '@lambersond/3d-dice-core'

type Props = {
  userId: string
  rolls: readonly RollEntry[]
  chats: readonly ChatMessage[]
  onRollRequest?: (request: RollRequest) => void
  onSendMessage?: (text: string) => void
  disabled?: boolean
  syncing?: boolean
  newSinceAt?: number
  header: ReactNode
  /** Render the dice-builder tray below the log (default true). */
  showTray?: boolean
}

export function RoomView({
  userId,
  rolls,
  chats,
  onRollRequest,
  disabled = false,
  header,
  showTray = true,
}: Readonly<Props>) {
  useDiceThemeSync()

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      {header}
      <DiceLog rolls={rolls} chats={chats} myRollerId={userId} />
      {showTray && (
        <DiceTray onRoll={onRollRequest ?? (() => {})} disabled={disabled} />
      )}
    </div>
  )
}
