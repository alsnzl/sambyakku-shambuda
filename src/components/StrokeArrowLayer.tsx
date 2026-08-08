import { useMemo } from 'react'
import type { GlyphStroke } from '../data/glyphStrokes'
import { buildStrokeArrowGuides } from '../lib/strokeArrows'
import './StrokeArrowLayer.css'

type Props = {
  strokes: GlyphStroke[]
  /** Show arrows for strokes with index < revealCount. Omit to show all. */
  revealCount?: number
  /** Dim arrows that are not the latest revealed stroke. */
  emphasizeLatest?: boolean
}

export function StrokeArrowLayer({
  strokes,
  revealCount,
  emphasizeLatest = false,
}: Props) {
  const guides = useMemo(() => buildStrokeArrowGuides(strokes), [strokes])
  const count = revealCount ?? strokes.length

  if (!guides.length || count <= 0) return null

  return (
    <g className="stroke-arrows" aria-hidden="true">
      {guides.map((g) => {
        if (g.index >= count) return null
        const isLatest = emphasizeLatest && g.index === count - 1
        const isPast = emphasizeLatest && g.index < count - 1
        const state = isLatest ? 'is-latest' : isPast ? 'is-past' : ''
        return (
          <g key={`arrow-${g.index}`} className={`stroke-arrow ${state}`}>
            <path className="stroke-arrow__shaft" d={g.shaftD} />
            {g.heads.map((d, i) => (
              <path key={`head-${g.index}-${i}`} className="stroke-arrow__head" d={d} />
            ))}
            <circle
              className="stroke-arrow__dot"
              cx={g.label.x}
              cy={g.label.y}
              r={isLatest ? 6.6 : 5.6}
            />
            <text
              className="stroke-arrow__num"
              x={g.label.x}
              y={g.label.y}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {g.label.n}
            </text>
          </g>
        )
      })}
    </g>
  )
}
