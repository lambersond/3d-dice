/* eslint-disable camelcase -- dice-box-threejs config keys are snake_case */
import { CUSTOM_COLORSET_KEY, type RollTheme } from '@lambersond/3d-dice-core'
import { renderHook } from '@testing-library/react'
import { useDiceTheme } from './use-dice-theme'

// Replace the renderer hook with a controllable fake so there's no WebGL.
// themeToBoxConfig stays real, so these tests also cover the translation.
const mockRenderer = {
  isReady: false,
  updateConfig: jest.fn(() => Promise.resolve()),
}

jest.mock('./dice-renderer-provider', () => ({
  useDiceRenderer: () => mockRenderer,
}))

beforeEach(() => {
  mockRenderer.isReady = false
})

const white: RollTheme = { colorset: 'white', material: 'glass' }

describe('useDiceTheme', () => {
  it('does not touch the renderer until it is ready', () => {
    renderHook(() => useDiceTheme(white))
    expect(mockRenderer.updateConfig).not.toHaveBeenCalled()
  })

  it('applies the translated theme once the renderer is ready', () => {
    mockRenderer.isReady = true
    renderHook(() => useDiceTheme(white))
    expect(mockRenderer.updateConfig).toHaveBeenCalledWith({
      theme_colorset: 'white',
      theme_material: 'glass',
    })
  })

  it('applies when the renderer becomes ready', () => {
    const { rerender } = renderHook(() => useDiceTheme(white))
    expect(mockRenderer.updateConfig).not.toHaveBeenCalled()
    mockRenderer.isReady = true
    rerender()
    expect(mockRenderer.updateConfig).toHaveBeenCalledWith({
      theme_colorset: 'white',
      theme_material: 'glass',
    })
  })

  it('re-applies when the theme changes', () => {
    mockRenderer.isReady = true
    const { rerender } = renderHook(({ theme }) => useDiceTheme(theme), {
      initialProps: { theme: white },
    })
    rerender({ theme: { colorset: 'black', material: 'metal' } })
    expect(mockRenderer.updateConfig).toHaveBeenLastCalledWith({
      theme_colorset: 'black',
      theme_material: 'metal',
    })
  })

  it('translates a custom-color theme via the real themeToBoxConfig', () => {
    mockRenderer.isReady = true
    renderHook(() =>
      useDiceTheme({
        colorset: CUSTOM_COLORSET_KEY,
        material: 'plastic',
        customColor: '#3e79ff',
      }),
    )
    expect(mockRenderer.updateConfig).toHaveBeenCalledWith({
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
})
