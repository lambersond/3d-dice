'use client'

import { useDicePreferences, useDiceTheme } from '@lambersond/3d-dice-react'

export function useDiceThemeSync() {
  const { theme } = useDicePreferences()
  useDiceTheme(theme)
}
