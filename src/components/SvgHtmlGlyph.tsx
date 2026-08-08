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
 * iOS-only: script glyph via foreignObject + HTML (avoids SVG dotted circles).
 * Anchored like SVG <text textAnchor="middle" y={STROKE_GUIDE_Y}> alphabetic baseline.
 * A small downward nudge offsets flex-end (line-box bottom) vs true alphabetic baseline.
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
          <span
            style={{
              display: 'block',
              lineHeight: 1,
              /* flex-end uses line-box bottom; nudge down toward alphabetic baseline */
              transform: 'translateY(0.18em)',
            }}
          >
            {glyph}
          </span>
        </div>
      </div>
    </foreignObject>
  )
}
