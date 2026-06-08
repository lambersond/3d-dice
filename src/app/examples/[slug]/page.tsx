import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { ExamplePage } from '@/components/examples/example-page'
import { findExample } from '@/components/examples/examples-config'
import { USER_ID_COOKIE } from '@/lib/user-cookies'

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ slug: string }> }>) {
  const { slug } = await params
  if (!findExample(slug)) notFound()

  const store = await cookies()
  const userId = store.get(USER_ID_COOKIE)?.value ?? 'anon'
  return <ExamplePage userId={userId} slug={slug} />
}
