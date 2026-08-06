import type { GlyphStroke } from '../data/glyphStrokes'
import { pointsToPathD } from './strokeRecord'

export type StrokeArrowGuide = {
  index: number
  /** Stabilized vector path — same form/proportion as the recording. */
  shaftD: string
  heads: string[]
  label: { x: number; y: number; n: number }
}

const r2 = (n: number) => Math.round(n * 100) / 100

function dist(a: [number, number], b: [number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

function polyLength(pts: [number, number][]) {
  let n = 0
  for (let i = 1; i < pts.length; i++) n += dist(pts[i - 1], pts[i])
  return n
}

function bbox(pts: [number, number][]) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of pts) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    w: Math.max(maxX - minX, 1e-3),
    h: Math.max(maxY - minY, 1e-3),
  }
}

/** Re-fit smoothed points into the original bbox so form/proportion stay. */
function fitToBBox(
  pts: [number, number][],
  target: ReturnType<typeof bbox>,
): [number, number][] {
  const src = bbox(pts)
  return pts.map(([x, y]) => [
    target.minX + ((x - src.minX) / src.w) * target.w,
    target.minY + ((y - src.minY) / src.h) * target.h,
  ])
}

function samplePathEvenly(d: string, spacing = 1.6): [number, number][] {
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
    const n = Math.max(8, Math.ceil(len / spacing))
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

/** Ramer–Douglas–Peucker — removes jitter while keeping major bends. */
function rdp(pts: [number, number][], epsilon: number): [number, number][] {
  if (pts.length < 3) return pts

  const [sx, sy] = pts[0]
  const [ex, ey] = pts[pts.length - 1]
  const dx = ex - sx
  const dy = ey - sy
  const denom = dx * dx + dy * dy || 1e-9

  let maxDist = 0
  let maxIdx = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i]
    const t = ((x - sx) * dx + (y - sy) * dy) / denom
    const px = sx + t * dx
    const py = sy + t * dy
    const d = Math.hypot(x - px, y - py)
    if (d > maxDist) {
      maxDist = d
      maxIdx = i
    }
  }

  if (maxDist < epsilon) return [pts[0], pts[pts.length - 1]]

  const left = rdp(pts.slice(0, maxIdx + 1), epsilon)
  const right = rdp(pts.slice(maxIdx), epsilon)
  return [...left.slice(0, -1), ...right]
}

/** Laplacian smoothing with fixed endpoints — stabilization. */
function laplacianSmooth(
  pts: [number, number][],
  iterations = 5,
  alpha = 0.5,
): [number, number][] {
  if (pts.length < 3) return pts
  let cur = pts.map((p) => [...p] as [number, number])
  for (let n = 0; n < iterations; n++) {
    const next = cur.map((p) => [...p] as [number, number])
    for (let i = 1; i < cur.length - 1; i++) {
      next[i] = [
        cur[i][0] * (1 - alpha) + ((cur[i - 1][0] + cur[i + 1][0]) / 2) * alpha,
        cur[i][1] * (1 - alpha) + ((cur[i - 1][1] + cur[i + 1][1]) / 2) * alpha,
      ]
    }
    cur = next
  }
  // Keep true endpoints.
  cur[0] = pts[0]
  cur[cur.length - 1] = pts[pts.length - 1]
  return cur
}

function chaikin(pts: [number, number][], iterations = 2): [number, number][] {
  let cur = pts
  for (let iter = 0; iter < iterations; iter++) {
    if (cur.length < 2) return cur
    const next: [number, number][] = [cur[0]]
    for (let i = 0; i < cur.length - 1; i++) {
      const [x0, y0] = cur[i]
      const [x1, y1] = cur[i + 1]
      next.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1])
      next.push([0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1])
    }
    next.push(cur[cur.length - 1])
    cur = next
  }
  return cur
}

function resample(pts: [number, number][], spacing = 3): [number, number][] {
  if (pts.length < 2) return pts
  const total = polyLength(pts)
  if (total <= spacing) return [pts[0], pts[pts.length - 1]]
  const out: [number, number][] = [pts[0]]
  let need = spacing
  let i = 1
  let prev = pts[0]
  while (i < pts.length) {
    const cur = pts[i]
    const seg = dist(prev, cur)
    if (seg < 1e-6) {
      i++
      continue
    }
    if (seg >= need) {
      const t = need / seg
      const p: [number, number] = [
        prev[0] + (cur[0] - prev[0]) * t,
        prev[1] + (cur[1] - prev[1]) * t,
      ]
      out.push(p)
      prev = p
      need = spacing
    } else {
      need -= seg
      prev = cur
      i++
    }
  }
  const last = pts[pts.length - 1]
  if (dist(out[out.length - 1], last) > 0.6) out.push(last)
  else out[out.length - 1] = last
  return out
}

/**
 * Light–medium jitter cleanup → clean vector centreline.
 * Midway between raw recording and heavy simplification.
 * Keeps overall form & bbox proportions of the recording.
 */
export function stabilizeStrokePath(d: string): string {
  const raw = samplePathEvenly(d, 1.2)
  if (raw.length < 2) return d

  const originalBox = bbox(raw)
  const total = polyLength(raw)

  // Milder epsilon — remove only micro-jitter, keep letter detail.
  const epsilon = Math.min(1.65, Math.max(0.7, total * 0.006))
  let pts = rdp(raw, epsilon)
  if (pts.length < 2) pts = [raw[0], raw[raw.length - 1]]

  pts = laplacianSmooth(pts, 3, 0.38)
  pts = chaikin(pts, 1)
  pts = resample(pts, Math.max(1.8, Math.min(3.0, total / 40)))
  pts = laplacianSmooth(pts, 1, 0.28)
  pts = fitToBBox(pts, originalBox)

  const clean = pointsToPathD(pts)
  return clean || d
}

function withMeasuredPath<T>(
  d: string,
  fn: (path: SVGPathElement, len: number) => T,
): T | null {
  if (typeof document === 'undefined' || !d) return null
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', d)
  svg.appendChild(path)
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'
  document.body.appendChild(svg)
  try {
    const len = path.getTotalLength()
    if (len <= 0) return null
    return fn(path, len)
  } finally {
    svg.remove()
  }
}

function tangentAt(path: SVGPathElement, len: number, at: number) {
  const t = Math.max(0, Math.min(len, at))
  const p = path.getPointAtLength(t)
  const look = Math.min(len, t + Math.max(4, len * 0.035))
  const q = path.getPointAtLength(look <= t ? Math.max(0, t - 4) : look)
  const angle =
    look <= t
      ? Math.atan2(p.y - q.y, p.x - q.x)
      : Math.atan2(q.y - p.y, q.x - p.x)
  return { x: p.x, y: p.y, angle }
}

function softArrowHead(x: number, y: number, angle: number, size: number): string {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const rot = (px: number, py: number): [number, number] => [
    x + px * cos - py * sin,
    y + px * sin + py * cos,
  ]

  const tip = rot(size * 0.92, 0)
  const left = rot(-size * 0.42, -size * 0.55)
  const right = rot(-size * 0.42, size * 0.55)
  const notch = rot(-size * 0.08, 0)
  const leftWing = rot(size * 0.08, -size * 0.18)
  const rightWing = rot(size * 0.08, size * 0.18)

  return [
    `M${r2(tip[0])} ${r2(tip[1])}`,
    `Q${r2(leftWing[0])} ${r2(leftWing[1])} ${r2(left[0])} ${r2(left[1])}`,
    `Q${r2(notch[0])} ${r2(notch[1])} ${r2(right[0])} ${r2(right[1])}`,
    `Q${r2(rightWing[0])} ${r2(rightWing[1])} ${r2(tip[0])} ${r2(tip[1])}`,
    'Z',
  ].join('')
}

/**
 * Arrow shafts from recorded strokes, cleaned into stable vector lines.
 * Order follows recording order.
 */
function buildGuide(stroke: GlyphStroke, index: number): StrokeArrowGuide | null {
  if (!stroke.d) return null

  const shaftD = stabilizeStrokePath(stroke.d)

  return withMeasuredPath(shaftD, (path, len) => {
    if (len < 3) return null

    const headSize = Math.min(6.2, Math.max(4.4, len * 0.05))
    const tip = tangentAt(path, len, Math.max(0, len - 0.8))
    const heads = [softArrowHead(tip.x, tip.y, tip.angle, headSize)]
    const label = tangentAt(path, len, Math.min(len * 0.06, 7))

    return {
      index,
      shaftD,
      heads,
      label: { x: label.x, y: label.y, n: index + 1 },
    }
  })
}

export function buildStrokeArrowGuides(strokes: GlyphStroke[]): StrokeArrowGuide[] {
  return strokes
    .map((stroke, index) => buildGuide(stroke, index))
    .filter((g): g is StrokeArrowGuide => Boolean(g))
}
