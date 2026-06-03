import { MATERIALS, type DiceMaterial } from '@lambersond/3d-dice-core'
import {
  DEFAULT_DICE_PREFERENCES,
  type DicePreferences,
  type DicePreferencesStorage,
} from './dice-preferences'

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/

const isDiceMaterial = (value: unknown): value is DiceMaterial =>
  typeof value === 'string' && (MATERIALS as readonly string[]).includes(value)

const validate = (raw: unknown, defaults: DicePreferences): DicePreferences => {
  if (!raw || typeof raw !== 'object') return defaults
  const p = raw as Partial<DicePreferences>
  return {
    colorset: typeof p.colorset === 'string' ? p.colorset : defaults.colorset,
    material: isDiceMaterial(p.material) ? p.material : defaults.material,
    customColor:
      typeof p.customColor === 'string' && HEX_PATTERN.test(p.customColor)
        ? p.customColor
        : defaults.customColor,
  }
}

/**
 * A `DicePreferencesStorage` backed by `localStorage` under `key`. It validates
 * and coerces whatever it reads back into a safe `DicePreferences`, falling back
 * to `defaults`. Safe on the server and in private mode — reads/writes that
 * throw degrade to in-memory state.
 */
export function localStoragePreferences(
  key: string,
  defaults: DicePreferences = DEFAULT_DICE_PREFERENCES,
): DicePreferencesStorage {
  return {
    get: () => {
      try {
        const raw = globalThis.localStorage?.getItem(key)
        return raw ? validate(JSON.parse(raw), defaults) : defaults
      } catch {
        return defaults
      }
    },
    set: preferences => {
      try {
        globalThis.localStorage?.setItem(key, JSON.stringify(preferences))
      } catch {
        // private mode / quota — state stays in memory
      }
    },
  }
}
