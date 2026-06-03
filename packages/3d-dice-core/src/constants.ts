import type { DieSides } from './types'

export const DIE_SIDES: readonly DieSides[] = [4, 6, 8, 10, 12, 20, 100]

/**
 * Sentinel `RollTheme.colorset` value meaning "use `customColor`" rather than a
 * built-in preset key. Part of the theme contract: `themeToBoxConfig` and
 * consumers building a theme check for it.
 */
export const CUSTOM_COLORSET_KEY = 'custom'
