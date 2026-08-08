import { glyphHasCombiningMarks, needsIosHtmlCombiningGlyph } from '../lib/complexScriptGlyph'
import {
  STROKE_GUIDE_FONT_SIZE,
  STROKE_GUIDE_X,
  STROKE_GUIDE_Y,
} from '../lib/strokeGuideLayout'
import { SvgHtmlGlyph } from './SvgHtmlGlyph'

type Props = {
  className?: string
  glyph: string
  fontFamily: string
  fontSize?: number
  x?: number
  y?: number
  mask?: string
}

/**
 * Canvas guide/ink glyph when no taught outline path is available.
 * Combining marks use HTML foreignObject only on iOS (dotted-circle bug).
 * Elsewhere SVG <text> keeps aṃ/aḥ aligned with taught stroke paths.
 *
 * Mask is applied on a wrapping <g> — mask on <foreignObject> often blanks
 * the glyph entirely in iOS WebKit (aṃ / aḥ watch/intro ink).
 */
export function ScriptCanvasGlyph({
  className,
  glyph,
  fontFamily,
  fontSize = STROKE_GUIDE_FONT_SIZE,
  x = STROKE_GUIDE_X,
  y = STROKE_GUIDE_Y,
  mask,
}: Props) {
  const useHtml =
    glyphHasCombiningMarks(glyph) && needsIosHtmlCombiningGlyph()
  if (useHtml) {
    const html = (
      <SvgHtmlGlyph
        className={className}
        glyph={glyph}
        fontFamily={fontFamily}
        fontSize={fontSize}
      />
    )
    return mask ? <g mask={mask}>{html}</g> : html
  }
  return (
    <text
      className={className}
      x={x}
      y={y}
      textAnchor="middle"
      lang="sa"
      fontSize={fontSize}
      style={{ fontFamily }}
      mask={mask}
    >
      {glyph}
    </text>
  )
}
