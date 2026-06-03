'use client'

import { useState } from 'react'
import { Dices } from 'lucide-react'
import { DicePreferencesModal } from './dice-preferences-modal'

export function DicePreferencesButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type='button'
        onClick={() => setOpen(true)}
        aria-label='Customize dice'
        className='inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
      >
        <Dices className='size-4' aria-hidden='true' />
        <span className='sr-only'>Customize dice</span>
      </button>
      {open && <DicePreferencesModal onClose={() => setOpen(false)} />}
    </>
  )
}
