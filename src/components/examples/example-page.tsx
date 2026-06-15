'use client'

import { useMemo } from 'react'
import {
  DicePreferencesProvider,
  DiceRendererProvider,
  localStoragePreferences,
} from '@lambersond/3d-dice-react'
import { ExampleRoom } from './example-room'
import { findExample, type ExampleConfig } from './examples-config'
import { SeedFlickRoom } from './seed-flick-room'
import { VttRoom } from './vtt-room'

function renderInteraction(
  interaction: ExampleConfig['interaction'],
  userId: string,
  example: ExampleConfig,
) {
  switch (interaction) {
    case 'seed': {
      return <SeedFlickRoom userId={userId} example={example} />
    }
    case 'vtt': {
      return <VttRoom userId={userId} example={example} />
    }
    default: {
      return <ExampleRoom userId={userId} example={example} />
    }
  }
}

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
        {renderInteraction(example.interaction, userId, example)}
      </DiceRendererProvider>
    </DicePreferencesProvider>
  )
}
