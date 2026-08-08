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
}

/**
 * iOS-only: script glyph via foreignObject + HTML (avoids SVG dotted circles).
 *
 * Place the line box so its bottom sits on STROKE_GUIDE_Y — same anchor as
 * SVG <text y={STROKE_GUIDE_Y}>, so aṃ/aḥ stay with taught stroke paths.
 * Avoid position:absolute / relying on flex-center alone (iOS FO often pins to top).
 *
 * className goes on the XHTML root (FO CSS color does not cascade on iOS).
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
          overflow: 'visible',
        }}
      >
        <div
          style={{
            width: '100%',
            height: `${STROKE_GUIDE_Y}px`,
            margin: 0,
            padding: 0,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'flex-end',
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
              /* Noto sits high in the em box; Muktam var is 0 */
              translate: '0 var(--siddham-optical-nudge, 0px)',
            }}
          >
            {glyph}
          </span>
        </div>
      </div>
    </foreignObject>
  )
}
