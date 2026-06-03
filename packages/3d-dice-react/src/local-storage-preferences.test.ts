import {
  DEFAULT_DICE_PREFERENCES,
  type DicePreferences,
} from './dice-preferences'
import { localStoragePreferences } from './local-storage-preferences'

const KEY = 'test:dice-preferences'

beforeEach(() => {
  globalThis.localStorage.clear()
})

describe('localStoragePreferences', () => {
  it('returns defaults when nothing is stored', () => {
    expect(localStoragePreferences(KEY).get()).toEqual(DEFAULT_DICE_PREFERENCES)
  })

  it('round-trips a stored value', () => {
    const storage = localStoragePreferences(KEY)
    const prefs: DicePreferences = {
      colorset: 'black',
      material: 'metal',
      customColor: '#abcdef',
    }
    storage.set(prefs)
    expect(storage.get()).toEqual(prefs)
  })

  it('falls back to defaults on corrupt JSON', () => {
    globalThis.localStorage.setItem(KEY, '{not valid json')
    expect(localStoragePreferences(KEY).get()).toEqual(DEFAULT_DICE_PREFERENCES)
  })

  it('coerces invalid material and customColor to defaults', () => {
    globalThis.localStorage.setItem(
      KEY,
      JSON.stringify({
        colorset: 'black',
        material: 'bogus',
        customColor: 'not-a-hex',
      }),
    )
    expect(localStoragePreferences(KEY).get()).toEqual({
      colorset: 'black',
      material: DEFAULT_DICE_PREFERENCES.material,
      customColor: DEFAULT_DICE_PREFERENCES.customColor,
    })
  })

  it('honours custom defaults', () => {
    const defaults: DicePreferences = {
      colorset: 'white',
      material: 'wood',
      customColor: '#111111',
    }
    expect(localStoragePreferences(KEY, defaults).get()).toEqual(defaults)
  })
})
