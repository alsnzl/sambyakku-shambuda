import type { GlyphStroke } from '../data/glyphStrokes'
import { pointsToPathD, simplifyPoints } from './strokeRecord'

export const FREEHAND_INK_WIDTH = 22

const r2 = (n: number) => Math.round(n * 100) / 100

function dist(a: [number, number], b: [number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

function polyLength(pts: [number, number][]) {
  let n = 0
  for (let i = 1; i < pts.length; i++) n += dist(pts[i - 1], pts[i])
  return n
}

/** Raw pointer trail → smooth teachable stroke (or null if too short). */
export function commitFreehandStroke(
  points: [number, number][],
  label: string,
  width = FREEHAND_INK_WIDTH,
): GlyphStroke | null {
  const pts = simplifyPoints(points, 2)
  if (pts.length < 2) return null
  return {
    d: pointsToPathD(pts),
    width,
    length: r2(Math.max(polyLength(pts), 1)),
    label,
  }
}

/** Live preview while drawing (polyline, not smoothed yet). */
export function freehandPreviewPath(points: [number, number][]): string {
  if (points.length < 2) return ''
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(' ')
}

export function appendPoint(
  points: [number, number][],
  pt: [number, number],
  minDist = 1.2,
): [number, number][] {
  if (!points.length) return [pt]
  const last = points[points.length - 1]
  if (dist(last, pt) < minDist) return points
  return [...points, pt]
}
