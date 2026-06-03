# @lambersond/3d-dice-core

Framework-agnostic building blocks for a 3D dice roller: a roll engine (RNG-based
**and** physics-sourced), a roll-expression parser, expression formatters, a
dice-tray state machine, theme presets, and a WebGL renderer controller (a thin
seam over [`@lambersond/3d-dice-engine`](../3d-dice-engine)).

There is **no React** (or any UI framework) here. Bring your own. For React
bindings, see [`@lambersond/3d-dice-react`](../3d-dice-react).

- **The roll engine, parser, formatters, and tray** are pure TypeScript and run
  anywhere (browser, Node, tests).
- **The `DiceRenderer`** needs a browser (it draws WebGL into a DOM canvas) and is
  the only thing that pulls in the 3D engine.

## Features

- **Two roll paths from one shape.** `executeRoll` resolves a `RollRequest` with an
  injectable RNG (deterministic / replayable, for synced multiplayer);
  `executeNonDetRoll` throws the dice for real and reads the result off the
  physics. Both produce the same `RollResult`.
- **Full dice grammar.** `parseRollExpression` turns `"2d6 + 3 adv !"` into a
  structured request (counts, modifiers, advantage/disadvantage, exploding)
  with friendly errors.
- **Tabletop rules built in.** Advantage/disadvantage (d20), exploding dice
  (capped), percentile d100, and net static modifiers.
- **A tray state machine.** A pure reducer + selectors for assembling a roll in a
  UI (which dice, modifier, advantage, exploding).
- **Theme presets.** Built-in colorsets and materials, plus a custom-colour path.
- **A renderer seam.** `DiceRenderer` wraps the engine: lazy WebGL setup, context
  loss/restore, a low-power downgrade, per-roll theme + removal, and a single
  full-screen overlay, with no UI-framework dependency.

## Install

```bash
npm install @lambersond/3d-dice-core
```

[`@lambersond/3d-dice-engine`](../3d-dice-engine) is a dependency and comes along
automatically. It is only loaded (via dynamic `import`) the first time you build a
`DiceRenderer`, so importing the pure functions never pulls in three.js.

## Quick start

```ts
import {
  parseRollExpression,
  executeRoll,
  toDiceBoxNotation,
  DiceRenderer,
} from '@lambersond/3d-dice-core'

// 1. Parse "2d6 + 3" into a structured request.
const parsed = parseRollExpression('2d6 + 3')
if (!parsed.ok) throw new Error(parsed.error)

// 2. Resolve the dice (pure, inject `rng` for deterministic results).
const result = executeRoll(parsed.request)
console.log(result.total) // e.g. 11

// 3. Animate it (browser only). The dice land on the computed values.
// Textures & sounds load from `/3d-dice/` by default. Populate it once with:
//   npx @lambersond/3d-dice-engine copy-assets
const renderer = new DiceRenderer()
renderer.ensure()
await renderer.roll(toDiceBoxNotation(result))
```

Prefer a **physics-decided** result instead? Skip `executeRoll`/`toDiceBoxNotation`
and let the dice choose. See [`executeNonDetRoll`](#physics-sourced-rolling-executenondetroll).

---

## Rolling: `executeRoll`

```ts
executeRoll(request: RollRequest, options?: ExecuteRollOptions): RollResult
```

Resolves a `RollRequest` into a `RollResult`: rolls every die, applies
advantage/disadvantage (d20 only) and exploding dice, and sums the total.
**Pure**: no global state, no side effects.

The result carries no notion of _who_ rolled; identity is the consumer's
concern. Attach your own roller/author onto the `RollResult` when you log or
broadcast it.

| Parameter | Type                 | Description                                                 |
| --------- | -------------------- | ----------------------------------------------------------- |
| `request` | `RollRequest`        | What to roll (pools, modifier, advantage, exploding).       |
| `options` | `ExecuteRollOptions` | Optional. Inject randomness, timestamp, and id (see below). |

`ExecuteRollOptions`:

| Field | Type     | Default               | Description                                                                                                              |
| ----- | -------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `rng` | `Rng`    | `Math.random`         | Randomness source: a `() => number` in `[0, 1)`. Seed it for deterministic / replayable / verifiable rolls (and tests). |
| `now` | `number` | `Date.now()`          | Timestamp written to `result.at` (ms since epoch).                                                                       |
| `id`  | `string` | `crypto.randomUUID()` | Stable id written to `result.id`.                                                                                        |

Rules it encodes:

- **Advantage/disadvantage** apply only to `d20`s: each is rolled twice and the
  higher (`adv`) or lower (`dis`) is kept. Other dice roll once.
- **Exploding dice**: a die that rolls its maximum spawns another of the same
  kind, recursively, capped at 50 explosions per die.
- `total` = sum of kept values + all explosion values + `modifier`.

```ts
// Deterministic via a seeded rng:
const fixed = executeRoll(
  { pools: [{ sides: 20, count: 1 }], modifier: 5 },
  { rng: () => 0.95, now: 0, id: 'roll-1' },
)
```

---

## Physics-sourced rolling: `executeNonDetRoll`

```ts
executeNonDetRoll(
  request: RollRequest,
  throwDice: PhysicalThrow,
  options?: { now?: number; id?: string },
): Promise<RollResult>

type PhysicalThrow = (notation: string) => Promise<number[]>
```

The non-deterministic counterpart to `executeRoll`: instead of computing dice with
an RNG, it throws them **for real** and reads the values they land on, then
assembles the same `RollResult`. You inject a `throwDice` primitive, typically
backed by `DiceRenderer.roll`, which resolves with the landed face values, and it
orchestrates everything:

- builds **bare** notation (no `@values`) so the physics decides the faces,
- **advantage** rolls two physical d20s and keeps the higher/lower of what lands,
- **exploding** throws follow-up dice on a natural max (capped at 50),
- **d100** pairs a physical d100 (tens) with a d10 (ones) into a percentile.

Because the result is only known once the dice settle, `await` it before logging.

```ts
// the renderer's roll() resolves with the landed values, in notation order
const result = await executeNonDetRoll(request, notation => renderer.roll(notation))
console.log(result.total)
```

Keeping `throwDice` injected means the orchestration stays pure and testable (feed
it scripted values) while the app wires it to the real renderer.

---

## Parsing: `parseRollExpression`

```ts
parseRollExpression(input: string): ParseRollResult
```

Turns a free-form dice expression into a `RollRequest`, or returns a reason it
couldn't. Case-insensitive; whitespace-tolerant.

Returns a discriminated union:

```ts
type ParseRollResult =
  | { ok: true; request: RollRequest }
  | { ok: false; error: string }
```

Grammar it understands:

| Token        | Examples                              | Meaning                                                |
| ------------ | ------------------------------------- | ------------------------------------------------------ |
| Dice         | `2d6`, `d20` (count defaults to 1)    | Sides must be one of `DIE_SIDES` (4/6/8/10/12/20/100). |
| Modifier     | `+3`, `-1`, `+10 -2`                  | All signed integers are summed.                        |
| Advantage    | `adv`, `advantage`                    | Sets `advantage: 'adv'`.                               |
| Disadvantage | `dis`, `disadvantage`                 | Sets `advantage: 'dis'`.                               |
| Exploding    | `exp`, `explode`, `exploding`, or `!` | Sets `exploding: true`.                                |

Errors (`{ ok: false, error }`) for: an empty expression, a dice count `<= 0`,
an unsupported die size, or an expression containing no dice. It does **not**
handle command prefixes like `/r` or `/roll`; strip those first.

```ts
parseRollExpression('1d20 + 5 adv')
// { ok: true, request: { pools: [{ sides: 20, count: 1 }], modifier: 5, advantage: 'adv', exploding: false } }

parseRollExpression('2d7')
// { ok: false, error: 'Unsupported die: d7' }
```

---

## Formatting

```ts
formatRollExpression(request: RollRequest): string
formatResultExpression(result: RollResult): string
```

`formatRollExpression` renders a request as a human-readable string
(`"1d20 + 3d6 + 5 (adv)"`; exploding pools get a trailing `!`; an empty request
becomes `"-"`). `formatResultExpression` does the same for a completed result (
useful for log entries) and re-derives the `!` from whether any die actually
exploded.

---

## Renderer notation: `toDiceBoxNotation`

```ts
toDiceBoxNotation(result: RollResult): string
```

Converts a `RollResult` into the **predetermined** notation the engine expects
(e.g. `"4d20@11,20,3,13"`), so the 3D dice land on the values already computed.
This is the **deterministic** path: feed the output to `DiceRenderer.roll`.
(For a physics-decided roll, use `executeNonDetRoll` with bare notation instead.)
Percentile dice (`d100`) are emitted as a tens-`d100` + units-`d10` pair so they
render the way tabletop percentile dice do.

---

## Theme → renderer config: `themeToBoxConfig`

```ts
themeToBoxConfig(theme: RollTheme): Record<string, unknown>
```

Translates a `RollTheme` into the snake_case payload the engine expects: the
single place that knows the engine's theme keys. Pass the result as the **per-roll**
`theme` to `DiceRenderer.roll({ theme })`, so each roll renders in its own colours
(a coalesced burst keeps every roller's colours, with no global-state race). A
theme whose `colorset` is `CUSTOM_COLORSET_KEY` (with a `customColor`) is sent as a
one-off `theme_customColorset`; any other `colorset` is passed through as a preset
key via `theme_colorset`.

```ts
themeToBoxConfig({ colorset: 'white', material: 'glass' })
// { theme_colorset: 'white', theme_material: 'glass' }

themeToBoxConfig({
  colorset: CUSTOM_COLORSET_KEY,
  material: 'plastic',
  customColor: '#3e79ff',
})
// { theme_customColorset: { name: 'custom-#3e79ff', … }, theme_material: 'plastic' }
```

---

## Tray state machine

A reducer + selectors for assembling a roll in a UI (the "dice tray"): which
dice are selected, the net static modifier, advantage, and exploding. Pure;
`pools` is a `Map`, preserving the order dice were added.

```ts
createTrayState(): TrayState
trayReducer(state: TrayState, action: TrayAction): TrayState
```

`TrayAction` (dispatch these):

| Action                               | Effect                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| `{ type: 'incrementDie', sides }`    | Add one die of `sides`.                                                                       |
| `{ type: 'decrementDie', sides }`    | Remove one; drops the entry at zero.                                                          |
| `{ type: 'clearDie', sides }`        | Remove all dice of `sides`.                                                                   |
| `{ type: 'bumpModifier', key }`      | +1/+5/−1/−5 tap. Cancels one tap of the opposite key first, so the badge shows the net value. |
| `{ type: 'removeOneModifier', key }` | Remove one tap of `key` (floors at 0).                                                         |
| `{ type: 'clearModifier', key }`     | Zero out `key`.                                                                               |
| `{ type: 'toggleAdvantage', value }` | Set `adv`/`dis`, or clear it if already set.                                                  |
| `{ type: 'toggleExploding' }`        | Flip exploding.                                                                               |
| `{ type: 'clear' }`                  | Reset to an empty tray.                                                                       |

`key` is a `ModifierKey`: `'plusOne' | 'minusOne' | 'plusFive' | 'minusFive'`.

Selectors (derive values from state):

| Selector               | Returns                             | Description                                               |
| ---------------------- | ----------------------------------- | --------------------------------------------------------- |
| `trayModifier(state)`  | `number`                            | Net static modifier (e.g. `+5 -1 → 4`).                   |
| `trayPoolList(state)`  | `Array<{ sides: DieSides; count }>` | Selected dice in first-added order, zero entries removed. |
| `trayToRequest(state)` | `RollRequest`                       | The assembled request (empty `pools` if no dice).         |
| `isTrayEmpty(state)`   | `boolean`                           | True when nothing at all is selected.                     |

```ts
let s = createTrayState()
s = trayReducer(s, { type: 'incrementDie', sides: 20 })
s = trayReducer(s, { type: 'bumpModifier', key: 'plusFive' })
executeRoll(trayToRequest(s), { id: 'me' })
```

---

## `DiceRenderer`

A browser-only controller around [`@lambersond/3d-dice-engine`](../3d-dice-engine).
One per page: it owns a single fixed, full-screen `<canvas>` overlay. Handles lazy
initialization, WebGL context loss/restore, a low-power downgrade (shadows off on
mobile/low-memory devices), and retry-on-resume. The **engine** owns the per-throw
timed removal; the renderer simply forwards each roll's `theme` + `removal` and
hides the overlay when the table fully drains. No React dependency.

```ts
new DiceRenderer(config?: DiceRendererConfig)
```

`DiceRendererConfig` (all optional):

| Field               | Type      | Default                       | Description                                             |
| ------------------- | --------- | ----------------------------- | ------------------------------------------------------- |
| `containerId`       | `string`  | `'dice-canvas-threejs'`       | id of the fixed canvas container; created if absent.    |
| `assetPath`         | `string`  | `'/3d-dice/'`                 | Base URL for textures/sounds. Populate it with `npx @lambersond/3d-dice-engine copy-assets`. |
| `sounds`            | `boolean` | `true`                        | Play dice sounds.                                       |
| `surface`           | `string`  | `'green-felt'`                | Engine `theme_surface`.                                 |
| `colorset`          | `string`  | `'white'`                     | Default dice colorset.                                  |
| `material`          | `string`  | `'glass'`                     | Default dice material.                                  |
| `gravityMultiplier` | `number`  | `400`                         | Physics gravity scale.                                  |
| `lightIntensity`    | `number`  | `0.8`                         | Scene light intensity.                                  |
| `strength`          | `number`  | `1`                           | Throw strength.                                         |
| `shadows`           | `boolean` | auto (off on low-power)       | Force shadows on/off, overriding the device heuristic.  |

Methods and properties:

| Member                     | Signature                                                                                              | Description                                                                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isReady`                  | `boolean` (getter)                                                                                    | False before the box builds or while the GL context is lost.                                                                                       |
| `ensure()`                 | `() => void`                                                                                          | Lazily build the box and bind the resume listener. Safe to call repeatedly.                                                                         |
| `subscribe(onChange)`      | `(cb: () => void) => () => void`                                                                      | Notified on ready / context-loss / restore. Returns an unsubscribe fn.                                                                              |
| `roll(notation, options?)` | `(notation: string, options?: { theme?; removal?: RemovalOptions }) => Promise<number[]>`            | Throw + animate the notation; resolves with the **landed face values** (in notation order) once the throw's own dice rest, or `[]` if not ready. `theme` and `removal` bind to just this throw. Every throw joins the live table. |
| `updateConfig(config)`     | `(config: Record<string, unknown>) => Promise<void>`                                                  | Push a raw engine config (e.g. change the default theme between rolls). No-ops if not ready.                                                        |

```ts
const renderer = new DiceRenderer()
renderer.ensure()
const off = renderer.subscribe(() => console.log('ready:', renderer.isReady))
await renderer.roll(toDiceBoxNotation(result), { removal: { style: 'fade' } })
off()
```

### Asset hosting (important)

The engine fetches its textures and sounds **at runtime** from `assetPath`. npm
install does not place these in your served static directory. Copy the engine's
asset bundle ([`@lambersond/3d-dice-engine`'s `public/3d-dice/`](../3d-dice-engine#assets))
into your public folder and point `assetPath` at it. Without it the dice render
untextured.

> **TODO: reinvestigate asset packaging (deferred; "option A"):** The engine
> bundles ~2 MB of textures/sounds (1.7 MB textures + 672 KB sounds) in its
> `public/`, so they ship in every consumer's `node_modules`, and their deploy
> artifact, if copied, even though the assets are fetched at runtime by URL and
> are **never** part of the JS bundle or tree-shakeable. Revisit extracting them
> into a standalone `@lambersond/3d-dice-assets` package and defaulting
> `assetPath` to a version-pinned CDN URL (jsDelivr/unpkg serve published package
> files), keeping `copy-assets` + an `assetPath` override as the self-host escape
> hatch. That takes the default local footprint to zero while preserving the
> existing per-theme lazy loading; the trade-off is a runtime CDN dependency.

---

## Theme presets

Static data describing the dice colorsets and materials the engine supports.

| Export              | Type                                           | Description                                           |
| ------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| `COLORSETS`         | `readonly ColorsetPreset[]`                    | All built-in colorsets, grouped by `category`.        |
| `MATERIALS`         | `readonly DiceMaterial[]`                      | `'none' \| 'plastic' \| 'glass' \| 'metal' \| 'wood'` |
| `DEFAULT_COLORSET`  | `string`                                       | `'white'`                                             |
| `DEFAULT_MATERIAL`  | `DiceMaterial`                                 | `'glass'`                                             |
| `findColorset(key)` | `(key: string) => ColorsetPreset \| undefined` | Look up a colorset by its `key`.                      |

`ColorsetPreset`: `{ key, name, category, foreground, background }`.

---

## Constants

| Export                | Type                  | Value                        |
| --------------------- | --------------------- | ---------------------------- |
| `DIE_SIDES`           | `readonly DieSides[]` | `[4, 6, 8, 10, 12, 20, 100]` |
| `CUSTOM_COLORSET_KEY` | `string`              | `'custom'`                   |

---

## Exported types

`DieSides`, `Advantage`, `DiePool`, `RollRequest`, `RollTheme`, `RollResult`,
`RemovalStyle`, `RemovalOptions`, `Rng`, `ExecuteRollOptions`, `PhysicalThrow`,
`ParseRollResult`, `ModifierKey`, `ModifierCounts`, `TrayState`, `TrayAction`,
`DiceRendererConfig`, `DiceMaterial`, `ColorsetPreset`.

## License

MIT
