import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ScriptTrack } from '../types/track'
import { STROKE_VIEWBOX, getGlyphStrokes } from '../data/glyphStrokes'
import type { GlyphStroke } from '../data/glyphStrokes'
import {
  avgStrokeWidth,
  clientToSvgPoint,
  defaultLabels,
  getEffectiveGlyphStrokes,
} from '../lib/strokeRecord'
import {
  appendPoint,
  commitFreehandStroke,
  freehandPreviewPath,
} from '../lib/freehandStroke'
import { scoreLetterWriting } from '../lib/writingScore'
import { recordWriteScore } from '../lib/learnerStore'
import './WritePractice.css'

type Props = {
  letterId: string
  glyph: string
  track: ScriptTrack
  onClose?: () => void
}

type PracticeMode = 'trace' | 'watch'

const SPEED = 0.32
const MIN_STROKE_MS = 220
const LIFT_MS = 55
const glide = (t: number) => 1 - (1 - t) ** 1.25

export function WritePractice({ letterId, glyph, track, onClose }: Props) {
  const script = track === 'sanskrit' ? 'deva' : 'siddham'
  const data = getEffectiveGlyphStrokes(letterId, script)
  const fallback = getGlyphStrokes(letterId, script)
  const canvasData = data ?? fallback
  const outlineD = canvasData?.d
  const inkWidth = avgStrokeWidth(canvasData)

  const [mode, setMode] = useState<PracticeMode>('trace')
  const [playId, setPlayId] = useState(0)
  const [activeStep, setActiveStep] = useState(0)
  const [watchDone, setWatchDone] = useState(false)
  const [drawn, setDrawn] = useState<GlyphStroke[]>([])
  const [drawing, setDrawing] = useState<[number, number][]>([])
  const [traceDone, setTraceDone] = useState(false)
  const [writeScore, setWriteScore] = useState<number | null>(null)

  const steps = data?.strokes.map((s) => s.label) ?? defaultLabels(letterId, track)

  const maskId = `${useId()}-mask`
  const svgRef = useRef<SVGSVGElement>(null)
  const revealRefs = useRef<(SVGPathElement | null)[]>([])
  const tipRef = useRef<SVGCircleElement | null>(null)
  const drawingRef = useRef(false)
  const pointsRef = useRef<[number, number][]>([])

  const resetTrace = useCallback(() => {
    setDrawn([])
    setDrawing([])
    setActiveStep(0)
    setTraceDone(false)
    setWriteScore(null)
    drawingRef.current = false
    pointsRef.current = []
  }, [])

  useEffect(() => {
    setMode('trace')
    resetTrace()
  }, [letterId, script, resetTrace])

  useEffect(() => {
    if (mode !== 'trace') return
    resetTrace()
  }, [mode, resetTrace])

  /** Watch animation — don't restart when activeStep updates */
  useEffect(() => {
    if (mode !== 'watch' || !data?.strokes.length) return

    let cancelled = false
    let raf = 0
    const strokeCount = data.strokes.length
    const strokeSnapshot = data.strokes.map((s) => ({ ...s }))

    const start = () => {
      if (cancelled) return
      const paths = revealRefs.current.slice(0, strokeCount)
      if (paths.some((el) => !el) || paths.length < strokeCount) {
        raf = requestAnimationFrame(start)
        return
      }

      const lengths = paths.map((el) => {
        const len = el!.getTotalLength()
        return len > 0.5 ? len : 1
      })

      const timeline = lengths.map((len) => ({
        ms: Math.max(MIN_STROKE_MS, len / SPEED),
      }))
      let clock = 0
      const starts = timeline.map((t) => {
        const s = clock
        clock += t.ms + LIFT_MS
        return s
      })
      const totalMs = Math.max(clock - LIFT_MS, MIN_STROKE_MS)

      paths.forEach((el, i) => {
        el!.style.strokeDasharray = `${lengths[i]}`
        el!.style.strokeDashoffset = `${lengths[i]}`
      })
      if (tipRef.current) tipRef.current.style.opacity = '0'
      setWatchDone(false)
      setActiveStep(0)

      let lastStep = -1
      const t0 = performance.now()

      const frame = (now: number) => {
        if (cancelled) return
        const t = now - t0
        let current = -1

        paths.forEach((el, i) => {
          const local = (t - starts[i]) / timeline[i].ms
          const p = local <= 0 ? 0 : local >= 1 ? 1 : glide(local)
          el!.style.strokeDashoffset = `${lengths[i] * (1 - p)}`
          if (local > 0 && local < 1) current = i
        })

        const tip = tipRef.current
        if (tip && current >= 0) {
          const el = paths[current]!
          const local = (t - starts[current]) / timeline[current].ms
          const point = el.getPointAtLength(lengths[current] * glide(local))
          tip.setAttribute('cx', `${point.x}`)
          tip.setAttribute('cy', `${point.y}`)
          tip.setAttribute('r', `${strokeSnapshot[current].width * 0.32}`)
          tip.style.opacity = '1'
        } else if (tip) {
          tip.style.opacity = '0'
        }

        const step = current >= 0 ? current : t >= totalMs ? strokeCount : lastStep
        if (step !== lastStep) {
          lastStep = step
          setActiveStep(step)
        }

        if (t < totalMs) {
          raf = requestAnimationFrame(frame)
          return
        }

        paths.forEach((el) => {
          el!.style.strokeDashoffset = '0'
        })
        if (tip) tip.style.opacity = '0'
        setActiveStep(strokeCount)
        setWatchDone(true)
      }

      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(start)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [mode, playId, letterId, script, data?.strokes.length, data?.d])

  const fontFamily = track === 'sanskrit' ? 'var(--deva)' : 'var(--siddham)'

  function pointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (mode !== 'trace' || traceDone || !outlineD) return
    e.preventDefault()

    const svg = svgRef.current
    if (!svg) return
    svg.setPointerCapture(e.pointerId)
    drawingRef.current = true
    setActiveStep(drawn.length)

    const pt = clientToSvgPoint(svg, e.clientX, e.clientY)
    pointsRef.current = [pt]
    setDrawing([pt])
  }

  function pointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!drawingRef.current || mode !== 'trace') return
    const svg = svgRef.current
    if (!svg) return
    const pt = clientToSvgPoint(svg, e.clientX, e.clientY)
    pointsRef.current = appendPoint(pointsRef.current, pt)
    setDrawing(pointsRef.current)
  }

  function endStroke(e: React.PointerEvent<SVGSVGElement>) {
    if (mode !== 'trace') return
    if (!drawingRef.current) return
    drawingRef.current = false

    const svg = svgRef.current
    if (svg?.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId)

    const index = drawn.length
    const stroke = commitFreehandStroke(
      pointsRef.current,
      steps[index] ?? `획 ${index + 1}`,
      inkWidth,
    )
    pointsRef.current = []
    setDrawing([])

    if (stroke) {
      setDrawn((ds) => [...ds, stroke])
      setActiveStep(index + 1)
    }
  }

  function gradeWriting() {
    if (!canvasData?.strokes.length || drawn.length === 0) return
    const { average } = scoreLetterWriting(drawn, canvasData.strokes)
    setWriteScore(average)
    setTraceDone(true)
    recordWriteScore(track, letterId, average)
  }

  const previewPath = freehandPreviewPath(drawing)

  return (
    <section className="write" aria-label="쓰기 연습">
      <div className="write__head">
        <div className="write__title-row">
          {onClose ? (
            <button type="button" className="write__back motion-press" onClick={onClose}>
              ← 글자 보기
            </button>
          ) : null}
          <h3>쓰기 연습</h3>
        </div>
        <div className="write__actions">
          <button
            type="button"
            className={`write__btn write__btn--ghost motion-press ${mode === 'trace' ? 'is-active' : ''}`}
            onClick={() => setMode('trace')}
          >
            따라 쓰기
          </button>
          <button
            type="button"
            className={`write__btn write__btn--ghost motion-press ${mode === 'watch' ? 'is-active' : ''}`}
            onClick={() => {
              setMode('watch')
              setPlayId((n) => n + 1)
            }}
          >
            보기
          </button>
          {mode === 'trace' ? (
            <button type="button" className="write__replay motion-press" onClick={resetTrace}>
              다시
            </button>
          ) : (
            <button
              type="button"
              className="write__replay motion-press"
              onClick={() => setPlayId((n) => n + 1)}
            >
              다시 보기
            </button>
          )}
        </div>
      </div>

      {mode === 'trace' && !traceDone && (
        <p className="write__hint">
          글자 안을 <strong>색칠하듯</strong> 그리면 글자가 채워집니다. 획을 다 쓴 뒤 「채점」을
          누르세요.
        </p>
      )}
      {mode === 'trace' && writeScore !== null && (
        <p className="write__flash">
          쓰기 점수 <strong>{writeScore}점</strong>
          {writeScore >= 80 ? ' · 훌륭해요!' : writeScore >= 60 ? ' · 좋아요. 한 번 더!' : ' · 궤적을 다시 따라 써 보세요.'}
        </p>
      )}

      {mode === 'trace' && !traceDone && drawn.length > 0 && (
        <div className="write__actions" style={{ justifyContent: 'center', marginBottom: '0.55rem' }}>
          <button type="button" className="write__btn motion-press" onClick={gradeWriting}>
            채점하기
          </button>
        </div>
      )}

      <div className="write__stage">
        <svg
          ref={svgRef}
          className={`write__svg ${mode === 'trace' ? 'write__svg--trace' : ''}`}
          viewBox={`0 0 ${STROKE_VIEWBOX} ${STROKE_VIEWBOX}`}
          role="img"
          aria-label={`${glyph} ${mode === 'trace' ? '따라 쓰기' : '쓰기 순서 보기'}`}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
        >
          {mode === 'trace' && outlineD ? (
            <>
              <defs>
                <mask id={maskId} maskUnits="userSpaceOnUse">
                  <rect width={STROKE_VIEWBOX} height={STROKE_VIEWBOX} fill="black" />
                  {drawn.map((s, i) => (
                    <path
                      key={`mask-${i}`}
                      d={s.d}
                      stroke="white"
                      strokeWidth={s.width}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  ))}
                  {previewPath && (
                    <path
                      d={previewPath}
                      stroke="white"
                      strokeWidth={inkWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  )}
                </mask>
              </defs>
              <path className="write__glyph-guide" d={outlineD} />
              <path className="write__glyph-ink" d={outlineD} mask={`url(#${maskId})`} />
            </>
          ) : canvasData ? (
            <>
              <defs>
                <mask id={`${maskId}-watch`} maskUnits="userSpaceOnUse">
                  <rect width={STROKE_VIEWBOX} height={STROKE_VIEWBOX} fill="black" />
                  {canvasData.strokes.map((s, i) => (
                    <path
                      key={`${letterId}-${playId}-${i}`}
                      ref={(el) => {
                        revealRefs.current[i] = el
                      }}
                      d={s.d}
                      stroke="white"
                      strokeWidth={s.width}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  ))}
                </mask>
              </defs>

              <path className="write__glyph-guide" d={canvasData.d} />
              <path
                className={`write__glyph-ink ${watchDone ? 'is-done' : ''}`}
                d={canvasData.d}
                mask={`url(#${maskId}-watch)`}
              />
              <circle ref={tipRef} className="write__tip" r={6} cx={-50} cy={-50} />
            </>
          ) : (
            <text
              className="write__glyph-fallback"
              x={STROKE_VIEWBOX / 2}
              y={STROKE_VIEWBOX * 0.7}
              textAnchor="middle"
              style={{ fontFamily }}
            >
              {glyph}
            </text>
          )}
        </svg>

        <ol className="write__steps">
          {(mode === 'trace'
            ? [
                ...drawn.map((s) => s.label),
                ...(traceDone ? [] : [steps[drawn.length] ?? `획 ${drawn.length + 1}`]),
              ]
            : steps
          ).map((label, i) => {
            let state = ''
            if (mode === 'trace') {
              state =
                i < drawn.length
                  ? 'is-done'
                  : i === drawn.length && !traceDone
                    ? 'is-active'
                    : ''
            } else {
              state = activeStep === i ? 'is-active' : activeStep > i ? 'is-done' : ''
            }
            return (
              <li key={`${letterId}-${i}-${label}`} className={`write__step ${state}`}>
                <span className="write__step-num">{i + 1}</span>
                <span className="write__step-label">{label}</span>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
