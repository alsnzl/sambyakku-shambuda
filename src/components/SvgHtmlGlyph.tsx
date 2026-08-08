import { STROKE_VIEWBOX } from '../data/glyphStrokes'
import { STROKE_GUIDE_FONT_SIZE } from '../lib/strokeGuideLayout'

type Props = {
  className?: string
  glyph: string
  fontFamily: string
  fontSize?: number
}

/**
 * iOS-only: script glyph via foreignObject + HTML (avoids SVG dotted circles).
 * Vertically centered in the viewBox so aṃ / aḥ line up with taught stroke paths
 * (HTML line metrics ≠ SVG alphabetic baseline at STROKE_GUIDE_Y).
 *
 * Keep layout simple — absolute boxes / translateY often fail to paint in iOS WebKit FO.
 * Put className on the XHTML root: FO CSS color does not cascade into HTML on iOS.
 */
export function SvgHtmlGlyph({
  className,
  glyph,
  fontFamily,
  fontSize = STROKE_GUIDE_FONT_SIZE,
}: Props) {
  return (
    <foreignObject
      x={0}
      y={0}
      width={STROKE_VIEWBOX}
      height={STROKE_VIEWBOX}
      style={{ pointerEvents: 'none', overflow: 'visible' }}
    >
      <div
        {...{ xmlns: 'http://www.w3.org/1999/xhtml' }}
        className={className}
        lang="sa"
        style={{
          width: '100%',
          height: '100%',
          margin: 0,
          padding: 0,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily,
          fontSize: `${fontSize}px`,
          lineHeight: 1,
          textAlign: 'center',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        <span
          style={{
            display: 'block',
            lineHeight: 1,
            color: 'inherit',
            WebkitTextFillColor: 'currentColor',
          }}
        >
          {glyph}
        </span>
      </div>
    </foreignObject>
  )
}
