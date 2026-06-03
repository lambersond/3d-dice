'use client'

import { useEffect, useId, useRef } from 'react'
import clsx from 'clsx'

type Props = {
  label?: string
  value: string
  onChange: (color: string) => void
  required?: boolean
  error?: string
  hint?: string
}

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/

export function ColorPicker({
  label,
  value,
  onChange,
  required = false,
  error,
  hint,
}: Readonly<Props>) {
  const id = useId()
  const hexId = `${id}-hex`
  const cleanupRef = useRef<(() => void) | undefined>(undefined)

  const normalizedValue = HEX_PATTERN.test(value) ? value : '#000000'

  const handleHexChange = (raw: string) => {
    const trimmed = raw.trim().startsWith('#') ? raw.trim() : `#${raw.trim()}`
    onChange(trimmed)
  }

  // The native <input type="color"> popup is rendered by the browser; when
  // the user dismisses it by clicking back on the page, that click fires
  // on the page too. If it lands on a modal backdrop, the modal would
  // close. After the swatch is clicked, arm a one-shot capture-phase
  // listener that stopPropagation()s the next page click so it can't
  // reach ancestor handlers like a modal backdrop's onClick.
  const armDismissGuard = () => {
    cleanupRef.current?.()
    setTimeout(() => {
      const onClick = (e: MouseEvent) => {
        e.stopPropagation()
        cleanup()
      }
      const cleanup = () => {
        document.removeEventListener('click', onClick, true)
        clearTimeout(timeoutId)
        cleanupRef.current = undefined
      }
      document.addEventListener('click', onClick, true)
      const timeoutId = setTimeout(cleanup, 10_000)
      cleanupRef.current = cleanup
    }, 0)
  }

  useEffect(() => {
    return () => cleanupRef.current?.()
  }, [])

  return (
    <div className='flex flex-col gap-1'>
      {label && (
        <label
          htmlFor={hexId}
          className='text-[11px] font-semibold uppercase tracking-widest
            text-text-secondary'
        >
          {label}
          {required && <sup className='text-danger'>*</sup>}
        </label>
      )}
      <div
        className={clsx(
          'mt-1 flex items-stretch overflow-hidden rounded-md border bg-paper',
          error ? 'border-error' : 'border-border-light',
        )}
      >
        <label
          aria-label='Pick a color'
          className='relative grid h-9 w-12 cursor-pointer place-items-center
            border-r border-border-light'
          style={{ backgroundColor: normalizedValue }}
        >
          <input
            type='color'
            value={normalizedValue}
            onClick={armDismissGuard}
            onChange={e => {
              cleanupRef.current?.()
              onChange(e.target.value)
            }}
            className='absolute inset-0 size-full cursor-pointer opacity-0'
          />
        </label>
        <input
          id={hexId}
          type='text'
          value={value}
          onChange={e => handleHexChange(e.target.value)}
          placeholder='#000000'
          spellCheck={false}
          className='flex-1 bg-transparent px-3 font-mono text-sm
            text-text-primary outline-none placeholder:text-text-secondary'
        />
      </div>
      {hint && !error && (
        <span className='text-text-secondary text-xs italic'>{hint}</span>
      )}
      {error && <p className='text-danger text-xs italic'>{error}</p>}
    </div>
  )
}
