# @lambersond/3d-dice-react

React bindings for [`@lambersond/3d-dice-core`](https://www.npmjs.com/package/@lambersond/3d-dice-core).
Hooks and a provider for a 3D dice app: assemble a roll in a "dice tray", drive
the 3D renderer, apply a theme, and manage dice preferences. All the dice logic,
types, and the renderer itself live in `3d-dice-core`; this package just wires
them to React's lifecycle.

UI, styling, and transport (Ably/WebSocket/etc.) are intentionally **not** here;
those belong to your app. Preference _persistence_ is **injected** too: the
preferences store keeps the reactive state, you choose where it's saved.

## Install

```bash
npm install @lambersond/3d-dice-react @lambersond/3d-dice-core
```

`@lambersond/3d-dice-core` and `react` (>=18) are peer dependencies; install
them alongside this package.

---

## `useTray`

```ts
useTray(): UseTray
```

Manages the in-progress roll a player is building: which dice are selected, the
net static modifier, advantage/disadvantage, and exploding. Wraps the core tray
reducer in `useReducer` and exposes derived values plus bound action dispatchers.
Menu/long-press/visual state is **not** here; keep that in your component.

Returns (`UseTray`):

| Member                 | Type                                        | Description                                                             |
| ---------------------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| `pools`                | `ReadonlyMap<DieSides, number>`             | Selected dice → count, in first-added order. Read `pools.get(sides)`.   |
| `modifiers`            | `ModifierCounts`                            | Raw tap counts: `{ plusOne, minusOne, plusFive, minusFive }`.           |
| `advantage`            | `'adv' \| 'dis' \| undefined`               | Current advantage state.                                                |
| `exploding`            | `boolean`                                   | Whether exploding dice is on.                                           |
| `modifier`             | `number`                                    | Net static modifier (e.g. `+5 -1 → 4`).                                 |
| `poolList`             | `Array<{ sides: DieSides; count: number }>` | Selected dice as a list, zero entries removed.                          |
| `isEmpty`              | `boolean`                                   | True when nothing at all is selected (use to disable a "Clear" button). |
| `toRequest()`          | `() => RollRequest`                         | The assembled `RollRequest` to hand to `executeRoll`.                   |
| `incrementDie(s)`      | `(sides: DieSides) => void`                 | Add one die.                                                            |
| `decrementDie(s)`      | `(sides: DieSides) => void`                 | Remove one (drops at zero).                                             |
| `clearDie(s)`          | `(sides: DieSides) => void`                 | Remove all of that die.                                                 |
| `bumpModifier(k)`      | `(key: ModifierKey) => void`                | Tap +1/+5/−1/−5 (cancels the opposite first → net value).               |
| `removeOneModifier(k)` | `(key: ModifierKey) => void`                | Remove one tap of a modifier.                                           |
| `clearModifier(k)`     | `(key: ModifierKey) => void`                | Zero a modifier.                                                        |
| `toggleAdvantage(v)`   | `(value: 'adv' \| 'dis') => void`           | Set advantage, or clear if already set.                                 |
| `toggleExploding()`    | `() => void`                                | Flip exploding.                                                         |
| `clear()`              | `() => void`                                | Reset the tray.                                                         |

```tsx
import { useTray } from '@lambersond/3d-dice-react'
import { DIE_SIDES } from '@lambersond/3d-dice-core'

function Tray({ onRoll }: { onRoll: (r: RollRequest) => void }) {
  const tray = useTray()
  return (
    <>
      {DIE_SIDES.map(sides => (
        <button key={sides} onClick={() => tray.incrementDie(sides)}>
          d{sides} ({tray.pools.get(sides) ?? 0})
        </button>
      ))}
      <button onClick={() => tray.bumpModifier('plusOne')}>
        +1 ({tray.modifier})
      </button>
      <button
        disabled={tray.poolList.length === 0}
        onClick={() => onRoll(tray.toRequest())}
      >
        Roll
      </button>
      <button disabled={tray.isEmpty} onClick={tray.clear}>
        Clear
      </button>
    </>
  )
}
```

---

## `useDiceRenderer`

```ts
useDiceRenderer(config?: DiceRendererConfig): DiceRenderer
```

Returns the shared `DiceRenderer` (one per page), calling `ensure()` on mount
and re-rendering the caller whenever the renderer becomes ready or its WebGL
context is lost/restored, so reading `renderer.isReady` is always live.

- The **first** call's `config` creates the singleton; later calls reuse it and
  ignore their `config` argument.
- The returned object is the core `DiceRenderer`. See the
  [`3d-dice-core` README](https://www.npmjs.com/package/@lambersond/3d-dice-core)
  for its full API (`isReady`, `roll`, `updateConfig`, `subscribe`, `ensure`).
- `config` is `DiceRendererConfig` from `3d-dice-core` (notably `assetPath`,
  default `/3d-dice/`). You must host the dice assets at that path. Copy them
  with `npx @lambersond/3d-dice-engine copy-assets`.

```tsx
import { useDiceRenderer } from '@lambersond/3d-dice-react'
import { executeRoll, toDiceBoxNotation } from '@lambersond/3d-dice-core'

function useRoller() {
  const renderer = useDiceRenderer() // assets served from /3d-dice/ by default

  return async (request: RollRequest) => {
    const result = executeRoll(request)
    // record/broadcast `result` first (attach your own roller/author here);
    // the animation is decorative.
    if (renderer.isReady) await renderer.roll(toDiceBoxNotation(result))
    return result
  }
}
```

### Remote rolls

The renderer just animates whatever notation you give it. To show another
player's roll without re-broadcasting it, animate their `RollResult` directly;
don't route it back through your own roll/emit path:

```ts
// a roll arrived from your transport:
if (renderer.isReady) await renderer.roll(toDiceBoxNotation(remoteResult))
```

---

## `useDiceTheme`

```ts
useDiceTheme(theme: RollTheme): void
```

Applies a `RollTheme` to the shared renderer whenever the theme changes, or
once the renderer becomes ready (the box builds asynchronously, so this hook
re-applies the moment `isReady` flips). A side-effect hook: it returns nothing
and drives the same singleton as `useDiceRenderer`.

The **theme is yours to supply** (from preferences, props, context, a server,
anywhere), so it works for any theme source, not just a built-in one. The
translation to dice-box config (including the `customColor` path) is handled for
you by core's `themeToBoxConfig`.

```tsx
import { useDiceTheme } from '@lambersond/3d-dice-react'

function DiceThemeSync({ theme }: { theme: RollTheme }) {
  useDiceTheme(theme) // re-applies on change and on renderer-ready
  return null
}
```

It depends on `theme.colorset` / `theme.material` / `theme.customColor`
(not object identity), so passing a fresh `{ ... }` each render is fine; it
only re-applies when a value actually changes.

---

## Preferences: `DicePreferencesProvider` + `useDicePreferences`

A store for a player's dice settings (`colorset`, `material`, `customColor`)
with **persistence injected by you**. The provider owns the reactive cache and
cross-component sync; _where_ the data lives is a storage adapter you pass in. It
also derives a `RollTheme`, so it drops straight into `useDiceTheme`.

```tsx
import {
  DicePreferencesProvider,
  localStoragePreferences,
  useDicePreferences,
  useDiceTheme,
} from '@lambersond/3d-dice-react'

// Wrap once, near the top of your dice UI:
function Providers({ children }: { children: ReactNode }) {
  const storage = useMemo(
    () => localStoragePreferences('my-app:dice-preferences'),
    [],
  )
  return (
    <DicePreferencesProvider storage={storage}>
      {children}
    </DicePreferencesProvider>
  )
}

// Read/update anywhere inside it:
function ThemeSync() {
  const { theme } = useDicePreferences()
  useDiceTheme(theme) // saved preferences → renderer
  return null
}
```

### `DicePreferencesProvider`

| Prop       | Type                     | Description                                                         |
| ---------- | ------------------------ | ------------------------------------------------------------------- |
| `storage`  | `DicePreferencesStorage` | Where prefs are read/written (required).                            |
| `defaults` | `DicePreferences`        | Initial values before load. Defaults to `DEFAULT_DICE_PREFERENCES`. |

### `useDicePreferences()`

Must be called within the provider. Returns:

| Member              | Type                               | Description                                            |
| ------------------- | ---------------------------------- | ------------------------------------------------------ |
| `preferences`       | `DicePreferences`                  | Current settings.                                      |
| `theme`             | `RollTheme`                        | `preferences` mapped to a theme (feed `useDiceTheme`). |
| `isLoaded`          | `boolean`                          | False until the initial `storage.get()` resolves.      |
| `setColorset(c)`    | `(colorset: string) => void`       | Update + persist the colorset.                         |
| `setMaterial(m)`    | `(material: DiceMaterial) => void` | Update + persist the material.                         |
| `setCustomColor(c)` | `(customColor: string) => void`    | Update + persist the custom colour.                    |

### Storage adapters

`storage` is just `{ get, set }`; bring your own (a DB, cookies, anything):

```ts
type DicePreferencesStorage = {
  get: () => DicePreferences | Promise<DicePreferences> // called once on mount
  set: (preferences: DicePreferences) => void // called on every change
}
```

`get` may be **async** (e.g. fetch from a server); `isLoaded` flips once it
resolves. `localStoragePreferences(key, defaults?)` is a ready-made adapter that
validates/coerces what it reads and degrades to in-memory state on the server or
in private mode.

---

## License

MIT
