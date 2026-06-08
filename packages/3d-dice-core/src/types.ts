export type DieSides = 4 | 6 | 8 | 10 | 12 | 20 | 100

export type Advantage = 'adv' | 'dis'

export type DiePool = {
  sides: DieSides
  count: number
  rolls: number[][]
  kept: number[]
  explosions?: number[][]
  /**
   * Per-kept-die breakdown of the physical dice that produced it, carrying each
   * die's stable id so a later reroll can update the right value. Present only
   * for non-exploding rolls thrown physically (see executeNonDetRoll); absent
   * for exploding or purely deterministic rolls.
   */
  slots?: DieSlot[]
}

/** A single physical die: its current face `value` and stable engine `dieId`. */
export type RolledDie = {
  value: number
  dieId: number
}

export type DieSlotKind = 'plain' | 'adv' | 'dis' | 'd100'

/** How a kept value is derived from one or more physical dice. */
export type DieSlot = {
  kind: DieSlotKind
  /** plain: [die]; adv/dis: [a, b]; d100: [tens, ones]. */
  parts: RolledDie[]
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

export type RemovalStyle = 'shrink' | 'fade'

export type RemovalOptions = {
  style?: RemovalStyle
  dwellMs?: number
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
  assetPath?: string
  sounds?: boolean
  surface?: string
  colorset?: string
  material?: string
  gravityMultiplier?: number
  lightIntensity?: number
  strength?: number
  shadows?: boolean
  /** Detect hover/click on visible dice; register handlers via onDieHover/onDieClick. */
  enableDiceSelection?: boolean
  /** CSS overrides for the auto-created overlay container (see DiceOverlayConfig). */
  overlay?: DiceOverlayConfig
}

/**
 * CSS overrides for the overlay container DiceRenderer creates. Unset fields
 * keep the default full-viewport, click-through overlay; supply a subset (e.g.
 * width/height plus inset) to confine the dice to a bounded tray area. Ignored
 * when the app pre-renders its own container element by id.
 */
export type DiceOverlayConfig = {
  position?: string
  top?: string
  left?: string
  right?: string
  bottom?: string
  width?: string
  height?: string
  zIndex?: string
  pointerEvents?: string
}

/**
 * A single die plus where it sits, passed to onDieHover/onDieClick handlers.
 * `id` is the die's index in the live tray (the same handle the engine's
 * reroll/remove accept); `position` is the world-space center; `screenPosition`
 * is that point projected to canvas pixels.
 */
export type DieEvent = {
  /** Index in the live tray at event time (use with reroll/remove). */
  id: number
  /** Stable per-die id (survives rerolls); use this to track a die over time. */
  dieId: number
  type: string
  sides: number
  value: number
  reason: string
  position: { x: number; y: number; z: number }
  screenPosition: { x: number; y: number }
  scale: number
}
