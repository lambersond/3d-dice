/**
 * @jest-environment node
 */
import {
  USER_ID_COOKIE,
  USER_IMAGE_COOKIE,
  USER_NAME_COOKIE,
  getOrCreateUserId,
  getUser,
  setUserImage,
  setUserName,
} from './user-cookies'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Stored = Record<string, string>

const buildStore = (initial: Stored = {}) => {
  const store = new Map(Object.entries(initial))
  return {
    get: jest.fn((name: string) =>
      store.has(name) ? { name, value: store.get(name)! } : undefined,
    ),
    set: jest.fn((name: string, value: string) => {
      store.set(name, value)
    }),
    raw: store,
  }
}

const cookiesMock = jest.fn()

jest.mock('next/headers', () => ({
  cookies: () => cookiesMock(),
}))

describe('lib/user-cookies', () => {
  describe('getUser', () => {
    it('returns undefined when no user_id cookie is set', async () => {
      cookiesMock.mockResolvedValue(buildStore())

      await expect(getUser()).resolves.toBeUndefined()
    })

    it('returns id alone when only user_id is set', async () => {
      cookiesMock.mockResolvedValue(buildStore({ [USER_ID_COOKIE]: 'abc' }))

      await expect(getUser()).resolves.toEqual({
        id: 'abc',
        name: undefined,
        image: undefined,
      })
    })

    it('returns id, name, and image when all are set', async () => {
      cookiesMock.mockResolvedValue(
        buildStore({
          [USER_ID_COOKIE]: 'abc',
          [USER_NAME_COOKIE]: 'Frodo',
          [USER_IMAGE_COOKIE]: 'https://example.com/f.png',
        }),
      )

      await expect(getUser()).resolves.toEqual({
        id: 'abc',
        name: 'Frodo',
        image: 'https://example.com/f.png',
      })
    })
  })

  describe('getOrCreateUserId', () => {
    it('returns the existing id without writing when one is set', async () => {
      const store = buildStore({ [USER_ID_COOKIE]: 'existing' })
      cookiesMock.mockResolvedValue(store)

      await expect(getOrCreateUserId()).resolves.toBe('existing')
      expect(store.set).not.toHaveBeenCalled()
    })

    it('mints and writes a UUID when no id is set', async () => {
      const store = buildStore()
      cookiesMock.mockResolvedValue(store)

      const id = await getOrCreateUserId()

      expect(id).toMatch(UUID_PATTERN)
      expect(store.set).toHaveBeenCalledWith(
        USER_ID_COOKIE,
        id,
        expect.objectContaining({ path: '/', sameSite: 'lax' }),
      )
    })

    it('returns a different id on each call when starting fresh', async () => {
      cookiesMock.mockResolvedValueOnce(buildStore())
      cookiesMock.mockResolvedValueOnce(buildStore())

      const a = await getOrCreateUserId()
      const b = await getOrCreateUserId()

      expect(a).not.toBe(b)
    })
  })

  describe('setUserName / setUserImage', () => {
    it('writes user_name with the shared cookie options', async () => {
      const store = buildStore()
      cookiesMock.mockResolvedValue(store)

      await setUserName('Sam')

      expect(store.set).toHaveBeenCalledWith(
        USER_NAME_COOKIE,
        'Sam',
        expect.objectContaining({ path: '/', sameSite: 'lax' }),
      )
    })

    it('writes user_image with the shared cookie options', async () => {
      const store = buildStore()
      cookiesMock.mockResolvedValue(store)

      await setUserImage('https://example.com/s.png')

      expect(store.set).toHaveBeenCalledWith(
        USER_IMAGE_COOKIE,
        'https://example.com/s.png',
        expect.objectContaining({ path: '/', sameSite: 'lax' }),
      )
    })
  })
})
