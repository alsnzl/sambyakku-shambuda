import type { PointerEvent as ReactPointerEvent } from 'react'
import type { GlyphStroke } from '../data/glyphStrokes'
import { clientToSvgPoint, pointsToPathD } from './strokeRecord'

/** Light / no-pressure freehand pen (SVG user units). */
export const FREEHAND_INK_WIDTH = 3.2

export type FreehandPoint = {
  x: number
  y: number
  /** 0–1 from PointerEvent.pressure; null if unavailable (mouse / unknown). */
  p: number | null
  /** event.timeStamp (ms) for velocity. */
  t: number
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

/** Start/end taper — brush tip on / off the page. */
export function tipTaperMul(progress: number): number {
  const t = Math.min(1, Math.max(0, progress))
  const edge = 0.15
  const tip = 0.06
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

/**
 * Faster stroke → thinner ink (brush lifting / skimming).
 * speed in SVG units per ms.
 */
export function velocityMul(speed: number): number {
  const s = Math.min(2.8, Math.max(0, speed))
  // slow ≈ 1.2, fast ≈ 0.38
  return 1.2 - (s / 2.8) * 0.82
}

/** Read stylus/touch pressure. Mouse → null (constant pressure base). */
export function readPointerPressure(e: PointerEvent): number | null {
  if (e.pointerType === 'mouse') return null

  if (e.pointerType === 'pen') {
    if (typeof e.pressure !== 'number' || !Number.isFinite(e.pressure)) return 0.3
    if (e.pressure <= 0) return 0.1
    return Math.min(1, e.pressure)
  }

  if (typeof e.pressure === 'number' && e.pressure > 0 && e.pressure < 1 && e.pressure !== 0.5) {
    return e.pressure
  }
  return null
}

/**
 * Map pressure → pen width (high sensitivity).
 * Soft ≈ 0.45× base, hard ≈ 5.5× base. Null pressure → base.
 */
export function pressureToWidth(pressure: number | null, baseWidth: number): number {
  if (pressure == null) return baseWidth
  const t = Math.min(1, Math.max(0, pressure))
  const minMul = 0.45
  const maxMul = 5.5
  const curved = t ** 0.55
  return r2(baseWidth * (minMul + (maxMul - minMul) * curved))
}

/** Combined brush-like width: pressure × tip taper × velocity. */
export function brushLikeWidth(
  pressure: number | null,
  baseWidth: number,
  progress: number,
  speed: number,
): number {
  const w =
    pressureToWidth(pressure, baseWidth) * tipTaperMul(progress) * velocityMul(speed)
  return r2(Math.max(0.35, w))
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
    return {
      x,
      y,
      p: readPointerPressure(ev),
      t: typeof ev.timeStamp === 'number' ? ev.timeStamp : performance.now(),
    }
  })
}

/** Pressure + tip taper + velocity for live ink / mask. */
export function freehandPressureSegments(
  points: FreehandPoint[],
  baseWidth: number,
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
    const dt = Math.max(pt.t - prev.t, 0.5)
    const speed = segLen / dt
    segs.push({
      i,
      x1: prev.x,
      y1: prev.y,
      x2: pt.x,
      y2: pt.y,
      width: brushLikeWidth(pt.p ?? prev.p, baseWidth, mid, speed),
    })
  }
  return segs
}

export function averageBrushWidth(points: FreehandPoint[], baseWidth: number): number {
  const segs = freehandPressureSegments(points, baseWidth)
  if (!segs.length) return baseWidth
  const widths = segs.map((s) => s.width).sort((a, b) => a - b)
  return widths[Math.floor(widths.length * 0.62)] ?? baseWidth
}

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
    width: averageBrushWidth(pts, baseWidth),
    length: r2(Math.max(polyLength(pts), 1)),
    label,
  }
}

export function freehandPreviewPath(points: FreehandPoint[]): string {
  if (points.length < 2) return ''
  return points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ')
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

/** Saved stroke mask with tip taper (velocity not recoverable from path alone). */
export function glyphStrokeMaskSegments(
  stroke: GlyphStroke,
  keyBase = 0,
): PressureSegment[] {
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
      width: r2(Math.max(0.35, stroke.width * tipTaperMul(mid))),
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
    if ((pt.p != null && pt.p !== last.p) || pt.t !== last.t) {
      const next = points.slice()
      next[next.length - 1] = {
        ...last,
        p: pt.p ?? last.p,
        t: pt.t,
      }
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
