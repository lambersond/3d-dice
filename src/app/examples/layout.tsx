import { ExamplesSidebar } from '@/components/examples/examples-sidebar'

export default function ExamplesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className='flex min-h-0 flex-1'>
      <ExamplesSidebar />
      <div className='flex min-h-0 flex-1 flex-col'>{children}</div>
    </div>
  )
}
