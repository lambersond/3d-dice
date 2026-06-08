import { redirect } from 'next/navigation'
import { DEFAULT_EXAMPLE_SLUG } from '@/components/examples/examples-config'

export default function Page() {
  redirect(`/examples/${DEFAULT_EXAMPLE_SLUG}`)
}
