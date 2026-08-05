/** Snap freehand input onto SVG stroke centrelines (magnetic ink fill). */

export type PathProjection = {
  /** arc length from path start */
  length: number
  /** 0–1 along path */
  ratio: number
  /** distance from touch point to path (viewBox units) */
  distance: number
  x: number
  y: number
}

/** Coarse then fine search for nearest point on path. */
export function projectOnPath(
  path: SVGPathElement,
  x: number,
  y: number,
): PathProjection {
  const total = path.getTotalLength()
  if (total <= 0) {
    return { length: 0, ratio: 0, distance: Infinity, x, y }
  }

  let bestLen = 0
  let bestDist = Infinity
  let bestX = x
  let bestY = y

  const coarse = 48
  for (let i = 0; i <= coarse; i++) {
    const len = (i / coarse) * total
    const pt = path.getPointAtLength(len)
    const d = Math.hypot(pt.x - x, pt.y - y)
    if (d < bestDist) {
      bestDist = d
      bestLen = len
      bestX = pt.x
      bestY = pt.y
    }
  }

  const window = total / coarse
  const fine = 24
  const start = Math.max(0, bestLen - window)
  const end = Math.min(total, bestLen + window)
  for (let i = 0; i <= fine; i++) {
    const len = start + ((end - start) * i) / fine
    const pt = path.getPointAtLength(len)
    const d = Math.hypot(pt.x - x, pt.y - y)
    if (d < bestDist) {
      bestDist = d
      bestLen = len
      bestX = pt.x
      bestY = pt.y
    }
  }

  return {
    length: bestLen,
    ratio: bestLen / total,
    distance: bestDist,
    x: bestX,
    y: bestY,
  }
}

export function applyStrokeReveal(
  path: SVGPathElement,
  progress: number,
  totalLength?: number,
) {
  const len = totalLength ?? path.getTotalLength()
  const p = Math.max(0, Math.min(1, progress))
  path.style.strokeDasharray = `${len}`
  path.style.strokeDashoffset = `${len * (1 - p)}`
}

export function resetStrokeReveal(path: SVGPathElement, totalLength?: number) {
  const len = totalLength ?? path.getTotalLength()
  path.style.strokeDasharray = `${len}`
  path.style.strokeDashoffset = `${len}`
}

export function fillStrokeReveal(path: SVGPathElement) {
  path.style.strokeDashoffset = '0'
}

/** Magnetic reach — wider near thick strokes. */
export function snapRadius(strokeWidth: number): number {
  return Math.max(28, strokeWidth * 1.15)
}

export const STROKE_DONE_RATIO = 0.78
