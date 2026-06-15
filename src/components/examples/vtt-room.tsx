'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  combineD100,
  parseRollExpression,
  themeToBoxConfig,
  type Advantage,
  type DiePool,
  type DieRoll,
  type DieSides,
} from '@lambersond/3d-dice-core'
import {
  useDicePreferences,
  useDiceRenderer,
  useDieEvents,
} from '@lambersond/3d-dice-react'
import clsx from 'clsx'
import { Send } from 'lucide-react'
import { ExampleHeader } from './example-room'
import { DiceLog } from '@/components/room/dice-log'
import { usePersistedChats } from '@/hooks/use-persisted-chats'
import { usePersistedRolls } from '@/hooks/use-persisted-rolls'
import { useRollExecutor } from '@/hooks/use-roll-executor'
import { useUserProfile } from '@/hooks/use-user-profile'
import type { ExampleConfig } from './examples-config'
import type { RollEntry, RollerInfo } from '@/types/roll'

// The physical dice resting along the bottom, each showing its highest face. The
// `orientation` (yaw degrees) gives a deterministic, readable pose; tweak per die
// if a number wants to sit more upright toward the camera.
const PALETTE: ReadonlyArray<{
  type: string
  value: number
  orientation: number
}> = [
  { type: 'd4', value: 4, orientation: 0 },
  { type: 'd6', value: 6, orientation: 0 },
  { type: 'd8', value: 8, orientation: 0 },
  { type: 'd10', value: 10, orientation: 0 },
  { type: 'd12', value: 12, orientation: 0 },
  { type: 'd20', value: 20, orientation: 0 },
  { type: 'd100', value: 100, orientation: 0 },
]
const PALETTE_Y = -0.88
// Center-to-center spacing between resting dice, in normalized table units.
const DIE_SPACING = 0.12

// Sticky roll settings applied to a grab-flick drop.
type DropSettings = {
  modifier: number
  advantage?: Advantage
  exploding: boolean
}

const sumValues = (values: number[]) => values.reduce((sum, v) => sum + v, 0)

// Explosion chain for a die that landed on its max face: keep rolling the same
// die while it shows its max, collecting the extra values (capped for safety).
function explodeChain(sides: number, base: number): number[] {
  if (base !== sides) return []
  const chain: number[] = []
  let last = sides
  while (last === sides && chain.length < 20) {
    // eslint-disable-next-line sonarjs/pseudo-random -- dice rolls, not security-sensitive
    last = 1 + Math.floor(Math.random() * sides)
    chain.push(last)
  }
  return chain
}

// Index of the value to keep for advantage (highest) or disadvantage (lowest).
function keptIndex(values: number[], advantage: Advantage): number {
  let idx = 0
  for (let i = 1; i < values.length; i++) {
    const better =
      advantage === 'adv' ? values[i] > values[idx] : values[i] < values[idx]
    if (better) idx = i
  }
  return idx
}

function buildPool(
  sides: DieSides,
  values: number[],
  settings: DropSettings,
): DiePool {
  const explode = settings.exploding && sides !== 100

  // Advantage/disadvantage collapses same-type dice into one slot, keeping the
  // highest/lowest and striking the rest (LogEntry renders the extras crossed).
  if (settings.advantage && values.length >= 2) {
    const keep = keptIndex(values, settings.advantage)
    return {
      sides,
      count: 1,
      rolls: [values],
      kept: [values[keep]],
      ...(explode ? { explosions: [explodeChain(sides, values[keep])] } : {}),
    }
  }

  const chains = values.map(v => (explode ? explodeChain(sides, v) : []))
  return {
    sides,
    count: values.length,
    rolls: values.map(v => [v]),
    kept: values,
    ...(chains.some(chain => chain.length > 0) ? { explosions: chains } : {}),
  }
}

function poolTotal(pool: DiePool): number {
  const explosions = (pool.explosions ?? []).reduce(
    (sum, chain) => sum + sumValues(chain),
    0,
  )
  return sumValues(pool.kept) + explosions
}

// Build one log entry from a grab-flick drop, applying the sticky settings.
// Percentile throws arrive as a tens die (`d100`) plus a ones die (`d10`); fold
// each pair into a 1-100 value and group the rest by sides.
function dropEntry(
  dice: DieRoll[],
  roller: RollerInfo,
  settings: DropSettings,
): RollEntry | undefined {
  if (dice.length === 0) return undefined

  const tens = dice.filter(die => die.type === 'd100')
  const ones = dice.filter(die => die.type === 'd10')
  const pairs = Math.min(tens.length, ones.length)

  const bySides = new Map<DieSides, number[]>()
  const push = (sides: DieSides, value: number) => {
    const list = bySides.get(sides) ?? []
    list.push(value)
    bySides.set(sides, list)
  }

  for (let i = 0; i < pairs; i++) {
    push(100, combineD100(tens[i].value, ones[i].value))
  }
  for (const die of ones.slice(pairs)) push(10, die.value)
  for (const die of dice) {
    if (die.type !== 'd100' && die.type !== 'd10') {
      push(die.sides as DieSides, die.value)
    }
  }

  const pools = [...bySides.entries()]
    .toSorted(([a], [b]) => a - b)
    .map(([sides, values]) => buildPool(sides, values, settings))
  if (pools.length === 0) return undefined

  return {
    id: crypto.randomUUID(),
    at: Date.now(),
    pools,
    modifier: settings.modifier,
    advantage: settings.advantage,
    total:
      pools.reduce((sum, pool) => sum + poolTotal(pool), 0) + settings.modifier,
    roller,
  }
}

const ROLL_COMMAND = /^\/(?:roll|r)\b/i

/**
 * VTT example. Physical dice (d4-d100) rest along the bottom-center, each showing
 * its highest face: grab one and flick to roll it, right-click while holding to add
 * another of that type, and the settled drop is logged using the bottom-left sticky
 * settings (modifier, advantage/disadvantage, exploding). The floating log's footer
 * is a message box: plain text posts a chat, while `/roll 2d6! + 3` (adv/dis/exp
 * supported) rolls computed dice. Each throw is its own log entry.
 */
export function VttRoom({
  userId,
  example,
}: Readonly<{ userId: string; example: ExampleConfig }>) {
  const { profile } = useUserProfile()
  const { theme } = useDicePreferences()
  const { rolls, append } = usePersistedRolls(`dice-log:rolls:${example.slug}`)
  const { chats, append: appendChat } = usePersistedChats(
    `dice-log:chat:${example.slug}`,
  )
  const renderer = useDiceRenderer()
  const ready = renderer.isReady

  const roller = useMemo<RollerInfo>(
    () => ({ id: userId, name: profile?.name, image: profile?.image }),
    [userId, profile?.name, profile?.image],
  )

  // Bottom-left sticky settings, applied to grab-flick drops.
  const [modifierText, setModifierText] = useState('0')
  const [advantage, setAdvantage] = useState<Advantage | undefined>()
  const [exploding, setExploding] = useState(false)

  // Read the latest settings inside the (stable) settle handler without
  // resubscribing the die-event listeners on every keystroke.
  const settingsRef = useRef<DropSettings>({ modifier: 0, exploding: false })
  useEffect(() => {
    settingsRef.current = {
      modifier: Number.parseInt(modifierText, 10) || 0,
      advantage,
      exploding,
    }
  }, [modifierText, advantage, exploding])

  const controlsRef = useRef<HTMLDivElement>(null)

  // Lay the physical palette in a row to the right of the controls box: the first
  // die sits one spacing past the box's right edge and the row is centered on the
  // box. The dice canvas fills the viewport with 1 world unit = 1px and a 0.9
  // inset (see engine place()), so screen px convert linearly to table coords.
  const placePalette = useCallback(() => {
    const spacing = DIE_SPACING
    let firstX = -0.42
    let y = PALETTE_Y
    const box = controlsRef.current?.getBoundingClientRect()
    if (box) {
      const toNormX = (px: number) => ((2 * px) / window.innerWidth - 1) / 0.9
      const toNormY = (py: number) => (1 - (2 * py) / window.innerHeight) / 0.9
      firstX = toNormX(box.right) + spacing
      y = toNormY((box.top + box.bottom) / 2)
    }
    for (const [i, die] of PALETTE.entries()) {
      renderer.placeDie({
        type: die.type,
        value: die.value,
        x: firstX + i * spacing,
        y,
        grabbable: true,
        orientation: die.orientation,
      })
    }
  }, [renderer])

  // Place (and recolor) the palette once ready and whenever the theme changes, so
  // the resting dice are created with the selected colorset.
  const placedThemeKey = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!ready) return
    const key = JSON.stringify(theme)
    if (placedThemeKey.current === key) return
    placedThemeKey.current = key
    const replace = () => {
      renderer.clear()
      placePalette()
    }
    renderer.updateConfig(themeToBoxConfig(theme)).then(replace, replace)
  }, [ready, theme, renderer, placePalette])

  // Keep the row aligned to the (HTML) controls box as the viewport resizes.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const onResize = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (!renderer.isReady) return
        renderer.clear()
        placePalette()
      }, 200)
    }
    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', onResize)
    }
  }, [renderer, placePalette])

  // Grab-flick path: a palette die is in play from grab until its drop settles.
  const grabbing = useRef(false)
  const handleGrabbed = useCallback(() => {
    grabbing.current = true
  }, [])

  const handleSettled = useCallback(
    (dice: DieRoll[]) => {
      if (!grabbing.current) return
      grabbing.current = false
      const entry = dropEntry(
        dice.filter(die => die.reason !== 'placed'),
        roller,
        settingsRef.current,
      )
      if (entry) append(entry)
      renderer.clear()
      placePalette()
    },
    [append, renderer, roller, placePalette],
  )

  useDieEvents({ onGrabbed: handleGrabbed, onSettled: handleSettled })

  // `/roll` path: parse the expression and throw computed dice (transient).
  const { requestRoll } = useRollExecutor({
    userId,
    name: profile?.name,
    image: profile?.image,
    onLocalResult: append,
    deterministic: false,
    removal: example.removal,
  })

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const toggleAdvantage = useCallback((value: Advantage) => {
    setAdvantage(current => {
      if (current === value) return
      return value
    })
  }, [])

  const handleSend = useCallback(() => {
    const text = message.trim()
    if (!text) return

    if (ROLL_COMMAND.test(text)) {
      const parsed = parseRollExpression(text.replace(ROLL_COMMAND, ''))
      if (!parsed.ok) {
        setError(parsed.error)
        return
      }
      setError('')
      setMessage('')
      requestRoll(parsed.request)
      return
    }

    setError('')
    setMessage('')
    appendChat({
      id: crypto.randomUUID(),
      at: Date.now(),
      sender: { id: userId, name: profile?.name, image: profile?.image },
      text,
    })
  }, [message, requestRoll, appendChat, userId, profile?.name, profile?.image])

  return (
    <div className='relative flex min-h-0 flex-1 flex-col'>
      <ExampleHeader
        title={example.label}
        description={example.description}
        clearable={false}
      />

      {/* Solid-color play area; the transparent dice canvas overlays it. The
          placed palette and rolled dice render here. */}
      <div className='relative flex-1 overflow-hidden bg-emerald-800' />

      {/* Bottom-left: square modifier input with ADV/DIS/EXP stacked to its right.
          The persistent dice sit to the right of this group (placed via x above). */}
      <div
        ref={controlsRef}
        className='absolute bottom-4 left-4 flex items-stretch gap-2 rounded-lg border border-border-light bg-paper/95 p-2 shadow-xl backdrop-blur'
      >
        <input
          type='number'
          value={modifierText}
          onChange={e => setModifierText(e.target.value)}
          aria-label='Roll modifier'
          className='size-20 rounded-md border border-border-light bg-card text-center font-mono text-2xl text-text-primary'
        />
        <div className='flex w-14 flex-col gap-1'>
          <SettingButton
            active={advantage === 'adv'}
            activeClass='border-emerald-500 bg-emerald-500 text-white'
            onClick={() => toggleAdvantage('adv')}
          >
            ADV
          </SettingButton>
          <SettingButton
            active={advantage === 'dis'}
            activeClass='border-rose-500 bg-rose-500 text-white'
            onClick={() => toggleAdvantage('dis')}
          >
            DIS
          </SettingButton>
          <SettingButton
            active={exploding}
            activeClass='border-warning bg-warning text-white'
            onClick={() => setExploding(v => !v)}
          >
            EXP
          </SettingButton>
        </div>
      </div>

      {/* Floating roll log with a message/command input in its footer. */}
      <aside className='absolute top-20 right-4 bottom-4 flex w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-border-light bg-card shadow-xl'>
        <DiceLog rolls={rolls} chats={chats} myRollerId={userId} />
        <form
          onSubmit={e => {
            e.preventDefault()
            handleSend()
          }}
          className='flex flex-col gap-1 border-t border-border-light bg-paper p-3'
        >
          <div className='flex items-center gap-2'>
            <input
              value={message}
              onChange={e => {
                setMessage(e.target.value)
                if (error) setError('')
              }}
              placeholder='Message, or /roll 2d6! + 3'
              aria-label='Message or roll command'
              className='min-w-0 flex-1 rounded-md border border-border-light bg-card px-3 py-2 text-sm text-text-primary'
            />
            <button
              type='submit'
              aria-label='Send'
              className='inline-flex cursor-pointer items-center justify-center rounded-md bg-primary px-3 py-2 text-white hover:bg-primary/90'
            >
              <Send className='size-5' />
            </button>
          </div>
          {error && <p className='text-xs text-rose-500'>{error}</p>}
        </form>
      </aside>
    </div>
  )
}

function SettingButton({
  children,
  active,
  activeClass,
  onClick,
}: Readonly<{
  children: ReactNode
  active: boolean
  activeClass: string
  onClick: () => void
}>) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={clsx(
        'flex-1 cursor-pointer rounded-md border text-xs font-semibold',
        active
          ? activeClass
          : 'border-border-light text-text-primary hover:bg-hover',
      )}
    >
      {children}
    </button>
  )
}
