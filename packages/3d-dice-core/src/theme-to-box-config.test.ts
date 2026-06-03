/* eslint-disable camelcase -- dice-box-threejs config keys are snake_case */
import { CUSTOM_COLORSET_KEY } from './constants'
import { themeToBoxConfig } from './theme-to-box-config'
import type { RollTheme } from './types'

describe('themeToBoxConfig', () => {
  it('passes a preset colorset through as theme_colorset', () => {
    const theme: RollTheme = { colorset: 'white', material: 'glass' }
    expect(themeToBoxConfig(theme)).toEqual({
      theme_colorset: 'white',
      theme_material: 'glass',
    })
  })

  it('builds a one-off customColorset for the custom sentinel', () => {
    const theme: RollTheme = {
      colorset: CUSTOM_COLORSET_KEY,
      material: 'plastic',
      customColor: '#3e79ff',
    }
    expect(themeToBoxConfig(theme)).toEqual({
      theme_customColorset: {
        name: 'custom-#3e79ff',
        foreground: '#ffffff',
        background: '#3e79ff',
        outline: '#3e79ff',
        texture: 'none',
      },
      theme_material: 'plastic',
    })
  })

  it('falls back to a preset when custom is selected without a color', () => {
    const theme: RollTheme = {
      colorset: CUSTOM_COLORSET_KEY,
      material: 'metal',
    }
    expect(themeToBoxConfig(theme)).toEqual({
      theme_colorset: CUSTOM_COLORSET_KEY,
      theme_material: 'metal',
    })
  })
})
