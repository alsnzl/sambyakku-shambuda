/**
 * True when the glyph includes Unicode combining marks (anusvāra, visarga, mātrā, …).
 * iOS WebKit often shapes those marks in isolation inside SVG <text>, drawing U+25CC
 * dotted circles. Prefer HTML (or path outlines) for such strings on Apple platforms.
 */
export function glyphHasCombiningMarks(glyph: string): boolean {
  return /\p{M}/u.test(glyph)
}
