'use client'

import { useEffect } from 'react'
import { themeToBoxConfig, type RollTheme } from '@lambersond/3d-dice-core'
import { useDiceRenderer } from './use-dice-renderer'

export function useDiceTheme(theme: RollTheme): void {
  const renderer = useDiceRenderer()
  const ready = renderer.isReady

  useEffect(() => {
    if (!ready) return
    renderer.updateConfig(themeToBoxConfig(theme)).catch(error => {
      console.error('[3d-dice] Failed to apply theme', error)
    })
  }, [renderer, ready, theme.colorset, theme.material, theme.customColor])
}
