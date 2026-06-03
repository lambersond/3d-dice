import type { SVGAttributes } from 'react'

export function Icon({
  d,
  ...props
}: Readonly<SVGAttributes<SVGElement> & { 'data-testid': string }>) {
  return (
    <svg width='24' height='24' viewBox='0 0 24 24' {...props}>
      <path fill='currentColor' d={d} />
    </svg>
  )
}
