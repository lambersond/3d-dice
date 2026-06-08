'use client'

import clsx from 'clsx'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { EXAMPLES } from './examples-config'

export function ExamplesSidebar() {
  const pathname = usePathname()
  return (
    <nav className='flex w-48 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border-light bg-paper p-2 sm:w-56 sm:p-3'>
      <p className='px-2 py-1 text-xs font-semibold uppercase tracking-wide text-text-tertiary'>
        Examples
      </p>
      {EXAMPLES.map(example => {
        const href = `/examples/${example.slug}`
        const active = pathname === href
        return (
          <Link
            key={example.slug}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={clsx(
              'rounded-md px-3 py-2 text-sm',
              active
                ? 'bg-primary/10 font-semibold text-primary'
                : 'text-text-primary hover:bg-hover',
            )}
          >
            <span className='block'>{example.label}</span>
            <span className='block text-[10px] uppercase text-text-tertiary'>
              {example.category}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
