import type { GlyphStrokeData, StrokeScript } from './glyphStrokes'
import store from './taughtStrokes.json'

export type TaughtEntry = GlyphStrokeData & {
  taughtAt: string
  note?: string
}

export type TaughtMeta = {
  description: string
  updatedAt: string | null
  taughtCount: { deva: number; siddham: number }
}

export type TaughtStore = {
  meta: TaughtMeta
  deva: Record<string, TaughtEntry>
  siddham: Record<string, TaughtEntry>
}

export const TAUGHT_STROKES = store as TaughtStore

export function getTaughtStrokes(
  letterId: string,
  script: StrokeScript,
): GlyphStrokeData | null {
  const entry = TAUGHT_STROKES[script][letterId]
  if (!entry) return null
  const { taughtAt: _, note: __, ...data } = entry
  void _
  void __
  return data
}

export function getTaughtEntry(
  letterId: string,
  script: StrokeScript,
): TaughtEntry | null {
  return TAUGHT_STROKES[script][letterId] ?? null
}

export function isTaughtLetter(letterId: string, script: StrokeScript): boolean {
  return Boolean(TAUGHT_STROKES[script][letterId])
}

export function listTaughtLetters(script: StrokeScript): string[] {
  return Object.keys(TAUGHT_STROKES[script])
}

export function taughtProgress(): { deva: number; siddham: number; total: number } {
  const deva = listTaughtLetters('deva').length
  const siddham = listTaughtLetters('siddham').length
  return { deva, siddham, total: deva + siddham }
}
