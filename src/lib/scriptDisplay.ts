import type { Letter } from '../data/letters'
import type { ScriptTrack } from '../types/track'

/**
 * Muktamsiddham draws Siddhaṃ letterforms on Devanagari codepoints
 * (not Unicode Siddham U+11580+). All Siddham *UI* must render Devanagari
 * characters with `font-family: var(--siddham)`.
 *
 * Unicode Siddham (`letter.siddham`) remains for stroke/cloud tooling that
 * still uses Noto Sans Siddham outlines.
 */
export function glyphForTrack(
  letter: Pick<Letter, 'dewa' | 'siddham'>,
  _track: ScriptTrack,
): string {
  void _track
  void letter.siddham
  return letter.dewa
}

/** Siddham-styled block when a Devanagari string is already available. */
export function siddhamUiFromDewa(deva: string): string {
  return deva
}
