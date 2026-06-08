import type {
  DiceRendererConfig,
  RemovalOptions,
} from '@lambersond/3d-dice-core'

export type ExampleInteraction = 'popover' | 'custom' | 'none'

export type ExampleConfig = {
  slug: string
  label: string
  category: 'Basic' | 'Advanced'
  description: string
  /** Roll via deterministic RNG (dice animate to a predetermined value). */
  deterministic: boolean
  /** Whether dice stay on the table after settling (drives the Clear control). */
  persistent: boolean
  /** Disposition for the initial roll's dice. */
  removal: RemovalOptions
  /** Construction config for this page's DiceRenderer. */
  renderer: DiceRendererConfig
  /** Which interaction layer renders over the dice. */
  interaction: ExampleInteraction
}

const TRANSIENT: RemovalOptions = { style: 'shrink', dwellMs: 2000 }
const TRANSIENT_LINGER: RemovalOptions = { style: 'shrink', dwellMs: 4000 }
const PERSIST: RemovalOptions = { style: 'none' }
const RESET: RemovalOptions = { style: 'reset', dwellMs: 1200 }

export const EXAMPLES: ExampleConfig[] = [
  {
    slug: 'basic-flickable',
    label: 'Basic · flickable',
    category: 'Basic',
    description:
      'Physical rolls. Hover a settled die to read it, tap or drag-flick to reroll. Dice fade out after a moment.',
    deterministic: false,
    persistent: false,
    removal: TRANSIENT,
    renderer: {
      enableDiceSelection: true,
      enableDiceDrag: true,
      dragRemoval: TRANSIENT,
    },
    interaction: 'popover',
  },
  {
    slug: 'basic-deterministic',
    label: 'Basic · deterministic',
    category: 'Basic',
    description:
      'Deterministic rolls: the result is decided up front and the dice animate to it. No hover or flick.',
    deterministic: true,
    persistent: false,
    removal: TRANSIENT,
    renderer: {},
    interaction: 'none',
  },
  {
    slug: 'persistent-flickable',
    label: 'Persistent · flickable',
    category: 'Advanced',
    description:
      'Dice stay on the table. Hover to read, flick to reroll (the die returns to its spot and logs a new result). Use Clear to empty.',
    deterministic: false,
    persistent: true,
    removal: PERSIST,
    renderer: {
      enableDiceSelection: true,
      enableDiceDrag: true,
      dragRemoval: RESET,
    },
    interaction: 'popover',
  },
  {
    slug: 'persistent-static',
    label: 'Persistent · static',
    category: 'Advanced',
    description:
      'Dice stay on the table and can be hovered to read their value, but not flicked. Use Clear to empty.',
    deterministic: false,
    persistent: true,
    removal: PERSIST,
    renderer: { enableDiceSelection: true },
    interaction: 'popover',
  },
  {
    slug: 'custom-actions',
    label: 'Custom hover actions',
    category: 'Advanced',
    description:
      'A custom hover popover with Reroll and Set aside actions, wired straight to the engine.',
    deterministic: false,
    persistent: false,
    removal: TRANSIENT_LINGER,
    renderer: { enableDiceSelection: true },
    interaction: 'custom',
  },
]

export function findExample(slug: string): ExampleConfig | undefined {
  return EXAMPLES.find(example => example.slug === slug)
}

export const DEFAULT_EXAMPLE_SLUG = EXAMPLES[0].slug
