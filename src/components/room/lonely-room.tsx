'use client'

import { useCallback, useMemo } from 'react'
import {
  DicePreferencesProvider,
  localStoragePreferences,
} from '@lambersond/3d-dice-react'
import Image from 'next/image'
import { DiceInteractionLayer } from './dice-interaction-layer'
import { RoomView } from './room-view'
import { DicePreferencesButton } from '@/components/dice-preferences'
import { usePersistedChats } from '@/hooks/use-persisted-chats'
import { usePersistedRolls } from '@/hooks/use-persisted-rolls'
import { useRollExecutor } from '@/hooks/use-roll-executor'
import { useUserProfile } from '@/hooks/use-user-profile'
import type { ChatMessage } from '@/types/chat'

export function LonelyRoom({ userId }: Readonly<{ userId: string }>) {
  const storage = useMemo(
    () => localStoragePreferences('dice-log:dice-preferences'),
    [],
  )
  return (
    <DicePreferencesProvider storage={storage}>
      <LonelyRoomInner userId={userId} />
    </DicePreferencesProvider>
  )
}

function LonelyRoomInner({ userId }: Readonly<{ userId: string }>) {
  const { profile } = useUserProfile()
  const {
    rolls,
    append: appendRoll,
    applyReroll,
  } = usePersistedRolls('dice-log:rolls:lonely')
  const { chats, append: appendChat } = usePersistedChats('3d-dice:solo')
  const { requestRoll, busy } = useRollExecutor({
    userId,
    onLocalResult: appendRoll,
    deterministic: false,
  })

  const handleSendMessage = useCallback(
    (text: string) => {
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        at: Date.now(),
        sender: { id: userId, name: profile?.name, image: profile?.image },
        text,
      }
      appendChat(message)
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
        disabled={busy}
        header={<LonelyHeader />}
      />
      <DiceInteractionLayer onReroll={applyReroll} />
    </>
  )
}

function LonelyHeader() {
  return (
    <header className='flex items-center justify-between gap-2 border-b border-border-light bg-appbar p-3'>
      <div className='flex flex-1 items-center'>
        <Image
          src='/logo.png'
          alt='Dice Log home'
          width={36}
          height={34}
          priority
        />
      </div>
      <div className='flex flex-1 items-center justify-end'>
        <DicePreferencesButton />
      </div>
    </header>
  )
}
