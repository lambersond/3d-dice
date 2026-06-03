import {
  COLORSETS,
  DEFAULT_COLORSET,
  DEFAULT_MATERIAL,
  MATERIALS,
  findColorset,
} from './presets'

describe('presets', () => {
  it('finds a colorset by key', () => {
    expect(findColorset('white')).toMatchObject({ key: 'white', name: 'White' })
  })

  it('returns undefined for an unknown key', () => {
    expect(findColorset('not-a-real-set')).toBeUndefined()
  })

  it('exposes resolvable defaults', () => {
    expect(findColorset(DEFAULT_COLORSET)).toBeDefined()
    expect(MATERIALS).toContain(DEFAULT_MATERIAL)
  })

  it('has unique colorset keys', () => {
    const keys = COLORSETS.map(c => c.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
