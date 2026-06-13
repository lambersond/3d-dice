'use client'

import { useMemo } from 'react'
import {
  DicePreferencesProvider,
  DiceRendererProvider,
  localStoragePreferences,
} from '@lambersond/3d-dice-react'
import { ExampleRoom } from './example-room'
import { findExample } from './examples-config'
import { SeedFlickRoom } from './seed-flick-room'

export function ExamplePage({
  userId,
  slug,
}: Readonly<{ userId: string; slug: string }>) {
  const storage = useMemo(
    () => localStoragePreferences('dice-log:dice-preferences'),
    [],
  )
  const example = findExample(slug)
  if (!example) return <></>

  return (
    <DicePreferencesProvider storage={storage}>
      <DiceRendererProvider config={example.renderer}>
        {example.interaction === 'seed' ? (
          <SeedFlickRoom userId={userId} example={example} />
        ) : (
          <ExampleRoom userId={userId} example={example} />
        )}
      </DiceRendererProvider>
    </DicePreferencesProvider>
  )
}
