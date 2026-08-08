import { STROKE_VIEWBOX } from '../data/glyphStrokes'
import { STROKE_GUIDE_FONT_SIZE } from '../lib/strokeGuideLayout'

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
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
          paddingTop: `${Math.round(STROKE_VIEWBOX * 0.06)}px`,
          margin: 0,
          fontFamily,
          fontSize: `${fontSize}px`,
          lineHeight: 1,
          color: 'currentColor',
          textAlign: 'center',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        {glyph}
      </div>
    </foreignObject>
  )
}
