import { CUSTOM_COLORSET_KEY } from '@lambersond/3d-dice-core'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
  DEFAULT_DICE_PREFERENCES,
  DicePreferencesProvider,
  useDicePreferences,
  type DicePreferences,
  type DicePreferencesStorage,
} from './dice-preferences'
import type { ReactNode } from 'react'

const makeWrapper =
  (storage: DicePreferencesStorage) =>
  ({ children }: { children: ReactNode }) => (
    <DicePreferencesProvider storage={storage}>
      {children}
    </DicePreferencesProvider>
  )

const black: DicePreferences = {
  colorset: 'black',
  material: 'metal',
  customColor: '#abcdef',
}

describe('useDicePreferences', () => {
  it('throws when used outside a provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useDicePreferences())).toThrow(
      /DicePreferencesProvider/,
    )
    spy.mockRestore()
  })

  it('loads from storage and derives a (non-custom) theme', async () => {
    const { result } = renderHook(() => useDicePreferences(), {
      wrapper: makeWrapper({ get: () => black, set: jest.fn() }),
    })
    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    expect(result.current.preferences).toEqual(black)
    expect(result.current.theme).toEqual({
      colorset: 'black',
      material: 'metal',
    })
  })

  it('supports an async get', async () => {
    const { result } = renderHook(() => useDicePreferences(), {
      wrapper: makeWrapper({
        get: () => Promise.resolve(black),
        set: jest.fn(),
      }),
    })
    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    expect(result.current.preferences).toEqual(black)
  })

  it('derives a custom theme that includes customColor', async () => {
    const custom: DicePreferences = {
      colorset: CUSTOM_COLORSET_KEY,
      material: 'plastic',
      customColor: '#3e79ff',
    }
    const { result } = renderHook(() => useDicePreferences(), {
      wrapper: makeWrapper({ get: () => custom, set: jest.fn() }),
    })
    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    expect(result.current.theme).toEqual(custom)
  })

  it('updates preferences and persists through storage.set', async () => {
    const set = jest.fn()
    const { result } = renderHook(() => useDicePreferences(), {
      wrapper: makeWrapper({ get: () => DEFAULT_DICE_PREFERENCES, set }),
    })
    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    act(() => result.current.setColorset('black'))
    expect(result.current.preferences.colorset).toBe('black')
    await waitFor(() =>
      expect(set).toHaveBeenCalledWith(
        expect.objectContaining({ colorset: 'black' }),
      ),
    )
  })

  it('does not persist the value it just loaded', async () => {
    const set = jest.fn()
    const { result } = renderHook(() => useDicePreferences(), {
      wrapper: makeWrapper({ get: () => black, set }),
    })
    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    expect(set).not.toHaveBeenCalled()
  })
})
