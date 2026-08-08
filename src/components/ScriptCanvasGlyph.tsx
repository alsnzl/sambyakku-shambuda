import { glyphHasCombiningMarks } from '../lib/complexScriptGlyph'
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
  /** When true, prefer path outlines elsewhere — still OK to use SVG text. */
  preferSvgText?: boolean
  fontSize?: number
  x?: number
  y?: number
  mask?: string
}

/**
 * Canvas guide/ink glyph: HTML foreignObject when combining marks need iOS-safe shaping.
 */
export function ScriptCanvasGlyph({
  className,
  glyph,
  fontFamily,
  preferSvgText = false,
  fontSize = STROKE_GUIDE_FONT_SIZE,
  x = STROKE_GUIDE_X,
  y = STROKE_GUIDE_Y,
  mask,
}: Props) {
  const useHtml = !preferSvgText && glyphHasCombiningMarks(glyph)
  if (useHtml) {
    return (
      <SvgHtmlGlyph
        className={className}
        glyph={glyph}
        fontFamily={fontFamily}
        fontSize={fontSize}
        mask={mask}
      />
    )
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
