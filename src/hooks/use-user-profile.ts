'use client'

import { useCallback, useEffect, useState } from 'react'

export type UserProfile = {
  name: string
  image?: string
}

const STORAGE_KEY = 'dice-log:profile'

const read = (): UserProfile | undefined => {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as Partial<UserProfile>
    if (typeof parsed.name !== 'string') return undefined
    return {
      name: parsed.name,
      image:
        typeof parsed.image === 'string' && parsed.image.length > 0
          ? parsed.image
          : undefined,
    }
  } catch {
    return undefined
  }
}

export function useUserProfile() {
  const [profile, setProfileState] = useState<UserProfile | undefined>()
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setProfileState(read())
    setIsLoaded(true)
  }, [])

  const setProfile = useCallback((next: UserProfile | undefined) => {
    setProfileState(next)
    try {
      if (next) {
        globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } else {
        globalThis.localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // storage may be unavailable (private mode, quota); state still updates
    }
  }, [])

  return { profile, setProfile, isLoaded }
}
