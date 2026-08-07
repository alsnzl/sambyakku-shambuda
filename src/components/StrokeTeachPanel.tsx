import { useEffect, useId, useRef, useState } from 'react'
import type { ScriptTrack } from '../types/track'
import type { GlyphStroke } from '../data/glyphStrokes'
import { STROKE_VIEWBOX, getGlyphStrokes } from '../data/glyphStrokes'
import {
  clearUserStrokes,
  defaultLabels,
  getTeachingInfo,
  saveUserStrokes,
} from '../lib/strokeRecord'
import {
  cloudRepoLabel,
  hasCloudWriteToken,
  publishLetterToCloud,
  refreshCloudStore,
} from '../lib/strokeCloud'
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
import { assessTeachCoverage } from '../lib/teachCoverage'
import { StrokeArrowLayer } from './StrokeArrowLayer'
import { StrokeHistoryRail } from './StrokeHistoryRail'
import './StrokeTeachPanel.css'

type Props = {
  letterId: string
  glyph: string
  track: ScriptTrack
}

type TeachMode = 'draw' | 'watch'

type CloudUiStatus =
  | 'checking'
  | 'saving'
  | 'synced'
  | 'bundled'
  | 'local'
  | 'empty'
  | 'no-token'
  | 'error'

const SPEED = 0.32
const MIN_STROKE_MS = 220
const LIFT_MS = 55
const glide = (t: number) => 1 - (1 - t) ** 1.25

export function StrokeTeachPanel({ letterId, glyph, track }: Props) {
  const script = track === 'sanskrit' ? 'deva' : 'siddham'
  const generated = getGlyphStrokes(letterId, script)
  const labels = defaultLabels(letterId, track)
  const inkWidth = FREEHAND_INK_WIDTH
  const outlineD = generated?.d
  /** UI glyph face — Muktamsiddham for Siddhaṃ (Devanagari codepoints in `glyph`). */
  const fontFamily = track === 'sanskrit' ? 'var(--deva)' : 'var(--siddham)'
  const glyphX = STROKE_VIEWBOX / 2
  /** Optical vertical center for large Indic faces in the square viewBox. */
  const glyphY = STROKE_VIEWBOX * 0.72

  const [tick, setTick] = useState(0)
  const info = getTeachingInfo(letterId, script)

  const [recorded, setRecorded] = useState<GlyphStroke[]>([])
  const [redoStack, setRedoStack] = useState<GlyphStroke[]>([])
  const [drawing, setDrawing] = useState<FreehandPoint[]>([])
  const [saving, setSaving] = useState(false)
  const [cloudPhase, setCloudPhase] = useState<'checking' | 'idle' | 'error'>('checking')
  const [cloudError, setCloudError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [mode, setMode] = useState<TeachMode>('draw')
  const [playId, setPlayId] = useState(0)
  const [activeStep, setActiveStep] = useState(0)
  const [watchDone, setWatchDone] = useState(false)
  const [brush, setBrush] = useState<BrushKind>(() => getBrushKind())
  const [penOnly, setPenOnlyState] = useState(() => getPenOnly())
  const [pressureSens, setPressureSensState] = useState(() => getPressureSens())
  const [saveAckLow, setSaveAckLow] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const maskId = `${useId()}-teach-mask`
  const svgRef = useRef<SVGSVGElement>(null)
  const revealRefs = useRef<(SVGPathElement | null)[]>([])
  const tipRef = useRef<SVGCircleElement | null>(null)
  const drawingRef = useRef(false)
  const pointsRef = useRef<FreehandPoint[]>([])

  const refresh = () => setTick((n) => n + 1)

  /** Prefer in-progress strokes; otherwise last saved/cloud taught data. */
  const previewStrokes =
    recorded.length > 0 ? recorded : (info.data?.strokes ?? [])
  const canWatch = previewStrokes.length > 0
  const canLoadSaved = Boolean(info.data?.strokes?.length)

  function exitWatch() {
    setMode('draw')
    setWatchDone(false)
    setActiveStep(0)
  }

  function allowPointer(e: React.PointerEvent) {
    if (penOnly && e.pointerType === 'touch') return false
    return true
  }

  useEffect(() => {
    setRecorded([])
    setRedoStack([])
    setDrawing([])
    setFlash(null)
    setCloudError(null)
    setCloudPhase('checking')
    setMode('draw')
    setWatchDone(false)
    setActiveStep(0)
    setSaveAckLow(false)
    drawingRef.current = false
    pointsRef.current = []
  }, [letterId, script])

  useEffect(() => {
    let cancelled = false
    setCloudPhase('checking')
    ;(async () => {
      try {
        await refreshCloudStore({ maxAgeMs: 15_000 })
        if (!cancelled) {
          setCloudPhase('idle')
          setCloudError(null)
          refresh()
        }
      } catch (err) {
        if (!cancelled) {
          setCloudPhase('error')
          setCloudError(err instanceof Error ? err.message : String(err))
          refresh()
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [letterId, script])

  useEffect(() => {
    if (mode !== 'watch' || !previewStrokes.length) return

    let cancelled = false
    let raf = 0
    const strokeCount = previewStrokes.length
    const strokeSnapshot = previewStrokes.map((s) => ({ ...s }))

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
    // playId / stroke identity drive restarts; length is enough with playId bump on edits
  }, [mode, playId, letterId, script, previewStrokes.length])

  function pointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!glyph || saving) return
    if (mode === 'watch') {
      // Tap after (or during) preview returns to drawing — no stroke on this press
      exitWatch()
      return
    }
    if (!allowPointer(e)) {
      setFlash('손바닥·손가락은 무시합니다. S Pen으로 그려 주세요. (펜만 켜짐)')
      return
    }
    // Ignore pure hover from S Pen until tip contacts the screen
    if (e.pointerType === 'pen' && e.buttons === 0) return
    // Tip only — block S Pen button / right-click / eraser side
    if (e.pointerType !== 'touch' && e.button !== 0) return
    e.preventDefault()

    const svg = svgRef.current
    if (!svg) return
    svg.setPointerCapture(e.pointerId)
    drawingRef.current = true
    setSaveAckLow(false)

    const samples = collectFreehandSamples(e, svg)
    pointsRef.current = samples
    setDrawing(samples)
  }

  function pointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (mode !== 'draw' || !drawingRef.current) return
    if (!allowPointer(e)) return
    if (e.pointerType === 'pen' && e.buttons === 0) return
    const svg = svgRef.current
    if (!svg) return
    const samples = collectFreehandSamples(e, svg)
    pointsRef.current = appendSamples(pointsRef.current, samples)
    setDrawing(pointsRef.current)
  }

  function endStroke(e: React.PointerEvent<SVGSVGElement>) {
    if (mode !== 'draw' || !drawingRef.current) return
    drawingRef.current = false

    const svg = svgRef.current
    if (svg?.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId)

    const index = recorded.length
    const stroke = commitFreehandStroke(
      pointsRef.current,
      labels[index] ?? `획 ${index + 1}`,
      inkWidth,
      pressureSens,
    )
    pointsRef.current = []
    setDrawing([])

    if (stroke) {
      setRecorded((rs) => [...rs, stroke])
      setRedoStack([])
      setFlash(null)
    }
  }

  function handleWatch() {
    if (!canWatch || saving) return
    drawingRef.current = false
    pointsRef.current = []
    setDrawing([])
    if (mode === 'watch') {
      setPlayId((n) => n + 1)
      return
    }
    setMode('watch')
    setPlayId((n) => n + 1)
  }

  function undoStroke() {
    if (saving || drawingRef.current || recorded.length === 0) return
    exitWatch()
    const last = recorded[recorded.length - 1]
    setRecorded((rs) => rs.slice(0, -1))
    setRedoStack((stack) => [...stack, last])
    setFlash(null)
  }

  function redoStroke() {
    if (saving || drawingRef.current || redoStack.length === 0) return
    exitWatch()
    const next = redoStack[redoStack.length - 1]
    setRedoStack((stack) => stack.slice(0, -1))
    setRecorded((rs) => [...rs, next])
    setFlash(null)
  }

  function renameStroke(index: number, label: string) {
    setRecorded((rs) => rs.map((s, i) => (i === index ? { ...s, label } : s)))
    setSaveAckLow(false)
  }

  function commitStrokeLabel(index: number) {
    setRecorded((rs) =>
      rs.map((s, i) => {
        if (i !== index) return s
        const next = s.label.trim()
        return { ...s, label: next || labels[i] || `획 ${i + 1}` }
      }),
    )
  }

  function handleLoad() {
    const strokes = info.data?.strokes
    if (!strokes?.length || saving) return
    exitWatch()
    setRecorded(strokes.map((s) => ({ ...s })))
    setRedoStack([])
    setDrawing([])
    drawingRef.current = false
    pointsRef.current = []
    setSaveAckLow(false)
    setFlash(`${strokes.length}획을 불러왔어요. 고친 뒤 저장하세요.`)
  }

  function handleEdit() {
    exitWatch()
    clearUserStrokes(script, letterId)
    setRecorded([])
    setRedoStack([])
    setDrawing([])
    drawingRef.current = false
    pointsRef.current = []
    setSaveAckLow(false)
    setFlash('캔버스를 비웠어요. 그린 뒤 저장을 눌러 주세요.')
    refresh()
  }

  async function handleSave() {
    if (!glyph || recorded.length === 0 || saving) return
    exitWatch()

    const coverage = assessTeachCoverage(recorded, outlineD)
    if (coverage.level === 'bad' && !saveAckLow) {
      setSaveAckLow(true)
      setFlash(`${coverage.message} 한 번 더 「저장」을 누르면 그대로 올립니다.`)
      return
    }
    setSaveAckLow(false)

    const count = recorded.length
    // Keep a path outline for playback fill when available; UI itself uses the face font.
    const data = { d: outlineD || `M${glyphX} ${glyphY}`, strokes: recorded }

    saveUserStrokes(script, letterId, data)
    refresh()

    const coverageNote =
      coverage.level === 'ok'
        ? `맞춤 ${coverage.score}점`
        : `맞춤 ${coverage.score}점(주의)`

    if (!hasCloudWriteToken()) {
      setFlash(`${count}획 · ${coverageNote} · 이 기기에만 저장 (설정에서 토큰을 저장하세요)`)
      return
    }

    setSaving(true)
    setFlash('클라우드에 저장 중…')
    setCloudError(null)
    try {
      await publishLetterToCloud(script, letterId, data)
      clearUserStrokes(script, letterId)
      await refreshCloudStore({ force: true })
      refresh()
      setRecorded([])
      setRedoStack([])
      setDrawing([])
      setCloudPhase('idle')
      setFlash(`${count}획 · ${coverageNote} · 클라우드 저장 완료`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setCloudPhase('error')
      setCloudError(msg)
      setFlash(`클라우드 저장 실패 · 기기에만 보관됨 — ${msg}`)
      refresh()
    } finally {
      setSaving(false)
    }
  }

  const cloudStatus: CloudUiStatus = (() => {
    if (saving) return 'saving'
    if (cloudPhase === 'checking') return 'checking'
    if (!hasCloudWriteToken()) return 'no-token'
    if (cloudPhase === 'error') return 'error'
    if (info.source === 'cloud') return 'synced'
    if (info.source === 'taught') return 'bundled'
    if (info.source === 'local' || info.source === 'draft-over-official') return 'local'
    return 'empty'
  })()

  const statusText: Record<CloudUiStatus, string> = {
    checking: '클라우드 확인 중…',
    saving: '클라우드 저장 중…',
    synced: '클라우드 저장됨',
    bundled: '앱 내장 이론값',
    local: '기기에만 있음',
    empty: '아직 미기록',
    'no-token': '토큰 없음',
    error: '동기화 오류',
  }

  const statusClass: Record<CloudUiStatus, string> = {
    checking: 'teach__status--draft',
    saving: 'teach__status--draft',
    synced: 'teach__status--official',
    bundled: 'teach__status--official',
    local: 'teach__status--draft',
    empty: 'teach__status--empty',
    'no-token': 'teach__status--warn',
    error: 'teach__status--warn',
  }

  const liveSegments = freehandPressureSegments(drawing, inkWidth, brush, pressureSens)
  const recordedMaskSegs = recorded.flatMap((s, i) =>
    glyphStrokeMaskSegments(s, brush, i * 1000),
  )
  void tick

  return (
    <section className="teach is-open" aria-label="획 가르치기">
      <div className="teach__chrome">
        <div className="teach__head">
          <h3>획 그리기</h3>
          <span
            className={`teach__status ${statusClass[cloudStatus]}`}
            title={cloudError ?? cloudRepoLabel()}
          >
            <span className="teach__status-dot" aria-hidden="true" />
            {statusText[cloudStatus]}
          </span>
        </div>

        <p className="teach__meta">
          {mode === 'watch'
            ? watchDone
              ? '재생 끝 · 화면을 누르면 다시 그릴 수 있어요'
              : `${previewStrokes.length}획 재생 중`
            : recorded.length > 0
              ? `${recorded.length}획 · 이름을 고쳐도 돼요`
              : info.strokeCount > 0
                ? `저장된 획 ${info.strokeCount}개 · 불러오기로 수정`
                : '글자 위에 손가락이 아닌 펜으로 그려 주세요'}
        </p>
      </div>

      <div className="teach__workspace">
        <div className="teach__main">
          {glyph ? (
            <div className="teach__canvas-row">
              <svg
                ref={svgRef}
                className={`teach__svg ${mode === 'draw' ? 'teach__svg--trace' : 'teach__svg--watch'}`}
                viewBox={`0 0 ${STROKE_VIEWBOX} ${STROKE_VIEWBOX}`}
                role="img"
                aria-label={`${glyph} ${mode === 'watch' ? '획 보기' : '획 기록'}`}
                onPointerDown={pointerDown}
                onPointerMove={pointerMove}
                onPointerUp={endStroke}
                onPointerCancel={endStroke}
                onContextMenu={(e) => e.preventDefault()}
              >
                {mode === 'watch' ? (
                  <>
                    <defs>
                      <mask id={`${maskId}-watch`} maskUnits="userSpaceOnUse">
                        <rect width={STROKE_VIEWBOX} height={STROKE_VIEWBOX} fill="black" />
                        {previewStrokes.map((s, i) => (
                          <path
                            key={`watch-${letterId}-${playId}-${i}`}
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
                    <text
                      className="teach__glyph-guide"
                      x={glyphX}
                      y={glyphY}
                      textAnchor="middle"
                      style={{ fontFamily }}
                    >
                      {glyph}
                    </text>
                    <text
                      className={`teach__glyph-ink teach__glyph-ink--under-arrows ${watchDone ? 'is-done' : ''}`}
                      x={glyphX}
                      y={glyphY}
                      textAnchor="middle"
                      style={{ fontFamily }}
                      mask={`url(#${maskId}-watch)`}
                    >
                      {glyph}
                    </text>
                    <StrokeArrowLayer
                      strokes={previewStrokes}
                      revealCount={watchDone ? previewStrokes.length : Math.max(activeStep + 1, 1)}
                      emphasizeLatest={!watchDone}
                    />
                    <circle ref={tipRef} className="teach__tip" r={6} cx={-50} cy={-50} />
                  </>
                ) : (
                  <>
                    <defs>
                      <mask id={maskId} maskUnits="userSpaceOnUse">
                        <rect width={STROKE_VIEWBOX} height={STROKE_VIEWBOX} fill="black" />
                        {recordedMaskSegs.map((seg) => (
                          <line
                            key={`mask-rec-${seg.i}`}
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
                    <text
                      className="teach__glyph-guide"
                      x={glyphX}
                      y={glyphY}
                      textAnchor="middle"
                      style={{ fontFamily }}
                    >
                      {glyph}
                    </text>
                    <text
                      className="teach__glyph-ink"
                      x={glyphX}
                      y={glyphY}
                      textAnchor="middle"
                      style={{ fontFamily }}
                      mask={`url(#${maskId})`}
                    >
                      {glyph}
                    </text>
                    <StrokeArrowLayer strokes={recorded} emphasizeLatest />
                  </>
                )}
              </svg>
            </div>
          ) : (
            <p className="teach__message teach__message--warn">
              이 글자는 그리기 윤곽을 불러올 수 없습니다.
            </p>
          )}
        </div>

        <div className="teach__rail">
          {mode === 'draw' ? (
            <StrokeHistoryRail
              undoDisabled={recorded.length === 0 || saving}
              redoDisabled={redoStack.length === 0 || saving}
              onUndo={undoStroke}
              onRedo={redoStroke}
            />
          ) : null}

          <div className="teach__bar teach__bar--primary">
            <button
              type="button"
              className="teach__btn teach__btn--primary"
              disabled={recorded.length === 0 || saving}
              onClick={() => void handleSave()}
            >
              {saving ? '저장 중…' : saveAckLow ? '그래도 저장' : '저장'}
            </button>
            <button
              type="button"
              className={`teach__btn ${mode === 'watch' ? 'is-active' : ''}`}
              disabled={!canWatch || saving}
              onClick={handleWatch}
            >
              {mode === 'watch' ? '다시 보기' : '보기'}
            </button>
          </div>

          <div className="teach__bar teach__bar--secondary">
            <button
              type="button"
              className="teach__btn"
              disabled={!canLoadSaved || saving}
              onClick={handleLoad}
              title="저장된 획을 캔버스로 불러와 수정"
            >
              불러오기
            </button>
            <button type="button" className="teach__btn" disabled={saving} onClick={handleEdit}>
              비우기
            </button>
          </div>

          {flash ? <p className="teach__message">{flash}</p> : null}
          {cloudStatus === 'error' && cloudError ? (
            <p className="teach__message teach__message--warn">{cloudError}</p>
          ) : null}

          {glyph ? (
            <ol className="teach__steps">
              {mode === 'watch'
                ? previewStrokes.map((s, i) => {
                    const state =
                      activeStep === i ? 'is-active' : activeStep > i ? 'is-done' : ''
                    return (
                      <li key={`teach-watch-${letterId}-${i}`} className={`teach__step ${state}`}>
                        <span className="teach__step-num">{i + 1}</span>
                        <span className="teach__step-label">{s.label}</span>
                      </li>
                    )
                  })
                : (
                  <>
                    {recorded.map((s, i) => (
                      <li key={`teach-${letterId}-${i}`} className="teach__step is-done">
                        <span className="teach__step-num">{i + 1}</span>
                        <input
                          className="teach__step-input"
                          type="text"
                          value={s.label}
                          disabled={saving}
                          aria-label={`${i + 1}번 획 이름`}
                          onChange={(e) => renameStroke(i, e.target.value)}
                          onBlur={() => commitStrokeLabel(i)}
                        />
                      </li>
                    ))}
                    <li className="teach__step is-active">
                      <span className="teach__step-num">{recorded.length + 1}</span>
                      <span className="teach__step-label">
                        {labels[recorded.length] ?? `획 ${recorded.length + 1}`} (그리는 중)
                      </span>
                    </li>
                  </>
                )}
            </ol>
          ) : null}

          <div className={`teach__advanced ${advancedOpen ? 'is-open' : ''}`}>
            <button
              type="button"
              className="teach__advanced-summary motion-press"
              aria-expanded={advancedOpen}
              onClick={() => setAdvancedOpen((v) => !v)}
            >
              <span className={`fold-chevron ${advancedOpen ? 'is-open' : ''}`} aria-hidden="true">
                ▸
              </span>
              그리기 설정
            </button>
            <div className={`fold-panel ${advancedOpen ? 'is-expanded' : ''}`}>
              <div className="fold-panel__inner">
                <div className="teach__advanced-body">
                  <div className="teach__brush" role="group" aria-label="붓·펜">
                    {BRUSH_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`teach__brush-btn ${brush === opt.id ? 'is-active' : ''}`}
                        title={opt.hint}
                        disabled={saving}
                        tabIndex={advancedOpen ? 0 : -1}
                        onClick={() => setBrush(setBrushKind(opt.id))}
                      >
                        {opt.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`teach__brush-btn ${penOnly ? 'is-active' : ''}`}
                      title="손바닥·손가락 입력 무시 (S Pen만)"
                      disabled={saving}
                      tabIndex={advancedOpen ? 0 : -1}
                      onClick={() => setPenOnlyState(setPenOnly(!penOnly))}
                    >
                      펜만
                    </button>
                  </div>

                  <label className="teach__sens">
                    <span className="teach__sens-label">
                      필압 민감도 <strong>{Math.round(pressureSens * 100)}%</strong>
                    </span>
                    <input
                      className="teach__sens-range"
                      type="range"
                      min={PRESSURE_SENS_MIN}
                      max={PRESSURE_SENS_MAX}
                      step={0.05}
                      value={pressureSens}
                      disabled={saving}
                      tabIndex={advancedOpen ? 0 : -1}
                      aria-label="필압 민감도"
                      onChange={(e) => setPressureSensState(setPressureSens(Number(e.target.value)))}
                    />
                    <span className="teach__sens-ends" aria-hidden="true">
                      <span>낮음</span>
                      <span>기본 100%</span>
                      <span>높음</span>
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
