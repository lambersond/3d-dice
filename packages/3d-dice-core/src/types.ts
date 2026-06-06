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
}
