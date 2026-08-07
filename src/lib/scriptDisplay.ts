import type { Letter } from '../data/letters'
import type { ScriptTrack } from '../types/track'
import { usesUnicodeSiddham } from './customScriptFonts'

/**
 * Glyph string for UI / teach / write guide text.
 * - Sanskrit track: always Devanagari
 * - Siddham + Muktam/user: Devanagari codepoints (Siddhaṃ shapes in those faces)
 * - Siddham + Noto Sans Siddham: Unicode Siddham (U+11580+)
 *
 * Stroke *order* still comes from taught/generated path data, not from this string.
 */
export function glyphForTrack(
  letter: Pick<Letter, 'dewa' | 'siddham'>,
  track: ScriptTrack,
): string {
  if (track === 'siddham' && usesUnicodeSiddham()) {
    return letter.siddham || letter.dewa
  }
  return letter.dewa
}

/** Siddham-styled block when a Devanagari string is already available. */
export function siddhamUiFromDewa(deva: string): string {
  return deva
}
