import type { DiceRendererConfig, RemovalOptions } from './types'

const DEFAULT_CONTAINER_ID = 'dice-canvas-threejs'

/** Pulls the per-die `value`s out of the engine's settle result, in order. */
function landedValues(settled: unknown): number[] {
  if (!Array.isArray(settled)) return []
  return settled
    .map(die => (die as { value?: unknown })?.value)
    .filter((v): v is number => typeof v === 'number')
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
}

type DiceBoxInstance = {
  initialize: () => Promise<void>
  roll: (notation: string, options?: BoxRollOptions) => Promise<unknown>
  add: (notation: string, options?: BoxRollOptions) => Promise<unknown>
  updateConfig?: (config: Record<string, unknown>) => Promise<void>
  clearDice?: () => void
  renderer?: { domElement?: HTMLCanvasElement }
}

export class DiceRenderer {
  private readonly containerId: string
  private readonly config: DiceRendererConfig
  private box: DiceBoxInstance | undefined
  private contextLost = false
  private building = false
  // serializes only the SPAWN of each throw (resolved via the engine's
  // `onSpawned`), so concurrent rolls coalesce into one continuous tumble
  // rather than waiting for each to settle
  private spawnChain: Promise<void> = Promise.resolve()
  private readonly subscribers = new Set<() => void>()
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

  ensure(): void {
    this.bindVisibility()
    if (!this.box && !this.building) this.build().catch(() => {})
  }

  async updateConfig(config: Record<string, unknown>): Promise<void> {
    const box = this.box
    if (!box?.updateConfig) return
    await box.updateConfig(config)
  }

  /**
   * Throws `notation` and resolves with the face values the dice landed on, in
   * notation order. For deterministic notation (`...@values`) these are just the
   * forced values (callers usually ignore them); for bare notation they're the
   * physics-determined landings — the source of truth for a non-deterministic
   * roll (see `executeNonDetRoll`). Empty if the renderer isn't ready.
   */
  async roll(
    notation: string,
    options?: { theme?: Record<string, unknown>; removal?: RemovalOptions },
  ): Promise<number[]> {
    const box = this.box
    if (!box || this.contextLost) return []

    const container = this.getContainer()
    if (container) container.style.opacity = '1'

    // Wait only until the previous throw has SPAWNED (not settled), so this
    // throw can join the live tumble. The chain serializes spawns so the
    // engine's "join vs. start fresh" check (does the table have dice?) is
    // race-free for concurrent callers.
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

    // Every throw joins the live table — the engine adds into the running world
    // (or starts fresh when empty), and each throw's dice leave on their own
    // schedule, so a settled roll can clear out even as new dice arrive. The
    // per-roll theme + removal are bound to this call; the container is hidden
    // via the onEmpty callback once the table fully drains (see buildBoxConfig).
    const settled = box.roll(notation, {
      theme: options?.theme,
      removal: options?.removal,
      onSpawned: releaseSpawn,
    })

    try {
      return landedValues(await settled)
    } finally {
      // safety net: the engine releases the spawn chain early via onSpawned, but
      // if it never fires, releasing here (resolve is idempotent) on settle —
      // success or failure — still prevents a stuck chain.
      releaseSpawn()
    }
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
      el.style.position = 'fixed'
      el.style.top = '0'
      el.style.left = '0'
      el.style.width = '100vw'
      el.style.height = '100vh'
      el.style.pointerEvents = 'none'
      el.style.zIndex = '100000'
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
    try {
      const container = this.ensureContainer()
      const ready = await this.waitForDimensions(container)
      if (!ready) {
        console.warn(
          '[dice] Container has zero dimensions; will retry on resume',
        )
        return
      }
      const { default: DiceBox } = await import('@lambersond/3d-dice-engine')
      const box = new DiceBox(
        `#${this.containerId}`,
        this.buildBoxConfig(),
      ) as unknown as DiceBoxInstance
      await box.initialize()
      this.box = box
      this.contextLost = false
      this.attachContextLossHandlers(box)
      this.notify()
    } catch (error) {
      console.error('[dice] Failed to initialize DiceBox:', error)
    } finally {
      this.building = false
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
      // engine fires this once the table empties via timed removal; hide the
      // overlay so it stops intercepting nothing-in-particular until next roll
      onEmpty: () => {
        const container = this.getContainer()
        if (container) container.style.opacity = '0'
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
