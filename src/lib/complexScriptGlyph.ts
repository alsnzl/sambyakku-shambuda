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
 * Desktop/Android SVG <text> at STROKE_GUIDE_Y stays aligned with taught strokes.
 * On iOS, SvgHtmlGlyph pins the HTML line box to that same baseline Y.
 */
export function needsIosHtmlCombiningGlyph(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod/i.test(ua)) return true
  // iPadOS desktop-UA mode
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}
