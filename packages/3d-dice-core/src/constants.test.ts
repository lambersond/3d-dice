import { DIE_SIDES } from './constants'

describe('DIE_SIDES', () => {
  it('lists the supported dice in ascending order', () => {
    expect(DIE_SIDES).toEqual([4, 6, 8, 10, 12, 20, 100])
  })
})
