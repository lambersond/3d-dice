// Public type surface for @lambersond/3d-dice-engine.
//
// Hand-written on purpose: consumers (e.g. @lambersond/3d-dice-core's
// DiceRenderer) type against this stable seam and never pull the engine's
// implementation `.ts` into their own — stricter — type-check program. The
// engine is built with `noImplicitAny: false`, so loading its source under a
// consumer's `strict` config would surface internal implicit-any errors.
//
// Runtime still resolves to `./src/index.ts` (the `import`/`default` export
// condition, transpiled via the consumer's `transpilePackages`); this file is
// used only for the `types` condition. Keep it in sync with `src/DiceBox.ts`.
//
// eslint-disable camelcase -- engine config keys are snake_case

/** Options accepted by the `DiceBox` constructor and `updateConfig`. */
export interface DiceBoxOptions {
  assetPath: string
  framerate: number
  sounds: boolean
  volume: number
  color_spotlight: number
  shadows: boolean
  theme_surface: string
  sound_dieMaterial: string
  theme_customColorset: unknown
  theme_colorset: string
  theme_texture: string
  theme_material: string
  gravity_multiplier: number
  light_intensity: number
  baseScale: number
  strength: number
  iterationLimit: number
  onRollComplete: (results: unknown) => void
  onRerollComplete: (results: unknown) => void
  onAddDiceComplete: (results: unknown) => void
  onRemoveDiceComplete: (results: unknown) => void
  /** Fires when the table empties via timed removal (not an explicit clear). */
  onEmpty: () => void
}

/** How a throw's dice leave the table once their dwell elapses. */
export type RemovalStyle = 'shrink' | 'fade'

/** Per-throw removal options; gaps fall back to the engine's defaults. */
export interface RemovalOptions {
  style?: RemovalStyle
  /** Rest time before the exit animation starts, ms (default 1000). */
  dwellMs?: number
  /** Exit animation duration, ms (default 450). */
  durationMs?: number
}

/** Per-throw options for `roll`/`add`. */
export interface RollOptions {
  /** Colorset bound to just this throw's dice. */
  theme?: Partial<DiceBoxOptions>
  /** When/how this throw's dice leave the table. */
  removal?: RemovalOptions
  /**
   * Fires once the dice exist in the world (before the throw settles), so a
   * caller can let a concurrent add() join the live tumble.
   */
  onSpawned?: () => void
}

export default class DiceBox {
  constructor(container: string, options?: Partial<DiceBoxOptions>)

  initialize(): Promise<void>
  /**
   * Throws dice into the live table. A roll joins whatever is already there
   * (or starts fresh when empty) and resolves the moment ITS OWN dice rest —
   * not when the whole table does — then its dice leave on their own removal
   * schedule, even while other throws are still tumbling or arriving.
   */
  roll(notation: string | string[], options?: RollOptions): Promise<unknown>
  /** Alias of {@link roll}: explicitly join the live table. */
  add(notation: string | string[], options?: RollOptions): Promise<unknown>
  reroll(diceIdArray: number[]): Promise<unknown>
  clearDice(): void
  updateConfig(options?: Partial<DiceBoxOptions>): Promise<void>

  // The renderer reads only the canvas, for WebGL context-loss handling; the
  // engine now owns the per-throw exit animation and dice lifecycle.
  readonly renderer: { domElement: HTMLCanvasElement }
}
