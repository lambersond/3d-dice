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

/**
 * One throw's lifecycle, tracked independently of every other throw on the
 * table. A throw resolves the moment ITS OWN dice come to rest (not when the
 * whole world rests), then — a fixed dwell later — its dice play their exit and
 * leave, even while other throws are still tumbling or new ones are spawning.
 */
type ThrowGroup = {
  dice: DiceMesh[]
  /** Fires once this throw's dice rest (reads their values, resolves the promise). */
  resolve: () => void
  resolved: boolean
  removal: ResolvedRemoval
  /** Timestamp the whole group came to rest, or null while still tumbling. */
  settledAt: number | null
  exiting: boolean
  exitStart: number
}

/** What a throw's promise resolves to (best-effort; the app reads its own values). */
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
}

class DiceBox {
  // --- configuration (merged from defaultConfig + constructor options) ---
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

  // --- three.js / cannon-es scene (built in the constructor / initialize) ---
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
  adaptive_timestep = false
  last_time = 0
  running: number | boolean = false
  rolling = false
  iteration = 0
  steps = 0
  dieIndex = 0
  // Collision groups isolate concurrent throws so they can't corrupt each
  // other's predetermined landings. A die collides with the table/walls
  // (WALLS_GROUP, bit 0) plus its own throw's group. Deterministic throws each
  // get a private bit (2..30); every NON-deterministic throw shares one group
  // (NON_DET_GROUP, bit 1) so those dice DO collide with each other — they have
  // no predetermined landing to protect — but never with deterministic dice.
  private static readonly WALLS_GROUP = 1
  private static readonly NON_DET_GROUP = 1 << 1
  private throwGroupCounter = 0
  private currentThrowGroup = 1 << 2
  // Default removal: shrink to nothing 1s after the dice rest, over 450ms —
  // the behaviour core's DiceRenderer used to hardcode before the engine owned
  // it. A throw can override any of these via roll/add's `removal` option.
  private static readonly DEFAULT_REMOVAL: ResolvedRemoval = {
    style: 'shrink',
    dwellMs: 1000,
    durationMs: 450,
  }
  soundDelay = 10 // time between sound effects in ms
  animstate = ''
  lastSoundType = ''
  lastSoundStep = 0
  lastSound = 0
  display: Display
  cameraHeight: CameraHeights
  box_body: Record<string, CANNON.Body>
  diceList: DiceMesh[]
  notationVectors: NotationLike | null
  // Every in-flight throw. One continuous loop services them all, but each
  // resolves + removes on its OWN schedule (when its dice rest), so throws
  // never wait for the whole table — dice leave even as new ones are added.
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

    // merge defaults + any options coming in
    Object.assign(this, defaultConfig, options)

    this.DiceColors = new DiceColors({ assetPath: this.assetPath })
    this.DiceFactory = new DiceFactory({ baseScale: this.baseScale })
    this.DiceFactory.setBumpMapping(true)

    // post-config settings
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
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.container.appendChild(this.renderer.domElement)
    this.renderer.shadowMap.enabled = this.shadows
    // three r0.184 removed PCFSoftShadowMap (it now falls back to PCFShadowMap
    // and warns); use PCFShadowMap directly. Soft shadows would now come from
    // the light's shadow.radius/blurSamples rather than the shadow-map type.
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
    }).catch(() => {
      throw new Error('Unable to load theme')
    })

    if (this.sounds) {
      await this.loadSounds().catch(() => {
        throw new Error('Unable to load sounds')
      })
    }

    this.initialized = true
    this.renderer.render(this.scene, this.camera)
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

  /**
   * Applies a per-throw theme to the factory just before a throw spawns its
   * dice. Because each die bakes its materials at creation, binding the colour
   * to the throw (rather than via a separate global `updateConfig`) lets a
   * coalesced burst keep every roller's colours. Omitted fields fall back to the
   * box's configured theme; passing no theme leaves the current colorset as-is.
   */
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

    // dice-hit clip counts per material (others fall back to plastic)
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
    // load the coin sounds for all sets
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
    return new Promise<HTMLAudioElement>((resolve, reject) => {
      const audio = new Audio()
      audio.oncanplaythrough = () => resolve(audio)
      audio.crossOrigin = 'anonymous'
      audio.src = src
      audio.onerror = () => reject(new Error(`Unable to load audio: ${src}`))
    }).catch(() => {
      console.error('Unable to load audio')
      return undefined
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

    // Coalesce a burst of resize events into one update per animation frame.
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

  /** Computes one die's launch position + velocity/spin from a base vector. */
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

  /** Returns a parsed notation populated with per-die throw vectors. */
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

  /** Normalises a d10/d100 face reading into its scored value (0 → 10/100). */
  private normalizeDieValue(type: string, value: number): number {
    if (type === 'd10' && value === 0) return 10
    if (type === 'd100' && value === 0) return 100
    if (type === 'd100' && value > 0 && value < 10) return value * 10
    return value
  }

  // swaps dice faces to match the desired (predetermined) result
  swapDiceFace(dicemesh: DiceMesh, result: number | string): void {
    const diceobj = this.DiceFactory.get(dicemesh.notation.type)

    // flag this result as forced
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

    // clone the geom before modifying it
    const geom = dicemesh.geometry.clone()

    // the mesh's materials start at index 2, except on d10 meshes (1)
    const magic = diceobj.shape === 'd10' ? 1 : 2
    // d2 meshes have many more faces and offset differently
    const material_value = diceobj.shape === 'd2' ? valueindex + 1 : valueindex + magic
    const material_result =
      diceobj.shape === 'd2' ? resultindex + 1 : resultindex + magic

    // find the faces that use the matching material index for value/result
    const geomindex_value: number[] = []
    const geomindex_result: number[] = []
    for (let i = 0, l = geom.groups.length; i < l; ++i) {
      const matindex = geom.groups[i].materialIndex
      if (matindex === material_value) geomindex_value.push(i)
      else if (matindex === material_result) geomindex_result.push(i)
    }

    if (geomindex_value.length <= 0 || geomindex_result.length <= 0) return

    // swap the materials
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

  /** Forces the predetermined faces for a throw, fixing dice that missed. */
  private applyForcedResults(notation: NotationLike, baseIndex: number): void {
    if (!notation.result || notation.result.length === 0) return
    for (let i = 0; i < notation.result.length; i++) {
      const dicemesh = this.diceList[baseIndex + i]
      if (!dicemesh) continue
      if (`${dicemesh.getLastValue().value}` === `${notation.result[i]}`) continue
      this.swapDiceFace(dicemesh, notation.result[i])
    }
  }

  /** Whether a throw lands on predetermined values (has forced `@` results). */
  private isDeterministic(notation: NotationLike): boolean {
    return (notation.result?.length ?? 0) > 0
  }

  /**
   * Selects the collision group for the throw about to spawn: a fresh private
   * bit (2..30) for a deterministic throw so it can't be disturbed, or the
   * shared non-deterministic group so those dice interact with each other.
   */
  private setThrowGroup(deterministic: boolean): void {
    if (!deterministic) {
      this.currentThrowGroup = DiceBox.NON_DET_GROUP
      return
    }
    // deterministic throws cycle bits 2..30 (bit 0 = walls, bit 1 = non-det)
    this.throwGroupCounter = (this.throwGroupCounter + 1) % 29
    this.currentThrowGroup = 1 << (this.throwGroupCounter + 2)
  }

  // spawns one dicemesh from a single vectordata object
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
    // collision events fire for both bodies; the checks below limit how often
    // sounds play. Skip entirely while pre-simulating.
    if (this.animstate === 'simulate' || !this.sounds || this.volume <= 0) return

    const now = Date.now()
    const stepnumber = body.world?.stepnumber ?? 0
    const currentSoundType = body.mass > 0 ? 'dice' : 'table'
    const tooSoon = this.lastSoundStep === stepnumber || this.lastSound > now

    // a dice clack should never be skipped in favour of a table sound, and two
    // dice clacks shouldn't stack within the same step
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
    // Roll-functions (e.g. "{r,2}" = reroll all 2s) are not implemented in this
    // engine yet, so dice never re-throw on their own.
    return false
  }

  /** Resolves one die during settling: still moving, re-thrown, or at rest. */
  private resolveDie(
    dicemesh: DiceMesh,
    forcedFinish: boolean,
  ): 'awake' | 'rethrow' | 'settled' {
    const sleepState = CANNON.Body.SLEEPING

    if (dicemesh.body.sleepState < sleepState && !forcedFinish) return 'awake'
    if (dicemesh.body.type === CANNON.Body.KINEMATIC) return 'settled'

    // record the resting value (or, for a reroll in progress, the new value)
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

  /** Schedules the next animation frame, honouring the target framerate. */
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

    // update physics interactions visually
    for (const die of this.diceList) {
      const { position, quaternion } = die.body
      die.position.set(position.x, position.y, position.z)
      die.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w)
    }

    this.last_time = this.last_time + neededSteps * this.framerate * 1000

    // advance each throw on its own schedule: resolve it when ITS dice rest,
    // then dwell → exit → remove, independent of every other throw
    if (this.running === threadid) this.serviceGroups(time)

    this.renderer.render(this.scene, this.camera)

    if (this.running !== threadid) return

    // the loop lives while any throw is still tumbling, dwelling, or exiting;
    // once the table has fully drained, settle to idle and signal empty
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

  /**
   * Advances every in-flight throw by one frame: resolve a throw the moment its
   * own dice rest, start its dwell → exit independently, and drop it once its
   * dice have left. Throws never wait on one another.
   */
  private serviceGroups(now: number): void {
    const forcedFinish = this.iteration > this.iterationLimit
    this.throwGroups = this.throwGroups.filter(group =>
      this.serviceGroup(group, now, forcedFinish),
    )
  }

  /** Advances one throw a frame; returns false once it has fully left. */
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
      // a leaving throw shouldn't block dice still being thrown in
      for (const die of group.dice) die.body.collisionResponse = false
    }

    if (!group.exiting) return true

    const progress = Math.min((now - group.exitStart) / group.removal.durationMs, 1)
    this.applyExit(group.dice, group.removal.style, progress)
    if (progress < 1) return true

    for (const die of group.dice) this.removeDie(die)
    return false
  }

  /** Whether every die in one throw has come to rest (per-throw `throwFinished`). */
  private groupSettled(group: ThrowGroup, forcedFinish: boolean): boolean {
    for (const die of group.dice) {
      if (this.resolveDie(die, forcedFinish) !== 'settled') return false
    }
    return true
  }

  /**
   * Starts the animation loop if one isn't already running. A running loop
   * already services every throw, so a mid-flight add() just spawns its dice +
   * pushes its group and the loop picks it up — no waiting on other throws.
   */
  private ensureAnimating(): void {
    if (this.running !== false) return
    this.animstate = 'throw'
    this.rolling = true
    this.last_time = 0
    this.running = Date.now()
    this.animateThrow(this.running as number)
  }

  startClickThrow(notation: unknown): NotationLike {
    // A throw always spawns into the live world — it never clears the table.
    // Each throw's dice leave later on their own removal schedule instead.
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
    // an explicit clear drops every in-flight throw (resolving any that hadn't
    // settled) — it does NOT fire onEmpty, which signals a *timed* drain
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

  /** Fills in a throw's removal spec from defaults; the object identity is the
   * per-throw group key, so each roll/add gets a distinct spec instance. */
  private resolveRemoval(removal?: RemovalOptions): ResolvedRemoval {
    const d = DiceBox.DEFAULT_REMOVAL
    return {
      style: removal?.style ?? d.style,
      dwellMs: removal?.dwellMs ?? d.dwellMs,
      durationMs: removal?.durationMs ?? d.durationMs,
    }
  }

  /** Applies one frame of a throw's exit: shrink scales down, fade lowers opacity. */
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

  /** Removes one die from the scene, physics world, and the dice list. */
  private removeDie(die: DiceMesh): void {
    const index = this.diceList.indexOf(die)
    if (index !== -1) this.diceList.splice(index, 1)
    this.scene.remove(die)
    if (die.body) this.world.removeBody(die.body)
  }

  /** Resolves and drops every in-flight throw, restoring any mid-exit dice. */
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

  /** One die's latest result, identified by its current index. */
  private dieResult(die: DiceMesh, id: number): DiceResult {
    const last = die.result.at(-1)!
    return {
      type: die.shape,
      sides: Number.parseInt(die.shape.substring(1)),
      id,
      value: last.value,
      label: last.label,
      reason: last.reason,
    }
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
    // A roll joins the live table: the engine adds into the running world so
    // dice already at rest leave on their own schedule even as these arrive. An
    // empty table simply starts fresh (there's nothing to join).
    return this.add(notationString, options)
  }

  async add(
    notationString: unknown,
    options: RollOptions = {},
  ): Promise<ThrowResult> {
    const { theme, removal, onSpawned } = options
    const removalSpec = this.resolveRemoval(removal)
    await this.applyThemeForThrow(theme)

    // Read the live count AFTER the await: the running loop may have removed a
    // finishing throw while the theme resolved. Everything from here to the
    // group push is synchronous, so the count stays stable for the slice below.
    const existing = this.diceList.length

    // a throw never clears the table, it joins it — so throws already resting
    // keep removing on their own schedule
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
    // this throw's dice (the deterministic relaunch below reuses these meshes)
    const groupDice = this.diceList.slice(existing)

    if (deterministic) {
      // Pre-simulate ONLY these dice (existing ones are frozen + restored) so
      // their faces can be swapped to the predetermined values before they're
      // seen, without disturbing throws already in flight. An empty table
      // freezes nothing, so this simulates the whole first throw.
      this.simulateAddedDice(existing)
      this.steps = 0
      this.iteration = 0
      // relaunch just these dice so they re-throw from the start
      throwNotation.vectors.forEach((vectordata, i) => {
        const die = this.diceList[existing + i]
        if (die) this.spawnDice(vectordata, die)
      })
      this.applyForcedResults(throwNotation, existing)
      // wake them — the pre-simulation can leave them sleeping (upstream PR #21)
      for (const die of groupDice) die.body?.wakeUp()
    } else {
      // non-deterministic: already launched by spawnDice; tumble them live so
      // they collide with the other non-deterministic dice (shared group).
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
      // join the running loop if there is one, otherwise start it
      this.ensureAnimating()
      // dice now exist — release any throw waiting to join after this one
      onSpawned?.()
    })
  }

  async reroll(diceIdArray: number[]): Promise<DiceResult[]> {
    // Not used by the app today; kept functional. Re-throws the named dice as
    // their own throw group; their original group (if still on the table)
    // continues its own removal schedule.
    this.iteration = 0
    // reset the clock so the reroll animates from the beginning (upstream PR #20)
    this.last_time = 0
    const dice = diceIdArray
      .map(id => this.diceList[id])
      .filter((die): die is DiceMesh => Boolean(die))
    for (const die of dice) {
      die.rerolls += 1
      die.rerolling = true
      die.body.wakeUp()
      die.body.type = CANNON.Body.DYNAMIC
      die.body.angularVelocity = new CANNON.Vec3(25, 25, 25)
      die.body.velocity = new CANNON.Vec3(0, 0, 3000)
    }
    return new Promise<DiceResult[]>(resolve => {
      this.throwGroups.push(
        this.makeGroup(dice, this.resolveRemoval(), () => {
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

  /** Builds a ThrowGroup in its initial (unsettled) state. */
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

  /**
   * Fires a throw's completion callbacks/events and returns its results. Every
   * throw reports its own dice via `addDiceComplete`; the first throw onto an
   * empty table also announces the richer (global) `rollComplete`.
   */
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

  /**
   * Best-effort global `rollComplete`. The whole-table snapshot can be
   * momentarily inconsistent while other throws are mid-flight, so any failure
   * is swallowed — the per-throw `addDiceComplete` above is the reliable one.
   */
  private announceRollComplete(): void {
    try {
      const results = this.getDiceResults()
      this.onRollComplete(results)
      document.dispatchEvent(
        new CustomEvent('rollComplete', { detail: results }),
      )
    } catch {
      // global view is optional; the per-throw report already fired
    }
  }

  /**
   * Pre-simulates only the dice at indices >= startIndex to rest, freezing the
   * dice before startIndex and restoring them exactly afterward. Combined with
   * per-throw collision groups, the added dice settle independently of the
   * in-flight throw they're joining, so its predetermined landings hold.
   */
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

  /** Whether every die at indices >= startIndex has come to rest. */
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
