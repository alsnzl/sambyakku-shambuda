import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ScriptTrack } from '../types/track'
import { STROKE_VIEWBOX, getGlyphStrokes } from '../data/glyphStrokes'
import type { GlyphStroke } from '../data/glyphStrokes'
import {
  defaultLabels,
  getEffectiveGlyphStrokes,
  getTaughtGlyphStrokes,
} from '../lib/strokeRecord'
import {
  BRUSH_OPTIONS,
  FREEHAND_INK_WIDTH,
  PRESSURE_SENS_MAX,
  PRESSURE_SENS_MIN,
  appendSamples,
  collectFreehandSamples,
  commitFreehandStroke,
  freehandPressureSegments,
  glyphStrokeMaskSegments,
  type BrushKind,
  type FreehandPoint,
} from '../lib/freehandStroke'
import {
  getBrushKind,
  getPenOnly,
  getPressureSens,
  setBrushKind,
  setPenOnly,
  setPressureSens,
} from '../lib/prefsStore'
import { scoreLetterWriting, type WritingGrade } from '../lib/writingScore'
import { recordWriteScore } from '../lib/learnerStore'
import { StrokeArrowLayer } from './StrokeArrowLayer'
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
  const taughtData = getTaughtGlyphStrokes(letterId, script)
  const data = getEffectiveGlyphStrokes(letterId, script)
  const fallback = getGlyphStrokes(letterId, script)
  const canvasData = data ?? fallback
  const outlineD = canvasData?.d
  const inkWidth = FREEHAND_INK_WIDTH
  const canWatchStrokes = Boolean(taughtData?.strokes.length)

  const [mode, setMode] = useState<PracticeMode>('trace')
  const [playId, setPlayId] = useState(0)
  const [activeStep, setActiveStep] = useState(0)
  const [watchDone, setWatchDone] = useState(false)
  const [drawn, setDrawn] = useState<GlyphStroke[]>([])
  const [redoStack, setRedoStack] = useState<GlyphStroke[]>([])
  const [drawing, setDrawing] = useState<FreehandPoint[]>([])
  const [traceDone, setTraceDone] = useState(false)
  const [grade, setGrade] = useState<WritingGrade | null>(null)
  const [watchBlocked, setWatchBlocked] = useState(false)
  const [brush, setBrush] = useState<BrushKind>(() => getBrushKind())
  const [penOnly, setPenOnlyState] = useState(() => getPenOnly())
  const [pressureSens, setPressureSensState] = useState(() => getPressureSens())

  const theoryStrokes = canvasData?.strokes ?? []
  const theoryCount = theoryStrokes.length
  const steps =
    theoryStrokes.map((s) => s.label).filter(Boolean).length > 0
      ? theoryStrokes.map((s) => s.label)
      : defaultLabels(letterId, track)

  const maskId = `${useId()}-mask`
  const svgRef = useRef<SVGSVGElement>(null)
  const revealRefs = useRef<(SVGPathElement | null)[]>([])
  const tipRef = useRef<SVGCircleElement | null>(null)
  const drawingRef = useRef(false)
  const pointsRef = useRef<FreehandPoint[]>([])

  const resetTrace = useCallback(() => {
    setDrawn([])
    setRedoStack([])
    setDrawing([])
    setActiveStep(0)
    setTraceDone(false)
    setGrade(null)
    drawingRef.current = false
    pointsRef.current = []
  }, [])

  useEffect(() => {
    setMode('trace')
    setWatchBlocked(false)
    resetTrace()
  }, [letterId, script, resetTrace])

  useEffect(() => {
    if (mode !== 'trace') return
    resetTrace()
  }, [mode, resetTrace])

  /** Watch animation — taught strokes only; don't restart when activeStep updates */
  useEffect(() => {
    if (mode !== 'watch' || !taughtData?.strokes.length) return

    let cancelled = false
    let raf = 0
    const strokeCount = taughtData.strokes.length
    const strokeSnapshot = taughtData.strokes.map((s) => ({ ...s }))

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
  }, [mode, playId, letterId, script, taughtData?.strokes.length, taughtData?.d])

  const fontFamily = track === 'sanskrit' ? 'var(--deva)' : 'var(--siddham)'

  function pointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (mode !== 'trace' || traceDone || !outlineD) return
    if (theoryCount > 0 && drawn.length >= theoryCount) return
    if (penOnly && e.pointerType === 'touch') return
    if (e.pointerType === 'pen' && e.buttons === 0) return
    // Tip only — block S Pen button / right-click / eraser side
    if (e.pointerType !== 'touch' && e.button !== 0) return
    e.preventDefault()

    const svg = svgRef.current
    if (!svg) return
    svg.setPointerCapture(e.pointerId)
    drawingRef.current = true
    setActiveStep(drawn.length)

    const samples = collectFreehandSamples(e, svg)
    pointsRef.current = samples
    setDrawing(samples)
  }

  function pointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!drawingRef.current || mode !== 'trace') return
    if (penOnly && e.pointerType === 'touch') return
    if (e.pointerType === 'pen' && e.buttons === 0) return
    const svg = svgRef.current
    if (!svg) return
    const samples = collectFreehandSamples(e, svg)
    pointsRef.current = appendSamples(pointsRef.current, samples)
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
      pressureSens,
    )
    pointsRef.current = []
    setDrawing([])

    if (stroke) {
      setDrawn((ds) => [...ds, stroke])
      setRedoStack([])
      setActiveStep(index + 1)
    }
  }

  function undoStroke() {
    if (mode !== 'trace' || traceDone || drawingRef.current || drawn.length === 0) return
    const last = drawn[drawn.length - 1]
    setDrawn((ds) => ds.slice(0, -1))
    setRedoStack((stack) => [...stack, last])
    setActiveStep(drawn.length - 1)
    setGrade(null)
  }

  function redoStroke() {
    if (mode !== 'trace' || traceDone || drawingRef.current || redoStack.length === 0) return
    if (theoryCount > 0 && drawn.length >= theoryCount) return
    const next = redoStack[redoStack.length - 1]
    setRedoStack((stack) => stack.slice(0, -1))
    setDrawn((ds) => [...ds, next])
    setActiveStep(drawn.length + 1)
    setGrade(null)
  }

  function gradeWriting() {
    if (!theoryStrokes.length || drawn.length === 0) return
    const result = scoreLetterWriting(drawn, theoryStrokes)
    setGrade(result)
    setTraceDone(true)
    recordWriteScore(track, letterId, result.average)
  }

  const liveSegments = freehandPressureSegments(drawing, inkWidth, brush, pressureSens)
  const drawnMaskSegs = drawn.flatMap((s, i) => glyphStrokeMaskSegments(s, brush, i * 1000))

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
            onClick={() => {
              setWatchBlocked(false)
              setMode('trace')
            }}
          >
            따라 쓰기
          </button>
          <button
            type="button"
            className={`write__btn write__btn--ghost motion-press ${mode === 'watch' ? 'is-active' : ''}`}
            onClick={() => {
              if (!canWatchStrokes) {
                setWatchBlocked(true)
                setMode('trace')
                return
              }
              setWatchBlocked(false)
              setMode('watch')
              setPlayId((n) => n + 1)
            }}
          >
            보기
          </button>
          {mode === 'trace' ? (
            <>
              <button
                type="button"
                className="write__btn write__btn--ghost motion-press"
                disabled={drawn.length === 0 || traceDone}
                onClick={undoStroke}
                aria-label="이전 획 취소"
              >
                ← 취소
              </button>
              <button
                type="button"
                className="write__btn write__btn--ghost motion-press"
                disabled={
                  redoStack.length === 0 ||
                  traceDone ||
                  (theoryCount > 0 && drawn.length >= theoryCount)
                }
                onClick={redoStroke}
                aria-label="취소한 획 다시"
              >
                되돌리기
              </button>
              <button type="button" className="write__replay motion-press" onClick={resetTrace}>
                다시
              </button>
            </>
          ) : (
            <button
              type="button"
              className="write__replay motion-press"
              disabled={!canWatchStrokes}
              onClick={() => setPlayId((n) => n + 1)}
            >
              다시 보기
            </button>
          )}
        </div>
      </div>

      {mode === 'trace' ? (
        <details className="write__advanced">
          <summary className="write__advanced-summary">그리기 설정</summary>
          <div className="write__advanced-body">
            <div className="write__brush" role="group" aria-label="붓·펜">
              {BRUSH_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`write__brush-btn motion-press ${brush === opt.id ? 'is-active' : ''}`}
                  title={opt.hint}
                  onClick={() => setBrush(setBrushKind(opt.id))}
                >
                  {opt.label}
                </button>
              ))}
              <button
                type="button"
                className={`write__brush-btn motion-press ${penOnly ? 'is-active' : ''}`}
                title="손바닥·손가락 입력 무시 (S Pen만)"
                onClick={() => setPenOnlyState(setPenOnly(!penOnly))}
              >
                펜만
              </button>
            </div>
            <label className="write__sens">
              <span className="write__sens-label">
                필압 민감도 <strong>{Math.round(pressureSens * 100)}%</strong>
              </span>
              <input
                className="write__sens-range"
                type="range"
                min={PRESSURE_SENS_MIN}
                max={PRESSURE_SENS_MAX}
                step={0.05}
                value={pressureSens}
                aria-label="필압 민감도"
                onChange={(e) => setPressureSensState(setPressureSens(Number(e.target.value)))}
              />
              <span className="write__sens-ends" aria-hidden="true">
                <span>낮음</span>
                <span>기본 100%</span>
                <span>높음</span>
              </span>
            </label>
          </div>
        </details>
      ) : null}

      {watchBlocked ? (
        <p className="write__hint write__hint--warn" role="alert">
          이 글자의 획이 아직 없습니다. 위쪽 「가르치기」 탭에서 먼저 획을 그려 저장해 주세요.
        </p>
      ) : null}

      {mode === 'trace' && !traceDone && (
        <p className="write__hint">
          순서대로 따라 쓰세요
          {theoryCount > 0 ? ` (${drawn.length}/${theoryCount})` : ''}.
          다 쓴 뒤 「채점」을 누르세요.
        </p>
      )}
      {mode === 'trace' && grade && (
        <div className="write__grade">
          <p className="write__flash">
            종합 <strong>{grade.average}점</strong>
            <span className="write__grade-note"> · {grade.feedback}</span>
          </p>
          <ul className="write__grade-metrics">
            <li>
              <span>형태</span>
              <strong>{grade.shapeScore}</strong>
            </li>
            <li>
              <span>순서</span>
              <strong className={grade.orderScore >= 70 ? 'is-good' : 'is-warn'}>
                {grade.orderScore}
              </strong>
            </li>
            <li>
              <span>방향</span>
              <strong className={grade.directionScore >= 70 ? 'is-good' : 'is-warn'}>
                {grade.directionScore}
              </strong>
            </li>
          </ul>
          {grade.perStroke.length > 0 ? (
            <ul className="write__grade-strokes">
              {grade.perStroke.map((s) => (
                <li key={`grade-${s.index}`} className={s.orderOk ? 'is-ok' : 'is-bad'}>
                  <span>
                    {s.index + 1}. {s.label}
                  </span>
                  <span>
                    {s.orderOk ? '순서 맞음' : `이론 ${s.bestMatchIndex + 1}번과 유사`}
                    {' · '}형태 {s.shape}
                    {' · '}방향 {s.direction}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {mode === 'trace' && !traceDone && drawn.length > 0 && (
        <div className="write__actions" style={{ justifyContent: 'center', marginBottom: '0.55rem' }}>
          <button
            type="button"
            className="write__btn motion-press"
            onClick={gradeWriting}
            disabled={theoryCount > 0 && drawn.length < theoryCount}
          >
            {theoryCount > 0 && drawn.length < theoryCount
              ? `채점하기 (${drawn.length}/${theoryCount})`
              : '채점하기'}
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
          onContextMenu={(e) => e.preventDefault()}
        >
          {mode === 'trace' && outlineD ? (
            <>
              <defs>
                <mask id={maskId} maskUnits="userSpaceOnUse">
                  <rect width={STROKE_VIEWBOX} height={STROKE_VIEWBOX} fill="black" />
                  {drawnMaskSegs.map((seg) => (
                    <line
                      key={`mask-${seg.i}`}
                      x1={seg.x1}
                      y1={seg.y1}
                      x2={seg.x2}
                      y2={seg.y2}
                      stroke="white"
                      strokeWidth={seg.width}
                      strokeLinecap={brush === 'brush' ? 'butt' : 'round'}
                      strokeLinejoin="round"
                    />
                  ))}
                  {liveSegments.map((seg) => (
                    <line
                      key={`mask-live-${seg.i}`}
                      x1={seg.x1}
                      y1={seg.y1}
                      x2={seg.x2}
                      y2={seg.y2}
                      stroke="white"
                      strokeWidth={seg.width}
                      strokeLinecap={brush === 'brush' ? 'butt' : 'round'}
                      strokeLinejoin="round"
                    />
                  ))}
                </mask>
              </defs>
              <path className="write__glyph-guide" d={outlineD} />
              <path className="write__glyph-ink" d={outlineD} mask={`url(#${maskId})`} />
            </>
          ) : mode === 'watch' && taughtData ? (
            <>
              <defs>
                <mask id={`${maskId}-watch`} maskUnits="userSpaceOnUse">
                  <rect width={STROKE_VIEWBOX} height={STROKE_VIEWBOX} fill="black" />
                  {taughtData.strokes.map((s, i) => (
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

              <path className="write__glyph-guide" d={taughtData.d} />
              <path
                className={`write__glyph-ink write__glyph-ink--under-arrows ${watchDone ? 'is-done' : ''}`}
                d={taughtData.d}
                mask={`url(#${maskId}-watch)`}
              />
              <StrokeArrowLayer
                strokes={taughtData.strokes}
                revealCount={watchDone ? taughtData.strokes.length : Math.max(activeStep + 1, 1)}
                emphasizeLatest={!watchDone}
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
