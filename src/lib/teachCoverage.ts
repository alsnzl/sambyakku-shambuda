import type { GlyphStroke } from '../data/glyphStrokes'

function dist(a: [number, number], b: [number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

function samplePathD(d: string, samples = 40): [number, number][] {
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
    const out: [number, number][] = []
    for (let i = 0; i <= samples; i++) {
      const p = path.getPointAtLength((len * i) / samples)
      out.push([p.x, p.y])
    }
    return out
  } finally {
    svg.remove()
  }
}

export type TeachCoverage = {
  score: number
  level: 'ok' | 'warn' | 'bad'
  message: string
}

/**
 * How well freehand strokes cover the reference glyph outline (0–100).
 * Used as a light pre-save sanity check for mothers teaching strokes.
 */
export function assessTeachCoverage(
  strokes: GlyphStroke[],
  outlineD: string | null | undefined,
): TeachCoverage {
  if (!strokes.length) {
    return { score: 0, level: 'bad', message: '그린 획이 없습니다.' }
  }
  if (!outlineD) {
    return {
      score: 70,
      level: 'ok',
      message: '윤곽 기준이 없어 맞춤 점수는 생략합니다.',
    }
  }

  const guide = samplePathD(outlineD, 48)
  if (guide.length < 4) {
    return { score: 70, level: 'ok', message: '윤곽을 읽지 못해 점수는 생략합니다.' }
  }

  const free: [number, number][] = []
  let reach = 18
  for (const s of strokes) {
    free.push(...samplePathD(s.d, 24))
    reach = Math.max(reach, s.width * 0.85)
  }
  if (free.length < 4) {
    return { score: 0, level: 'bad', message: '획이 너무 짧아 저장하기 어렵습니다.' }
  }

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
    if (best <= reach * 1.2) freeHit += 1
  }
  const precision = freeHit / free.length

  const score = Math.round((coverage * 0.65 + precision * 0.35) * 100)
  const clamped = Math.max(0, Math.min(100, score))

  if (clamped >= 62) {
    return {
      score: clamped,
      level: 'ok',
      message: `윤곽 맞춤 ${clamped}점 · 저장해도 괜찮아 보여요.`,
    }
  }
  if (clamped >= 40) {
    return {
      score: clamped,
      level: 'warn',
      message: `윤곽 맞춤 ${clamped}점 · 조금 빗나간 부분이 있어요.`,
    }
  }
  return {
    score: clamped,
    level: 'bad',
    message: `윤곽 맞춤 ${clamped}점 · 글자와 많이 어긋난 것 같아요.`,
  }
}
