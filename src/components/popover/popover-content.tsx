'use client'

import { forwardRef } from 'react'
import {
  FloatingFocusManager,
  FloatingPortal,
  useMergeRefs,
} from '@floating-ui/react'
import clsx from 'clsx'
import { usePopover } from './popover-context'

export const PopoverContent = forwardRef<
  HTMLDivElement,
  React.HTMLProps<HTMLDivElement>
>(function PopoverContent({ style, className, ...props }, propRef) {
  const { context: floatingContext, ...context } = usePopover()
  const ref = useMergeRefs([context.refs.setFloating, propRef])

  if (!floatingContext.open) return

  return (
    <FloatingPortal>
      <FloatingFocusManager context={floatingContext} modal={context.modal}>
        <div
          ref={ref}
          style={{ ...context.floatingStyles, ...style }}
          aria-labelledby={context.labelId}
          aria-describedby={context.descriptionId}
          {...context.getFloatingProps(props)}
          className={clsx('z-100', className)}
        >
          {props.children}
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  )
})
