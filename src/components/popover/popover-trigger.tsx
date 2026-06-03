'use client'

import { cloneElement, forwardRef, isValidElement } from 'react'
import { useMergeRefs } from '@floating-ui/react'
import { usePopover } from './popover-context'
import type { PopoverTriggerProps } from './types'

export const PopoverTrigger = forwardRef<
  HTMLElement,
  React.HTMLProps<HTMLElement> & PopoverTriggerProps
>(function PopoverTrigger({ children, asChild = false, ...props }, propRef) {
  const context = usePopover()
  const childrenRef = (children as any).ref
  const ref = useMergeRefs([context.refs.setReference, propRef, childrenRef])

  if (asChild && isValidElement(children)) {
    return cloneElement(
      children,
      context.getReferenceProps({
        ref,
        ...props,
        ...(children.props as Record<string, any>),
        onClick: (e: React.MouseEvent) => e.stopPropagation(),
        'data-state': context.open ? 'open' : 'closed',
      } as any),
    )
  }

  return (
    <div
      ref={ref}
      data-state={context.open ? 'open' : 'closed'}
      {...context.getReferenceProps(props)}
    >
      {children}
    </div>
  )
})
