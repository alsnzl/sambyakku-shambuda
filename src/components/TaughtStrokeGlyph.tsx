import { useMemo } from 'react'
import { fitOutlineToStrokesTransform } from '../lib/fitOutlineToStrokes'

type StrokeLike = {
  d: string
  width: number
}

type Props = {
  /** Coverage / font silhouette path (filled letter shape). */
  d: string
  /** Taught freehand strokes — used only to size/center the outline. */
  strokes: StrokeLike[]
  className?: string
  mask?: string
}

/**
 * Render the taught outline glyph, scaled & centered to the stroke ink bounds
 * so it matches reveal-animation size (outline `d` alone is often larger).
 */
export function TaughtStrokeGlyph({ d, strokes, className, mask }: Props) {
  const transform = useMemo(
    () => (d && strokes.length ? fitOutlineToStrokesTransform(d, strokes) : null),
    [d, strokes],
  )
  if (!d) return null
  return (
    <g
      className={className}
      mask={mask}
      transform={transform ?? undefined}
      style={{ pointerEvents: 'none' }}
    >
      <path d={d} />
    </g>
  )
}
