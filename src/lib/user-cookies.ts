import { cookies } from 'next/headers'

export const USER_ID_COOKIE = 'user_id'
export const USER_NAME_COOKIE = 'user_name'
export const USER_IMAGE_COOKIE = 'user_image'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export const USER_COOKIE_OPTIONS = {
  maxAge: ONE_YEAR_SECONDS,
  path: '/',
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  httpOnly: false,
} as const

export type User = {
  id: string
  name?: string
  image?: string
}

export async function getUser(): Promise<User | undefined> {
  const store = await cookies()
  const id = store.get(USER_ID_COOKIE)?.value
  if (!id) return undefined
  return {
    id,
    name: store.get(USER_NAME_COOKIE)?.value,
    image: store.get(USER_IMAGE_COOKIE)?.value,
  }
}

export async function getOrCreateUserId(): Promise<string> {
  const store = await cookies()
  const existing = store.get(USER_ID_COOKIE)?.value
  if (existing) return existing

  const id = crypto.randomUUID()
  store.set(USER_ID_COOKIE, id, USER_COOKIE_OPTIONS)
  return id
}

export async function setUserName(name: string): Promise<void> {
  const store = await cookies()
  store.set(USER_NAME_COOKIE, name, USER_COOKIE_OPTIONS)
}

export async function setUserImage(image: string): Promise<void> {
  const store = await cookies()
  store.set(USER_IMAGE_COOKIE, image, USER_COOKIE_OPTIONS)
}
