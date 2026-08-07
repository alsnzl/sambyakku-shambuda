import type { PointerEvent as ReactPointerEvent } from 'react'
import type { GlyphStroke } from '../data/glyphStrokes'
import { clientToSvgPoint, pointsToPathD } from './strokeRecord'

/** Light / no-pressure freehand brush (SVG user units). */
export const FREEHAND_INK_WIDTH = 3.2

/** Pressure sensitivity: 1 = current default curve. */
export const PRESSURE_SENS_DEFAULT = 1
export const PRESSURE_SENS_MIN = 0.4
export const PRESSURE_SENS_MAX = 2

export type BrushKind = 'pen' | 'brush'

export const BRUSH_OPTIONS: { id: BrushKind; label: string; hint: string }[] = [
  { id: 'brush', label: '붓', hint: '시작·끝이 날카로움' },
  { id: 'pen', label: '펜', hint: '끝도 둥글게' },
]

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

/** Sharp tips at start/end (calligraphy brush). Pen → no taper. */
export function brushTaperMul(progress: number, kind: BrushKind): number {
  if (kind !== 'brush') return 1
  const t = Math.min(1, Math.max(0, progress))
  const edge = 0.16
  const tip = 0.05
  if (t < edge) {
    const u = t / edge
    return tip + (1 - tip) * u * u
  }
  if (t > 1 - edge) {
    const u = (1 - t) / edge
    return tip + (1 - tip) * u * u
  }
  return 1
}

/** Read stylus/touch pressure. Mouse → null (constant width). */
export function readPointerPressure(e: PointerEvent): number | null {
  if (e.pointerType === 'mouse') return null

  if (e.pointerType === 'pen') {
    // S Pen / active stylus — Chrome/Android reports 0–1 while in contact
    if (typeof e.pressure !== 'number' || !Number.isFinite(e.pressure)) return 0.35
    if (e.pressure <= 0) return 0.12
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
 * `sensitivity` 1 = current default curve; higher = wider soft→hard range.
 */
export function pressureToWidth(
  pressure: number | null,
  baseWidth: number,
  sensitivity = 1,
): number {
  if (pressure == null) return baseWidth
  const s = Math.min(PRESSURE_SENS_MAX, Math.max(PRESSURE_SENS_MIN, sensitivity))
  const t = Math.min(1, Math.max(0, pressure))
  // s=1 → min 0.55, max 5, gamma 0.62 (current baseline)
  const minMul = Math.min(0.9, Math.max(0.3, 0.55 + (1 - s) * 0.25))
  const maxMul = Math.min(9, Math.max(1.8, 5 * s))
  const gamma = 0.62 / s
  const curved = t ** gamma
  return r2(baseWidth * (minMul + (maxMul - minMul) * curved))
}

export function averagePressureWidth(
  points: FreehandPoint[],
  baseWidth: number,
  sensitivity = 1,
): number {
  const samples = points.map((pt) => pt.p).filter((p): p is number => p != null)
  if (!samples.length) return baseWidth
  const sorted = [...samples].sort((a, b) => a - b)
  const pick = sorted[Math.floor(sorted.length * 0.62)] ?? sorted[sorted.length - 1]
  return pressureToWidth(pick, baseWidth, sensitivity)
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
  sensitivity = 1,
): GlyphStroke | null {
  const pts = simplifyFreehand(points, 2)
  if (pts.length < 2) return null
  const xy = pts.map((pt) => [pt.x, pt.y] as [number, number])
  return {
    d: pointsToPathD(xy),
    width: averagePressureWidth(pts, baseWidth, sensitivity),
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

/** Pressure + brush taper for live ink / mask. */
export function freehandPressureSegments(
  points: FreehandPoint[],
  baseWidth: number,
  brush: BrushKind = 'brush',
  sensitivity = 1,
): PressureSegment[] {
  if (points.length < 2) return []
  const total = Math.max(polyLength(points), 1e-6)
  let traveled = 0
  const segs: PressureSegment[] = []
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const pt = points[i]
    const segLen = dist(prev, pt)
    const mid = (traveled + segLen * 0.5) / total
    traveled += segLen
    const pressW = pressureToWidth(pt.p ?? prev.p, baseWidth, sensitivity)
    segs.push({
      i,
      x1: prev.x,
      y1: prev.y,
      x2: pt.x,
      y2: pt.y,
      width: r2(Math.max(0.35, pressW * brushTaperMul(mid, brush))),
    })
  }
  return segs
}

function samplePathPoints(d: string, spacing = 2.2): [number, number][] {
  if (typeof document === 'undefined' || !d) return []
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', d)
  svg.appendChild(path)
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'
  document.body.appendChild(svg)
  try {
    const len = path.getTotalLength()
    if (len <= 0) return []
    const n = Math.max(6, Math.ceil(len / spacing))
    const out: [number, number][] = []
    for (let i = 0; i <= n; i++) {
      const p = path.getPointAtLength((len * i) / n)
      out.push([p.x, p.y])
    }
    return out
  } finally {
    svg.remove()
  }
}

/**
 * Render a saved stroke as mask segments (applies brush tip taper).
 * Pen → one thick polyline segment set with constant width.
 */
export function glyphStrokeMaskSegments(
  stroke: GlyphStroke,
  brush: BrushKind = 'brush',
  keyBase = 0,
): PressureSegment[] {
  if (brush === 'pen') {
    // Keep as path-like single width: sample coarsely still ok for mask consistency
    const pts = samplePathPoints(stroke.d, 4)
    if (pts.length < 2) return []
    const segs: PressureSegment[] = []
    for (let i = 1; i < pts.length; i++) {
      segs.push({
        i: keyBase + i,
        x1: pts[i - 1][0],
        y1: pts[i - 1][1],
        x2: pts[i][0],
        y2: pts[i][1],
        width: stroke.width,
      })
    }
    return segs
  }

  const pts = samplePathPoints(stroke.d, 2)
  if (pts.length < 2) return []
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  }
  total = Math.max(total, 1e-6)
  let traveled = 0
  const segs: PressureSegment[] = []
  for (let i = 1; i < pts.length; i++) {
    const segLen = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    const mid = (traveled + segLen * 0.5) / total
    traveled += segLen
    segs.push({
      i: keyBase + i,
      x1: pts[i - 1][0],
      y1: pts[i - 1][1],
      x2: pts[i][0],
      y2: pts[i][1],
      width: r2(Math.max(0.35, stroke.width * brushTaperMul(mid, brush))),
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
