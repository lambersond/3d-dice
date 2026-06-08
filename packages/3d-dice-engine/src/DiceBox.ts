import * as CANNON from 'cannon-es'
import * as THREE from 'three'
import { THEMES } from './const/themes'
import { DiceColors } from './DiceColors'
import { DiceFactory } from './DiceFactory'
import { DiceNotation } from './DiceNotation'
import type {
  AxisAngle,
  CameraHeights,
  ColorData,
  DiceBody,
  DiceBoxConfig,
  DiceEventData,
  DiceMesh,
  DiceResult,
  Display,
  NotationLike,
  RemovalOptions,
  ResolvedRemoval,
  ResultSet,
  RollOptions,
  RollResults,
  ThemeConfig,
  ThemeOptions,
  Vec3Like,
  VectorData,
} from './types'

type Vec2Like = { x: number; y: number }
type ThrowVectors = {
  pos: Vec3Like
  velocity: Vec3Like
  angle: Vec3Like
  axis: AxisAngle
}

// iOS/WebKit defers media buffering until a user gesture, so an un-gestured
// <audio> can fire neither `canplaythrough` nor `error`. Cap the wait so a
// deferred clip resolves (skipped) instead of hanging the load chain.
const AUDIO_LOAD_TIMEOUT_MS = 8000

function describeWebGLSupport(): Record<string, unknown> {
  const info: Record<string, unknown> = {
    userAgent: typeof navigator === 'undefined' ? 'n/a' : navigator.userAgent,
  }
  try {
    const canvas = document.createElement('canvas')
    const gl2 = canvas.getContext('webgl2')
    const gl1 = canvas.getContext('webgl')
    const gl = gl2 ?? gl1
    info.webgl2 = !!gl2
    info.webgl1 = !!gl1
    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info')
      info.renderer = dbg
        ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER)
      info.vendor = dbg
        ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)
        : gl.getParameter(gl.VENDOR)
      info.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)
    }
  } catch (probeError) {
    info.probeError = String(probeError)
  }
  return info
}

type ThrowGroup = {
  dice: DiceMesh[]
  resolve: () => void
  resolved: boolean
  removal: ResolvedRemoval
  settledAt: number | null
  exiting: boolean
  exitStart: number
}

type ThrowResult = RollResults | DiceResult[] | undefined

const defaultConfig: DiceBoxConfig = {
  assetPath: './',
  framerate: 1 / 60,
  sounds: false,
  volume: 100,
  color_spotlight: 0xefdfd5,
  shadows: true,
  theme_surface: 'green-felt',
  sound_dieMaterial: 'plastic',
  theme_customColorset: null,
  theme_colorset: 'white',
  theme_texture: '',
  theme_material: 'glass',
  gravity_multiplier: 400,
  light_intensity: 0.7,
  baseScale: 100,
  strength: 1,
  iterationLimit: 1000,
  onRollComplete: () => {},
  onRerollComplete: () => {},
  onAddDiceComplete: () => {},
  onRemoveDiceComplete: () => {},
  onEmpty: () => {},
  enableDiceSelection: false,
  onDiceHover: () => {},
  onDiceClick: () => {},
}

class DiceBox {
  assetPath!: string
  framerate!: number
  sounds!: boolean
  volume!: number
  color_spotlight!: number
  shadows!: boolean
  theme_surface!: string
  sound_dieMaterial!: string
  theme_customColorset!: DiceBoxConfig['theme_customColorset']
  theme_colorset!: string
  theme_texture!: string
  theme_material!: string
  gravity_multiplier!: number
  light_intensity!: number
  baseScale!: number
  strength!: number
  iterationLimit!: number
  onRollComplete!: (results: RollResults) => void
  onRerollComplete!: (results: DiceResult[]) => void
  onAddDiceComplete!: (results: DiceResult[]) => void
  onRemoveDiceComplete!: (results: DiceResult[]) => void
  onEmpty!: () => void
  enableDiceSelection!: boolean
  onDiceHover!: (data: DiceEventData | null) => void
  onDiceClick!: (data: DiceEventData) => void

  container: HTMLElement
  dimensions: THREE.Vector2
  scene: THREE.Scene
  world: CANNON.World
  dice_body_material: CANNON.Material
  renderer!: THREE.WebGLRenderer
  camera!: THREE.PerspectiveCamera
  light!: THREE.SpotLight
  light_amb!: THREE.HemisphereLight
  desk!: THREE.Mesh
  surface = ''

  // --- engine state ---
  initialized = false
  private soundsRequested = false
  adaptive_timestep = false
  last_time = 0
  running: number | boolean = false
  rolling = false
  private raycaster?: THREE.Raycaster
  private mouse?: THREE.Vector2
  private hoveredDice: DiceMesh | null = null
  private onMouseMoveBound?: (event: MouseEvent) => void
  private onMouseClickBound?: (event: MouseEvent) => void
  iteration = 0
  steps = 0
  dieIndex = 0
  private static readonly WALLS_GROUP = 1
  private static readonly NON_DET_GROUP = 1 << 1
  private throwGroupCounter = 0
  private currentThrowGroup = 1 << 2
  private static readonly DEFAULT_REMOVAL: ResolvedRemoval = {
    style: 'shrink',
    dwellMs: 1000,
    durationMs: 450,
  }
  soundDelay = 10
  animstate = ''
  lastSoundType = ''
  lastSoundStep = 0
  lastSound = 0
  display: Display
  cameraHeight: CameraHeights
  box_body: Record<string, CANNON.Body>
  diceList: DiceMesh[]
  notationVectors: NotationLike | null
  private throwGroups: ThrowGroup[] = []
  colorData!: ColorData
  sounds_table: Record<string, HTMLAudioElement[]>
  sounds_dice: Record<string, HTMLAudioElement[]>
  selector: {
    animate: boolean
    rotate: boolean
    intersected: unknown
    dice: unknown[]
  }
  DiceColors: DiceColors
  DiceFactory: DiceFactory

  constructor(element_container: string, options: Partial<DiceBoxConfig> = {}) {
    this.container = document.querySelector(element_container) as HTMLElement
    this.dimensions = new THREE.Vector2(
      this.container.clientWidth,
      this.container.clientHeight,
    )

    this.display = {
      currentWidth: 0,
      currentHeight: 0,
      containerWidth: 0,
      containerHeight: 0,
      aspect: 0,
      scale: 0,
    }
    this.cameraHeight = { max: 0, close: 0, medium: 0, far: 0 }

    this.scene = new THREE.Scene()
    this.world = new CANNON.World()
    this.dice_body_material = new CANNON.Material()
    this.sounds_table = {}
    this.sounds_dice = {}
    this.box_body = {}
    this.diceList = []
    this.notationVectors = null
    this.selector = { animate: true, rotate: true, intersected: null, dice: [] }

    Object.assign(this, defaultConfig, options)

    this.DiceColors = new DiceColors({ assetPath: this.assetPath })
    this.DiceFactory = new DiceFactory({ baseScale: this.baseScale })
    this.DiceFactory.setBumpMapping(true)

    this.surface = THEMES[this.theme_surface].surface
  }

  enableShadows() {
    this.shadows = true
    if (this.renderer) this.renderer.shadowMap.enabled = this.shadows
    if (this.light) this.light.castShadow = this.shadows
    if (this.desk) this.desk.receiveShadow = this.shadows
  }

  disableShadows() {
    this.shadows = false
    if (this.renderer) this.renderer.shadowMap.enabled = this.shadows
    if (this.light) this.light.castShadow = this.shadows
    if (this.desk) this.desk.receiveShadow = this.shadows
  }

  async initialize(): Promise<void> {
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch (error) {
      console.error(
        '[dice-engine] Failed to create WebGL renderer.',
        describeWebGLSupport(),
        error,
      )
      throw error
    }
    this.container.appendChild(this.renderer.domElement)
    this.renderer.shadowMap.enabled = this.shadows
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.setClearColor(0x000000, 0)

    this.setDimensions(this.dimensions)

    this.world.gravity.set(0, 0, -9.8 * this.gravity_multiplier)
    this.world.broadphase = new CANNON.NaiveBroadphase()
    ;(this.world.solver as CANNON.GSSolver).iterations = 14
    this.world.allowSleep = true

    this.makeWorldBox()
    this.resizeWorld()

    await this.loadTheme({
      colorset: this.theme_colorset,
      texture: this.theme_texture,
      material: this.theme_material,
    }).catch(error => {
      console.error('[dice-engine] Unable to load theme/textures:', error)
      throw error instanceof Error ? error : new Error('Unable to load theme')
    })

    this.initialized = true
    this.renderer.render(this.scene, this.camera)

    if (this.enableDiceSelection) this.enableSelection()
  }

  private enableSelection(): void {
    if (this.onMouseMoveBound) return
    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()
    this.onMouseMoveBound = (event: MouseEvent) => this.onMouseMove(event)
    this.onMouseClickBound = (event: MouseEvent) => this.onMouseClick(event)
    // Listen on the window, not the container: core mounts the canvas inside a
    // full-viewport `pointer-events:none` overlay, so the element itself never
    // receives pointer events. We hit-test against the dice and only swallow a
    // click when it actually lands on a die (see onMouseClick), which keeps the
    // app UI beneath the overlay fully interactive.
    globalThis.addEventListener('mousemove', this.onMouseMoveBound)
    globalThis.addEventListener('click', this.onMouseClickBound, true)
  }

  private teardownSelection(): void {
    if (this.onMouseMoveBound)
      globalThis.removeEventListener('mousemove', this.onMouseMoveBound)
    if (this.onMouseClickBound)
      globalThis.removeEventListener('click', this.onMouseClickBound, true)
    this.onMouseMoveBound = undefined
    this.onMouseClickBound = undefined
    this.hoveredDice = null
  }

  private ensureSoundsLoaded(): void {
    if (!this.sounds || this.soundsRequested) return
    this.soundsRequested = true
    this.loadSounds().catch(error => {
      console.error('[dice-engine] Failed to load sounds (non-fatal):', error)
    })
  }

  makeWorldBox(): void {
    if (Object.keys(this.box_body).length) {
      this.world.removeBody(this.box_body.desk)
      this.world.removeBody(this.box_body.topWall)
      this.world.removeBody(this.box_body.bottomWall)
      this.world.removeBody(this.box_body.leftWall)
      this.world.removeBody(this.box_body.rightWall)
    }

    const desk_body_material = new CANNON.Material()
    const barrier_body_material = new CANNON.Material()

    this.world.addContactMaterial(
      new CANNON.ContactMaterial(desk_body_material, this.dice_body_material, {
        friction: 0.6,
        restitution: 0.5,
      }),
    )
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(barrier_body_material, this.dice_body_material, {
        friction: 0.6,
        restitution: 1,
      }),
    )
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.dice_body_material, this.dice_body_material, {
        friction: 0.6,
        restitution: 0.5,
      }),
    )

    const { containerWidth, containerHeight } = this.display

    this.box_body.desk = new CANNON.Body({
      allowSleep: false,
      mass: 0,
      shape: new CANNON.Plane(),
      material: desk_body_material,
    })
    this.world.addBody(this.box_body.desk)

    this.box_body.topWall = new CANNON.Body({
      allowSleep: false,
      mass: 0,
      shape: new CANNON.Plane(),
      material: barrier_body_material,
    })
    this.box_body.topWall.quaternion.setFromAxisAngle(
      new CANNON.Vec3(1, 0, 0),
      Math.PI / 2,
    )
    this.box_body.topWall.position.set(0, containerHeight * 0.93, 0)
    this.world.addBody(this.box_body.topWall)

    this.box_body.bottomWall = new CANNON.Body({
      allowSleep: false,
      mass: 0,
      shape: new CANNON.Plane(),
      material: barrier_body_material,
    })
    this.box_body.bottomWall.quaternion.setFromAxisAngle(
      new CANNON.Vec3(1, 0, 0),
      -Math.PI / 2,
    )
    this.box_body.bottomWall.position.set(0, -containerHeight * 0.93, 0)
    this.world.addBody(this.box_body.bottomWall)

    this.box_body.leftWall = new CANNON.Body({
      allowSleep: false,
      mass: 0,
      shape: new CANNON.Plane(),
      material: barrier_body_material,
    })
    this.box_body.leftWall.quaternion.setFromAxisAngle(
      new CANNON.Vec3(0, 1, 0),
      -Math.PI / 2,
    )
    this.box_body.leftWall.position.set(containerWidth * 0.93, 0, 0)
    this.world.addBody(this.box_body.leftWall)

    this.box_body.rightWall = new CANNON.Body({
      allowSleep: false,
      mass: 0,
      shape: new CANNON.Plane(),
      material: barrier_body_material,
    })
    this.box_body.rightWall.quaternion.setFromAxisAngle(
      new CANNON.Vec3(0, 1, 0),
      Math.PI / 2,
    )
    this.box_body.rightWall.position.set(-containerWidth * 0.93, 0, 0)
    this.world.addBody(this.box_body.rightWall)
  }

  async loadTheme(themeConfig: ThemeConfig): Promise<void> {
    const colorData = this.theme_customColorset
      ? await this.DiceColors.makeColorSet(this.theme_customColorset)
      : await this.DiceColors.getColorSet(themeConfig)
    this.DiceFactory.applyColorSet(colorData)
    this.colorData = colorData
  }

  private async applyThemeForThrow(theme?: ThemeOptions): Promise<void> {
    if (!theme) return
    const colorData = theme.theme_customColorset
      ? await this.DiceColors.makeColorSet(theme.theme_customColorset)
      : await this.DiceColors.getColorSet({
          colorset: theme.theme_colorset ?? this.theme_colorset,
          texture: theme.theme_texture ?? this.theme_texture,
          material: theme.theme_material ?? this.theme_material,
        })
    this.DiceFactory.applyColorSet(colorData)
    this.colorData = colorData
  }

  async loadSounds(): Promise<void> {
    const surfaces: Record<string, number> = {
      felt: 7,
      wood_table: 7,
      wood_tray: 7,
      metal: 9,
    }

    const dieMaterials: Record<string, number> = {
      coin: 6,
      metal: 12,
      plastic: 15,
      wood: 12,
    }

    const material = this.colorData.texture.material ?? ''
    this.sound_dieMaterial = /wood|metal/g.test(material) ? material : 'plastic'

    await this.loadSoundGroup(
      this.sounds_table,
      this.surface,
      surfaces[this.surface],
      s => `sounds/surfaces/surface_${this.surface}${s}.mp3`,
    )
    await this.loadSoundGroup(
      this.sounds_dice,
      'coin',
      dieMaterials['coin'],
      s => `sounds/dicehit/dicehit_coin${s}.mp3`,
    )
    await this.loadSoundGroup(
      this.sounds_dice,
      this.sound_dieMaterial,
      dieMaterials[this.sound_dieMaterial],
      s => `sounds/dicehit/dicehit_${this.sound_dieMaterial}${s}.mp3`,
    )
  }

  private async loadSoundGroup(
    store: Record<string, HTMLAudioElement[]>,
    key: string,
    count: number,
    pathFor: (index: number) => string,
  ): Promise<void> {
    if (Object.hasOwn(store, key)) return
    store[key] = []
    for (let s = 1; s <= count; ++s) {
      const clip = await this.loadAudio(this.assetPath + pathFor(s))
      if (clip) store[key].push(clip)
    }
  }

  loadAudio(src: string): Promise<HTMLAudioElement | undefined> {
    return new Promise<HTMLAudioElement | undefined>(resolve => {
      const audio = new Audio()
      audio.crossOrigin = 'anonymous'
      audio.preload = 'auto'
      let settled = false
      let timer!: ReturnType<typeof setTimeout>
      const finish = (value: HTMLAudioElement | undefined) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(value)
      }
      timer = setTimeout(() => {
        console.warn(`[dice-engine] Audio load timed out, skipping: ${src}`)
        finish(undefined)
      }, AUDIO_LOAD_TIMEOUT_MS)
      audio.oncanplaythrough = () => finish(audio)
      audio.onerror = () => {
        console.error(`[dice-engine] Unable to load audio: ${src}`)
        finish(undefined)
      }
      audio.src = src
      audio.load()
    })
  }

  async updateConfig(options: Partial<DiceBoxConfig> = {}): Promise<void> {
    this.theme_customColorset = options.theme_customColorset ?? null
    if (options.theme_colorset) this.theme_colorset = options.theme_colorset
    if (options.theme_texture) this.theme_texture = options.theme_texture
    if (options.theme_material) this.theme_material = options.theme_material
    if (
      options.theme_colorset ||
      options.theme_texture ||
      options.theme_material ||
      options.theme_customColorset
    ) {
      await this.loadTheme({
        colorset: this.theme_colorset,
        texture: this.theme_texture,
        material: this.theme_material,
      })
    }
  }

  setDimensions(dimensions?: Vec2Like): void {
    this.display.currentWidth = this.container.clientWidth / 2
    this.display.currentHeight = this.container.clientHeight / 2
    if (dimensions) {
      this.display.containerWidth = dimensions.x
      this.display.containerHeight = dimensions.y
    } else {
      this.display.containerWidth = this.display.currentWidth
      this.display.containerHeight = this.display.currentHeight
    }
    this.display.aspect = Math.min(
      this.display.currentWidth / this.display.containerWidth,
      this.display.currentHeight / this.display.containerHeight,
    )
    this.display.scale =
      Math.hypot(this.display.containerWidth, this.display.containerHeight) / 13

    this.makeWorldBox()

    this.renderer.setSize(
      this.display.currentWidth * 2,
      this.display.currentHeight * 2,
    )

    this.cameraHeight.max =
      this.display.currentHeight /
      this.display.aspect /
      Math.tan((10 * Math.PI) / 180)
    this.cameraHeight.medium = this.cameraHeight.max / 1.5
    this.cameraHeight.far = this.cameraHeight.max
    this.cameraHeight.close = this.cameraHeight.max / 2

    if (this.camera) this.scene.remove(this.camera)
    this.camera = new THREE.PerspectiveCamera(
      20,
      this.display.currentWidth / this.display.currentHeight,
      1,
      this.cameraHeight.max * 1.3,
    )

    if (this.animstate === 'selector') {
      const count = this.selector.dice.length
      if (count > 9) this.camera.position.z = this.cameraHeight.far
      else if (count < 6) this.camera.position.z = this.cameraHeight.close
      else this.camera.position.z = this.cameraHeight.medium
    } else {
      this.camera.position.z = this.cameraHeight.far
    }

    this.camera.lookAt(new THREE.Vector3(0, 0, 0))

    const maxwidth = Math.max(
      this.display.containerWidth,
      this.display.containerHeight,
    )

    if (this.light) this.scene.remove(this.light)
    if (this.light_amb) this.scene.remove(this.light_amb)
    this.light = new THREE.SpotLight(this.color_spotlight, this.light_intensity)
    this.light.position.set(-maxwidth / 2, maxwidth / 2, maxwidth * 3)
    this.light.target.position.set(0, 0, 0)
    this.light.distance = maxwidth * 5
    this.light.angle = Math.PI / 4
    this.light.castShadow = this.shadows
    this.light.shadow.camera.near = maxwidth / 10
    this.light.shadow.camera.far = maxwidth * 5
    this.light.shadow.camera.fov = 50
    this.light.shadow.bias = 0.001
    this.light.shadow.mapSize.width = 1024
    this.light.shadow.mapSize.height = 1024
    this.scene.add(this.light)

    this.light_amb = new THREE.HemisphereLight(
      0xffffbb,
      0x676771,
      this.light_intensity,
    )
    this.scene.add(this.light_amb)

    if (this.desk) this.scene.remove(this.desk)
    const shadowplane = new THREE.ShadowMaterial()
    shadowplane.opacity = 0.5
    this.desk = new THREE.Mesh(
      new THREE.PlaneGeometry(
        this.display.containerWidth * 6,
        this.display.containerHeight * 6,
        1,
        1,
      ),
      shadowplane,
    )
    this.desk.receiveShadow = this.shadows
    this.scene.add(this.desk)

    this.renderer.render(this.scene, this.camera)
  }

  resizeWorld(): void {
    const resize = () => {
      const canvas = this.renderer.domElement
      const width = this.container.clientWidth
      const height = this.container.clientHeight
      const needResize = canvas.width !== width || canvas.height !== height
      if (needResize) {
        this.setDimensions(
          new THREE.Vector2(
            this.container.clientWidth,
            this.container.clientHeight,
          ),
        )
      }
      return needResize
    }

    let frame: number | undefined
    globalThis.addEventListener('resize', () => {
      if (frame) globalThis.cancelAnimationFrame(frame)
      frame = globalThis.requestAnimationFrame(resize)
    })
  }

  vectorRand({ x, y }: Vec2Like): Vec2Like {
    const angle = (Math.random() * Math.PI) / 5 - Math.PI / 5 / 2
    const vec = {
      x: x * Math.cos(angle) - y * Math.sin(angle),
      y: x * Math.sin(angle) + y * Math.cos(angle),
    }
    if (vec.x === 0) vec.x = 0.01
    if (vec.y === 0) vec.y = 0.01
    return vec
  }

  private throwVectors(
    diceobj: { shape: string; inertia: number },
    vector: Vec2Like,
    dist: number,
    boost: number,
  ): ThrowVectors {
    const vec = this.vectorRand(vector)
    vec.x /= dist
    vec.y /= dist

    const pos: Vec3Like = {
      x: this.display.containerWidth * (vec.x > 0 ? -1 : 1) * 0.9,
      y: this.display.containerHeight * (vec.y > 0 ? -1 : 1) * 0.9,
      z: Math.random() * 200 + 200,
    }

    const projector = Math.abs(vec.x / vec.y)
    if (projector > 1) pos.y /= projector
    else pos.x *= projector

    const velvec = this.vectorRand(vector)
    velvec.x /= dist
    velvec.y /= dist

    if (diceobj.shape !== 'd2') {
      return {
        pos,
        velocity: { x: velvec.x * boost, y: velvec.y * boost, z: -10 },
        angle: {
          x: -(Math.random() * vec.y * 5 + diceobj.inertia * vec.y),
          y: Math.random() * vec.x * 5 + diceobj.inertia * vec.x,
          z: 0,
        },
        axis: {
          x: Math.random(),
          y: Math.random(),
          z: Math.random(),
          a: Math.random(),
        },
      }
    }

    // coin flip (d2)
    return {
      pos,
      velocity: { x: (velvec.x * boost) / 10, y: (velvec.y * boost) / 10, z: 3000 },
      angle: { x: 12 * diceobj.inertia, y: 1 * diceobj.inertia, z: 0 },
      axis: { x: 1, y: 1, z: Math.random(), a: Math.random() },
    }
  }

  getNotationVectors(
    notation: unknown,
    vector: Vec2Like,
    boost: number,
    dist: number,
  ): NotationLike {
    const notationVectors = new DiceNotation(notation)

    for (const i in notationVectors.set) {
      const set = notationVectors.set[i]
      const diceobj = this.DiceFactory.get(set.type)

      for (let k = 0; k < set.num; k++) {
        const { pos, velocity, angle, axis } = this.throwVectors(
          diceobj,
          vector,
          dist,
          boost,
        )
        notationVectors.vectors.push({
          index: this.dieIndex++,
          type: diceobj.type,
          op: set.op,
          sid: set.sid,
          gid: set.gid,
          glvl: set.glvl,
          func: set.func,
          args: set.args,
          pos,
          velocity,
          angle,
          axis,
        })
      }
    }

    return notationVectors as unknown as NotationLike
  }

  private normalizeDieValue(type: string, value: number): number {
    if (type === 'd10' && value === 0) return 10
    if (type === 'd100' && value === 0) return 100
    if (type === 'd100' && value > 0 && value < 10) return value * 10
    return value
  }

  swapDiceFace(dicemesh: DiceMesh, result: number | string): void {
    const diceobj = this.DiceFactory.get(dicemesh.notation.type)

    dicemesh.resultReason = 'forced'

    if (diceobj.shape === 'd4') {
      this.swapDiceFace_D4(dicemesh, result)
      return
    }

    const type = dicemesh.notation.type
    const value = this.normalizeDieValue(
      type,
      Number.parseInt(`${dicemesh.getLastValue().value}`),
    )
    const target = this.normalizeDieValue(type, Number.parseInt(`${result}`))

    const valueindex = diceobj.values.indexOf(value)
    const resultindex = diceobj.values.indexOf(target)

    if (valueindex < 0 || resultindex < 0) return
    if (valueindex === resultindex) return

    const geom = dicemesh.geometry.clone()

    const magic = diceobj.shape === 'd10' ? 1 : 2
    const material_value = diceobj.shape === 'd2' ? valueindex + 1 : valueindex + magic
    const material_result =
      diceobj.shape === 'd2' ? resultindex + 1 : resultindex + magic

    const geomindex_value: number[] = []
    const geomindex_result: number[] = []
    for (let i = 0, l = geom.groups.length; i < l; ++i) {
      const matindex = geom.groups[i].materialIndex
      if (matindex === material_value) geomindex_value.push(i)
      else if (matindex === material_result) geomindex_result.push(i)
    }

    if (geomindex_value.length <= 0 || geomindex_result.length <= 0) return

    for (const i of geomindex_result) geom.groups[i].materialIndex = material_value
    for (const i of geomindex_value) geom.groups[i].materialIndex = material_result

    dicemesh.geometry = geom
    dicemesh.result = []
  }

  swapDiceFace_D4(dicemesh: DiceMesh, result: number | string): void {
    const diceobj = this.DiceFactory.get(dicemesh.notation.type)
    const value = Number.parseInt(`${dicemesh.getLastValue().value}`)
    const resultValue = Number.parseInt(`${result}`)

    if (!(value >= 1 && value <= 4)) return

    let num = resultValue - value
    const geom = dicemesh.geometry.clone()

    for (let i = 0, l = geom.groups.length; i < l; ++i) {
      const face = geom.groups[i]
      let matindex = face.materialIndex
      if (matindex === undefined || matindex === 0) continue

      matindex += num - 1
      while (matindex > 4) matindex -= 4
      while (matindex < 1) matindex += 4

      face.materialIndex = matindex + 1
    }
    if (num !== 0) {
      if (num < 0) num += 4
      dicemesh.material = this.DiceFactory.createMaterials(diceobj, 0, 0, false, num)
    }

    dicemesh.geometry = geom
  }

  private applyForcedResults(notation: NotationLike, baseIndex: number): void {
    if (!notation.result || notation.result.length === 0) return
    for (let i = 0; i < notation.result.length; i++) {
      const dicemesh = this.diceList[baseIndex + i]
      if (!dicemesh) continue
      if (`${dicemesh.getLastValue().value}` === `${notation.result[i]}`) continue
      this.swapDiceFace(dicemesh, notation.result[i])
    }
  }

  private isDeterministic(notation: NotationLike): boolean {
    return (notation.result?.length ?? 0) > 0
  }

  private setThrowGroup(deterministic: boolean): void {
    if (!deterministic) {
      this.currentThrowGroup = DiceBox.NON_DET_GROUP
      return
    }
    this.throwGroupCounter = (this.throwGroupCounter + 1) % 29
    this.currentThrowGroup = 1 << (this.throwGroupCounter + 2)
  }

  spawnDice(vectordata: VectorData, reset: DiceMesh | false = false): void {
    const { pos, axis, angle, velocity } = vectordata
    let dicemesh: DiceMesh

    if (reset) {
      dicemesh = reset
      dicemesh.stopped = 0
      this.world.removeBody(dicemesh.body)
    } else {
      const created: DiceMesh | null = this.DiceFactory.create(vectordata.type)
      if (!created) return
      dicemesh = created
      dicemesh.notation = vectordata
      dicemesh.result = []
      dicemesh.stopped = 0
      dicemesh.castShadow = this.shadows
      this.scene.add(dicemesh)
      this.diceList.push(dicemesh)
    }

    dicemesh.body = new CANNON.Body({
      allowSleep: true,
      sleepSpeedLimit: 75,
      sleepTimeLimit: 0.9,
      mass: dicemesh.mass,
      shape: dicemesh.geometry.cannon_shape,
      material: this.dice_body_material,
      collisionFilterGroup: this.currentThrowGroup,
      collisionFilterMask: DiceBox.WALLS_GROUP | this.currentThrowGroup,
    })
    dicemesh.body.type = CANNON.Body.DYNAMIC
    dicemesh.body.position.set(pos.x, pos.y, pos.z)
    dicemesh.body.quaternion.setFromAxisAngle(
      new CANNON.Vec3(axis.x, axis.y, axis.z),
      axis.a * Math.PI * 2,
    )
    dicemesh.body.angularVelocity.set(angle.x, angle.y, angle.z)
    dicemesh.body.velocity.set(velocity.x, velocity.y, velocity.z)
    dicemesh.body.linearDamping = 0.1
    dicemesh.body.angularDamping = 0.1
    dicemesh.body.diceShape = dicemesh.shape
    dicemesh.body.sleepState = 0

    dicemesh.body.addEventListener('collide', this.eventCollide.bind(this))

    this.world.addBody(dicemesh.body)
  }

  eventCollide({ body, target }: { body: DiceBody; target: DiceBody }): void {
    if (this.animstate === 'simulate' || !this.sounds || this.volume <= 0) return

    const now = Date.now()
    const stepnumber = body.world?.stepnumber ?? 0
    const currentSoundType = body.mass > 0 ? 'dice' : 'table'
    const tooSoon = this.lastSoundStep === stepnumber || this.lastSound > now

    if (tooSoon && currentSoundType !== 'dice') return
    if (tooSoon && currentSoundType === 'dice' && this.lastSoundType === 'dice') {
      return
    }

    if (body.mass > 0) {
      this.playCollisionSound(body.velocity.length(), this.diceClip(body))
      this.lastSoundType = 'dice'
    } else {
      const list = this.sounds_table[this.surface]
      this.playCollisionSound(target.velocity.length(), this.randomClip(list))
      this.lastSoundType = 'table'
    }

    this.lastSoundStep = stepnumber
    this.lastSound = now + this.soundDelay
  }

  private diceClip(body: { diceShape?: string }): HTMLAudioElement | undefined {
    const list =
      body.diceShape === 'd2'
        ? this.sounds_dice['coin']
        : this.sounds_dice[this.sound_dieMaterial]
    return this.randomClip(list)
  }

  private randomClip(list?: HTMLAudioElement[]): HTMLAudioElement | undefined {
    if (!list || list.length === 0) return undefined
    return list[Math.floor(Math.random() * list.length)]
  }

  private playCollisionSound(speed: number, sound?: HTMLAudioElement): void {
    // don't bother playing at low speeds
    if (speed < 250 || !sound) return
    sound.volume = Math.min(speed / 8000, this.volume / 100)
    sound.play().catch(() => {})
  }

  checkForRethrow(_dicemesh: DiceMesh): boolean {
    return false
  }

  private resolveDie(
    dicemesh: DiceMesh,
    forcedFinish: boolean,
  ): 'awake' | 'rethrow' | 'settled' {
    const sleepState = CANNON.Body.SLEEPING

    if (dicemesh.body.sleepState < sleepState && !forcedFinish) return 'awake'
    if (dicemesh.body.type === CANNON.Body.KINEMATIC) return 'settled'

    let rethrow = false
    if (dicemesh.result.length === 0) {
      dicemesh.storeRolledValue(dicemesh.resultReason)
      rethrow = this.checkForRethrow(dicemesh)
    } else if (dicemesh.rerolling) {
      dicemesh.rerolling = false
      dicemesh.storeRolledValue('reroll')
      rethrow = this.checkForRethrow(dicemesh)
    }

    if (rethrow) {
      dicemesh.rerolls += 1
      dicemesh.rerolling = true
      dicemesh.body.wakeUp()
      dicemesh.body.type = CANNON.Body.DYNAMIC
      dicemesh.body.angularVelocity = new CANNON.Vec3(25, 25, 25)
      dicemesh.body.velocity = new CANNON.Vec3(0, 0, 3000)
      return 'rethrow'
    }

    dicemesh.rerolling = false
    dicemesh.body.type = CANNON.Body.KINEMATIC
    return 'settled'
  }

  private scheduleFrame(timeDiff: number, run: () => void): void {
    if (!this.adaptive_timestep && timeDiff < this.framerate) {
      setTimeout(
        () => requestAnimationFrame(run),
        (this.framerate - timeDiff) * 1000,
      )
    } else {
      requestAnimationFrame(run)
    }
  }

  animateThrow(threadid: number): void {
    this.animstate = 'throw'
    const time = Date.now()
    this.last_time = this.last_time || time - this.framerate * 1000
    const time_diff = (time - this.last_time) / 1000
    ++this.iteration
    const neededSteps = Math.floor(time_diff / this.framerate)

    for (let i = 0; i < neededSteps; i++) {
      this.world.step(this.framerate)
      ++this.steps
    }

    for (const die of this.diceList) {
      const { position, quaternion } = die.body
      die.position.set(position.x, position.y, position.z)
      die.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w)
    }

    this.last_time = this.last_time + neededSteps * this.framerate * 1000

    if (this.running === threadid) this.serviceGroups(time)

    this.renderer.render(this.scene, this.camera)

    if (this.running !== threadid) return

    if (this.throwGroups.length === 0) {
      this.running = false
      this.rolling = false
      this.animstate = 'afterthrow'
      this.onEmpty()
      this.renderer.render(this.scene, this.camera)
      return
    }

    this.scheduleFrame(time_diff, () => this.animateThrow(threadid))
  }

  private serviceGroups(now: number): void {
    const forcedFinish = this.iteration > this.iterationLimit
    this.throwGroups = this.throwGroups.filter(group =>
      this.serviceGroup(group, now, forcedFinish),
    )
  }

  private serviceGroup(
    group: ThrowGroup,
    now: number,
    forcedFinish: boolean,
  ): boolean {
    if (group.settledAt === null) {
      if (!this.groupSettled(group, forcedFinish)) return true
      group.settledAt = now
      if (!group.resolved) {
        group.resolved = true
        group.resolve()
      }
    }

    if (!group.exiting && now - group.settledAt >= group.removal.dwellMs) {
      group.exiting = true
      group.exitStart = now
      for (const die of group.dice) die.body.collisionResponse = false
    }

    if (!group.exiting) return true

    const progress = Math.min((now - group.exitStart) / group.removal.durationMs, 1)
    this.applyExit(group.dice, group.removal.style, progress)
    if (progress < 1) return true

    for (const die of group.dice) this.removeDie(die)
    return false
  }

  private groupSettled(group: ThrowGroup, forcedFinish: boolean): boolean {
    for (const die of group.dice) {
      if (this.resolveDie(die, forcedFinish) !== 'settled') return false
    }
    return true
  }

  private ensureAnimating(): void {
    if (this.running !== false) return
    this.animstate = 'throw'
    this.rolling = true
    this.last_time = 0
    this.running = Date.now()
    this.animateThrow(this.running as number)
  }

  startClickThrow(notation: unknown): NotationLike {
    const vector = {
      x: (Math.random() * 2 - 0.5) * this.display.currentWidth,
      y: -(Math.random() * 2 - 0.5) * this.display.currentHeight,
    }
    const dist = Math.hypot(vector.x, vector.y) + 100
    const boost = (Math.random() + 3) * dist * this.strength

    return this.getNotationVectors(notation, vector, boost, dist)
  }

  clearDice(): void {
    this.running = false
    this.cancelGroups()
    let dice: DiceMesh | undefined
    while ((dice = this.diceList.pop())) {
      this.scene.remove(dice)
      if (dice.body) this.world.removeBody(dice.body)
    }
    this.renderer.render(this.scene, this.camera)

    setTimeout(() => {
      this.renderer.render(this.scene, this.camera)
    }, 100)
  }

  private resolveRemoval(removal?: RemovalOptions): ResolvedRemoval {
    const d = DiceBox.DEFAULT_REMOVAL
    return {
      style: removal?.style ?? d.style,
      dwellMs: removal?.dwellMs ?? d.dwellMs,
      durationMs: removal?.durationMs ?? d.durationMs,
    }
  }

  private applyExit(
    dice: DiceMesh[],
    style: ResolvedRemoval['style'],
    progress: number,
  ): void {
    if (style === 'fade') {
      const opacity = Math.max(1 - progress, 0)
      for (const die of dice) {
        for (const mat of die.material) mat.opacity = opacity
      }
    } else {
      const scale = Math.max(1 - progress, 0.0001)
      for (const die of dice) die.scale.setScalar(scale)
    }
  }

  private removeDie(die: DiceMesh): void {
    const index = this.diceList.indexOf(die)
    if (index !== -1) this.diceList.splice(index, 1)
    this.scene.remove(die)
    if (die.body) this.world.removeBody(die.body)
  }

  private cancelGroups(): void {
    for (const group of this.throwGroups) {
      for (const die of group.dice) {
        if (!this.diceList.includes(die)) continue
        die.scale.setScalar(1)
        for (const mat of die.material) mat.opacity = 1
        die.body.collisionResponse = true
      }
      if (!group.resolved) {
        group.resolved = true
        group.resolve()
      }
    }
    this.throwGroups = []
  }

  private dieResult(die: DiceMesh, id: number): DiceResult {
    const last = die.result.at(-1)!
    return {
      type: die.shape,
      sides: Number.parseInt(die.shape.substring(1)),
      id,
      dieId: die.notation.index,
      value: last.value,
      label: last.label,
      reason: last.reason,
    }
  }

  private buildDiceEventData(die: DiceMesh): DiceEventData {
    const result = this.dieResult(die, this.diceList.indexOf(die))
    const { x, y, z } = die.position
    return {
      ...result,
      position: { x, y, z },
      screenPosition: this.getScreenPosition(die.position),
      scale: die.scale.x,
    }
  }

  private getScreenPosition(position: THREE.Vector3): Vec2Like {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const projected = position.clone().project(this.camera)
    return {
      x: (projected.x * 0.5 + 0.5) * rect.width,
      y: (-projected.y * 0.5 + 0.5) * rect.height,
    }
  }

  private dispatchDiceEvent(
    name: 'diceHover' | 'diceClick',
    detail: DiceEventData | null,
  ): void {
    document.dispatchEvent(new CustomEvent(name, { detail }))
  }

  private isSelectableDie(die: DiceMesh): boolean {
    // Selectable once the die has come to rest with a stored result and is not
    // mid-reroll. Per-throw removal keeps the animation loop (and `rolling`)
    // alive through the dwell, so we gate on the die's own state, not `rolling`.
    return (
      this.diceList.includes(die) && die.result.length > 0 && !die.rerolling
    )
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.enableDiceSelection || this.diceList.length === 0) return
    const { raycaster, mouse } = this
    if (!raycaster || !mouse) return

    const rect = this.renderer.domElement.getBoundingClientRect()
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(mouse, this.camera)

    const hit = raycaster
      .intersectObjects(this.diceList)
      .map(intersection => intersection.object as DiceMesh)
      .find(die => this.isSelectableDie(die))

    if (hit) {
      if (this.hoveredDice !== hit) {
        this.hoveredDice = hit
        const data = this.buildDiceEventData(hit)
        this.onDiceHover(data)
        this.dispatchDiceEvent('diceHover', data)
      }
    } else if (this.hoveredDice) {
      this.hoveredDice = null
      this.onDiceHover(null)
      this.dispatchDiceEvent('diceHover', null)
    }
  }

  private onMouseClick(event: MouseEvent): void {
    if (
      !this.enableDiceSelection ||
      !this.hoveredDice ||
      !this.isSelectableDie(this.hoveredDice)
    )
      return
    // Only consume the click when it actually lands on a die; otherwise it falls
    // through to whatever app UI sits beneath the overlay.
    event.preventDefault()
    event.stopPropagation()
    const data = this.buildDiceEventData(this.hoveredDice)
    this.onDiceClick(data)
    this.dispatchDiceEvent('diceClick', data)
  }

  getDiceResults(): RollResults
  getDiceResults(id: number): DiceResult
  getDiceResults(id?: number): RollResults | DiceResult {
    if (id !== undefined) {
      return this.dieResult(this.diceList[id], id)
    }

    const notation = this.notationVectors!
    const modifier = notation.constant
      ? Number.parseInt(`${notation.op}${notation.constant}`)
      : 0
    let counter = 0
    let rollTotal = modifier

    const sets: ResultSet[] = notation.set.map(set => {
      const endCount = counter + set.num - 1
      let setTotal = 0
      const rolls: DiceResult[] = []
      for (let index = counter; index <= endCount; index++) {
        const last = this.diceList[counter].result.at(-1)!
        if (last.reason === 'remove') {
          counter++
          continue
        }
        rolls.push({
          type: set.type,
          sides: Number.parseInt(set.type.substring(1)),
          id: counter,
          dieId: this.diceList[counter].notation.index,
          value: last.value,
          label: last.label,
          reason: last.reason,
        })
        setTotal += last.value
        counter++
      }
      rollTotal += setTotal
      return {
        num: set.num,
        type: set.type,
        sides: Number.parseInt(set.type.substring(1)),
        rolls,
        total: setTotal,
      }
    })

    return { notation: notation.notation, sets, modifier, total: rollTotal }
  }

  async roll(
    notationString: unknown,
    options: RollOptions = {},
  ): Promise<ThrowResult> {
    return this.add(notationString, options)
  }

  async add(
    notationString: unknown,
    options: RollOptions = {},
  ): Promise<ThrowResult> {
    const { theme, removal, onSpawned } = options
    this.ensureSoundsLoaded()
    const removalSpec = this.resolveRemoval(removal)
    await this.applyThemeForThrow(theme)

    const existing = this.diceList.length

    const throwNotation = this.startClickThrow(notationString)
    if (
      !throwNotation ||
      throwNotation.error ||
      throwNotation.vectors.length === 0
    ) {
      if (!existing) this.notationVectors = throwNotation ?? null
      onSpawned?.()
      return undefined
    }

    const deterministic = this.isDeterministic(throwNotation)
    this.setThrowGroup(deterministic)
    for (const vectordata of throwNotation.vectors) this.spawnDice(vectordata)
    const groupDice = this.diceList.slice(existing)

    if (deterministic) {
      this.simulateAddedDice(existing)
      this.steps = 0
      this.iteration = 0
      throwNotation.vectors.forEach((vectordata, i) => {
        const die = this.diceList[existing + i]
        if (die) this.spawnDice(vectordata, die)
      })
      this.applyForcedResults(throwNotation, existing)
      for (const die of groupDice) die.body?.wakeUp()
    } else {
      this.steps = 0
      this.iteration = 0
    }

    const isFresh = existing === 0
    this.notationVectors = isFresh
      ? throwNotation
      : DiceNotation.mergeNotation(this.notationVectors, throwNotation)

    return new Promise<ThrowResult>(resolve => {
      this.throwGroups.push(
        this.makeGroup(groupDice, removalSpec, () =>
          resolve(this.reportThrow(groupDice, isFresh)),
        ),
      )
      this.ensureAnimating()
      onSpawned?.()
    })
  }

  async reroll(
    diceIdArray: number[],
    options: { removal?: RemovalOptions } = {},
  ): Promise<DiceResult[]> {
    this.iteration = 0
    this.last_time = 0
    const dice = diceIdArray
      .map(id => this.diceList[id])
      .filter((die): die is DiceMesh => Boolean(die))
    if (dice.length === 0) return []
    // Hand these dice to a fresh group: pull them out of whatever group is
    // counting down to removal and undo any in-progress exit, so the new throw
    // alone governs their lifecycle (otherwise the old group still removes them).
    this.detachFromGroups(dice)
    for (const die of dice) {
      die.scale.setScalar(1)
      for (const mat of die.material) mat.opacity = 1
      die.rerolls += 1
      die.rerolling = true
      die.body.collisionResponse = true
      die.body.wakeUp()
      die.body.type = CANNON.Body.DYNAMIC
      die.body.angularVelocity = new CANNON.Vec3(25, 25, 25)
      die.body.velocity = new CANNON.Vec3(0, 0, 3000)
    }
    return new Promise<DiceResult[]>(resolve => {
      this.throwGroups.push(
        this.makeGroup(dice, this.resolveRemoval(options.removal), () => {
          const results = dice.map(die =>
            this.dieResult(die, this.diceList.indexOf(die)),
          )
          this.onRerollComplete(results)
          document.dispatchEvent(
            new CustomEvent('rerollComplete', { detail: results }),
          )
          resolve(results)
        }),
      )
      this.ensureAnimating()
    })
  }

  private detachFromGroups(dice: DiceMesh[]): void {
    const detaching = new Set(dice)
    this.throwGroups = this.throwGroups.filter(group => {
      group.dice = group.dice.filter(die => !detaching.has(die))
      if (group.dice.length > 0) return true
      // Drop a now-empty group, but settle its promise if it never resolved.
      if (!group.resolved) {
        group.resolved = true
        group.resolve()
      }
      return false
    })
  }

  private makeGroup(
    dice: DiceMesh[],
    removal: ResolvedRemoval,
    resolve: () => void,
  ): ThrowGroup {
    return {
      dice,
      resolve,
      resolved: false,
      removal,
      settledAt: null,
      exiting: false,
      exitStart: 0,
    }
  }

  private reportThrow(dice: DiceMesh[], isFresh: boolean): ThrowResult {
    const results = dice.map(die =>
      this.dieResult(die, this.diceList.indexOf(die)),
    )
    this.onAddDiceComplete(results)
    document.dispatchEvent(
      new CustomEvent('addDiceComplete', { detail: results }),
    )
    if (isFresh) this.announceRollComplete()
    return results
  }

  private announceRollComplete(): void {
    try {
      const results = this.getDiceResults()
      this.onRollComplete(results)
      document.dispatchEvent(
        new CustomEvent('rollComplete', { detail: results }),
      )
    } catch {}
  }

  private simulateAddedDice(startIndex: number): void {
    const frozen = this.diceList.slice(0, startIndex).map(die => ({
      die,
      type: die.body.type,
      position: die.body.position.clone(),
      quaternion: die.body.quaternion.clone(),
      velocity: die.body.velocity.clone(),
      angularVelocity: die.body.angularVelocity.clone(),
      sleepState: die.body.sleepState,
    }))

    for (const { die } of frozen) {
      die.body.type = CANNON.Body.KINEMATIC
      die.body.velocity.setZero()
      die.body.angularVelocity.setZero()
    }

    this.animstate = 'simulate'
    this.iteration = 0
    while (!this.addedDiceSettled(startIndex)) {
      ++this.iteration
      this.world.step(this.framerate)
    }

    for (const f of frozen) {
      f.die.body.type = f.type
      f.die.body.position.copy(f.position)
      f.die.body.quaternion.copy(f.quaternion)
      f.die.body.velocity.copy(f.velocity)
      f.die.body.angularVelocity.copy(f.angularVelocity)
      f.die.body.sleepState = f.sleepState
    }
  }

  private addedDiceSettled(startIndex: number): boolean {
    const forcedFinish = this.iteration > this.iterationLimit
    for (let i = startIndex; i < this.diceList.length; i++) {
      if (this.resolveDie(this.diceList[i], forcedFinish) !== 'settled') return false
    }
    return true
  }

  async remove(diceIdArray: number[]): Promise<DiceResult[]> {
    return new Promise<DiceResult[]>(resolve => {
      const results: DiceResult[] = []
      for (const dieId of diceIdArray) {
        const mesh = this.diceList[dieId]
        if (mesh.body) this.world.removeBody(mesh.body)
        this.scene.remove(mesh)
        mesh.storeRolledValue('remove')
        results.push(this.getDiceResults(dieId))
      }

      this.renderer.render(this.scene, this.camera)
      this.onRemoveDiceComplete(results)
      document.dispatchEvent(
        new CustomEvent('removeDiceComplete', { detail: results }),
      )
      resolve(results)
    })
  }

}

export { DiceBox }
