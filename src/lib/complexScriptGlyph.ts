/**
 * True when the glyph includes Unicode combining marks (anusvāra, visarga, mātrā, …).
 * iOS WebKit often shapes those marks in isolation inside SVG <text>, drawing U+25CC
 * dotted circles. Prefer HTML (or path outlines) for such strings on Apple platforms.
 */
export function glyphHasCombiningMarks(glyph: string): boolean {
  return /\p{M}/u.test(glyph)
}

/**
 * Only iPhone/iPad WebKit needs HTML foreignObject for combining marks.
 * Desktop/Android SVG <text> positions aṃ/aḥ correctly against taught strokes.
 * On iOS, center the HTML glyph in the viewBox (not STROKE_GUIDE_Y baseline) —
 * FO line-box metrics differ from SVG text and the baseline approach clipped/misplaced aṃ/aḥ.
 */
export function needsIosHtmlCombiningGlyph(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod/i.test(ua)) return true
  // iPadOS desktop-UA mode
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}
