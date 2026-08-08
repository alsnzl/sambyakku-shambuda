/**
 * High-refresh-safe stroke reveal playback.
 * Pre-samples path points so 120Hz frames avoid getPointAtLength every tick.
 */

export const STROKE_PLAY_SPEED = 0.256
export const STROKE_PLAY_MIN_MS = 275
export const STROKE_PLAY_LIFT_MS = 69

export function glideEase(t: number): number {
  /* iOS-like ease-out cubic for stroke tip / dash progress */
  const u = 1 - t
  return 1 - u * u * u
}

type Pt = { x: number; y: number }

function samplePath(path: SVGPathElement, length: number): Pt[] {
  const steps = Math.max(48, Math.min(160, Math.ceil(length / 1.5)))
  const pts: Pt[] = new Array(steps + 1)
  for (let i = 0; i <= steps; i++) {
    const p = path.getPointAtLength((length * i) / steps)
    pts[i] = { x: p.x, y: p.y }
  }
  return pts
}

function lerpSample(samples: Pt[], t: number): Pt {
  const n = samples.length - 1
  if (n <= 0) return samples[0] ?? { x: 0, y: 0 }
  const x = Math.max(0, Math.min(1, t)) * n
  const i = Math.min(n - 1, Math.floor(x))
  const f = x - i
  const a = samples[i]!
  const b = samples[i + 1]!
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
}

export type StrokePlaybackOptions = {
  paths: SVGPathElement[]
  tip: SVGCircleElement | null
  strokeWidths: number[]
  speed?: number
  minStrokeMs?: number
  liftMs?: number
  onStep: (step: number) => void
  onDone: () => void
}

/**
 * Freeze ink at a stroke index (inclusive): strokes ≤ step are fully visible,
 * later strokes stay hidden. Tip is hidden (completed-stroke pose).
 */
export function applyStrokeRevealAtStep(
  paths: SVGPathElement[],
  stepIndex: number,
  tip: SVGCircleElement | null = null,
): void {
  const strokeCount = paths.length
  if (strokeCount === 0) return

  const step = Math.max(0, Math.min(strokeCount - 1, stepIndex))

  paths.forEach((el, i) => {
    const raw = el.getTotalLength()
    const length = raw > 0.5 ? raw : 1
    el.style.strokeDasharray = `${length}`
    el.style.strokeDashoffset = i <= step ? '0' : `${length}`
  })

  if (tip) tip.style.opacity = '0'
}

/**
 * Starts rAF reveal. Returns cancel().
 * Progress is wall-clock based (smooth at 60 / 90 / 120 Hz).
 */
export function startStrokeRevealPlayback(opts: StrokePlaybackOptions): () => void {
  const {
    paths,
    tip,
    strokeWidths,
    speed = STROKE_PLAY_SPEED,
    minStrokeMs = STROKE_PLAY_MIN_MS,
    liftMs = STROKE_PLAY_LIFT_MS,
    onStep,
    onDone,
  } = opts

  const strokeCount = paths.length
  if (strokeCount === 0) {
    onDone()
    return () => undefined
  }

  const lengths = paths.map((el) => {
    const len = el.getTotalLength()
    return len > 0.5 ? len : 1
  })
  const samples = paths.map((el, i) => samplePath(el, lengths[i]!))

  const timeline = lengths.map((len) => ({
    ms: Math.max(minStrokeMs, len / speed),
  }))
  let clock = 0
  const starts = timeline.map((entry) => {
    const s = clock
    clock += entry.ms + liftMs
    return s
  })
  const totalMs = Math.max(clock - liftMs, minStrokeMs)

  paths.forEach((el, i) => {
    el.style.strokeDasharray = `${lengths[i]}`
    el.style.strokeDashoffset = `${lengths[i]}`
  })
  if (tip) tip.style.opacity = '0'

  let lastStep = -1
  let lastTipKey = ''
  let raf = 0
  let cancelled = false
  const t0 = performance.now()

  const frame = (now: number) => {
    if (cancelled) return
    const t = now - t0
    let current = -1

    for (let i = 0; i < strokeCount; i++) {
      const local = (t - starts[i]!) / timeline[i]!.ms
      const p = local <= 0 ? 0 : local >= 1 ? 1 : glideEase(local)
      paths[i]!.style.strokeDashoffset = `${lengths[i]! * (1 - p)}`
      if (local > 0 && local < 1) current = i
    }

    if (tip) {
      if (current >= 0) {
        const local = (t - starts[current]!) / timeline[current]!.ms
        const point = lerpSample(samples[current]!, glideEase(Math.max(0, Math.min(1, local))))
        const r = (strokeWidths[current] ?? 12) * 0.32
        const tipKey = `${point.x | 0}:${point.y | 0}:${(r * 10) | 0}`
        if (tipKey !== lastTipKey) {
          lastTipKey = tipKey
          tip.setAttribute('cx', `${point.x}`)
          tip.setAttribute('cy', `${point.y}`)
          tip.setAttribute('r', `${r}`)
        }
        tip.style.opacity = '1'
      } else {
        tip.style.opacity = '0'
        lastTipKey = ''
      }
    }

    const step = current >= 0 ? current : t >= totalMs ? strokeCount : lastStep
    if (step !== lastStep) {
      lastStep = step
      onStep(step)
    }

    if (t < totalMs) {
      raf = requestAnimationFrame(frame)
      return
    }

    paths.forEach((el) => {
      el.style.strokeDashoffset = '0'
    })
    if (tip) tip.style.opacity = '0'
    onStep(strokeCount)
    onDone()
  }

  raf = requestAnimationFrame(frame)

  return () => {
    cancelled = true
    cancelAnimationFrame(raf)
  }
}
