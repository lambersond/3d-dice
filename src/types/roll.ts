import type { RollResult } from '@lambersond/3d-dice-core'

/**
 * Identity of whoever produced a roll or chat message. App-owned: the dice
 * engine in @lambersond/3d-dice-core is agnostic about who rolled, so this
 * type lives here and is attached to the engine's output before a roll is
 * logged or broadcast.
 */
export type RollerInfo = {
  id: string
  name?: string
  image?: string
}

/**
 * A roll as it lives in the room log and travels over the wire: the engine's
 * dice outcome (`RollResult`) plus the identity of who rolled it. `grabbed` marks
 * a roll interrupted mid-tumble by a grab (the shown value is the grabbed face).
 */
export type RollEntry = RollResult & { roller: RollerInfo; grabbed?: boolean }
