import type { PointerEvent as ReactPointerEvent } from 'react'
import type { GlyphStroke } from '../data/glyphStrokes'
import { clientToSvgPoint, pointsToPathD } from './strokeRecord'

/** Light / no-pressure freehand brush (SVG user units). */
export const FREEHAND_INK_WIDTH = 7

export type FreehandPoint = {
  x: number
  y: number
  /** 0–1 from PointerEvent.pressure; null if unavailable (mouse / unknown). */
  p: number | null
}

export type PressureSegment = {
  i: number
  x1: number
  y1: number
  x2: number
  y2: number
  width: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

function dist(a: FreehandPoint, b: FreehandPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function polyLength(pts: FreehandPoint[]) {
  let n = 0
  for (let i = 1; i < pts.length; i++) n += dist(pts[i - 1], pts[i])
  return n
}

/** Read stylus/touch pressure. Mouse → null (constant width). */
export function readPointerPressure(e: PointerEvent): number | null {
  if (e.pointerType === 'mouse') return null

  if (e.pointerType === 'pen') {
    // S Pen / active stylus — Chrome/Android reports 0–1 while in contact
    if (typeof e.pressure !== 'number' || !Number.isFinite(e.pressure)) return 0.35
    if (e.pressure <= 0) return 0.15
    return Math.min(1, e.pressure)
  }

  // Finger: some devices expose force via pressure
  if (typeof e.pressure === 'number' && e.pressure > 0 && e.pressure < 1 && e.pressure !== 0.5) {
    return e.pressure
  }
  return null
}

/**
 * Map pressure → brush width.
 * Light tip stays thin; firm press opens a wide range (high sensitivity).
 */
export function pressureToWidth(pressure: number | null, baseWidth: number): number {
  if (pressure == null) return baseWidth
  const t = Math.min(1, Math.max(0, pressure))
  // Soft ≈ 0.65× base, hard ≈ 4.6× base; gamma < 1 reacts early when pressing harder
  const minMul = 0.65
  const maxMul = 4.6
  const curved = t ** 0.62
  return r2(baseWidth * (minMul + (maxMul - minMul) * curved))
}

export function averagePressureWidth(points: FreehandPoint[], baseWidth: number): number {
  const samples = points.map((pt) => pt.p).filter((p): p is number => p != null)
  if (!samples.length) return baseWidth
  const sorted = [...samples].sort((a, b) => a - b)
  const pick = sorted[Math.floor(sorted.length * 0.62)] ?? sorted[sorted.length - 1]
  return pressureToWidth(pick, baseWidth)
}

export function simplifyFreehand(points: FreehandPoint[], minDist = 2): FreehandPoint[] {
  if (points.length < 2) return points
  const out: FreehandPoint[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    if (dist(out[out.length - 1], points[i]) >= minDist) out.push(points[i])
  }
  const last = points[points.length - 1]
  if (dist(out[out.length - 1], last) > 0.5) out.push(last)
  return out.length >= 2 ? out : points
}

/** High-rate samples (helps Galaxy Tab S Pen smoothness). */
export function collectFreehandSamples(
  e: ReactPointerEvent<SVGSVGElement>,
  svg: SVGSVGElement,
): FreehandPoint[] {
  const native = e.nativeEvent
  const batch =
    typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : []
  const events = batch.length > 0 ? batch : [native]
  return events.map((ev) => {
    const [x, y] = clientToSvgPoint(svg, ev.clientX, ev.clientY)
    return { x, y, p: readPointerPressure(ev) }
  })
}

/** Raw pointer trail → smooth teachable stroke (or null if too short). */
export function commitFreehandStroke(
  points: FreehandPoint[],
  label: string,
  baseWidth = FREEHAND_INK_WIDTH,
): GlyphStroke | null {
  const pts = simplifyFreehand(points, 2)
  if (pts.length < 2) return null
  const xy = pts.map((pt) => [pt.x, pt.y] as [number, number])
  return {
    d: pointsToPathD(xy),
    width: averagePressureWidth(pts, baseWidth),
    length: r2(Math.max(polyLength(pts), 1)),
    label,
  }
}

/** Live preview polyline (constant width fallback). */
export function freehandPreviewPath(points: FreehandPoint[]): string {
  if (points.length < 2) return ''
  return points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ')
}

/** Pressure-aware short segments for live ink / mask. */
export function freehandPressureSegments(
  points: FreehandPoint[],
  baseWidth: number,
): PressureSegment[] {
  if (points.length < 2) return []
  const segs: PressureSegment[] = []
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const pt = points[i]
    segs.push({
      i,
      x1: prev.x,
      y1: prev.y,
      x2: pt.x,
      y2: pt.y,
      width: pressureToWidth(pt.p ?? prev.p, baseWidth),
    })
  }
  return segs
}

export function appendPoint(
  points: FreehandPoint[],
  pt: FreehandPoint,
  minDist = 1.05,
): FreehandPoint[] {
  if (!points.length) return [pt]
  const last = points[points.length - 1]
  if (dist(last, pt) < minDist) {
    // Refresh pressure on nearly-stationary tip (important for S Pen hover→press)
    if (pt.p != null && pt.p !== last.p) {
      const next = points.slice()
      next[next.length - 1] = { ...last, p: pt.p }
      return next
    }
    return points
  }
  return [...points, pt]
}

export function appendSamples(
  points: FreehandPoint[],
  samples: FreehandPoint[],
  minDist = 1.05,
): FreehandPoint[] {
  let next = points
  for (const s of samples) next = appendPoint(next, s, minDist)
  return next
}
