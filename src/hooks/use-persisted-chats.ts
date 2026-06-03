'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '@/types/chat'

const DEFAULT_MAX = 200

const isChatMessage = (value: unknown): value is ChatMessage => {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<ChatMessage>
  return (
    typeof v.id === 'string' &&
    typeof v.at === 'number' &&
    typeof v.text === 'string' &&
    !!v.sender &&
    typeof v.sender.id === 'string'
  )
}

export function usePersistedChats(
  storageKey: string,
  max: number = DEFAULT_MAX,
) {
  const [chats, setChats] = useState<ChatMessage[]>([])
  const loadedRef = useRef(false)

  useEffect(() => {
    loadedRef.current = false
    try {
      const raw = globalThis.localStorage?.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as unknown
        if (Array.isArray(parsed)) {
          setChats(parsed.filter(isChatMessage).slice(-max))
        } else {
          setChats([])
        }
      } else {
        setChats([])
      }
    } catch {
      setChats([])
    } finally {
      loadedRef.current = true
    }
  }, [storageKey, max])

  useEffect(() => {
    if (!loadedRef.current) return
    try {
      globalThis.localStorage?.setItem(storageKey, JSON.stringify(chats))
    } catch {
      // quota or private mode — chat stays in-memory only
    }
  }, [storageKey, chats])

  const append = useCallback(
    (message: ChatMessage) => {
      setChats(prev => {
        if (prev.some(c => c.id === message.id)) return prev
        const next = [...prev, message]
        return next.length > max ? next.slice(-max) : next
      })
    },
    [max],
  )

  return { chats, append }
}
