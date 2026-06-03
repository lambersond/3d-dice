import { Icon } from './icon'
import type { SVGAttributes } from 'react'

export function D4Icon(props: Readonly<SVGAttributes<SVGElement>>) {
  return (
    <Icon
      data-testid='D4Icon'
      {...props}
      viewBox='0 0 5120 5120'
      preserveAspectRatio='xMidYMid meet'
      d='M2349 5024 c-25 -38 -113 -157 -196 -264 -154 -202 -518 -680 -1064
-1400 -174 -228 -450 -593 -615 -810 -389 -512 -474 -626 -474 -639 0 -22 466
-396 1216 -976 50 -38 246 -190 435 -337 189 -146 434 -336 544 -421 l200
-154 6 496 c8 647 8 4026 0 4335 l-6 239 -46 -69z M2710 5080 c-5 -40 -16 -4669 -12 -4833 l7 -227 265 203 c146 112
421 325 611 473 587 457 1227 955 1387 1078 83 65 152 120 152 123 0 9 -566
759 -1465 1943 -157 206 -428 564 -603 794 -367 486 -341 452 -342 446z'
    />
  )
}
