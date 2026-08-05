import type { GlyphStroke } from '../data/glyphStrokes'

function dist(a: [number, number], b: [number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

/** Sample points along an SVG path element. */
export function samplePath(
  path: SVGPathElement,
  samples = 32,
): [number, number][] {
  const len = path.getTotalLength()
  if (len <= 0) return []
  const out: [number, number][] = []
  for (let i = 0; i <= samples; i++) {
    const p = path.getPointAtLength((len * i) / samples)
    out.push([p.x, p.y])
  }
  return out
}

function samplePathD(
  d: string,
  samples = 32,
): [number, number][] {
  if (typeof document === 'undefined') return []
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', d)
  svg.appendChild(path)
  document.body.appendChild(svg)
  const pts = samplePath(path, samples)
  svg.remove()
  return pts
}

/**
 * Score freehand stroke against a reference centreline (0–100).
 * Combines coverage of reference by freehand and path similarity.
 */
export function scoreStrokeAgainstRef(
  freehandD: string,
  ref: GlyphStroke,
): number {
  const free = samplePathD(freehandD, 28)
  const guide = samplePathD(ref.d, 28)
  if (free.length < 2 || guide.length < 2) return 0

  const reach = Math.max(18, ref.width * 0.7)

  let hit = 0
  for (const g of guide) {
    let best = Infinity
    for (const f of free) best = Math.min(best, dist(g, f))
    if (best <= reach) hit += 1
  }
  const coverage = hit / guide.length

  let freeHit = 0
  for (const f of free) {
    let best = Infinity
    for (const g of guide) best = Math.min(best, dist(f, g))
    if (best <= reach * 1.15) freeHit += 1
  }
  const precision = freeHit / free.length

  const lenRatio =
    Math.min(free.length, guide.length) / Math.max(free.length, guide.length)

  const score = Math.round((coverage * 0.55 + precision * 0.3 + lenRatio * 0.15) * 100)
  return Math.max(0, Math.min(100, score))
}

export function scoreLetterWriting(
  freehandStrokes: { d: string }[],
  refs: GlyphStroke[],
): { perStroke: number[]; average: number } {
  if (!refs.length) return { perStroke: [], average: 0 }

  const perStroke = refs.map((ref, i) => {
    const free = freehandStrokes[i]
    if (!free) return 0
    return scoreStrokeAgainstRef(free.d, ref)
  })

  // Penalize missing / extra strokes lightly
  const countPenalty =
    freehandStrokes.length === refs.length
      ? 1
      : Math.max(0.55, 1 - Math.abs(freehandStrokes.length - refs.length) * 0.15)

  const avg =
    perStroke.reduce((s, n) => s + n, 0) / Math.max(perStroke.length, 1)
  return {
    perStroke,
    average: Math.round(avg * countPenalty),
  }
}
