'use client'

import { useMemo } from 'react'
import clsx from 'clsx'
import { generateIdenticon } from '@/utils/generate-identicon'

type Props = {
  name?: string
  image?: string
  seed?: string
  className?: string
  alt?: string
}

export function Avatar({ name, image, seed, className, alt }: Readonly<Props>) {
  const identiconSeed = (seed ?? name ?? '').trim() || 'anonymous'
  const fallback = useMemo(
    () => generateIdenticon(identiconSeed),
    [identiconSeed],
  )
  const src = image || fallback

  return (
    // eslint-disable-next-line @next/next/no-img-element -- avatar is a data URL
    <img
      src={src}
      alt={alt ?? name ?? ''}
      className={clsx(
        'shrink-0 rounded-full object-cover bg-card',
        className ?? 'size-10',
      )}
    />
  )
}
