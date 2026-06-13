import type {
  DiceRendererConfig,
  DieEvent,
  DieRoll,
  PlaceDieOptions,
  RemovalOptions,
  RolledDie,
} from './types'

type Vec3 = { x: number; y: number; z: number }

const DEFAULT_CONTAINER_ID = 'dice-canvas-threejs'
const INIT_TIMEOUT_MS = 15_000

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms}ms`)),
        ms,
      ),
    ),
  ])
}

function userAgent(): string {
  return typeof navigator === 'undefined' ? 'n/a' : navigator.userAgent
}

function landedDice(settled: unknown): RolledDie[] {
  if (!Array.isArray(settled)) return []
  return settled
    .map(die => die as { value?: unknown; dieId?: unknown })
    .filter(
      (die): die is { value: number; dieId: number } =>
        typeof die.value === 'number' && typeof die.dieId === 'number',
    )
    .map(die => ({ value: die.value, dieId: die.dieId }))
}

function toDieRolls(settled: unknown): DieRoll[] {
  if (!Array.isArray(settled)) return []
  const rolls: DieRoll[] = []
  for (const item of settled) {
    const d = item as Partial<DieRoll>
    if (
      typeof d.dieId === 'number' &&
      typeof d.value === 'number' &&
      typeof d.sides === 'number' &&
      typeof d.type === 'string'
    ) {
      rolls.push({
        dieId: d.dieId,
        value: d.value,
        sides: d.sides,
        type: d.type,
        reason: typeof d.reason === 'string' ? d.reason : '',
      })
    }
  }
  return rolls
}

function isLowPowerDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const coarse =
    typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  const mobileUA = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)
  const deviceMemory = (navigator as { deviceMemory?: number }).deviceMemory
  const lowMemory = typeof deviceMemory === 'number' && deviceMemory <= 4
  return coarse || mobileUA || lowMemory
}

type BoxRollOptions = {
  theme?: Record<string, unknown>
  removal?: RemovalOptions
  onSpawned?: () => void
  enableFlickOnSettled?: boolean
  center?: boolean
}

type DiceBoxInstance = {
  initialize: () => Promise<void>
  roll: (notation: string, options?: BoxRollOptions) => Promise<unknown>
  add: (notation: string, options?: BoxRollOptions) => Promise<unknown>
  reroll?: (
    ids: number[],
    options?: {
      removal?: RemovalOptions
      velocity?: Vec3
      position?: Vec3
      angular?: Vec3
    },
  ) => Promise<unknown>
  remove?: (ids: number[]) => Promise<unknown>
  place?: (options: PlaceDieOptions) => unknown
  updateConfig?: (config: Record<string, unknown>) => Promise<void>
  clearDice?: () => void
  dispose?: () => void
  renderer?: { domElement?: HTMLCanvasElement }
}

export class DiceRenderer {
  private readonly containerId: string
  private readonly config: DiceRendererConfig
  private box: DiceBoxInstance | undefined
  private contextLost = false
  private building = false
  // Bumped by dispose() to cancel an in-flight build whose container/box would
  // otherwise be torn down underneath it (e.g. navigating away mid-build).
  private generation = 0
  private spawnChain: Promise<void> = Promise.resolve()
  private readonly subscribers = new Set<() => void>()
  private readonly hoverSubscribers = new Set<(die: DieEvent | null) => void>()
  private readonly clickSubscribers = new Set<(die: DieEvent) => void>()
  private readonly rerollSubscribers = new Set<(rolls: DieRoll[]) => void>()
  private readonly grabSubscribers = new Set<(die: DieEvent) => void>()
  private readonly settledSubscribers = new Set<(rolls: DieRoll[]) => void>()
  private readonly addedSubscribers = new Set<(rolls: DieRoll[]) => void>()
  private visibilityBound = false

  constructor(config: DiceRendererConfig = {}) {
    this.config = config
    this.containerId = config.containerId ?? DEFAULT_CONTAINER_ID
  }

  get isReady(): boolean {
    return !this.contextLost && !!this.box
  }

  subscribe(onChange: () => void): () => void {
    this.subscribers.add(onChange)
    return () => {
      this.subscribers.delete(onChange)
    }
  }

  /**
   * Register a handler for pointer hover over a visible die (fires with the die,
   * or null when the pointer leaves all dice). Requires
   * `enableDiceSelection: true` in the renderer config. Returns an unsubscribe.
   */
  onDieHover(handler: (die: DieEvent | null) => void): () => void {
    this.hoverSubscribers.add(handler)
    return () => {
      this.hoverSubscribers.delete(handler)
    }
  }

  /**
   * Register a handler for clicks on a visible die. Requires
   * `enableDiceSelection: true` in the renderer config. Returns an unsubscribe.
   */
  onDieClick(handler: (die: DieEvent) => void): () => void {
    this.clickSubscribers.add(handler)
    return () => {
      this.clickSubscribers.delete(handler)
    }
  }

  /**
   * Register a handler that fires whenever dice settle from a reroll or flick,
   * with their new face values. Covers both tap and drag rerolls. Returns an
   * unsubscribe.
   */
  onDieReroll(handler: (rolls: DieRoll[]) => void): () => void {
    this.rerollSubscribers.add(handler)
    return () => {
      this.rerollSubscribers.delete(handler)
    }
  }

  /**
   * Register a handler that fires the moment a die is grabbed, with its current
   * up-face value (before it's re-thrown). Requires `enableDiceDrag`. Returns an
   * unsubscribe.
   */
  onDieGrabbed(handler: (die: DieEvent) => void): () => void {
    this.grabSubscribers.add(handler)
    return () => {
      this.grabSubscribers.delete(handler)
    }
  }

  /**
   * Register a handler that fires whenever the whole table comes to rest, with
   * every die's current value (covers the initial roll and each flick). Holding
   * a die defers this until it's released and settles. Returns an unsubscribe.
   */
  onSettled(handler: (rolls: DieRoll[]) => void): () => void {
    this.settledSubscribers.add(handler)
    return () => {
      this.settledSubscribers.delete(handler)
    }
  }

  /**
   * Register a handler that fires when a die added via the grab-to-add gesture
   * (right-click while holding) settles, with its value(s) — one die, or two for
   * a percentile pair (tens then ones). Requires `enableDiceAdd`. Returns an
   * unsubscribe.
   */
  onDiceAdded(handler: (rolls: DieRoll[]) => void): () => void {
    this.addedSubscribers.add(handler)
    return () => {
      this.addedSubscribers.delete(handler)
    }
  }

  /** Remove every die currently on the table. */
  clear(): void {
    this.box?.clearDice?.()
  }

  /**
   * Drop a single grabbable die into the center of the table and leave it there
   * (persistent, flickable). Used by the center-seed flick interaction to place
   * the die you grab. Resolves once it has settled.
   */
  async seed(notation: string): Promise<void> {
    const box = this.box
    if (!box || this.contextLost) return
    const container = this.getContainer()
    if (container) container.style.opacity = '1'
    await box.roll(notation, {
      center: true,
      removal: { style: 'none' },
      enableFlickOnSettled: true,
    })
  }

  /**
   * Place a single die at a normalized (-1..1) table coordinate, resting flat
   * with the given face value showing up. Instant (no tumble) and persistent.
   * Returns the placed die's value + stable `dieId`, or undefined if not ready.
   */
  placeDie(options: PlaceDieOptions): DieRoll | undefined {
    const box = this.box
    if (!box?.place || this.contextLost) return undefined
    const container = this.getContainer()
    if (container) container.style.opacity = '1'
    const rolls = toDieRolls([box.place(options)])
    return rolls[0]
  }

  /** Take specific dice off the table by id (e.g. a "set aside" action). */
  async remove(ids: number[]): Promise<void> {
    const box = this.box
    if (!box?.remove || this.contextLost || ids.length === 0) return
    await box.remove(ids)
  }

  /**
   * Tear down the engine box and remove the overlay element this renderer
   * created. Call when the renderer is no longer needed (e.g. on unmount) so
   * navigating away does not leak canvases/listeners or leave stale dice.
   */
  dispose(): void {
    this.generation += 1
    this.box?.dispose?.()
    this.getContainer()?.remove()
    this.box = undefined
    this.building = false
  }

  ensure(): void {
    this.bindVisibility()
    if (!this.box && !this.building) this.build().catch(() => {})
  }

  async updateConfig(config: Record<string, unknown>): Promise<void> {
    const box = this.box
    if (!box?.updateConfig) return
    await box.updateConfig(config)
  }

  async roll(
    notation: string,
    options?: {
      theme?: Record<string, unknown>
      removal?: RemovalOptions
      /**
       * Keep this throw's dice flickable after they settle. Forced off for
       * deterministic notation (`...@values`), which can't be re-flicked.
       */
      enableFlickOnSettled?: boolean
    },
  ): Promise<RolledDie[]> {
    const box = this.box
    if (!box || this.contextLost) return []

    const container = this.getContainer()
    if (container) container.style.opacity = '1'

    const prevSpawn = this.spawnChain
    let releaseSpawn!: () => void
    this.spawnChain = new Promise<void>(resolve => {
      releaseSpawn = resolve
    })
    await prevSpawn

    if (this.contextLost || !this.box) {
      releaseSpawn()
      return []
    }

    const deterministic = notation.includes('@')
    const settled = box.roll(notation, {
      theme: options?.theme,
      removal: options?.removal,
      enableFlickOnSettled: deterministic
        ? false
        : options?.enableFlickOnSettled,
      onSpawned: releaseSpawn,
    })

    try {
      return landedDice(await settled)
    } finally {
      releaseSpawn()
    }
  }

  /**
   * Re-throw dice that are already on the table, by their `id` (the index
   * carried on a {@link DieEvent} from onDieClick/onDieHover). Resolves with the
   * dice's new face values. `removal` controls how long the rerolled dice dwell
   * before leaving, matching the dwell used on the original throw.
   */
  async reroll(
    ids: number[],
    options?: { removal?: RemovalOptions },
  ): Promise<RolledDie[]> {
    const box = this.box
    if (!box?.reroll || this.contextLost || ids.length === 0) return []

    const container = this.getContainer()
    if (container) container.style.opacity = '1'

    return landedDice(await box.reroll(ids, { removal: options?.removal }))
  }

  private notify(): void {
    for (const cb of this.subscribers) cb()
  }

  private getContainer(): HTMLElement | null {
    return document.querySelector<HTMLElement>(`#${this.containerId}`)
  }

  private ensureContainer(): HTMLElement {
    let el = this.getContainer()
    if (!el) {
      el = document.createElement('div')
      el.id = this.containerId
      // Default full-viewport, click-through overlay; `overlay` config can
      // override any field (e.g. width/height + inset) to confine dice to a
      // bounded tray. Apps that pre-render the element keep full control.
      Object.assign(el.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: '100000',
        ...this.config.overlay,
      })
      document.body.append(el)
    }
    return el
  }

  private async waitForDimensions(
    container: HTMLElement,
    frames = 60,
  ): Promise<boolean> {
    for (let i = 0; i < frames; i += 1) {
      if (container.clientWidth > 0 && container.clientHeight > 0) return true
      await new Promise(requestAnimationFrame)
    }
    return container.clientWidth > 0 && container.clientHeight > 0
  }

  private async build(): Promise<void> {
    if (this.box || this.building) return
    this.building = true
    const generation = this.generation
    try {
      const container = this.ensureContainer()
      const ready = await this.waitForDimensions(container)
      // Bail if disposed (e.g. navigated away) while we awaited — the container
      // and box would be torn down underneath us.
      if (generation !== this.generation) return
      if (!ready) {
        console.error(
          '[dice] Container has zero dimensions; renderer not built (retries when visible).',
          {
            width: container.clientWidth,
            height: container.clientHeight,
            userAgent: userAgent(),
          },
        )
        return
      }
      const { default: DiceBox } = await import('@lambersond/3d-dice-engine')
      if (generation !== this.generation) return
      const box = new DiceBox(
        `#${this.containerId}`,
        this.buildBoxConfig(),
      ) as unknown as DiceBoxInstance
      await withTimeout(box.initialize(), INIT_TIMEOUT_MS, 'DiceBox.initialize')
      if (generation !== this.generation) {
        box.dispose?.()
        return
      }
      this.box = box
      this.contextLost = false
      this.attachContextLossHandlers(box)
      this.notify()
    } catch (error) {
      const el = this.getContainer()
      console.error('[dice] Failed to initialize DiceBox:', error, {
        userAgent: userAgent(),
        assetPath: this.config.assetPath ?? '/3d-dice/',
        width: el?.clientWidth,
        height: el?.clientHeight,
      })
    } finally {
      // Only the build that still owns the current generation clears the flag,
      // so a superseded build doesn't stomp a newer one's `building` state.
      if (generation === this.generation) this.building = false
    }
  }

  /* eslint-disable camelcase -- dice-box config keys are snake_case */
  private buildBoxConfig(): Record<string, unknown> {
    const c = this.config
    return {
      assetPath: c.assetPath ?? '/3d-dice/',
      sounds: c.sounds ?? true,
      shadows: c.shadows ?? !isLowPowerDevice(),
      theme_surface: c.surface ?? 'green-felt',
      theme_colorset: c.colorset ?? 'white',
      theme_material: c.material ?? 'glass',
      gravity_multiplier: c.gravityMultiplier ?? 400,
      light_intensity: c.lightIntensity ?? 0.8,
      strength: c.strength ?? 1,
      onEmpty: () => {
        const container = this.getContainer()
        if (container) container.style.opacity = '0'
      },
      enableDiceSelection: c.enableDiceSelection ?? false,
      enableDiceDrag: c.enableDiceDrag ?? false,
      enableDiceAdd: c.enableDiceAdd ?? false,
      ...(c.dragRemoval ? { dragRemoval: c.dragRemoval } : {}),
      onDiceHover: (data: DieEvent | null) => {
        for (const cb of this.hoverSubscribers) cb(data)
      },
      onDiceClick: (data: DieEvent) => {
        for (const cb of this.clickSubscribers) cb(data)
      },
      onRerollComplete: (results: unknown) => {
        const rolls = toDieRolls(results)
        for (const cb of this.rerollSubscribers) cb(rolls)
      },
      onDiceGrabbed: (data: DieEvent) => {
        for (const cb of this.grabSubscribers) cb(data)
      },
      onSettled: (results: unknown) => {
        const rolls = toDieRolls(results)
        for (const cb of this.settledSubscribers) cb(rolls)
      },
      onDiceAdded: (results: unknown) => {
        const rolls = toDieRolls(results)
        for (const cb of this.addedSubscribers) cb(rolls)
      },
    }
  }
  /* eslint-enable camelcase */

  private attachContextLossHandlers(box: DiceBoxInstance): void {
    const canvas = box.renderer?.domElement
    if (!canvas) return
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault()
      console.warn('[dice] WebGL context lost')
      this.contextLost = true
      this.notify()
    })
    canvas.addEventListener('webglcontextrestored', () => {
      console.warn('[dice] WebGL context restored')
      this.contextLost = false
      this.notify()
    })
  }

  private bindVisibility(): void {
    if (this.visibilityBound || typeof document === 'undefined') return
    this.visibilityBound = true
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.ensure()
    })
  }
}
