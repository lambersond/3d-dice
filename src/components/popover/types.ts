import type { Placement } from '@floating-ui/react'

type PopoverPropsChildren = {
  content: React.ReactNode
  contentClassName?: string
  hidePopover?: boolean
  asKabab?: false
} & PopoverOptions &
  PopoverTriggerProps

type PopoverPropsKabab = {
  content: React.ReactNode
  contentClassName?: string
  hidePopover?: boolean
  asKabab: true
  children?: null
} & Pick<PopoverTriggerProps, 'asChild'> &
  PopoverOptions

export type PopoverProps = PopoverPropsChildren | PopoverPropsKabab

export interface PopoverTriggerProps {
  children: React.ReactNode
  asChild?: boolean
}

export interface PopoverOptions {
  placement?: Placement
  modal?: boolean
}
