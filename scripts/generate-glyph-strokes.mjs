/**
 * Regenerates brush-writing strokes from the real Noto glyphs.
 *
 * Design goals (vs the previous over-split skeleton):
 *  - Exactly as many strokes as the pedagogical guide in strokes.ts
 *  - Labels come from that guide (no invented "왼쪽 가로 획 2")
 *  - One continuous centreline per stroke — no spur/touch-up re-traces
 *  - Smooth Catmull-Rom paths that cover the glyph ink when brushed
 *
 * Output: src/data/glyphStrokes.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import opentype from 'opentype.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const VB = 240
const PAD = 28
const FONT_SIZE = 1000
const W = VB
const H = VB
const at = (x, y) => y * W + x
const r2 = (n) => Math.round(n * 100) / 100
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
const pt = (i) => [i % W, (i - (i % W)) / W]

function loadFont(file) {
  const buf = fs.readFileSync(path.join(root, 'public', 'fonts', file))
  return opentype.parse(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  )
}

const fonts = {
  deva: loadFont('NotoSansDevanagari.ttf'),
  siddham: loadFont('NotoSansSiddham-Regular.ttf'),
}

function readLetters() {
  const src = fs.readFileSync(path.join(root, 'src', 'data', 'letters.ts'), 'utf8')
  const out = []
  const vowel = /\bv\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'/g
  const cons =
    /\bc\(\s*'[^']+'\s*,\s*\w+\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'/g
  for (const m of src.matchAll(vowel)) out.push({ id: m[1], dewa: m[2], siddham: m[3] })
  for (const m of src.matchAll(cons)) out.push({ id: m[1], dewa: m[2], siddham: m[3] })
  return out
}

/** Pedagogical stroke labels from strokes.ts — this is the target stroke count. */
function readStrokeLabels() {
  const src = fs.readFileSync(path.join(root, 'src', 'data', 'strokes.ts'), 'utf8')
  const out = {}
  const block =
    /([a-z]+):\s*\{\s*dewa:\s*\[([^\]]*)\]\s*,\s*siddham:\s*\[([^\]]*)\]/g
  for (const m of src.matchAll(block)) {
    const parse = (s) =>
      [...s.matchAll(/'([^']+)'/g)].map((x) => x[1])
    out[m[1]] = { dewa: parse(m[2]), siddham: parse(m[3]) }
  }
  return out
}

const LETTERS = readLetters()
const LABELS = readStrokeLabels()
const FALLBACK = {
  dewa: ['윗선(시로레카)', '주요 세로·곡선', '세부·마무리 획'],
  siddham: ['주요 기둥', '가로·곡선 연결', '마무리 획'],
}

function textPath(font, text) {
  const combined = new opentype.Path()
  let penX = 0
  let baseX = 0
  let baseAdv = 0
  for (const ch of Array.from(text)) {
    const glyph = font.charToGlyph(ch)
    if (!glyph) continue
    const adv = (glyph.advanceWidth ?? 0) * (FONT_SIZE / font.unitsPerEm)
    if (adv === 0 && baseAdv > 0) {
      const box = glyph.getPath(0, 0, FONT_SIZE).getBoundingBox()
      const x = baseX + (baseAdv - (box.x2 - box.x1)) / 2 - box.x1
      combined.extend(glyph.getPath(x, 0, FONT_SIZE))
      continue
    }
    combined.extend(glyph.getPath(penX, 0, FONT_SIZE))
    baseX = penX
    baseAdv = adv
    penX += adv
  }
  return combined
}

function fitTransform(box) {
  const w = box.x2 - box.x1
  const h = box.y2 - box.y1
  const scale = Math.min((VB - PAD * 2) / w, (VB - PAD * 2) / h)
  return {
    scale,
    dx: (VB - w * scale) / 2 - box.x1 * scale,
    dy: (VB - h * scale) / 2 - box.y1 * scale,
  }
}

function transformedD(commands, t) {
  const X = (x) => r2(x * t.scale + t.dx)
  const Y = (y) => r2(y * t.scale + t.dy)
  const parts = []
  for (const c of commands) {
    if (c.type === 'M') parts.push(`M${X(c.x)} ${Y(c.y)}`)
    else if (c.type === 'L') parts.push(`L${X(c.x)} ${Y(c.y)}`)
    else if (c.type === 'C')
      parts.push(
        `C${X(c.x1)} ${Y(c.y1)} ${X(c.x2)} ${Y(c.y2)} ${X(c.x)} ${Y(c.y)}`,
      )
    else if (c.type === 'Q')
      parts.push(`Q${X(c.x1)} ${Y(c.y1)} ${X(c.x)} ${Y(c.y)}`)
    else if (c.type === 'Z') parts.push('Z')
  }
  return parts.join('')
}

function flatten(commands, t) {
  const N = 12
  const X = (x) => x * t.scale + t.dx
  const Y = (y) => y * t.scale + t.dy
  const contours = []
  let cur = null
  let sx = 0
  let sy = 0
  let cx = 0
  let cy = 0
  const close = () => {
    if (cur && cur.length > 1) {
      cur.push([sx, sy])
      contours.push(cur)
    }
    cur = null
  }
  for (const c of commands) {
    if (c.type === 'M') {
      close()
      sx = X(c.x)
      sy = Y(c.y)
      cx = sx
      cy = sy
      cur = [[sx, sy]]
    } else if (c.type === 'L') {
      const x = X(c.x)
      const y = Y(c.y)
      cur?.push([x, y])
      cx = x
      cy = y
    } else if (c.type === 'C') {
      const x1 = X(c.x1)
      const y1 = Y(c.y1)
      const x2 = X(c.x2)
      const y2 = Y(c.y2)
      const x = X(c.x)
      const y = Y(c.y)
      for (let i = 1; i <= N; i++) {
        const u = i / N
        const m = 1 - u
        cur?.push([
          m ** 3 * cx + 3 * m * m * u * x1 + 3 * m * u * u * x2 + u ** 3 * x,
          m ** 3 * cy + 3 * m * m * u * y1 + 3 * m * u * u * y2 + u ** 3 * y,
        ])
      }
      cx = x
      cy = y
    } else if (c.type === 'Q') {
      const x1 = X(c.x1)
      const y1 = Y(c.y1)
      const x = X(c.x)
      const y = Y(c.y)
      for (let i = 1; i <= N; i++) {
        const u = i / N
        const m = 1 - u
        cur?.push([
          m * m * cx + 2 * m * u * x1 + u * u * x,
          m * m * cy + 2 * m * u * y1 + u * u * y,
        ])
      }
      cx = x
      cy = y
    } else if (c.type === 'Z') {
      close()
      cx = sx
      cy = sy
    }
  }
  close()
  return contours
}

function rasterize(contours) {
  const ink = new Uint8Array(W * H)
  for (let gy = 0; gy < H; gy++) {
    const py = gy + 0.5
    const xs = []
    for (const c of contours) {
      for (let i = 0; i < c.length - 1; i++) {
        const [ax, ay] = c[i]
        const [bx, by] = c[i + 1]
        if ((ay <= py && by > py) || (by <= py && ay > py)) {
          const t = (py - ay) / (by - ay)
          xs.push({ x: ax + t * (bx - ax), w: by > ay ? 1 : -1 })
        }
      }
    }
    if (xs.length < 2) continue
    xs.sort((a, b) => a.x - b.x)
    let wind = 0
    for (let i = 0; i < xs.length - 1; i++) {
      wind += xs[i].w
      if (wind === 0) continue
      const x0 = Math.max(0, Math.ceil(xs[i].x - 0.5))
      const x1 = Math.min(W - 1, Math.floor(xs[i + 1].x - 0.5))
      for (let gx = x0; gx <= x1; gx++) ink[at(gx, gy)] = 1
    }
  }
  return ink
}

function distanceTransform(ink) {
  const d = new Float32Array(W * H)
  const INF = 1e6
  for (let i = 0; i < d.length; i++) d[i] = ink[i] ? INF : 0
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = at(x, y)
      if (!ink[i]) continue
      d[i] = Math.min(
        d[i],
        d[i - 1] + 1,
        d[i - W] + 1,
        d[i - W - 1] + 1.414,
        d[i - W + 1] + 1.414,
      )
    }
  }
  for (let y = H - 2; y > 0; y--) {
    for (let x = W - 2; x > 0; x--) {
      const i = at(x, y)
      if (!ink[i]) continue
      d[i] = Math.min(
        d[i],
        d[i + 1] + 1,
        d[i + W] + 1,
        d[i + W + 1] + 1.414,
        d[i + W - 1] + 1.414,
      )
    }
  }
  return d
}

function components(ink) {
  const seen = new Uint8Array(W * H)
  const comps = []
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const start = at(x, y)
      if (!ink[start] || seen[start]) continue
      const stack = [start]
      const pix = []
      seen[start] = 1
      while (stack.length) {
        const i = stack.pop()
        pix.push(i)
        const cx = i % W
        const cy = (i - cx) / W
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue
            const nx = cx + dx
            const ny = cy + dy
            if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1) continue
            const j = at(nx, ny)
            if (ink[j] && !seen[j]) {
              seen[j] = 1
              stack.push(j)
            }
          }
        }
      }
      comps.push(pix)
    }
  }
  return comps.sort((a, b) => b.length - a.length)
}

function thin(mask) {
  const P = Uint8Array.from(mask)
  const ring = [
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
  ]
  let changed = true
  while (changed) {
    changed = false
    for (const step of [0, 1]) {
      const kill = []
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const i = at(x, y)
          if (!P[i]) continue
          const n = ring.map(([dx, dy]) => P[at(x + dx, y + dy)])
          const B = n.reduce((a, b) => a + b, 0)
          if (B < 2 || B > 6) continue
          let A = 0
          for (let k = 0; k < 8; k++) if (!n[k] && n[(k + 1) % 8]) A++
          if (A !== 1) continue
          const [p2, , p4, , p6, , p8] = n
          if (step === 0) {
            if (p2 * p4 * p6 || p4 * p6 * p8) continue
          } else if (p2 * p4 * p8 || p2 * p6 * p8) continue
          kill.push(i)
        }
      }
      if (kill.length) {
        changed = true
        for (const i of kill) P[i] = 0
      }
    }
  }
  return P
}

function neighbours(skel, i) {
  const x = i % W
  const y = (i - x) / W
  const out = []
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]) {
    const j = at(x + dx, y + dy)
    if (skel[j]) out.push(j)
  }
  return out
}

const edgeKey = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`)

function skeletonSegments(skel, pixels) {
  const deg = new Map()
  for (const i of pixels) if (skel[i]) deg.set(i, neighbours(skel, i).length)

  const used = new Set()
  const segs = []

  const walk = (start, first) => {
    const pts = [start]
    let prev = start
    let cur = first
    for (;;) {
      pts.push(cur)
      used.add(edgeKey(prev, cur))
      if ((deg.get(cur) ?? 0) !== 2) break
      const next = neighbours(skel, cur).find(
        (n) => n !== prev && !used.has(edgeKey(cur, n)),
      )
      if (next === undefined) break
      prev = cur
      cur = next
    }
    return pts
  }

  const nodes = [...deg.keys()].filter((i) => deg.get(i) !== 2)
  for (const n of nodes) {
    if (deg.get(n) === 0) {
      segs.push([n, n])
      continue
    }
    for (const nb of neighbours(skel, n)) {
      if (used.has(edgeKey(n, nb))) continue
      segs.push(walk(n, nb))
    }
  }
  for (const i of pixels) {
    if (!skel[i] || deg.get(i) !== 2) continue
    if (neighbours(skel, i).every((n) => used.has(edgeKey(i, n)))) continue
    const nb = neighbours(skel, i).find((n) => !used.has(edgeKey(i, n)))
    if (nb === undefined) continue
    const pts = walk(i, nb)
    pts.push(i)
    segs.push(pts)
  }
  return segs.map((s) => s.map(pt))
}

function polyLength(pts) {
  let n = 0
  for (let i = 1; i < pts.length; i++) n += dist(pts[i - 1], pts[i])
  return n
}

function angle(from, to) {
  return Math.atan2(to[1] - from[1], to[0] - from[0])
}

function turn(a, b) {
  let d = Math.abs(a - b)
  if (d > Math.PI) d = 2 * Math.PI - d
  return d
}

function bbox(pts) {
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (const [x, y] of pts) {
    x1 = Math.min(x1, x)
    y1 = Math.min(y1, y)
    x2 = Math.max(x2, x)
    y2 = Math.max(y2, y)
  }
  return { x1, y1, x2, y2 }
}

function rdp(pts, eps) {
  if (pts.length < 3) return pts
  let maxD = -1
  let idx = 0
  const [ax, ay] = pts[0]
  const [bx, by] = pts[pts.length - 1]
  const len = Math.hypot(bx - ax, by - ay) || 1
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i]
    const d = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len
    if (d > maxD) {
      maxD = d
      idx = i
    }
  }
  if (maxD <= eps) return [pts[0], pts[pts.length - 1]]
  return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)]
}

function smoothPts(pts, passes = 3) {
  let out = pts
  for (let p = 0; p < passes; p++) {
    const next = [out[0]]
    for (let i = 1; i < out.length - 1; i++) {
      next.push([
        (out[i - 1][0] + 2 * out[i][0] + out[i + 1][0]) / 4,
        (out[i - 1][1] + 2 * out[i][1] + out[i + 1][1]) / 4,
      ])
    }
    next.push(out[out.length - 1])
    out = next
  }
  return out
}

function resample(pts, step = 2.2) {
  if (pts.length < 2) return pts
  const out = [pts[0]]
  let carry = 0
  for (let i = 1; i < pts.length; i++) {
    let a = out[out.length - 1]
    let b = pts[i]
    let rem = dist(a, b)
    while (carry + rem >= step) {
      const need = step - carry
      const t = need / rem
      const nx = a[0] + (b[0] - a[0]) * t
      const ny = a[1] + (b[1] - a[1]) * t
      out.push([nx, ny])
      a = [nx, ny]
      rem = dist(a, b)
      carry = 0
    }
    carry += rem
  }
  const last = pts[pts.length - 1]
  if (dist(out[out.length - 1], last) > 0.5) out.push(last)
  return out
}

function toPathD(pts) {
  if (pts.length < 2) {
    const [x, y] = pts[0] ?? [0, 0]
    return `M${r2(x)} ${r2(y)}l0.4 0`
  }
  const d = [`M${r2(pts[0][0])} ${r2(pts[0][1])}`]
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d.push(
      `C${r2(c1[0])} ${r2(c1[1])} ${r2(c2[0])} ${r2(c2[1])} ${r2(p2[0])} ${r2(p2[1])}`,
    )
  }
  return d.join('')
}

function orientPoints(pts) {
  if (pts.length < 2) return pts
  const a = pts[0]
  const b = pts[pts.length - 1]
  const dx = Math.abs(b[0] - a[0])
  const dy = Math.abs(b[1] - a[1])
  const flip = dx > dy * 1.6 ? b[0] < a[0] : b[1] < a[1]
  return flip ? [...pts].reverse() : pts
}

function strokeWidth(pts, dt) {
  const vals = []
  for (const [x, y] of pts) {
    const i = at(Math.round(x), Math.round(y))
    if (i >= 0 && i < dt.length && dt[i] > 0) vals.push(dt[i])
  }
  if (!vals.length) return 14
  vals.sort((a, b) => a - b)
  const p = vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.9))]
  return Math.max(10, r2(p * 2.35 + 5.5))
}

function extendEnds(pts, amount) {
  if (amount <= 0 || pts.length < 2) return pts
  const out = [...pts]
  const lead = (a, b) => {
    const len = dist(a, b) || 1
    return [
      a[0] + ((a[0] - b[0]) / len) * amount,
      a[1] + ((a[1] - b[1]) / len) * amount,
    ]
  }
  out.unshift(lead(pts[0], pts[Math.min(2, pts.length - 1)]))
  out.push(lead(pts[pts.length - 1], pts[Math.max(0, pts.length - 3)]))
  return out
}

/** Chain colinear skeleton segments into long continuous strokes. */
function chainSegments(segs) {
  const open = segs
    .map((pts) => ({ pts: resample(smoothPts(rdp(pts, 1.2), 2)), used: false }))
    .filter((s) => s.pts.length >= 2 && polyLength(s.pts) >= 4)

  const key = (p) => `${Math.round(p[0])},${Math.round(p[1])}`
  const endMap = new Map()
  for (const s of open) {
    for (const end of [s.pts[0], s.pts[s.pts.length - 1]]) {
      const k = key(end)
      if (!endMap.has(k)) endMap.set(k, [])
      endMap.get(k).push(s)
    }
  }

  const chains = []
  const order = [...open].sort((a, b) => polyLength(b.pts) - polyLength(a.pts))

  for (const seed of order) {
    if (seed.used) continue
    seed.used = true
    let pts = [...seed.pts]

    for (const dir of ['tail', 'head']) {
      for (;;) {
        const tip = dir === 'tail' ? pts[pts.length - 1] : pts[0]
        const inner =
          dir === 'tail'
            ? pts[Math.max(0, pts.length - 5)]
            : pts[Math.min(4, pts.length - 1)]
        const incoming = angle(inner, tip)
        const cands = (endMap.get(key(tip)) ?? []).filter((s) => !s.used)
        let best = null
        for (const c of cands) {
          const startsHere = key(c.pts[0]) === key(tip)
          const seq = startsHere ? c.pts : [...c.pts].reverse()
          const outward = angle(seq[0], seq[Math.min(4, seq.length - 1)])
          const t = turn(incoming, outward)
          if (t < 0.95 && (!best || t < best.t)) best = { s: c, seq, t }
        }
        if (!best) break
        best.s.used = true
        if (dir === 'tail') pts = pts.concat(best.seq.slice(1))
        else pts = [...best.seq].reverse().slice(0, -1).concat(pts)
      }
    }
    chains.push(orientPoints(pts))
  }
  return chains.sort((a, b) => polyLength(b) - polyLength(a))
}

function isBar(pts, glyph) {
  const b = bbox(pts)
  const gw = glyph.x2 - glyph.x1
  const gh = glyph.y2 - glyph.y1
  const flat = b.y2 - b.y1 < gh * 0.14
  const long = b.x2 - b.x1 > gw * 0.55
  const high = (b.y1 + b.y2) / 2 < glyph.y1 + gh * 0.28
  return flat && long && high
}

function labelMentionsBar(label) {
  return /시로레카|윗선|가로 윗/.test(label)
}

/**
 * Reduce an arbitrary set of centreline chains down to exactly `target`
 * strokes by repeatedly merging the pair that continues most naturally.
 */
function mergeToCount(chains, target) {
  let pool = chains.map((pts) => ({ pts }))
  if (pool.length === 0) return []
  if (pool.length <= target) return pool

  while (pool.length > target) {
    let bestI = 0
    let bestJ = 1
    let bestScore = Infinity
    for (let i = 0; i < pool.length; i++) {
      for (let j = 0; j < pool.length; j++) {
        if (i === j) continue
        const a = pool[i].pts
        const b = pool[j].pts
        const aEnd = a[a.length - 1]
        const bStart = b[0]
        const gap = dist(aEnd, bStart)
        const inDir = angle(a[Math.max(0, a.length - 4)], aEnd)
        const outDir = angle(bStart, b[Math.min(3, b.length - 1)])
        const score = gap + turn(inDir, outDir) * 18
        if (score < bestScore) {
          bestScore = score
          bestI = i
          bestJ = j
        }
      }
    }
    const a = pool[bestI].pts
    const b = pool[bestJ].pts
    const merged = { pts: [...a, ...b] }
    pool = pool.filter((_, k) => k !== bestI && k !== bestJ)
    pool.push(merged)
  }
  return pool
}

/**
 * Order strokes like a hand, then attach guide labels by matching each label's
 * meaning (왼쪽/오른쪽/세로/곡선/점…) to the geometry — so the spoken guide
 * and the brush path agree.
 */
function orderAndLabel(pieces, labels, glyph, script) {
  const n = labels.length
  let bar = null
  let body = [...pieces]

  if (script === 'deva') {
    const bi = body.findIndex((p) => isBar(p.pts, glyph))
    if (bi >= 0) bar = body.splice(bi, 1)[0]
  }

  const barFirst = labelMentionsBar(labels[0] ?? '')
  const barLast = labelMentionsBar(labels[n - 1] ?? '')
  let bodyTarget = n
  if (bar && (barFirst || barLast)) bodyTarget = Math.max(1, n - 1)

  body = mergeToCount(
    body.map((p) => p.pts),
    bodyTarget,
  ).map((p) => ({ pts: orientPoints(p.pts) }))

  // flow-order the body (nearest continuation)
  const ordered = []
  let pen = null
  const remaining = [...body]
  while (remaining.length) {
    let pick = 0
    let best = Infinity
    remaining.forEach((s, i) => {
      const start = s.pts[0]
      const score = pen ? dist(pen, start) : start[1] * 0.7 + start[0]
      if (score < best) {
        best = score
        pick = i
      }
    })
    const chosen = remaining.splice(pick, 1)[0]
    if (pen) {
      const a = chosen.pts[0]
      const b = chosen.pts[chosen.pts.length - 1]
      if (dist(pen, b) + 2 < dist(pen, a)) chosen.pts = [...chosen.pts].reverse()
    }
    ordered.push(chosen)
    pen = chosen.pts[chosen.pts.length - 1]
  }

  let strokes
  if (bar && barFirst) strokes = [{ pts: orientPoints(bar.pts) }, ...ordered]
  else if (bar && barLast) strokes = [...ordered, { pts: orientPoints(bar.pts) }]
  else if (bar) strokes = [{ pts: orientPoints(bar.pts) }, ...ordered]
  else strokes = ordered

  while (strokes.length > n) {
    let idx = 0
    let min = Infinity
    strokes.forEach((s, i) => {
      const len = polyLength(s.pts)
      if (len < min) {
        min = len
        idx = i
      }
    })
    const victim = strokes.splice(idx, 1)[0]
    const host = strokes[Math.min(idx, strokes.length - 1)]
    const vStart = victim.pts[0]
    const vEnd = victim.pts[victim.pts.length - 1]
    const hStart = host.pts[0]
    const hEnd = host.pts[host.pts.length - 1]
    if (dist(hEnd, vStart) <= dist(vEnd, hStart)) {
      host.pts = [...host.pts, ...victim.pts]
    } else {
      host.pts = [...victim.pts, ...host.pts]
    }
  }
  while (strokes.length < n) {
    let idx = 0
    let max = -1
    strokes.forEach((s, i) => {
      const len = polyLength(s.pts)
      if (len > max) {
        max = len
        idx = i
      }
    })
    const s = strokes[idx]
    if (s.pts.length < 6) break
    const mid = Math.floor(s.pts.length / 2)
    strokes.splice(idx, 1, { pts: s.pts.slice(0, mid + 1) }, { pts: s.pts.slice(mid) })
  }
  strokes = strokes.slice(0, n)
  while (strokes.length < n) strokes.push({ pts: [...strokes[strokes.length - 1].pts] })

  // match non-bar labels to geometry so "왼쪽" really is the left stroke, etc.
  const barIdx = labels.findIndex(labelMentionsBar)
  const freeIdx = strokes.map((_, i) => i).filter((i) => i !== barIdx)
  const freeLabels = labels
    .map((l, i) => ({ l, i }))
    .filter(({ i }) => i !== barIdx)
  const freeStrokes = freeIdx.map((i) => strokes[i])

  const used = new Set()
  const assigned = new Array(n)

  if (barIdx >= 0 && bar) {
    // keep bar stroke in the guide slot
    const bi = strokes.findIndex((s) => isBar(s.pts, glyph))
    assigned[barIdx] = strokes[bi >= 0 ? bi : 0]
    used.add(bi >= 0 ? bi : 0)
  }

  for (const { l, i } of freeLabels) {
    let best = -1
    let bestScore = -Infinity
    freeStrokes.forEach((s, local) => {
      const global = freeIdx[local]
      if (used.has(global)) return
      const score = scoreStrokeForLabel(s.pts, l, glyph)
      if (score > bestScore) {
        bestScore = score
        best = global
      }
    })
    if (best < 0) best = freeIdx.find((g) => !used.has(g)) ?? 0
    used.add(best)
    assigned[i] = strokes[best]
  }

  for (let i = 0; i < n; i++) {
    if (!assigned[i]) {
      const leftover = strokes.findIndex((_, k) => !used.has(k))
      assigned[i] = strokes[leftover >= 0 ? leftover : 0]
      if (leftover >= 0) used.add(leftover)
    }
  }

  return assigned.map((s, i) => ({
    pts: s.pts,
    label: labels[i],
  }))
}

function scoreStrokeForLabel(pts, label, glyph) {
  const b = bbox(pts)
  const cx = (b.x1 + b.x2) / 2
  const cy = (b.y1 + b.y2) / 2
  const gw = glyph.x2 - glyph.x1 || 1
  const gh = glyph.y2 - glyph.y1 || 1
  const dx = Math.max(b.x2 - b.x1, 1)
  const dy = Math.max(b.y2 - b.y1, 1)
  const len = polyLength(pts)
  const straight = dist(pts[0], pts[pts.length - 1]) / Math.max(len, 1)
  let score = 0

  // positional
  if (/왼쪽|좌/.test(label)) score += (1 - (cx - glyph.x1) / gw) * 2
  if (/오른쪽|우|장음|기식|비사르가/.test(label)) score += ((cx - glyph.x1) / gw) * 2
  if (/가운데|본체|주요|기둥/.test(label))
    score += (1 - Math.abs(cx - (glyph.x1 + glyph.x2) / 2) / (gw / 2)) * 2
  if (/위|점|아누스바라/.test(label)) score += (1 - (cy - glyph.y1) / gh) * 1.5
  if (/아래|마무리/.test(label)) score += ((cy - glyph.y1) / gh) * 1.2

  // shape — these dominate so "세로" never lands on a loop
  if (/세로|기둥/.test(label)) score += (dy / dx) * 2.5 + straight * 1.5
  if (/가로/.test(label) && !labelMentionsBar(label)) score += (dx / dy) * 2.5
  if (/곡선|고리|연결|삼각|열린/.test(label))
    score += (1 - straight) * 3 + Math.min(dx, dy) / Math.max(dx, dy)
  if (/점/.test(label)) score += len < 40 ? 3 : -2

  // length preference for body strokes
  if (/기둥|본체|주요/.test(label)) score += Math.min(len / 80, 2)

  return score
}

function coverRatio(strokes, ink, widths) {
  const covered = new Uint8Array(W * H)
  strokes.forEach((s, i) => {
    const radius = widths[i] / 2
    const r = Math.ceil(radius)
    for (let k = 1; k < s.pts.length; k++) {
      const steps = Math.max(1, Math.ceil(dist(s.pts[k - 1], s.pts[k]) * 2))
      for (let t = 0; t <= steps; t++) {
        const cx =
          s.pts[k - 1][0] + ((s.pts[k][0] - s.pts[k - 1][0]) * t) / steps
        const cy =
          s.pts[k - 1][1] + ((s.pts[k][1] - s.pts[k - 1][1]) * t) / steps
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy > radius * radius) continue
            const x = Math.round(cx + dx)
            const y = Math.round(cy + dy)
            if (x < 0 || y < 0 || x >= W || y >= H) continue
            covered[at(x, y)] = 1
          }
        }
      }
    }
  })
  let total = 0
  let hit = 0
  for (let i = 0; i < ink.length; i++) {
    if (!ink[i]) continue
    total++
    if (covered[i]) hit++
  }
  return total ? Math.round((hit / total) * 100) : 100
}

function buildStrokes(script, letterId, text) {
  const font = fonts[script]
  const labels =
    (LABELS[letterId] ?? FALLBACK)[script === 'deva' ? 'dewa' : 'siddham']
  const p = textPath(font, text)
  const rawBox = p.getBoundingBox()
  const t = fitTransform(rawBox)
  const d = transformedD(p.commands, t)
  const contours = flatten(p.commands, t)
  const ink = rasterize(contours)
  const dt = distanceTransform(ink)
  const glyph = {
    x1: rawBox.x1 * t.scale + t.dx,
    y1: rawBox.y1 * t.scale + t.dy,
    x2: rawBox.x2 * t.scale + t.dx,
    y2: rawBox.y2 * t.scale + t.dy,
  }

  // skeleton of every ink component, then chain into long centreline pieces
  const rawChains = []
  for (const comp of components(ink)) {
    const mask = new Uint8Array(W * H)
    for (const i of comp) mask[i] = 1
    const skel = thin(mask)
    const segs = skeletonSegments(skel, comp)
    for (const c of chainSegments(segs)) {
      if (polyLength(c) >= 6 || comp.length < 200) rawChains.push(c)
    }
  }

  // drop tiny noise
  const chains = rawChains
    .filter((c) => polyLength(c) >= 8 || rawChains.length <= labels.length)
    .map((c) => ({ pts: c }))

  // if skeleton failed, fall back to a single vertical mid-line
  if (!chains.length) {
    const cx = (glyph.x1 + glyph.x2) / 2
    chains.push({
      pts: [
        [cx, glyph.y1],
        [cx, glyph.y2],
      ],
    })
  }

  const ordered = orderAndLabel(chains, labels, glyph, script)

  const strokes = ordered.map((s) => {
    let pts = resample(smoothPts(s.pts, 3), 2)
    let width = strokeWidth(pts, dt)
    pts = extendEnds(pts, width * 0.4)
    return {
      d: toPathD(pts),
      width,
      length: r2(Math.max(polyLength(pts), 1)),
      label: s.label,
      _pts: pts,
    }
  })

  // widen brushes until they cover the glyph — never add extra passes
  let coverage = coverRatio(
    strokes.map((s) => ({ pts: s._pts })),
    ink,
    strokes.map((s) => s.width),
  )
  while (coverage < 93) {
    let grew = false
    for (const s of strokes) {
      if (s.width >= 55) continue
      s.width = r2(s.width + 2)
      grew = true
    }
    if (!grew) break
    coverage = coverRatio(
      strokes.map((s) => ({ pts: s._pts })),
      ink,
      strokes.map((s) => s.width),
    )
  }

  for (const s of strokes) delete s._pts

  return { d, strokes, coverage }
}

const dewa = {}
const siddham = {}

for (const l of LETTERS) {
  try {
    dewa[l.id] = buildStrokes('deva', l.id, l.dewa)
  } catch (e) {
    console.warn(`deva ${l.id}: ${e.message}`)
  }
  try {
    siddham[l.id] = buildStrokes('siddham', l.id, l.siddham)
  } catch (e) {
    console.warn(`siddham ${l.id}: ${e.message}`)
  }
}

const all = [
  ...Object.entries(dewa).map(([id, g]) => [`deva ${id}`, g]),
  ...Object.entries(siddham).map(([id, g]) => [`siddham ${id}`, g]),
]
const counts = all.map(([, g]) => g.strokes.length)
const covers = all.map(([, g]) => g.coverage)
console.log(
  `deva ${Object.keys(dewa).length} / siddham ${Object.keys(siddham).length}; strokes ${Math.min(...counts)}-${Math.max(...counts)}`,
)
console.log(
  `coverage avg ${Math.round(covers.reduce((a, b) => a + b, 0) / covers.length)}%, min ${Math.min(...covers)}%`,
)
const worst = all
  .map(([k, g]) => [k, g.coverage])
  .sort((a, b) => a[1] - b[1])
  .slice(0, 6)
console.log('lowest:', worst.map(([k, v]) => `${k} ${v}%`).join(', '))
console.log(
  'sample ka:',
  dewa.ka?.strokes.map((s) => `${s.label}(${Math.round(s.length)})`).join(' → '),
)

for (const g of [...Object.values(dewa), ...Object.values(siddham)]) delete g.coverage

const ts = `/** Auto-generated by scripts/generate-glyph-strokes.mjs — do not edit by hand.
 * Outlines and centrelines come from Noto Sans Devanagari / Noto Sans Siddham (SIL OFL 1.1).
 * Stroke count and labels match src/data/strokes.ts.
 */
export type StrokeScript = 'deva' | 'siddham'

export type GlyphStroke = {
  /** brush centreline, in the 0 0 240 240 viewBox */
  d: string
  /** brush thickness that covers this stroke's ink */
  width: number
  /** centreline length, used to pace the animation */
  length: number
  label: string
}

export type GlyphStrokeData = {
  /** glyph outline path, already fitted to the viewBox */
  d: string
  strokes: GlyphStroke[]
}

export const STROKE_VIEWBOX = 240

const dewa: Record<string, GlyphStrokeData> = ${JSON.stringify(dewa, null, 2)}

const siddham: Record<string, GlyphStrokeData> = ${JSON.stringify(siddham, null, 2)}

export function getGlyphStrokes(
  letterId: string,
  script: StrokeScript,
): GlyphStrokeData | null {
  const map = script === 'deva' ? dewa : siddham
  return map[letterId] ?? null
}
`

fs.writeFileSync(path.join(root, 'src', 'data', 'glyphStrokes.ts'), ts, 'utf8')
