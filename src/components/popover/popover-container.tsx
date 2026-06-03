'use client'

import { PopoverContext, usePopoverState } from './popover-context'
import type { PopoverOptions } from './types'

type Props = {
  children: React.ReactNode
} & PopoverOptions

export function PopoverContainer({
  children,
  modal = false,
  ...restOptions
}: Readonly<Props>) {
  const popover = usePopoverState({ modal, ...restOptions })
  return (
    <PopoverContext.Provider value={popover}>
      {children}
    </PopoverContext.Provider>
  )
}
