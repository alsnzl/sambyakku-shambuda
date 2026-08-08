type StrokeLike = {
  d: string
  width: number
}

type Props = {
  strokes: StrokeLike[]
  className?: string
  mask?: string
}

/**
 * Render a glyph from taught freehand strokes (same geometry as reveal animation).
 * Prefer this over the coverage outline `d`, which is often a larger font silhouette.
 */
export function TaughtStrokeGlyph({ strokes, className, mask }: Props) {
  if (strokes.length === 0) return null
  return (
    <g className={className} mask={mask} style={{ pointerEvents: 'none' }}>
      {strokes.map((s, i) => (
        <path
          key={`taught-stroke-${i}`}
          d={s.d}
          fill="none"
          stroke="currentColor"
          strokeWidth={s.width > 0 ? s.width : 12}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </g>
  )
}
