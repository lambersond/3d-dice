import type * as CANNON from 'cannon-es'
import type * as THREE from 'three'

export interface Vec3Like {
  x: number
  y: number
  z: number
}

export interface AxisAngle extends Vec3Like {
  a: number
}

/** A single die's throw parameters, produced by the notation parser. */
export interface VectorData {
  index: number
  type: string
  op: string
  sid: number
  gid: number
  glvl: number
  func: string
  args: string | string[]
  pos: Vec3Like
  velocity: Vec3Like
  angle: Vec3Like
  axis: AxisAngle
}

/** The value rolled on a single die face. */
export interface FaceValue {
  value: number
  label: unknown
  reason: string
  ignore?: boolean
}

/** A cannon body carrying the engine's per-die tag. */
export type DiceBody = CANNON.Body & { diceShape?: string }

/** A buffer geometry carrying its matching cannon collision shape. */
export type DiceGeometry = THREE.BufferGeometry & {
  cannon_shape?: CANNON.Shape
}

/**
 * A die: a `THREE.Mesh` plus the per-die runtime state and value helpers the
 * factory attaches to each mesh.
 */
/** A die's resting home transform, recorded for the `reset` disposition. */
export interface DiePlacement {
  position: Vec3Like
  quaternion: { x: number; y: number; z: number; w: number }
}

export interface DiceMesh extends THREE.Mesh {
  geometry: DiceGeometry
  material: THREE.Material[]
  body: DiceBody
  notation: VectorData
  result: FaceValue[]
  shape: string
  mass: number
  stopped: number
  rerolls: number
  rerolling: boolean
  resultReason: string
  /** Home transform to return to under the `reset` disposition (see DiceBox). */
  placement?: DiePlacement
  getFaceValue(): FaceValue
  storeRolledValue(reason?: string): void
  getLastValue(): FaceValue
  ignoreLastValue(ignore: boolean): void
  setLastValue(result: FaceValue): FaceValue | undefined
}

export interface Display {
  currentWidth: number
  currentHeight: number
  containerWidth: number
  containerHeight: number
  aspect: number
  scale: number
}

export interface CameraHeights {
  max: number
  close: number
  medium: number
  far: number
}

/** A single die face's content: a glyph, an image, or (for d4) a group of them. */
export type DiceLabel = string | HTMLImageElement | DiceLabel[]

/** A texture entry (a `TEXTURELIST` item, augmented with loaded images). */
export interface DiceTexture {
  name: string
  composite?: string
  source?: string
  source_bump?: string
  material?: string
  texture?: HTMLImageElement
  bump?: HTMLImageElement
}

/** A colour: a single value or a list the factory picks one from per roll. */
export type ColorValue = string | string[]

/** A texture: a single entry or a list the factory picks one from per roll. */
export type TextureValue = DiceTexture | DiceTexture[] | string

/** The composite + bump canvas textures produced for one die face. */
export interface FaceTextures {
  composite: THREE.Texture
  bump: THREE.Texture | null
}

/** The concrete material types the factory builds per face. */
export type DiceMaterial = THREE.MeshStandardMaterial | THREE.MeshPhongMaterial

/** Colorset data resolved by `DiceColors` and applied to the factory. */
export interface ColorData {
  id?: string | number
  name?: string
  foreground: ColorValue
  background: ColorValue
  outline: ColorValue
  edge?: ColorValue
  texture: DiceTexture
}

/**
 * A die definition (one entry of the preset table), as built by `DicePreset`
 * and handed back by `DiceFactory.get()`.
 */
export interface DicePresetLike {
  type: string
  shape: string
  name: string
  scale: number
  font: string
  color: string
  labels: DiceLabel[]
  values: number[]
  valueMap: number[]
  normals: DiceLabel[]
  mass: number
  inertia: number
  display: string
  system: string
}

/** A custom colorset definition passed via `theme_customColorset`. */
export type ColorsetOptions = Record<string, unknown>

/** Theme selection passed to `loadTheme`. */
export interface ThemeConfig {
  colorset: string
  texture: string
  material: string
}

/**
 * Per-throw theme overrides (a subset of the box config) accepted by
 * `roll`/`add`. Anything omitted falls back to the box's configured theme.
 */
export interface ThemeOptions {
  theme_colorset?: string
  theme_customColorset?: ColorsetOptions | null
  theme_texture?: string
  theme_material?: string
}

/** How a throw's dice leave the table once their dwell elapses. */
export type RemovalStyle = 'shrink' | 'fade' | 'reset' | 'none'

/** Per-throw removal options (everything optional; gaps fall back to defaults). */
export interface RemovalOptions {
  /** Exit animation: scale to nothing (`shrink`) or lerp opacity to 0 (`fade`). */
  style?: RemovalStyle
  /** How long the dice rest before the exit animation starts, in ms. */
  dwellMs?: number
  /** How long the exit animation runs, in ms. */
  durationMs?: number
}

/** A fully-resolved removal spec (defaults applied). Identity = one throw. */
export interface ResolvedRemoval {
  style: RemovalStyle
  dwellMs: number
  durationMs: number
}

/** Per-throw options for `roll`/`add`. */
export interface RollOptions {
  /** Colorset bound to just this throw's dice (see {@link ThemeOptions}). */
  theme?: ThemeOptions
  /** When/how this throw's dice leave the table. */
  removal?: RemovalOptions
  /** Fires once the dice exist in the world (before the throw settles). */
  onSpawned?: () => void
}

/** One parsed notation set (`2d6`, `1d20`, …). */
export interface NotationSet {
  num: number
  type: string
  op?: string
  sid: number
  gid: number
  glvl: number
  func?: string
  args?: string | string[]
}

/** Parsed notation — a `DiceNotation` instance or a merged plain object. */
export interface NotationLike {
  set: NotationSet[]
  vectors: VectorData[]
  constant: number | null
  notation: string
  op: string
  result: string[]
  error: boolean
}

/** One die's contribution to a result. */
export interface DiceResult {
  type: string
  sides: number
  /** Index in the live `diceList` at report time (shifts as dice are removed). */
  id: number
  /** Stable per-die id (survives rerolls); use this to track a die over time. */
  dieId: number
  value: number
  label: unknown
  reason: string
}

/**
 * A single die plus where it sits, emitted by the hover/click handlers when
 * {@link DiceBoxConfig.enableDiceSelection} is on. `position` is the world-space
 * center; `screenPosition` is that point projected to canvas pixels.
 */
export interface DiceEventData extends DiceResult {
  position: { x: number; y: number; z: number }
  screenPosition: { x: number; y: number }
  scale: number
}

/** One notation set's aggregated result. */
export interface ResultSet {
  num: number
  type: string
  sides: number
  rolls: DiceResult[]
  total: number
}

/** The full result of a roll. */
export interface RollResults {
  notation: string
  sets: ResultSet[]
  modifier: number
  total: number
}

export interface DiceBoxConfig {
  assetPath: string
  framerate: number
  sounds: boolean
  volume: number
  color_spotlight: number
  shadows: boolean
  theme_surface: string
  sound_dieMaterial: string
  theme_customColorset: ColorsetOptions | null
  theme_colorset: string
  theme_texture: string
  theme_material: string
  gravity_multiplier: number
  light_intensity: number
  baseScale: number
  strength: number
  iterationLimit: number
  onRollComplete: (results: RollResults) => void
  onRerollComplete: (results: DiceResult[]) => void
  onAddDiceComplete: (results: DiceResult[]) => void
  onRemoveDiceComplete: (results: DiceResult[]) => void
  /** Fires when the table empties via timed removal (not an explicit clear). */
  onEmpty: () => void
  /** Attach pointer listeners so hover/click on visible dice are detected. */
  enableDiceSelection: boolean
  /** Fires with the die under the pointer, or null when the pointer leaves all dice. */
  onDiceHover: (data: DiceEventData | null) => void
  /** Fires when a visible die is clicked. */
  onDiceClick: (data: DiceEventData) => void
  /** Attach pointer drag handlers so dice can be grabbed and flicked. */
  enableDiceDrag: boolean
  /** Disposition applied to a flicked/tapped die (default returns it home). */
  dragRemoval: RemovalOptions
}
