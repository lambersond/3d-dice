/* eslint-disable camelcase -- dice-box-threejs config keys are snake_case */
import { CUSTOM_COLORSET_KEY } from './constants'
import type { RollTheme } from './types'

export function themeToBoxConfig(theme: RollTheme): Record<string, unknown> {
  if (theme.colorset === CUSTOM_COLORSET_KEY && theme.customColor) {
    return {
      theme_customColorset: {
        name: `custom-${theme.customColor}`,
        foreground: '#ffffff',
        background: theme.customColor,
        outline: theme.customColor,
        texture: 'none',
      },
      theme_material: theme.material,
    }
  }
  return {
    theme_colorset: theme.colorset,
    theme_material: theme.material,
  }
}
