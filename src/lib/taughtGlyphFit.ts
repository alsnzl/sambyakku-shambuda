import type { GlyphStroke, GlyphStrokeData } from '../data/glyphStrokes'

type Box = { x: number; y: number; w: number; h: number }

/**
 * Legacy recordings were traced over the live font `<text>` guide, whose ink is
 * only ~60–70% of the viewBox-fitted outline `d`. Both come from the same glyph,
 * so a uniform scale + recentre puts the strokes back onto the letter.
 */
const MIN_FIT_SCALE = 1.08
const MAX_FIT_SCALE = 2.4
const MAX_STROKE_WIDTH = 40

const cache = new Map<string, GlyphStrokeData>()

function measureBBox(d: string): Box | null {
  if (typeof document === 'undefined' || !d) return null
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.style.cssText =
    'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden'
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', d)
  svg.appendChild(path)
  document.body.appendChild(svg)
  try {
    const b = path.getBBox()
    if (!(b.width > 0) || !(b.height > 0)) return null
    return { x: b.x, y: b.y, w: b.width, h: b.height }
  } catch {
    return null
  } finally {
    svg.remove()
  }
}

function inkBBox(strokes: GlyphStroke[]): Box | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let half = 0
  for (const s of strokes) {
    const b = measureBBox(s.d)
    if (!b) continue
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.w)
    maxY = Math.max(maxY, b.y + b.h)
    if (s.width > 0) half = Math.max(half, s.width / 2)
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) return null
  return {
    x: minX - half,
    y: minY - half,
    w: maxX - minX + half * 2,
    h: maxY - minY + half * 2,
  }
}

/** Absolute M/L/C/Q/Z only — recorded and generated strokes never use others. */
const SUPPORTED_COMMANDS = /^[MLCQZ\s\-+0-9.,e]+$/
const TOKEN = /([MLCQZ])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/g

function transformPathD(
  d: string,
  map: (x: number, y: number) => [number, number],
): string | null {
  if (!SUPPORTED_COMMANDS.test(d)) return null
  const out: string[] = []
  const nums: number[] = []
  let cmd = ''
  let m: RegExpExecArray | null
  const r2 = (n: number) => Math.round(n * 100) / 100
  const flush = () => {
    if (!cmd) return
    if (cmd === 'Z') {
      out.push('Z')
      return
    }
    if (nums.length % 2 !== 0) return
    const mapped: string[] = []
    for (let i = 0; i < nums.length; i += 2) {
      const [x, y] = map(nums[i], nums[i + 1])
      mapped.push(`${r2(x)} ${r2(y)}`)
    }
    out.push(cmd + mapped.join(' '))
    nums.length = 0
  }
  TOKEN.lastIndex = 0
  while ((m = TOKEN.exec(d))) {
    if (m[1]) {
      flush()
      cmd = m[1].toUpperCase()
      nums.length = 0
    } else {
      nums.push(Number(m[2]))
    }
  }
  flush()
  return out.length ? out.join('') : null
}

/**
 * Scale/centre taught strokes onto their own outline `d` so the reveal
 * animation matches the letter drawn on the same canvas. No-op when the two
 * already agree (generated data) or when geometry cannot be measured.
 */
export function fitStrokesToOutline(
  data: GlyphStrokeData | null,
): GlyphStrokeData | null {
  if (!data || !data.d || data.strokes.length === 0) return data
  const key = `${data.d.length}|${data.d.slice(0, 48)}|${data.strokes.length}|${data.strokes[0].d.slice(0, 48)}`
  const hit = cache.get(key)
  if (hit) return hit

  const outline = measureBBox(data.d)
  const ink = inkBBox(data.strokes)
  if (!outline || !ink) return data

  const scale = Math.min(outline.w / ink.w, outline.h / ink.h)
  if (!(scale >= MIN_FIT_SCALE) || scale > MAX_FIT_SCALE) return data

  const inkCx = ink.x + ink.w / 2
  const inkCy = ink.y + ink.h / 2
  const outCx = outline.x + outline.w / 2
  const outCy = outline.y + outline.h / 2
  const map = (x: number, y: number): [number, number] => [
    (x - inkCx) * scale + outCx,
    (y - inkCy) * scale + outCy,
  ]

  const strokes: GlyphStroke[] = []
  for (const s of data.strokes) {
    const d = transformPathD(s.d, map)
    if (!d) return data
    strokes.push({
      ...s,
      d,
      width: Math.min(s.width * scale, MAX_STROKE_WIDTH),
      length: s.length * scale,
    })
  }
  const fitted: GlyphStrokeData = { ...data, d: data.d, strokes }
  cache.set(key, fitted)
  return fitted
}
