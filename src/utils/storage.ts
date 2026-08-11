import type { LabelDimensions, LabelItem } from '../types'

/** @deprecated Local password auth removed — use API login. Kept for type imports. */
export interface SavedAppData {
  items: LabelItem[]
  nextSku: number
  size: LabelDimensions
}
