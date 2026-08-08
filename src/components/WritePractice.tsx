import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ScriptTrack } from '../types/track'
import { STROKE_VIEWBOX, getGlyphStrokes } from '../data/glyphStrokes'
import {
  STROKE_GUIDE_FONT_SIZE,
  STROKE_GUIDE_X,
  STROKE_GUIDE_Y,
} from '../lib/strokeGuideLayout'
import type { GlyphStroke } from '../data/glyphStrokes'
import {
  getEffectiveGlyphStrokes,
  getTaughtGlyphStrokes,
  getTeachingInfo,
} from '../lib/strokeRecord'
import {
  FREEHAND_INK_WIDTH,
  PRESSURE_SENS_MAX,
  PRESSURE_SENS_MIN,
  appendSamples,
  collectFreehandSamples,
  commitFreehandStroke,
  freehandPressureSegments,
  glyphStrokeMaskSegments,
  type FreehandPoint,
} from '../lib/freehandStroke'
import {
  getPenOnly,
  getPressureSens,
  getWatchPlaySpeed,
  setPenOnly,
  setPressureSens,
  setWatchPlaySpeed,
  WATCH_PLAY_SPEED_MAX,
  WATCH_PLAY_SPEED_MIN,
  WATCH_PLAY_SPEED_STEP,
} from '../lib/prefsStore'
import { scoreLetterWriting, type WritingGrade } from '../lib/writingScore'
import { recordWriteScore } from '../lib/learnerStore'
import { StrokeArrowLayer } from './StrokeArrowLayer'
import { StrokeHistoryRail } from './StrokeHistoryRail'
import {
  ensureScriptFontReady,
  getActiveScriptFontStack,
  getScriptFontStack,
  parseScriptFontChoice,
} from '../lib/customScriptFonts'
import { useScriptFontEpoch } from '../lib/useScriptFontEpoch'
import { ScriptFontQuickBar } from './ScriptFontQuickBar'
import { FoldChevron } from './FoldChevron'
import {
  STROKE_PLAY_LIFT_MS,
  STROKE_PLAY_MIN_MS,
  STROKE_PLAY_SPEED,
  applyStrokeRevealAtStep,
  startSingleStrokeRevealPlayback,
  startStrokeRevealPlayback,
} from '../lib/strokePlayback'
import { useLockScrollWhileDrawing } from '../lib/useLockScrollWhileDrawing'
import { ScriptCanvasGlyph } from './ScriptCanvasGlyph'
import { StrokeOrderTrack } from './StrokeOrderTrack'
import './WritePractice.css'

type Props = {
  letterId: string
  glyph: string
  track: ScriptTrack
  onClose?: () => void
  /** When embedded under Learn's font bar, skip the duplicate bar. */
  hideFontBar?: boolean
}

type PracticeMode = 'trace' | 'watch'
type WatchMode = 'playing' | 'scrub' | 'single'

export function WritePractice({ letterId, glyph, track, onClose, hideFontBar = false }: Props) {
  const fontEpoch = useScriptFontEpoch()
  const script = track === 'sanskrit' ? 'deva' : 'siddham'
  const fontSlot = script
  const taughtData = getTaughtGlyphStrokes(letterId, script)
  const teachInfo = getTeachingInfo(letterId, script)
  const data = getEffectiveGlyphStrokes(letterId, script)
  const fallback = getGlyphStrokes(letterId, script)
  const canvasData = data ?? fallback
  const inkWidth = FREEHAND_INK_WIDTH
  const canWatchStrokes = Boolean(taughtData?.strokes.length)
  const fontFamily = getActiveScriptFontStack(fontSlot)
  const recordedFontChoice = parseScriptFontChoice(fontSlot, teachInfo.fontFace)
  const watchFontFamily = recordedFontChoice
    ? getScriptFontStack(fontSlot, recordedFontChoice)
    : fontFamily
  const useWatchPathGuide = Boolean(taughtData?.d)
  const useTracePathGuide = Boolean(taughtData?.d)
  const glyphX = STROKE_GUIDE_X
  const glyphY = STROKE_GUIDE_Y
  const watchFontKey = `${fontEpoch}-${watchFontFamily}`
  const traceFontKey = `${fontEpoch}-${fontFamily}`

  const [mode, setMode] = useState<PracticeMode>('trace')
  const [watchMode, setWatchMode] = useState<WatchMode>('playing')
  const [playId, setPlayId] = useState(0)
  const [activeStep, setActiveStep] = useState(0)
  const [watchDone, setWatchDone] = useState(false)
  /** When set with watchMode `single`, replay only this stroke index */
  const [replayStroke, setReplayStroke] = useState<number | null>(null)
  const [drawn, setDrawn] = useState<GlyphStroke[]>([])
  const [redoStack, setRedoStack] = useState<GlyphStroke[]>([])
  const [drawing, setDrawing] = useState<FreehandPoint[]>([])
  const [traceDone, setTraceDone] = useState(false)
  const [grade, setGrade] = useState<WritingGrade | null>(null)
  const [watchBlocked, setWatchBlocked] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [penOnly, setPenOnlyState] = useState(() => getPenOnly())
  const [pressureSens, setPressureSensState] = useState(() => getPressureSens())
  const [watchPlaySpeed, setWatchPlaySpeedState] = useState(() => getWatchPlaySpeed())
  const brush = 'pen' as const

  const theoryStrokes = canvasData?.strokes ?? []
  const theoryCount = theoryStrokes.length

  const maskId = `${useId()}-mask`
  const svgRef = useRef<SVGSVGElement>(null)
  const revealRefs = useRef<(SVGPathElement | null)[]>([])
  const tipRef = useRef<SVGCircleElement | null>(null)
  const advancedRef = useRef<HTMLDivElement>(null)
  const drawingRef = useRef(false)
  const pointsRef = useRef<FreehandPoint[]>([])
  const [scrollLock, setScrollLock] = useState(false)
  useLockScrollWhileDrawing(scrollLock)

  function toggleAdvanced() {
    setAdvancedOpen((v) => {
      const next = !v
      if (next) {
        requestAnimationFrame(() => {
          advancedRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        })
      }
      return next
    })
  }

  const resetTrace = useCallback(() => {
    setDrawn([])
    setRedoStack([])
    setDrawing([])
    setActiveStep(0)
    setTraceDone(false)
    setGrade(null)
    drawingRef.current = false
    setScrollLock(false)
    pointsRef.current = []
  }, [])

  useEffect(() => {
    setMode('trace')
    setWatchBlocked(false)
    setWatchMode('playing')
    resetTrace()
  }, [letterId, script, resetTrace])

  /** Hide strokes from other fonts when the active face changes. */
  useEffect(() => {
    setMode('trace')
    setWatchBlocked(false)
    setWatchMode('playing')
    resetTrace()
  }, [fontEpoch, resetTrace])

  useEffect(() => {
    if (mode !== 'trace') return
    resetTrace()
  }, [mode, resetTrace])

  useEffect(() => {
    if (!recordedFontChoice) return
    let cancelled = false
    void ensureScriptFontReady(fontSlot, recordedFontChoice).catch(() => {
      if (!cancelled) {
        /* CSS fallback */
      }
    })
    return () => {
      cancelled = true
    }
  }, [fontSlot, recordedFontChoice, letterId])

  const seekWatchTo = useCallback(
    (index: number) => {
      if (!taughtData?.strokes.length) return
      const strokeCount = taughtData.strokes.length
      const step = Math.max(0, Math.min(strokeCount - 1, index))

      setReplayStroke(null)
      setWatchMode('scrub')
      setActiveStep(step)
      setWatchDone(step === strokeCount - 1)

      const apply = () => {
        const paths = revealRefs.current.slice(0, strokeCount)
        if (paths.some((el) => !el) || paths.length < strokeCount) {
          requestAnimationFrame(apply)
          return
        }
        applyStrokeRevealAtStep(paths as SVGPathElement[], step, tipRef.current)
      }
      requestAnimationFrame(apply)
    },
    [taughtData?.strokes.length],
  )

  const replayWatchStroke = useCallback(
    (index: number) => {
      if (!taughtData?.strokes.length) return
      const strokeCount = taughtData.strokes.length
      const step = Math.max(0, Math.min(strokeCount - 1, index))
      setReplayStroke(step)
      setWatchMode('single')
      setWatchDone(false)
      setActiveStep(step)
      setPlayId((n) => n + 1)
    },
    [taughtData?.strokes.length],
  )

  /** Full watch animation — taught strokes only */
  useEffect(() => {
    if (mode !== 'watch' || watchMode !== 'playing' || !taughtData?.strokes.length) return

    let cancelled = false
    let raf = 0
    let stopPlayback: (() => void) | null = null
    const strokeCount = taughtData.strokes.length
    const strokeSnapshot = taughtData.strokes.map((s) => ({ ...s }))

    const start = () => {
      if (cancelled) return
      const paths = revealRefs.current.slice(0, strokeCount)
      if (paths.some((el) => !el) || paths.length < strokeCount) {
        raf = requestAnimationFrame(start)
        return
      }

      setWatchDone(false)
      setActiveStep(0)
      const speedMul = watchPlaySpeed
      stopPlayback = startStrokeRevealPlayback({
        paths: paths as SVGPathElement[],
        tip: tipRef.current,
        strokeWidths: strokeSnapshot.map((s) => s.width),
        speed: STROKE_PLAY_SPEED * speedMul,
        minStrokeMs: Math.max(90, Math.round(STROKE_PLAY_MIN_MS / speedMul)),
        liftMs: Math.max(20, Math.round(STROKE_PLAY_LIFT_MS / speedMul)),
        onStep: setActiveStep,
        onDone: () => {
          if (!cancelled) setWatchDone(true)
        },
      })
    }

    raf = requestAnimationFrame(start)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      stopPlayback?.()
    }
  }, [mode, watchMode, playId, letterId, script, taughtData?.strokes.length, taughtData?.d, watchPlaySpeed])

  /** Single-stroke replay from number tap */
  useEffect(() => {
    if (mode !== 'watch' || watchMode !== 'single' || replayStroke == null || !taughtData?.strokes.length)
      return

    let cancelled = false
    let raf = 0
    let stopPlayback: (() => void) | null = null
    const strokeCount = taughtData.strokes.length
    const strokeSnapshot = taughtData.strokes.map((s) => ({ ...s }))
    const index = Math.max(0, Math.min(strokeCount - 1, replayStroke))
    const speedMul = watchPlaySpeed

    const start = () => {
      if (cancelled) return
      const paths = revealRefs.current.slice(0, strokeCount)
      if (paths.some((el) => !el) || paths.length < strokeCount) {
        raf = requestAnimationFrame(start)
        return
      }

      setWatchDone(false)
      setActiveStep(index)
      stopPlayback = startSingleStrokeRevealPlayback({
        paths: paths as SVGPathElement[],
        tip: tipRef.current,
        strokeWidths: strokeSnapshot.map((s) => s.width),
        strokeIndex: index,
        speed: STROKE_PLAY_SPEED * speedMul,
        minStrokeMs: Math.max(90, Math.round(STROKE_PLAY_MIN_MS / speedMul)),
        onStep: setActiveStep,
        onDone: () => {
          if (cancelled) return
          applyStrokeRevealAtStep(paths as SVGPathElement[], index, tipRef.current)
          setActiveStep(index)
          setWatchDone(index === strokeCount - 1)
          setWatchMode('scrub')
        },
      })
    }

    raf = requestAnimationFrame(start)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      stopPlayback?.()
    }
  }, [
    mode,
    watchMode,
    playId,
    replayStroke,
    letterId,
    script,
    taughtData?.strokes.length,
    taughtData?.d,
    watchPlaySpeed,
  ])

  function pointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (mode !== 'trace' || traceDone || !glyph) return
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
    setScrollLock(true)
    setActiveStep(drawn.length)

    const samples = collectFreehandSamples(e, svg)
    pointsRef.current = samples
    setDrawing(samples)
  }

  function pointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!drawingRef.current || mode !== 'trace') return
    if (penOnly && e.pointerType === 'touch') return
    if (e.pointerType === 'pen' && e.buttons === 0) return
    e.preventDefault()
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
    setScrollLock(false)

    const svg = svgRef.current
    if (svg?.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId)

    const index = drawn.length
    const stroke = commitFreehandStroke(
      pointsRef.current,
      String(index + 1),
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
      <div className="write__chrome">
        {hideFontBar ? null : <ScriptFontQuickBar track={track} />}
        <div className="write__head">
          <div className="write__title-row">
            {onClose ? (
              <button type="button" className="write__back motion-press" onClick={onClose}>
                ← 글자
              </button>
            ) : null}
            <h3>쓰기 연습</h3>
          </div>
          <div className="write__toolbar" role="group" aria-label="연습 모드">
            <div className="write__mode-seg">
              <button
                type="button"
                className={`write__mode-btn motion-press ${mode === 'trace' ? 'is-active' : ''}`}
                aria-pressed={mode === 'trace'}
                onClick={() => {
                  setWatchBlocked(false)
                  setMode('trace')
                }}
              >
                쓰기
              </button>
              <button
                type="button"
                className={`write__mode-btn motion-press ${mode === 'watch' ? 'is-active' : ''}`}
                aria-pressed={mode === 'watch'}
                onClick={() => {
                  if (!canWatchStrokes) {
                    setWatchBlocked(true)
                    setMode('trace')
                    return
                  }
                  setWatchBlocked(false)
                  setReplayStroke(null)
                  setWatchMode('playing')
                  setMode('watch')
                  setPlayId((n) => n + 1)
                }}
              >
                보기
              </button>
            </div>
            <button
              type="button"
              className="write__again motion-press"
              disabled={mode === 'watch' && !canWatchStrokes}
              onClick={() => {
                if (mode === 'trace') resetTrace()
                else {
                  setReplayStroke(null)
                  setWatchMode('playing')
                  setPlayId((n) => n + 1)
                }
              }}
            >
              다시
            </button>
          </div>
        </div>
      </div>

      <div className="write__workspace">
        <div className="write__main">
          <div className="write__canvas-row">
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
              {mode === 'trace' ? (
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
                          strokeLinecap="round"
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
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ))}
                    </mask>
                  </defs>
                  {useTracePathGuide && taughtData?.d ? (
                    <>
                      <path className="write__glyph-guide" d={taughtData.d} />
                      <path
                        className="write__glyph-ink"
                        d={taughtData.d}
                        mask={`url(#${maskId})`}
                      />
                    </>
                  ) : (
                    <>
                      <ScriptCanvasGlyph
                        key={`guide-${traceFontKey}`}
                        className="write__glyph-guide"
                        glyph={glyph}
                        fontFamily={fontFamily}
                        fontSize={STROKE_GUIDE_FONT_SIZE}
                        x={glyphX}
                        y={glyphY}
                      />
                      <ScriptCanvasGlyph
                        key={`ink-${traceFontKey}`}
                        className="write__glyph-ink"
                        glyph={glyph}
                        fontFamily={fontFamily}
                        fontSize={STROKE_GUIDE_FONT_SIZE}
                        x={glyphX}
                        y={glyphY}
                        mask={`url(#${maskId})`}
                      />
                    </>
                  )}
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

                  {useWatchPathGuide ? (
                    <>
                      <path className="write__glyph-guide" d={taughtData.d} />
                      <path
                        className={`write__glyph-ink write__glyph-ink--under-arrows ${watchDone ? 'is-done' : ''}`}
                        d={taughtData.d}
                        mask={`url(#${maskId}-watch)`}
                      />
                    </>
                  ) : (
                    <>
                      <ScriptCanvasGlyph
                        key={`guide-${watchFontKey}`}
                        className="write__glyph-guide"
                        glyph={glyph}
                        fontFamily={watchFontFamily}
                        fontSize={STROKE_GUIDE_FONT_SIZE}
                        x={glyphX}
                        y={glyphY}
                      />
                      <ScriptCanvasGlyph
                        key={`ink-${watchFontKey}`}
                        className={`write__glyph-ink write__glyph-ink--under-arrows ${watchDone ? 'is-done' : ''}`}
                        glyph={glyph}
                        fontFamily={watchFontFamily}
                        fontSize={STROKE_GUIDE_FONT_SIZE}
                        x={glyphX}
                        y={glyphY}
                        mask={`url(#${maskId}-watch)`}
                      />
                    </>
                  )}
                  <StrokeArrowLayer
                    strokes={taughtData.strokes}
                    revealCount={
                      watchMode === 'scrub'
                        ? activeStep + 1
                        : watchDone
                          ? taughtData.strokes.length
                          : Math.max(activeStep + 1, 1)
                    }
                    emphasizeLatest={watchMode === 'scrub' ? true : !watchDone}
                  />
                  <circle ref={tipRef} className="write__tip" r={6} cx={-50} cy={-50} />
                </>
              ) : (
                <ScriptCanvasGlyph
                  className="write__glyph-fallback"
                  glyph={glyph}
                  fontFamily={fontFamily}
                  fontSize={STROKE_GUIDE_FONT_SIZE}
                  x={glyphX}
                  y={glyphY}
                />
              )}
            </svg>
          </div>
        </div>

        <div className="write__rail">
          {mode === 'trace' ? (
            <StrokeHistoryRail
              undoDisabled={drawn.length === 0 || traceDone}
              redoDisabled={
                redoStack.length === 0 ||
                traceDone ||
                (theoryCount > 0 && drawn.length >= theoryCount)
              }
              onUndo={undoStroke}
              onRedo={redoStroke}
            />
          ) : null}

          {mode === 'trace' ? (
            <div
              ref={advancedRef}
              className={`write__advanced ${advancedOpen ? 'is-open' : ''}`}
            >
              <button
                type="button"
                className="write__advanced-summary motion-press"
                aria-expanded={advancedOpen}
                onClick={toggleAdvanced}
              >
                <FoldChevron open={advancedOpen} />
                그리기 설정
              </button>
              <div className={`fold-panel ${advancedOpen ? 'is-expanded' : ''}`}>
                <div className="fold-panel__inner">
                  <div className="write__advanced-body">
                    <div className="write__brush" role="group" aria-label="그리기 입력">
                      <button
                        type="button"
                        className={`write__brush-btn motion-press ${penOnly ? 'is-active' : ''}`}
                        title="손바닥·손가락 입력 무시 (S Pen만)"
                        tabIndex={advancedOpen ? 0 : -1}
                        onClick={() => setPenOnlyState(setPenOnly(!penOnly))}
                      >
                        Spen 모드
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
                        tabIndex={advancedOpen ? 0 : -1}
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
                </div>
              </div>
            </div>
          ) : null}

          {watchBlocked ? (
            <p className="write__hint write__hint--warn" role="alert">
              「{teachInfo.fontLabel}」에는 획이 없습니다
              {teachInfo.otherFonts.length > 0
                ? ` (다른 폰트 ${teachInfo.otherFonts.length}개에 기록이 있어요).`
                : '.'}{' '}
              홈의 「획 기록하기」에서 이 폰트로 먼저 저장해 주세요.
            </p>
          ) : null}

          {mode === 'watch' && !watchBlocked && taughtData ? (
            <>
              <div className="write__scrub" aria-label="획 탐색">
                <StrokeOrderTrack
                  className="write__scrub-order"
                  label="획 번호"
                  onSelect={replayWatchStroke}
                  steps={taughtData.strokes.map((_, i) => {
                    const playingDone = watchMode === 'playing' && watchDone
                    const step = Math.min(activeStep, taughtData.strokes.length - 1)
                    return {
                      done: playingDone || i < step,
                      current: !playingDone && i === step,
                    }
                  })}
                />
                <div className="write__scrub-nav" role="group" aria-label="획 이동">
                  <button
                    type="button"
                    className="write__scrub-btn motion-press"
                    disabled={
                      taughtData.strokes.length <= 1 ||
                      Math.min(activeStep, taughtData.strokes.length - 1) <= 0
                    }
                    onClick={() => {
                      const cur = Math.min(activeStep, taughtData.strokes.length - 1)
                      seekWatchTo(cur - 1)
                    }}
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    className="write__scrub-btn motion-press"
                    disabled={
                      taughtData.strokes.length <= 1 ||
                      Math.min(activeStep, taughtData.strokes.length - 1) >=
                        taughtData.strokes.length - 1
                    }
                    onClick={() => {
                      const cur = Math.min(activeStep, taughtData.strokes.length - 1)
                      seekWatchTo(cur + 1)
                    }}
                  >
                    다음
                  </button>
                </div>
              </div>
              <label className="write__speed">
                <span className="write__speed-label">
                  속도 <strong>{watchPlaySpeed.toFixed(1)}×</strong>
                </span>
                <input
                  className="write__speed-range"
                  type="range"
                  min={WATCH_PLAY_SPEED_MIN}
                  max={WATCH_PLAY_SPEED_MAX}
                  step={WATCH_PLAY_SPEED_STEP}
                  value={watchPlaySpeed}
                  aria-label="획 재생 속도"
                  onChange={(e) => {
                    const next = setWatchPlaySpeed(Number(e.target.value))
                    setWatchPlaySpeedState(next)
                  }}
                />
              </label>
            </>
          ) : null}

          {mode === 'watch' && !watchBlocked && !taughtData ? (
            <p className="write__hint write__hint--warn" role="status">
              지금 폰트「{teachInfo.fontLabel}」에는 획이 없습니다
              {teachInfo.otherFonts.length > 0
                ? ` · 다른 폰트 ${teachInfo.otherFonts.length}개에 기록이 있어요`
                : ''}
              .
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
                        {s.index + 1}번 획
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
        </div>
      </div>
    </section>
  )
}
