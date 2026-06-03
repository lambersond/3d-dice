'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  CUSTOM_COLORSET_KEY,
  DEFAULT_COLORSET,
  DEFAULT_MATERIAL,
  type DiceMaterial,
  type RollTheme,
} from '@lambersond/3d-dice-core'

export type DicePreferences = {
  /** A preset colorset key, or `CUSTOM_COLORSET_KEY` to use `customColor`. */
  colorset: string
  material: DiceMaterial
  /** Last-picked hex colour, kept even on a preset so the picker remembers it. */
  customColor: string
}

/**
 * Persistence adapter for dice preferences — bring your own (localStorage, a DB,
 * cookies, anything). `get` is called once on mount and may be sync or async;
 * `set` receives the full preferences on every change. See
 * `localStoragePreferences` for a ready-made one.
 */
export type DicePreferencesStorage = {
  get: () => DicePreferences | Promise<DicePreferences>
  set: (preferences: DicePreferences) => void
}

export const DEFAULT_CUSTOM_COLOR = '#3e79ff'

export const DEFAULT_DICE_PREFERENCES: DicePreferences = {
  colorset: DEFAULT_COLORSET,
  material: DEFAULT_MATERIAL,
  customColor: DEFAULT_CUSTOM_COLOR,
}

type DicePreferencesValue = {
  preferences: DicePreferences
  /** `preferences` mapped to a `RollTheme` (e.g. to feed `useDiceTheme`). */
  theme: RollTheme
  /** False until the initial `storage.get()` has resolved. */
  isLoaded: boolean
  setColorset: (colorset: string) => void
  setMaterial: (material: DiceMaterial) => void
  setCustomColor: (customColor: string) => void
}

const toTheme = (preferences: DicePreferences): RollTheme =>
  preferences.colorset === CUSTOM_COLORSET_KEY
    ? {
        colorset: preferences.colorset,
        material: preferences.material,
        customColor: preferences.customColor,
      }
    : { colorset: preferences.colorset, material: preferences.material }

const DicePreferencesContext = createContext<DicePreferencesValue | undefined>(
  undefined,
)

export function DicePreferencesProvider({
  storage,
  defaults = DEFAULT_DICE_PREFERENCES,
  children,
}: {
  storage: DicePreferencesStorage
  defaults?: DicePreferences
  children: ReactNode
}) {
  const [preferences, setPreferences] = useState<DicePreferences>(defaults)
  const [isLoaded, setIsLoaded] = useState(false)

  // Latest storage in a ref so the load effect runs once and the persist effect
  // always writes through the current adapter.
  const storageRef = useRef(storage)
  storageRef.current = storage

  // Load once, on mount (client only — never during render, so SSR hydration
  // stays clean). Supports a sync or async `get`.
  useEffect(() => {
    let active = true
    Promise.resolve(storageRef.current.get())
      .then(loaded => {
        if (!active) return
        setPreferences(loaded)
        setIsLoaded(true)
      })
      .catch(() => {
        if (active) setIsLoaded(true)
      })
    return () => {
      active = false
    }
  }, [])

  // Persist on change — but not the initial defaults, nor the just-loaded value.
  const persistArmed = useRef(false)
  useEffect(() => {
    if (!isLoaded) return
    if (!persistArmed.current) {
      persistArmed.current = true
      return
    }
    storageRef.current.set(preferences)
  }, [preferences, isLoaded])

  const setColorset = useCallback(
    (colorset: string) => setPreferences(prev => ({ ...prev, colorset })),
    [],
  )
  const setMaterial = useCallback(
    (material: DiceMaterial) => setPreferences(prev => ({ ...prev, material })),
    [],
  )
  const setCustomColor = useCallback(
    (customColor: string) => setPreferences(prev => ({ ...prev, customColor })),
    [],
  )

  const value = useMemo<DicePreferencesValue>(
    () => ({
      preferences,
      theme: toTheme(preferences),
      isLoaded,
      setColorset,
      setMaterial,
      setCustomColor,
    }),
    [preferences, isLoaded, setColorset, setMaterial, setCustomColor],
  )

  return (
    <DicePreferencesContext.Provider value={value}>
      {children}
    </DicePreferencesContext.Provider>
  )
}

export function useDicePreferences(): DicePreferencesValue {
  const value = useContext(DicePreferencesContext)
  if (!value) {
    throw new Error(
      'useDicePreferences must be used within a <DicePreferencesProvider>',
    )
  }
  return value
}
