'use client'

import { Kebab } from './kebab'
import { PopoverContainer } from './popover-container'
import { PopoverContent } from './popover-content'
import { PopoverTrigger } from './popover-trigger'
import type { PopoverProps } from './types'

export function Popover({
  asChild,
  content,
  contentClassName,
  modal,
  placement,
  asKabab,
  children,
  hidePopover,
}: Readonly<PopoverProps>) {
  if (hidePopover) {
    return <>{children}</>
  }

  return (
    <PopoverContainer placement={placement} modal={modal}>
      <PopoverTrigger asChild={asChild}>
        {asKabab ? <Kebab /> : children}
      </PopoverTrigger>
      <PopoverContent className={contentClassName}>{content}</PopoverContent>
    </PopoverContainer>
  )
}
