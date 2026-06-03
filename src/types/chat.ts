import type { RollerInfo } from '@/types/roll'

export type ChatMessage = {
  id: string
  at: number
  sender: RollerInfo
  text: string
}
