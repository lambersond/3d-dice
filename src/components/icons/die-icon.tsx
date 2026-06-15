import { type ComponentType, type SVGAttributes } from 'react'
import { type DieSides } from '@lambersond/3d-dice-core'
import { D10Icon } from './d10'
import { D12Icon } from './d12'
import { D20Icon } from './d20'
import { D4Icon } from './d4'
import { D6Icon } from './d6'
import { D8Icon } from './d8'

const DIE_ICON: Record<
  Exclude<DieSides, 100>,
  ComponentType<SVGAttributes<SVGElement>>
> = {
  4: D4Icon,
  6: D6Icon,
  8: D8Icon,
  10: D10Icon,
  12: D12Icon,
  20: D20Icon,
}

/**
 * Renders the icon for a die type. A `d100` (percentile) shows as two
 * overlapped d10s, matching how it's physically rolled (tens + ones).
 */
export function DieIcon({
  sides,
  className = 'size-5',
}: Readonly<{ sides: DieSides; className?: string }>) {
  if (sides === 100) {
    return (
      <span className='inline-flex items-center -space-x-1'>
        <D10Icon className={className} />
        <D10Icon className={className} />
      </span>
    )
  }
  const Icon = DIE_ICON[sides]
  return <Icon className={className} />
}
