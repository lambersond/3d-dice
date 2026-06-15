import type {
  DiceRendererConfig,
  RemovalOptions,
} from '@lambersond/3d-dice-core'

export type ExampleInteraction = 'popover' | 'custom' | 'none' | 'seed' | 'vtt'

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
  /** Keep this roll's dice flickable after they settle (re-flick a resting die). */
  enableFlickOnSettled?: boolean
  /** Which interaction layer renders over the dice. */
  interaction: ExampleInteraction
}

const TRANSIENT: RemovalOptions = { style: 'shrink', dwellMs: 2000 }
const TRANSIENT_LINGER: RemovalOptions = { style: 'shrink', dwellMs: 4000 }
const PERSIST: RemovalOptions = { style: 'none' }

export const EXAMPLES: ExampleConfig[] = [
  {
    slug: 'basic',
    label: 'Basic',
    category: 'Basic',
    description:
      'Physical rolls. Hover a settled die to read its value. Dice fade out after a moment.',
    deterministic: false,
    persistent: false,
    removal: TRANSIENT,
    renderer: { enableDiceSelection: true },
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
    slug: 'basic-flickable',
    label: 'Basic · flickable',
    category: 'Basic',
    description:
      'Physical rolls. Hover a settled die to read it; grab to flick — even mid-roll — and it rerolls. Dice fade out after a moment.',
    deterministic: false,
    persistent: false,
    removal: TRANSIENT,
    enableFlickOnSettled: true,
    renderer: {
      enableDiceSelection: true,
      enableDiceDrag: true,
      dragRemoval: TRANSIENT,
    },
    interaction: 'popover',
  },
  {
    slug: 'grab-to-add',
    label: 'Grab to add',
    category: 'Advanced',
    description:
      'No tray: a palette of d4–d20 rests along the bottom, each showing its max face. Grab one and flick to roll; right-click while holding to add more of that die in a ring, then release to drop them all together. Once they settle the roll is recorded and the palette is restored.',
    deterministic: false,
    persistent: true,
    removal: PERSIST,
    enableFlickOnSettled: true,
    renderer: {
      enableDiceSelection: true,
      enableDiceDrag: true,
      enableDiceAdd: true,
      dragRemoval: { style: 'none' },
    },
    interaction: 'seed',
  },
  {
    slug: 'vtt',
    label: 'VTT',
    category: 'Advanced',
    description:
      'A virtual-tabletop layout: a solid play area with a floating roll log. Grab a die from the table and flick to roll it (right-click while holding to add another), or build a roll in the log with advantage/disadvantage and a modifier. Each throw is its own log entry.',
    deterministic: false,
    persistent: true,
    removal: TRANSIENT,
    renderer: {
      enableDiceSelection: true,
      enableDiceDrag: true,
      enableDiceAdd: true,
      dragRemoval: { style: 'none' },
      dieScale: 65,
    },
    interaction: 'vtt',
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
