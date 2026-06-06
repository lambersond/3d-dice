import type { DiceRendererConfig, RemovalOptions } from './types'

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

  async roll(
    notation: string,
    options?: { theme?: Record<string, unknown>; removal?: RemovalOptions },
  ): Promise<number[]> {
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

    const settled = box.roll(notation, {
      theme: options?.theme,
      removal: options?.removal,
      onSpawned: releaseSpawn,
    })

    try {
      return landedValues(await settled)
    } finally {
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
      const box = new DiceBox(
        `#${this.containerId}`,
        this.buildBoxConfig(),
      ) as unknown as DiceBoxInstance
      await withTimeout(box.initialize(), INIT_TIMEOUT_MS, 'DiceBox.initialize')
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
