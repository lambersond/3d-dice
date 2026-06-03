/* eslint-disable camelcase -- dice-box-threejs config keys are snake_case */
import { CUSTOM_COLORSET_KEY } from './constants'
import type { RollTheme } from './types'

/**
 * Translates a high-level `RollTheme` into the snake_case payload that
 * `@lambersond/3d-dice-engine` expects from `updateConfig` — the single place
 * that knows the engine's theme keys.
 *
 * A custom-color theme (`colorset === CUSTOM_COLORSET_KEY` with a `customColor`)
 * is sent as a one-off `theme_customColorset`; any other colorset is passed
 * through as a preset key via `theme_colorset`.
 */
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
