'use client'

import { useEffect, useState } from 'react'

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const TICK_MS = 30_000

function formatRelative(at: number, now: number): string {
  const seconds = Math.floor(Math.max(now - at, 0) / 1000)
  if (seconds < MINUTE) return 'just now'
  if (seconds < HOUR) return `${Math.floor(seconds / MINUTE)}m ago`
  if (seconds < DAY) return `${Math.floor(seconds / HOUR)}h ago`
  return `${Math.floor(seconds / DAY)}d ago`
}

const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | undefined

function subscribe(onTick: () => void) {
  listeners.add(onTick)
  timer ??= setInterval(() => {
    for (const listener of listeners) listener()
  }, TICK_MS)

  return () => {
    listeners.delete(onTick)
    if (listeners.size === 0 && timer) {
      clearInterval(timer)
      timer = undefined
    }
  }
}

export function useRelativeTime(at: number): string {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => subscribe(() => setNow(Date.now())), [])
  return formatRelative(at, now)
}
