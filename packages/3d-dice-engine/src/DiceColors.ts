import { COLORSETS } from './const/colorsets'
import { TEXTURELIST } from './const/texturelist'

export class DiceColors {
  // `colorsets` doubles as a string-keyed cache; members stay loose.
  [key: string]: any

  constructor(options: any = {}) {
    this.colorsets = []
    this.assetPath = options.assetPath
  }

  async ImageLoader(data: any): Promise<any> {
    if (Array.isArray(data)) {
      for (let i = 0, l = data.length; i < l; i++) {
        data[i] = await this.ImageLoader(data[i])
      }
      return data
    }

    if (data.source && data.source !== '') {
      data.texture = await this.loadImage(data.source)
    }

    if (data.source_bump && data.source_bump !== '') {
      data.bump = await this.loadImage(data.source_bump)
    }

    return data
  }

  loadImage(src: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.crossOrigin = 'anonymous'
      img.src = this.assetPath + src
      img.onerror = error => reject(error)
    }).catch(() => {
      console.error('Unable to load image texture')
    })
  }

  async getColorSet(options: any) {
    let setName
    if (typeof options === 'string') setName = options
    if (typeof options === 'object') setName = options.colorset

    // return the cached colorset if it's already been built
    if (Object.hasOwn(this.colorsets, setName)) {
      return this.colorsets[setName]
    }

    const colorset = COLORSETS[setName]
    const texture = options.texture || colorset.texture

    colorset.texture = this.getTexture(texture)
    colorset.texture = await this.ImageLoader(colorset.texture)

    // if a material type was specified then use it
    if (options.material) colorset.texture.material = options.material

    this.colorsets[setName] = colorset
    return colorset
  }

  async makeColorSet(options: any = {}) {
    if (Object.hasOwn(this.colorsets, options.name)) {
      return this.colorsets[options.name]
    }

    const defaultSet = COLORSETS['white']
    const colorset = Object.assign({}, defaultSet, options)
    const texture = this.getTexture(colorset.texture)

    colorset.texture = await this.ImageLoader(texture)

    if (options.material) colorset.texture.material = options.material

    if (colorset.name.toLowerCase() === 'white') {
      // create a unique name
      colorset.name = `${Date.now()}`
    }

    this.colorsets[colorset.name] = colorset
    return colorset
  }

  getTexture(texturename: any): any {
    if (Array.isArray(texturename)) {
      return texturename.map(name => this.getTexture(name))
    }

    if (Object.hasOwn(TEXTURELIST, texturename)) {
      return TEXTURELIST[texturename]
    }
    return TEXTURELIST['none']
  }
}
