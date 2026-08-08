import { STROKE_VIEWBOX } from '../data/glyphStrokes'
import {
  STROKE_GUIDE_FONT_SIZE,
  STROKE_GUIDE_Y,
} from '../lib/strokeGuideLayout'

type Props = {
  className?: string
  glyph: string
  fontFamily: string
  fontSize?: number
  mask?: string
}

/**
 * Script glyph inside SVG via foreignObject + HTML.
 * iOS WebKit shapes Devanagari/Siddham combining marks correctly in HTML,
 * but often paints U+25CC dotted circles for the same string in SVG <text>.
 *
 * Placement mirrors SVG <text textAnchor="middle" y={STROKE_GUIDE_Y}>
 * (alphabetic baseline), so stroke paths recorded against that guide stay aligned.
 */
export function SvgHtmlGlyph({
  className,
  glyph,
  fontFamily,
  fontSize = STROKE_GUIDE_FONT_SIZE,
  mask,
}: Props) {
  return (
    <foreignObject
      className={className}
      x={0}
      y={0}
      width={STROKE_VIEWBOX}
      height={STROKE_VIEWBOX}
      mask={mask}
      style={{ pointerEvents: 'none', overflow: 'visible' }}
    >
      <div
        // React 19 / SVG foreignObject XHTML root
        {...{ xmlns: 'http://www.w3.org/1999/xhtml' }}
        lang="sa"
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          margin: 0,
          padding: 0,
          boxSizing: 'border-box',
          overflow: 'visible',
          pointerEvents: 'none',
        }}
      >
        {/*
          Height = baseline Y; flex-end puts the line box on the alphabetic
          baseline the same way SVG text does at STROKE_GUIDE_Y.
        */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: `${STROKE_GUIDE_Y}px`,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            margin: 0,
            padding: 0,
            boxSizing: 'border-box',
            fontFamily,
            fontSize: `${fontSize}px`,
            lineHeight: 1,
            color: 'currentColor',
            textAlign: 'center',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        >
          <span style={{ display: 'block', lineHeight: 1 }}>{glyph}</span>
        </div>
      </div>
    </foreignObject>
  )
}
