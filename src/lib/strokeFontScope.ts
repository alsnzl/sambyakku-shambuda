import type { StrokeScript } from '../data/glyphStrokes'
import type { TaughtEntry } from '../data/taughtStrokes'
import {
  getScriptFontLabelForChoice,
  parseScriptFontChoice,
  type ScriptFontChoice,
  type ScriptFontSlot,
} from './customScriptFonts'

/** Outline / generator faces — legacy records without fontFace map here. */
export function defaultStrokeFontFace(script: StrokeScript): ScriptFontChoice {
  return script === 'deva' ? 'noto-deva' : 'noto-siddham'
}

export function scriptToFontSlot(script: StrokeScript): ScriptFontSlot {
  return script
}

/** Canonical face id for storage / lookup (never empty). */
export function resolveStrokeFontFace(
  script: StrokeScript,
  face?: string | null,
): ScriptFontChoice {
  return parseScriptFontChoice(script, face) ?? defaultStrokeFontFace(script)
}

export function strokeFontLabel(
  script: StrokeScript,
  face: string,
  storedLabel?: string | null,
): string {
  const trimmed = storedLabel?.trim()
  if (trimmed) return trimmed
  return getScriptFontLabelForChoice(script, face) ?? face
}

export function isTaughtEntryLike(value: unknown): value is TaughtEntry {
  if (!value || typeof value !== 'object') return false
  const v = value as TaughtEntry
  return typeof v.d === 'string' && Array.isArray(v.strokes)
}

/** letterId → fontFace → entry */
export type TaughtFontMap = Record<string, TaughtEntry>

/**
 * Normalize a letter slot that may be:
 * - legacy flat TaughtEntry
 * - already font-keyed map
 */
export function normalizeTaughtFontMap(
  script: StrokeScript,
  raw: unknown,
): TaughtFontMap {
  if (!raw || typeof raw !== 'object') return {}

  if (isTaughtEntryLike(raw)) {
    const face = resolveStrokeFontFace(script, raw.fontFace)
    return {
      [face]: {
        ...raw,
        fontFace: face,
        fontLabel: strokeFontLabel(script, face, raw.fontLabel),
      },
    }
  }

  const out: TaughtFontMap = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isTaughtEntryLike(value)) continue
    const face = resolveStrokeFontFace(script, value.fontFace ?? key)
    out[face] = {
      ...value,
      fontFace: face,
      fontLabel: strokeFontLabel(script, face, value.fontLabel),
    }
  }
  return out
}

export function getFontMapEntry(
  script: StrokeScript,
  raw: unknown,
  face: string,
): TaughtEntry | null {
  const map = normalizeTaughtFontMap(script, raw)
  const key = resolveStrokeFontFace(script, face)
  return map[key] ?? null
}

export function fontMapHasAny(raw: unknown, script: StrokeScript): boolean {
  return Object.keys(normalizeTaughtFontMap(script, raw)).length > 0
}

export function countFontMapLetters(
  scriptBucket: Record<string, unknown> | undefined,
  script: StrokeScript,
): number {
  if (!scriptBucket) return 0
  let n = 0
  for (const raw of Object.values(scriptBucket)) {
    if (fontMapHasAny(raw, script)) n += 1
  }
  return n
}
