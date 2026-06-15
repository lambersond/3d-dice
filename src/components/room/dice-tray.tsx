'use client'

import { useEffect, useRef, useState } from 'react'
import {
  DIE_SIDES,
  type DieSides,
  type ModifierKey,
  type RollRequest,
} from '@lambersond/3d-dice-core'
import { useTray } from '@lambersond/3d-dice-react'
import clsx from 'clsx'
import { Dices, InfoIcon } from 'lucide-react'
import { DieIcon } from '@/components/icons'
import { Popover } from '@/components/popover'

type Props = {
  onRoll: (request: RollRequest) => void
  disabled?: boolean
}

const LONG_PRESS_MS = 450

function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const triggered = useRef(false)

  const start = () => {
    triggered.current = false
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      triggered.current = true
      onLongPress()
    }, LONG_PRESS_MS)
  }

  const cancel = () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = undefined
    }
  }

  return { start, cancel, triggered }
}

export function DiceTray({ onRoll, disabled = false }: Readonly<Props>) {
  const tray = useTray()
  const [menuFor, setMenuFor] = useState<DieSides | undefined>()
  const [modMenuFor, setModMenuFor] = useState<ModifierKey | undefined>()

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const longPressTriggered = useRef(false)

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = undefined
    }
  }

  useEffect(() => {
    if (menuFor === undefined && modMenuFor === undefined) return
    const closeMenus = () => {
      setMenuFor(undefined)
      setModMenuFor(undefined)
    }
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('[data-tray-menu]')) return
      closeMenus()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenus()
    }
    const armId = setTimeout(() => {
      document.addEventListener('click', onDocClick)
    }, 0)
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(armId)
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuFor, modMenuFor])

  const openModMenu = (key: ModifierKey) => {
    if (tray.modifiers[key] === 0) return
    setMenuFor(undefined)
    setModMenuFor(key)
  }

  const isEmptyPools = tray.poolList.length === 0

  const handleRoll = () => {
    if (isEmptyPools) return
    onRoll(tray.toRequest())
  }

  const openMenu = (sides: DieSides) => {
    if ((tray.pools.get(sides) ?? 0) === 0) return
    setModMenuFor(undefined)
    setMenuFor(sides)
  }

  const handleDieClick = (sides: DieSides) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false
      return
    }
    tray.incrementDie(sides)
  }

  const startLongPress = (sides: DieSides) => {
    longPressTriggered.current = false
    cancelLongPress()
    if ((tray.pools.get(sides) ?? 0) === 0) return
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true
      openMenu(sides)
    }, LONG_PRESS_MS)
  }

  return (
    <div className='flex flex-col gap-2 border-t border-border-light bg-paper p-3'>
      <div className='grid grid-cols-7 gap-1'>
        {DIE_SIDES.map(sides => {
          const count = tray.pools.get(sides) ?? 0
          const active = count > 0
          return (
            <div key={sides} className='relative'>
              <button
                type='button'
                onClick={e => {
                  if (longPressTriggered.current) e.stopPropagation()
                  handleDieClick(sides)
                }}
                onContextMenu={e => {
                  e.preventDefault()
                  if (count > 0) openMenu(sides)
                }}
                onTouchStart={() => startLongPress(sides)}
                onTouchEnd={cancelLongPress}
                onTouchMove={cancelLongPress}
                onTouchCancel={cancelLongPress}
                disabled={disabled}
                className={clsx(
                  'relative flex w-full cursor-pointer items-center justify-center rounded-md border py-2 font-mono text-xs sm:text-sm select-none disabled:cursor-not-allowed disabled:opacity-50',
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border-light text-text-primary hover:bg-hover',
                )}
              >
                <span className='inline-flex items-center gap-1'>
                  <DieIcon sides={sides} />
                  <span className='hidden text-xs md:inline'>d{sides}</span>
                </span>
                {active && (
                  <span className='absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white'>
                    {count}
                  </span>
                )}
              </button>

              {menuFor === sides && (
                <DieMenu
                  sides={sides}
                  count={count}
                  onRemove={() => {
                    tray.decrementDie(sides)
                    setMenuFor(undefined)
                  }}
                  onClear={() => {
                    tray.clearDie(sides)
                    setMenuFor(undefined)
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      <div className='grid grid-cols-7 gap-1'>
        <ModButton
          label='-5'
          onClick={() => tray.bumpModifier('minusFive')}
          disabled={disabled}
          count={tray.modifiers.minusFive}
          menuOpen={modMenuFor === 'minusFive'}
          onOpenMenu={() => openModMenu('minusFive')}
          onCloseMenu={() => setModMenuFor(undefined)}
          onRemoveOne={() => tray.removeOneModifier('minusFive')}
          onClearAll={() => tray.clearModifier('minusFive')}
        />
        <ModButton
          label='−1'
          onClick={() => tray.bumpModifier('minusOne')}
          disabled={disabled}
          count={tray.modifiers.minusOne}
          menuOpen={modMenuFor === 'minusOne'}
          onOpenMenu={() => openModMenu('minusOne')}
          onCloseMenu={() => setModMenuFor(undefined)}
          onRemoveOne={() => tray.removeOneModifier('minusOne')}
          onClearAll={() => tray.clearModifier('minusOne')}
        />
        <ModButton
          label='+1'
          onClick={() => tray.bumpModifier('plusOne')}
          disabled={disabled}
          count={tray.modifiers.plusOne}
          menuOpen={modMenuFor === 'plusOne'}
          onOpenMenu={() => openModMenu('plusOne')}
          onCloseMenu={() => setModMenuFor(undefined)}
          onRemoveOne={() => tray.removeOneModifier('plusOne')}
          onClearAll={() => tray.clearModifier('plusOne')}
        />
        <ModButton
          label='+5'
          onClick={() => tray.bumpModifier('plusFive')}
          disabled={disabled}
          count={tray.modifiers.plusFive}
          menuOpen={modMenuFor === 'plusFive'}
          onOpenMenu={() => openModMenu('plusFive')}
          onCloseMenu={() => setModMenuFor(undefined)}
          onRemoveOne={() => tray.removeOneModifier('plusFive')}
          onClearAll={() => tray.clearModifier('plusFive')}
        />
        <ToggleButton
          active={tray.advantage === 'adv'}
          activeClass='border-emerald-500 bg-emerald-500 text-white'
          onClick={() => tray.toggleAdvantage('adv')}
          disabled={disabled}
        >
          ADV
        </ToggleButton>
        <ToggleButton
          active={tray.advantage === 'dis'}
          activeClass='border-rose-500 bg-rose-500 text-white'
          onClick={() => tray.toggleAdvantage('dis')}
          disabled={disabled}
        >
          DIS
        </ToggleButton>
        <ToggleButton
          active={tray.exploding}
          activeClass='border-warning bg-warning text-white'
          onClick={() => tray.toggleExploding()}
          disabled={disabled}
        >
          EXP
        </ToggleButton>
      </div>

      <div className='flex items-center gap-2'>
        <button
          type='button'
          onClick={tray.clear}
          disabled={disabled || tray.isEmpty}
          className='inline-flex cursor-pointer items-center justify-center rounded-md border border-border-light px-4 py-2 text-sm font-semibold text-text-primary hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50 sm:text-base'
        >
          Clear
        </button>
        <button
          type='button'
          onClick={handleRoll}
          className='inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 sm:text-base'
        >
          <Dices className='size-5' />
          Roll
        </button>
        <Popover
          asChild
          placement='top'
          content='Tap dice to add — long-press or right-click to remove.'
          contentClassName='max-w-[calc(100vw_-_16px)] z-30 rounded-lg bg-card px-3 py-2 text-xs text-text-primary shadow-md ring-1 ring-black/5'
        >
          <button
            type='button'
            aria-label='Dice tray help'
            className='flex shrink-0 cursor-pointer items-center justify-center text-info/80 hover:text-info'
          >
            <InfoIcon className='size-5' />
          </button>
        </Popover>
      </div>
    </div>
  )
}

function DieMenu({
  sides,
  count,
  onRemove,
  onClear,
}: Readonly<{
  sides: DieSides
  count: number
  onRemove: () => void
  onClear: () => void
}>) {
  return (
    <div
      data-tray-menu
      role='menu'
      className='absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 min-w-32 overflow-hidden rounded-md border border-border-light bg-paper text-sm text-text-primary shadow-lg'
    >
      <button
        type='button'
        role='menuitem'
        onClick={onRemove}
        className='block w-full cursor-pointer px-3 py-2 text-left hover:bg-hover'
      >
        Remove 1 (×{count})
      </button>
      <button
        type='button'
        role='menuitem'
        onClick={onClear}
        className='block w-full cursor-pointer border-t border-border-light px-3 py-2 text-left hover:bg-hover'
      >
        Clear d{sides}
      </button>
    </div>
  )
}

function ModMenu({
  label,
  count,
  onRemove,
  onClear,
}: Readonly<{
  label: string
  count: number
  onRemove: () => void
  onClear: () => void
}>) {
  return (
    <div
      data-tray-menu
      role='menu'
      className='absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 min-w-32 overflow-hidden rounded-md border border-border-light bg-paper text-sm text-text-primary shadow-lg'
    >
      <button
        type='button'
        role='menuitem'
        onClick={onRemove}
        className='block w-full cursor-pointer px-3 py-2 text-left hover:bg-hover'
      >
        Remove 1 (×{count})
      </button>
      <button
        type='button'
        role='menuitem'
        onClick={onClear}
        className='block w-full cursor-pointer border-t border-border-light px-3 py-2 text-left hover:bg-hover'
      >
        Clear {label}
      </button>
    </div>
  )
}

function ModButton({
  label,
  onClick,
  disabled,
  count = 0,
  menuOpen,
  onOpenMenu,
  onCloseMenu,
  onRemoveOne,
  onClearAll,
}: Readonly<{
  label: string
  onClick: () => void
  disabled?: boolean
  count?: number
  menuOpen: boolean
  onOpenMenu: () => void
  onCloseMenu: () => void
  onRemoveOne: () => void
  onClearAll: () => void
}>) {
  const active = count > 0
  const longPress = useLongPress(() => {
    if (active) onOpenMenu()
  })

  return (
    <div className='relative'>
      <button
        type='button'
        onClick={e => {
          if (longPress.triggered.current) {
            longPress.triggered.current = false
            e.stopPropagation()
            return
          }
          onClick()
        }}
        onContextMenu={e => {
          e.preventDefault()
          if (active) onOpenMenu()
        }}
        onTouchStart={() => {
          if (active) longPress.start()
        }}
        onTouchEnd={longPress.cancel}
        onTouchMove={longPress.cancel}
        onTouchCancel={longPress.cancel}
        disabled={disabled}
        className={clsx(
          'relative h-full w-full cursor-pointer rounded-md border py-2 text-xs sm:text-sm font-mono select-none disabled:cursor-not-allowed disabled:opacity-50',
          active
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border-light text-text-primary hover:bg-hover',
        )}
      >
        {label}
        {active && (
          <span className='absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white'>
            {count}
          </span>
        )}
      </button>

      {menuOpen && (
        <ModMenu
          label={label}
          count={count}
          onRemove={() => {
            onRemoveOne()
            onCloseMenu()
          }}
          onClear={() => {
            onClearAll()
            onCloseMenu()
          }}
        />
      )}
    </div>
  )
}

function ToggleButton({
  children,
  onClick,
  disabled,
  active,
  activeClass,
}: Readonly<{
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  active: boolean
  activeClass: string
}>) {
  return (
    <button
      type='button'
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'cursor-pointer rounded-md border py-2 text-[10px] sm:text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50',
        active
          ? activeClass
          : 'border-border-light text-text-primary hover:bg-hover',
      )}
    >
      {children}
    </button>
  )
}
