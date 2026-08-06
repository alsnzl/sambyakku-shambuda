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

function samplePathD(d: string, samples = 32): [number, number][] {
  if (typeof document === 'undefined') return []
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', d)
  svg.appendChild(path)
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'
  document.body.appendChild(svg)
  try {
    return samplePath(path, samples)
  } finally {
    svg.remove()
  }
}

/**
 * Score freehand stroke shape against a reference centreline (0–100).
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

/** 0–100: does the stroke run in the same direction as the theory stroke? */
export function scoreStrokeDirection(freehandD: string, ref: GlyphStroke): number {
  const free = samplePathD(freehandD, 20)
  const guide = samplePathD(ref.d, 20)
  if (free.length < 2 || guide.length < 2) return 0

  const reach = Math.max(22, ref.width * 0.85)
  const startOk = dist(free[0], guide[0])
  const endOk = dist(free[free.length - 1], guide[guide.length - 1])
  const startRev = dist(free[0], guide[guide.length - 1])
  const endRev = dist(free[free.length - 1], guide[0])

  const forward = (startOk + endOk) / 2
  const reverse = (startRev + endRev) / 2

  // Strongly prefer forward direction matching theory.
  if (reverse + 8 < forward) {
    return Math.max(0, Math.round(35 - (reverse / reach) * 20))
  }

  const startScore = Math.max(0, 1 - startOk / (reach * 1.6))
  const endScore = Math.max(0, 1 - endOk / (reach * 1.6))
  return Math.round((startScore * 0.5 + endScore * 0.5) * 100)
}

export type StrokeGrade = {
  index: number
  label: string
  shape: number
  direction: number
  /** True when this drawn stroke best matches the same theory index. */
  orderOk: boolean
  bestMatchIndex: number
}

export type WritingGrade = {
  /** Combined 0–100 for learner store / summary. */
  average: number
  shapeScore: number
  orderScore: number
  directionScore: number
  perStroke: StrokeGrade[]
  expectedCount: number
  drawnCount: number
  countOk: boolean
  feedback: string
}

function feedbackFor(grade: Omit<WritingGrade, 'feedback'>): string {
  if (!grade.expectedCount) return '이론 획이 없어 채점할 수 없습니다.'
  if (grade.drawnCount === 0) return '먼저 획을 써 주세요.'

  const parts: string[] = []
  if (!grade.countOk) {
    parts.push(
      grade.drawnCount < grade.expectedCount
        ? `획이 ${grade.expectedCount - grade.drawnCount}개 부족합니다.`
        : `획이 ${grade.drawnCount - grade.expectedCount}개 많습니다.`,
    )
  }
  if (grade.orderScore < 70) parts.push('이론값 순서를 다시 확인해 보세요.')
  if (grade.directionScore < 70) parts.push('획의 방향(시작→끝)을 맞춰 보세요.')
  if (grade.shapeScore < 70) parts.push('글자 궤적을 이론값에 더 가까이 따라 써 보세요.')

  if (!parts.length) {
    if (grade.average >= 90) return '이론값 순서와 형태가 훌륭합니다!'
    if (grade.average >= 80) return '잘했어요. 순서와 형태를 잘 지켰습니다.'
    return '좋아요. 한 번 더 다듬어 보세요.'
  }
  return parts.join(' ')
}

/**
 * Grade freehand writing against theory strokes.
 * - Shape: drawn[i] vs theory[i]
 * - Order: whether each drawn stroke best matches the same theory index
 * - Direction: start/end alignment with theory
 */
export function scoreLetterWriting(
  freehandStrokes: { d: string }[],
  refs: GlyphStroke[],
): WritingGrade {
  if (!refs.length) {
    return {
      average: 0,
      shapeScore: 0,
      orderScore: 0,
      directionScore: 0,
      perStroke: [],
      expectedCount: 0,
      drawnCount: freehandStrokes.length,
      countOk: false,
      feedback: '이론 획이 없어 채점할 수 없습니다.',
    }
  }

  const perStroke: StrokeGrade[] = refs.map((ref, i) => {
    const free = freehandStrokes[i]
    if (!free) {
      return {
        index: i,
        label: ref.label,
        shape: 0,
        direction: 0,
        orderOk: false,
        bestMatchIndex: -1,
      }
    }

    const shape = scoreStrokeAgainstRef(free.d, ref)
    const direction = scoreStrokeDirection(free.d, ref)

    let bestMatchIndex = 0
    let bestScore = -1
    for (let j = 0; j < refs.length; j++) {
      const s = scoreStrokeAgainstRef(free.d, refs[j])
      if (s > bestScore) {
        bestScore = s
        bestMatchIndex = j
      }
    }

    return {
      index: i,
      label: ref.label,
      shape,
      direction,
      orderOk: bestMatchIndex === i,
      bestMatchIndex,
    }
  })

  // Extra drawn strokes past theory count hurt order.
  const extra = Math.max(0, freehandStrokes.length - refs.length)
  const matched = perStroke.filter((s) => s.orderOk).length
  const orderScore = Math.round(
    Math.max(0, (matched / refs.length) * 100 - extra * 18),
  )

  const shapeVals = perStroke.map((s) => s.shape)
  const dirVals = perStroke.map((s) => s.direction)
  const shapeScore = Math.round(
    shapeVals.reduce((a, b) => a + b, 0) / Math.max(shapeVals.length, 1),
  )
  const directionScore = Math.round(
    dirVals.reduce((a, b) => a + b, 0) / Math.max(dirVals.length, 1),
  )

  const countOk = freehandStrokes.length === refs.length
  const countFactor = countOk
    ? 1
    : Math.max(0.5, 1 - Math.abs(freehandStrokes.length - refs.length) * 0.18)

  // Shape & order are the main goals; direction supports correct stroke habit.
  const average = Math.round(
    (shapeScore * 0.5 + orderScore * 0.35 + directionScore * 0.15) * countFactor,
  )

  const grade = {
    average: Math.max(0, Math.min(100, average)),
    shapeScore,
    orderScore: Math.max(0, Math.min(100, orderScore)),
    directionScore,
    perStroke,
    expectedCount: refs.length,
    drawnCount: freehandStrokes.length,
    countOk,
    feedback: '',
  }
  grade.feedback = feedbackFor(grade)
  return grade
}
