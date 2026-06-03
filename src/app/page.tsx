import { cookies } from 'next/headers'
import { LonelyRoom } from '@/components/room'
import { USER_ID_COOKIE } from '@/lib/user-cookies'

export default async function Page() {
  const store = await cookies()
  const userId = store.get(USER_ID_COOKIE)?.value ?? 'anon'
  return <LonelyRoom userId={userId} />
}
