export type DieSides = 4 | 6 | 8 | 10 | 12 | 20 | 100

export type Advantage = 'adv' | 'dis'

export type DiePool = {
  sides: DieSides
  count: number
  rolls: number[][]
  kept: number[]
  explosions?: number[][]
}

export type RollRequest = {
  pools: ReadonlyArray<{ sides: DieSides; count: number }>
  modifier: number
  advantage?: Advantage
  exploding?: boolean
}

export type RollTheme = {
  colorset: string
  material: string
  customColor?: string
}

/** How a throw's dice leave the table once their dwell elapses. */
export type RemovalStyle = 'shrink' | 'fade'

/** Per-throw removal options; gaps fall back to the engine's defaults. */
export type RemovalOptions = {
  style?: RemovalStyle
  /** Rest time before the exit animation starts, ms (default 1000). */
  dwellMs?: number
  /** Exit animation duration, ms (default 450). */
  durationMs?: number
}

export type RollResult = {
  id: string
  at: number
  pools: DiePool[]
  modifier: number
  advantage?: Advantage
  total: number
  theme?: RollTheme
}

export type Rng = () => number

export type ExecuteRollOptions = {
  rng?: Rng
  now?: number
  id?: string
}

export type ParseRollResult =
  | { ok: true; request: RollRequest }
  | { ok: false; error: string }

export type ModifierKey = 'plusOne' | 'minusOne' | 'plusFive' | 'minusFive'

export type ModifierCounts = Record<ModifierKey, number>

export type TrayState = {
  pools: ReadonlyMap<DieSides, number>
  modifiers: ModifierCounts
  advantage?: Advantage
  exploding: boolean
}

export type TrayAction =
  | { type: 'incrementDie'; sides: DieSides }
  | { type: 'decrementDie'; sides: DieSides }
  | { type: 'clearDie'; sides: DieSides }
  | { type: 'bumpModifier'; key: ModifierKey }
  | { type: 'removeOneModifier'; key: ModifierKey }
  | { type: 'clearModifier'; key: ModifierKey }
  | { type: 'toggleAdvantage'; value: Advantage }
  | { type: 'toggleExploding' }
  | { type: 'clear' }

export type DiceRendererConfig = {
  containerId?: string
  /**
   * Base URL the renderer fetches textures & sounds from at runtime, e.g.
   * `assetPath + 'textures/wood.webp'`. Defaults to `/3d-dice/`, matching the
   * folder produced by `npx @lambersond/3d-dice-engine copy-assets`. Override
   * if you serve the assets from a different path.
   */
  assetPath?: string
  sounds?: boolean
  surface?: string
  colorset?: string
  material?: string
  gravityMultiplier?: number
  lightIntensity?: number
  strength?: number
  shadows?: boolean
}
