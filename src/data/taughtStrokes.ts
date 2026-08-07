import type { GlyphStrokeData, StrokeScript } from './glyphStrokes'
import store from './taughtStrokes.json'
import {
  getFontMapEntry,
  normalizeTaughtFontMap,
  resolveStrokeFontFace,
  type TaughtFontMap,
} from '../lib/strokeFontScope'
import { getScriptFontChoice } from '../lib/customScriptFonts'

export type TaughtEntry = GlyphStrokeData & {
  taughtAt: string
  note?: string
  /** Script font choice id used when strokes were recorded */
  fontFace?: string
  /** Display label for that font (may include user file name) */
  fontLabel?: string
}

export type TaughtMeta = {
  description: string
  updatedAt: string | null
  taughtCount: { deva: number; siddham: number }
}

/**
 * Per letter: either a legacy flat TaughtEntry, or fontFace → TaughtEntry map.
 * Readers always normalize via strokeFontScope helpers.
 */
export type TaughtLetterSlot = TaughtEntry | TaughtFontMap

export type TaughtStore = {
  meta: TaughtMeta
  deva: Record<string, TaughtLetterSlot>
  siddham: Record<string, TaughtLetterSlot>
}

export const TAUGHT_STROKES = store as TaughtStore

export function getTaughtFontMap(
  letterId: string,
  script: StrokeScript,
): TaughtFontMap {
  return normalizeTaughtFontMap(script, TAUGHT_STROKES[script][letterId])
}

export function getTaughtStrokes(
  letterId: string,
  script: StrokeScript,
  fontFace: string = getScriptFontChoice(script),
): GlyphStrokeData | null {
  const entry = getTaughtEntry(letterId, script, fontFace)
  if (!entry) return null
  return { d: entry.d, strokes: entry.strokes }
}

export function getTaughtEntry(
  letterId: string,
  script: StrokeScript,
  fontFace: string = getScriptFontChoice(script),
): TaughtEntry | null {
  return getFontMapEntry(script, TAUGHT_STROKES[script][letterId], fontFace)
}

export function isTaughtLetter(
  letterId: string,
  script: StrokeScript,
  fontFace?: string | null,
): boolean {
  if (fontFace) {
    return Boolean(getTaughtEntry(letterId, script, fontFace))
  }
  return Object.keys(getTaughtFontMap(letterId, script)).length > 0
}

export function listTaughtLetters(script: StrokeScript): string[] {
  return Object.keys(TAUGHT_STROKES[script]).filter(
    (id) => Object.keys(getTaughtFontMap(id, script)).length > 0,
  )
}

export function listTaughtFontsForLetter(
  letterId: string,
  script: StrokeScript,
): string[] {
  return Object.keys(getTaughtFontMap(letterId, script))
}

export function taughtProgress(): { deva: number; siddham: number; total: number } {
  const deva = listTaughtLetters('deva').length
  const siddham = listTaughtLetters('siddham').length
  return { deva, siddham, total: deva + siddham }
}

/** Ensure writes always nest by resolved fontFace. */
export function setTaughtFontEntry(
  bucket: Record<string, TaughtLetterSlot>,
  letterId: string,
  script: StrokeScript,
  entry: TaughtEntry,
): void {
  const face = resolveStrokeFontFace(script, entry.fontFace)
  const map = normalizeTaughtFontMap(script, bucket[letterId])
  map[face] = {
    ...entry,
    fontFace: face,
    fontLabel: entry.fontLabel,
  }
  bucket[letterId] = map
}
