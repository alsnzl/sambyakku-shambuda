import { STROKE_VIEWBOX } from '../data/glyphStrokes'
import { STROKE_GUIDE_FONT_SIZE } from '../lib/strokeGuideLayout'

type Props = {
  className?: string
  glyph: string
  fontFamily: string
  fontSize?: number
}

/**
 * iOS-only no-outline fallback: script glyph via foreignObject + HTML
 * (avoids SVG dotted circles). Prefer taught SVG path outlines when present.
 *
 * Use **pixel** width/height inside FO — percentage sizing breaks layout on iOS
 * WebKit (glyph jumps top-right / wrong scale). Center with flex in the viewBox.
 * Apply masks on a wrapping <g> in ScriptCanvasGlyph, never on the FO itself.
 *
 * className stays on <foreignObject> so SVG opacity transitions (hero final) work.
 */
export function SvgHtmlGlyph({
  className,
  glyph,
  fontFamily,
  fontSize = STROKE_GUIDE_FONT_SIZE,
}: Props) {
  const box = STROKE_VIEWBOX
  return (
    <foreignObject
      className={className}
      x={0}
      y={0}
      width={box}
      height={box}
      style={{ pointerEvents: 'none', overflow: 'hidden' }}
    >
      <div
        {...{ xmlns: 'http://www.w3.org/1999/xhtml' }}
        lang="sa"
        style={{
          width: box,
          height: box,
          margin: 0,
          padding: 0,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily,
          fontSize: `${fontSize}px`,
          lineHeight: 1,
          color: 'inherit',
          WebkitTextFillColor: 'currentColor',
          textAlign: 'center',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        <span style={{ display: 'block', lineHeight: 1 }}>{glyph}</span>
      </div>
    </foreignObject>
  )
}
