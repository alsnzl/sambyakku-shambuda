import { useEffect, useId, useRef, useState } from 'react'
import type { ScriptTrack } from '../types/track'
import type { GlyphStroke } from '../data/glyphStrokes'
import { STROKE_VIEWBOX, getGlyphStrokes } from '../data/glyphStrokes'
import {
  STROKE_GUIDE_FONT_SIZE,
  STROKE_GUIDE_X,
  STROKE_GUIDE_Y,
} from '../lib/strokeGuideLayout'
import {
  ensureScriptFontReady,
  getActiveScriptFontLabel,
  getActiveScriptFontStack,
  getScriptFontChoice,
  getScriptFontStack,
  matchesGeneratedOutlineFont,
  parseScriptFontChoice,
} from '../lib/customScriptFonts'
import {
  clearUserStrokes,
  DEFAULT_TEACH_GUIDE_TIP,
  defaultLabels,
  getTeachingInfo,
  saveUserStrokes,
} from '../lib/strokeRecord'
import { useScriptFontEpoch } from '../lib/useScriptFontEpoch'
import {
  cloudRepoLabel,
  hasCloudWriteToken,
  publishLetterToCloud,
  refreshCloudStore,
} from '../lib/strokeCloud'
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
  setPenOnly,
  setPressureSens,
} from '../lib/prefsStore'
import { assessTeachCoverage } from '../lib/teachCoverage'
import { recordTodayStrokeAttempt } from '../lib/todayStrokeSession'
import { StrokeArrowLayer } from './StrokeArrowLayer'
import { StrokeHistoryRail } from './StrokeHistoryRail'
import { FoldChevron } from './FoldChevron'
import { ScriptFontQuickBar } from './ScriptFontQuickBar'
import { StrokeVersionPanel } from './StrokeVersionPanel'
import { startStrokeRevealPlayback } from '../lib/strokePlayback'
import { useLockScrollWhileDrawing } from '../lib/useLockScrollWhileDrawing'
import './StrokeTeachPanel.css'

type Props = {
  letterId: string
  glyph: string
  track: ScriptTrack
  iast?: string
  hangulHint?: string
  /** Letter paging motion — canvas slides; guide fades; rail stays still. */
  navMotion?: 'slide-left' | 'slide-right' | 'pop'
  onPrevLetter?: () => void
  onNextLetter?: () => void
  hasPrevLetter?: boolean
  hasNextLetter?: boolean
  /** Fired after local/cloud stroke save so parent sync bar can refresh. */
  onSyncChange?: () => void
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

function LetterNavChevron({ dir }: { dir: 'prev' | 'next' }) {
  return (
    <svg className="teach__letter-nav-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      {dir === 'prev' ? (
        <path
          d="M14.5 5.5 8 12l6.5 6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M9.5 5.5 16 12l-6.5 6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

export function StrokeTeachPanel({
  letterId,
  glyph,
  track,
  iast,
  hangulHint,
  navMotion = 'pop',
  onPrevLetter,
  onNextLetter,
  hasPrevLetter = false,
  hasNextLetter = false,
  onSyncChange,
}: Props) {
  const fontEpoch = useScriptFontEpoch()
  const script = track === 'sanskrit' ? 'deva' : 'siddham'
  const fontSlot = script
  const generated = getGlyphStrokes(letterId, script)
  const labels = defaultLabels(letterId, track)
  const inkWidth = FREEHAND_INK_WIDTH
  const fontChoice = getScriptFontChoice(fontSlot)
  const fontFamily = getActiveScriptFontStack(fontSlot)
  const glyphX = STROKE_GUIDE_X
  /** Baseline low enough for Devanagari top matras (ई, ऐ, …) inside the square. */
  const glyphY = STROKE_GUIDE_Y

  const [tick, setTick] = useState(0)
  const info = getTeachingInfo(letterId, script)
  /** Prefer taught/cloud outline so saved strokes stay registered with the guide. */
  const outlineD = info.data?.d ?? generated?.d
  const activeFontLabel = info.fontLabel
  const recordedFontChoice = parseScriptFontChoice(fontSlot, info.fontFace)
  const watchFontFamily = recordedFontChoice
    ? getScriptFontStack(fontSlot, recordedFontChoice)
    : fontFamily
  const otherFontHint =
    info.otherFonts.length > 0
      ? info.otherFonts.map((f) => `${f.fontLabel} ${f.strokeCount}획`).join(' · ')
      : null

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
  const [penOnly, setPenOnlyState] = useState(() => getPenOnly())
  const [pressureSens, setPressureSensState] = useState(() => getPressureSens())
  const [saveAckLow, setSaveAckLow] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const brush = 'pen' as const
  const [labelDrafts, setLabelDrafts] = useState<string[]>(() => [...labels])
  const [guideTip, setGuideTip] = useState(DEFAULT_TEACH_GUIDE_TIP)

  /**
   * Draw always uses live SVG text so font switches update immediately.
   * Watch uses path only for legacy cloud entries (no fontFace) that match Noto outlines.
   */
  const usePathGuide =
    mode === 'watch' &&
    Boolean(outlineD) &&
    !recordedFontChoice &&
    matchesGeneratedOutlineFont(fontSlot, fontChoice)
  const canvasFontFamily = mode === 'watch' ? watchFontFamily : fontFamily
  const canvasFontKey = `${fontEpoch}-${canvasFontFamily}-${mode}`

  const maskId = `${useId()}-teach-mask`
  const svgRef = useRef<SVGSVGElement>(null)
  const revealRefs = useRef<(SVGPathElement | null)[]>([])
  const tipRef = useRef<SVGCircleElement | null>(null)
  const advancedRef = useRef<HTMLDivElement>(null)
  const drawingRef = useRef(false)
  const pointsRef = useRef<FreehandPoint[]>([])
  const recordedCountRef = useRef(0)
  recordedCountRef.current = recorded.length
  const [scrollLock, setScrollLock] = useState(false)
  useLockScrollWhileDrawing(scrollLock)
  const fontBootRef = useRef(true)

  const refresh = () => setTick((n) => n + 1)

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

  function buildLabelDrafts(strokes?: GlyphStroke[]): string[] {
    const fromStrokes = strokes?.map((s) => s.label) ?? []
    const base = defaultLabels(letterId, track)
    const count = Math.max(base.length, fromStrokes.length, 1)
    return Array.from({ length: count }, (_, i) => {
      const raw = fromStrokes[i]?.trim() || base[i]?.trim()
      return raw || `획 ${i + 1}`
    })
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
    setScrollLock(false)
    pointsRef.current = []
    const nextInfo = getTeachingInfo(letterId, script)
    setLabelDrafts(buildLabelDrafts(nextInfo.data?.strokes))
    setGuideTip(nextInfo.note?.trim() || DEFAULT_TEACH_GUIDE_TIP)
  }, [letterId, script, track])

  /** Font switch: hide other-face strokes and wipe in-progress ink. */
  useEffect(() => {
    if (fontBootRef.current) {
      fontBootRef.current = false
      return
    }
    setRecorded([])
    setRedoStack([])
    setDrawing([])
    drawingRef.current = false
    setScrollLock(false)
    pointsRef.current = []
    setSaveAckLow(false)
    setMode('draw')
    setWatchDone(false)
    setActiveStep(0)
    const next = getTeachingInfo(letterId, script)
    setLabelDrafts(buildLabelDrafts(next.data?.strokes))
    setGuideTip(next.note?.trim() || DEFAULT_TEACH_GUIDE_TIP)
    refresh()
    if (next.strokeCount > 0) {
      setFlash(`「${next.fontLabel}」에 저장된 획 ${next.strokeCount}개`)
    } else if (next.otherFonts.length > 0) {
      setFlash(
        `「${next.fontLabel}」에는 획 없음 · 다른 폰트 ${next.otherFonts.length}개에 기록됨`,
      )
    } else {
      setFlash(`「${next.fontLabel}」로 새 획을 기록합니다`)
    }
  }, [fontEpoch])

  useEffect(() => {
    const choice = parseScriptFontChoice(fontSlot, info.fontFace)
    if (!choice) return
    let cancelled = false
    void ensureScriptFontReady(fontSlot, choice).catch(() => {
      if (!cancelled) {
        /* keep CSS fallback stack */
      }
    })
    return () => {
      cancelled = true
    }
  }, [fontSlot, info.fontFace, letterId])

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
          // Prefer cloud labels/note once pull finishes (canvas still empty).
          if (recordedCountRef.current === 0) {
            const next = getTeachingInfo(letterId, script)
            setLabelDrafts(buildLabelDrafts(next.data?.strokes))
            setGuideTip(next.note?.trim() || DEFAULT_TEACH_GUIDE_TIP)
          }
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
    let stopPlayback: (() => void) | null = null
    const strokeCount = previewStrokes.length
    const strokeSnapshot = previewStrokes.map((s) => ({ ...s }))

    const start = () => {
      if (cancelled) return
      const paths = revealRefs.current.slice(0, strokeCount)
      if (paths.some((el) => !el) || paths.length < strokeCount) {
        raf = requestAnimationFrame(start)
        return
      }

      setWatchDone(false)
      setActiveStep(0)
      stopPlayback = startStrokeRevealPlayback({
        paths: paths as SVGPathElement[],
        tip: tipRef.current,
        strokeWidths: strokeSnapshot.map((s) => s.width),
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
      setFlash('손바닥·손가락은 무시합니다. S Pen으로 그려 주세요. (Spen 모드 켜짐)')
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
    setScrollLock(true)
    setSaveAckLow(false)

    const samples = collectFreehandSamples(e, svg)
    pointsRef.current = samples
    setDrawing(samples)
  }

  function pointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (mode !== 'draw' || !drawingRef.current) return
    if (!allowPointer(e)) return
    if (e.pointerType === 'pen' && e.buttons === 0) return
    e.preventDefault()
    const svg = svgRef.current
    if (!svg) return
    const samples = collectFreehandSamples(e, svg)
    pointsRef.current = appendSamples(pointsRef.current, samples)
    setDrawing(pointsRef.current)
  }

  function endStroke(e: React.PointerEvent<SVGSVGElement>) {
    if (mode !== 'draw' || !drawingRef.current) return
    drawingRef.current = false
    setScrollLock(false)

    const svg = svgRef.current
    if (svg?.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId)

    const index = recorded.length
    const stroke = commitFreehandStroke(
      pointsRef.current,
      labelDrafts[index]?.trim() || labels[index] || `획 ${index + 1}`,
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
    setScrollLock(false)
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
    setLabelDrafts((drafts) => {
      const next = [...drafts]
      while (next.length <= index) next.push(`획 ${next.length + 1}`)
      next[index] = label
      return next
    })
    setRecorded((rs) => rs.map((s, i) => (i === index ? { ...s, label } : s)))
    setSaveAckLow(false)
  }

  function commitStrokeLabel(index: number) {
    const fallback = labels[index] || `획 ${index + 1}`
    setLabelDrafts((drafts) => {
      const next = [...drafts]
      while (next.length <= index) next.push(fallback)
      const trimmed = next[index]?.trim()
      next[index] = trimmed || fallback
      return next
    })
    setRecorded((rs) =>
      rs.map((s, i) => {
        if (i !== index) return s
        const next = s.label.trim()
        return { ...s, label: next || fallback }
      }),
    )
  }

  function commitGuideTip() {
    const trimmed = guideTip.trim()
    setGuideTip(trimmed || DEFAULT_TEACH_GUIDE_TIP)
  }

  function handleLoad() {
    const strokes = info.data?.strokes
    if (!strokes?.length || saving) return
    exitWatch()
    setRecorded(strokes.map((s) => ({ ...s })))
    setLabelDrafts(buildLabelDrafts(strokes))
    setGuideTip(info.note?.trim() || DEFAULT_TEACH_GUIDE_TIP)
    setRedoStack([])
    setDrawing([])
    drawingRef.current = false
    setScrollLock(false)
    pointsRef.current = []
    setSaveAckLow(false)
    setFlash(`${strokes.length}획을 불러왔어요. 고친 뒤 저장하세요.`)
  }

  function handleEdit() {
    exitWatch()
    clearUserStrokes(script, letterId, getScriptFontChoice(fontSlot))
    setRecorded([])
    setRedoStack([])
    setDrawing([])
    drawingRef.current = false
    setScrollLock(false)
    pointsRef.current = []
    setSaveAckLow(false)
    setFlash(`「${activeFontLabel}」 획을 비웠어요. 그린 뒤 저장을 눌러 주세요.`)
    refresh()
  }

  async function handleSave() {
    if (!glyph || recorded.length === 0 || saving) return
    exitWatch()

    const coverageOutline = matchesGeneratedOutlineFont(fontSlot, fontChoice)
      ? outlineD
      : null
    const coverage = assessTeachCoverage(recorded, coverageOutline)
    if (coverage.level === 'bad' && !saveAckLow) {
      setSaveAckLow(true)
      setFlash(`${coverage.message} 한 번 더 「저장」을 누르면 그대로 올립니다.`)
      return
    }
    setSaveAckLow(false)

    const count = recorded.length
    const tip = guideTip.trim() || DEFAULT_TEACH_GUIDE_TIP
    const face = getScriptFontChoice(fontSlot)
    const faceLabel = getActiveScriptFontLabel(fontSlot)
    const fontMeta = { fontFace: face, fontLabel: faceLabel }
    // Keep a path outline for playback fill when available; UI itself uses the face font.
    const data = {
      d: outlineD || `M${glyphX} ${glyphY}`,
      strokes: recorded.map((s, i) => ({
        ...s,
        label: s.label.trim() || labelDrafts[i]?.trim() || labels[i] || `획 ${i + 1}`,
      })),
    }

    saveUserStrokes(script, letterId, data, tip, fontMeta)
    setGuideTip(tip)
    refresh()

    const coverageNote =
      coverage.level === 'ok'
        ? `맞춤 ${coverage.score}점`
        : `맞춤 ${coverage.score}점(주의)`

    if (!hasCloudWriteToken()) {
      recordTodayStrokeAttempt({
        script,
        letterId,
        fontFace: face,
        fontLabel: faceLabel,
        strokeCount: count,
        upload: 'local-only',
      })
      setFlash(
        `${count}획 · ${faceLabel} · ${coverageNote} · 이 기기에만 저장 (설정에서 토큰을 저장하세요)`,
      )
      onSyncChange?.()
      return
    }

    setSaving(true)
    setFlash('클라우드에 저장 중…')
    setCloudError(null)
    try {
      await publishLetterToCloud(script, letterId, data, tip, fontMeta)
      clearUserStrokes(script, letterId, face)
      await refreshCloudStore({ force: true })
      refresh()
      setRecorded([])
      setRedoStack([])
      setDrawing([])
      setLabelDrafts(buildLabelDrafts(data.strokes))
      setGuideTip(tip)
      setCloudPhase('idle')
      recordTodayStrokeAttempt({
        script,
        letterId,
        fontFace: face,
        fontLabel: faceLabel,
        strokeCount: count,
        upload: 'success',
      })
      setFlash(`${count}획 · ${faceLabel} · ${coverageNote} · 클라우드 저장 완료`)
      onSyncChange?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setCloudPhase('error')
      setCloudError(msg)
      recordTodayStrokeAttempt({
        script,
        letterId,
        fontFace: face,
        fontLabel: faceLabel,
        strokeCount: count,
        upload: 'failed',
        error: msg,
      })
      setFlash(`클라우드 저장 실패 · 기기에만 보관됨 — ${msg}`)
      refresh()
      onSyncChange?.()
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

  const guideCount = Math.max(
    labelDrafts.length,
    labels.length,
    mode === 'watch' ? previewStrokes.length : recorded.length + (mode === 'draw' ? 1 : 0),
    1,
  )
  const guideSteps = Array.from({ length: guideCount }, (_, i) => {
    const label =
      labelDrafts[i] ||
      recorded[i]?.label ||
      previewStrokes[i]?.label ||
      labels[i] ||
      `획 ${i + 1}`
    const done =
      mode === 'watch'
        ? watchDone || activeStep > i
        : i < recorded.length
    const current =
      mode === 'watch'
        ? !watchDone && activeStep === i
        : i === recorded.length
    return { label, done, current }
  })

  return (
    <section className="teach is-open" aria-label="획 가르치기">
      <div className="teach__chrome">
        <div className="teach__head">
          <h3>획 그리기</h3>
          <div className="teach__status-row">
            <span
              className={`teach__status ${statusClass[cloudStatus]}`}
              title={cloudError ?? cloudRepoLabel()}
            >
              <span className="teach__status-dot" aria-hidden="true" />
              {statusText[cloudStatus]}
            </span>
            {otherFontHint ? (
              <span
                className="teach__status teach__status--other-font"
                title={`다른 폰트에만 있는 기록(현재 폰트에서는 숨김): ${otherFontHint}`}
              >
                <span className="teach__status-dot" aria-hidden="true" />
                다른 폰트 {otherFontHint}
              </span>
            ) : null}
          </div>
        </div>

        <p className="teach__meta">
          {mode === 'watch'
            ? watchDone
              ? '재생 끝 · 화면을 누르면 다시 그릴 수 있어요'
              : `${previewStrokes.length}획 재생 중`
            : recorded.length > 0
              ? `${recorded.length}획 · 이름을 고쳐도 돼요`
              : info.strokeCount > 0
                ? `이 폰트 저장 ${info.strokeCount}획 · 불러오기로 수정`
                : '이 폰트에는 아직 획이 없습니다 · 펜으로 그려 주세요'}
        </p>
      </div>

      <div className="teach__workspace">
        <aside
          key={`guide-${letterId}`}
          className="teach__guide teach__nav-fade"
          aria-label="획 기록 가이드"
        >
          <div className="teach__guide-letter">
            <span className="teach__guide-glyph" lang="sa" style={{ fontFamily }}>
              {glyph}
            </span>
            <div className="teach__guide-meta">
              {iast ? <p className="teach__guide-iast">{iast}</p> : null}
              {hangulHint ? <p className="teach__guide-hangul">{hangulHint}</p> : null}
            </div>
          </div>

          <div className="teach__guide-scroll">
            <p className="teach__guide-title">획 가이드</p>
            <ol className="teach__guide-steps">
              {guideSteps.map((step, i) => (
                <li
                  key={`guide-${letterId}-${i}`}
                  className={`teach__guide-step${step.done ? ' is-done' : ''}${
                    step.current ? ' is-current' : ''
                  }`}
                >
                  <span className="teach__guide-num" aria-hidden="true">
                    {step.done ? '✓' : i + 1}
                  </span>
                  <div className="teach__guide-label-wrap">
                    <input
                      className="teach__guide-label-input"
                      type="text"
                      value={step.label}
                      disabled={saving}
                      aria-label={`${i + 1}번 획 설명`}
                      onChange={(e) => renameStroke(i, e.target.value)}
                      onBlur={() => commitStrokeLabel(i)}
                    />
                    {step.current ? (
                      <span className="teach__guide-current-tag">그리는 중</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <label className="teach__guide-tip-field">
            <span className="teach__guide-tip-label">기록 팁</span>
            <textarea
              className="teach__guide-tip-input"
              rows={3}
              value={guideTip}
              disabled={saving}
              aria-label="획 기록 팁"
              onChange={(e) => setGuideTip(e.target.value)}
              onBlur={commitGuideTip}
            />
          </label>
        </aside>

        <div
          key={`canvas-${letterId}`}
          className={
            navMotion === 'slide-left'
              ? 'teach__main teach__nav-slide teach__nav-slide--next'
              : navMotion === 'slide-right'
                ? 'teach__main teach__nav-slide teach__nav-slide--prev'
                : 'teach__main teach__nav-slide teach__nav-slide--pop'
          }
        >
          {glyph ? (
            <div className="teach__center-stack">
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
                    {usePathGuide && outlineD ? (
                      <>
                        <path className="teach__glyph-guide" d={outlineD} />
                        <path
                          className={`teach__glyph-ink teach__glyph-ink--under-arrows ${watchDone ? 'is-done' : ''}`}
                          d={outlineD}
                          mask={`url(#${maskId}-watch)`}
                        />
                      </>
                    ) : (
                      <>
                        <text
                          key={`guide-${canvasFontKey}`}
                          className="teach__glyph-guide"
                          x={glyphX}
                          y={glyphY}
                          textAnchor="middle"
                          lang="sa"
                          fontSize={STROKE_GUIDE_FONT_SIZE}
                          style={{ fontFamily: canvasFontFamily }}
                        >
                          {glyph}
                        </text>
                        <text
                          key={`ink-${canvasFontKey}`}
                          className={`teach__glyph-ink teach__glyph-ink--under-arrows ${watchDone ? 'is-done' : ''}`}
                          x={glyphX}
                          y={glyphY}
                          textAnchor="middle"
                          lang="sa"
                          fontSize={STROKE_GUIDE_FONT_SIZE}
                          style={{ fontFamily: canvasFontFamily }}
                          mask={`url(#${maskId}-watch)`}
                        >
                          {glyph}
                        </text>
                      </>
                    )}
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
                    <text
                      key={`guide-${canvasFontKey}`}
                      className="teach__glyph-guide"
                      x={glyphX}
                      y={glyphY}
                      textAnchor="middle"
                      lang="sa"
                      fontSize={STROKE_GUIDE_FONT_SIZE}
                      style={{ fontFamily: canvasFontFamily }}
                    >
                      {glyph}
                    </text>
                    <text
                      key={`ink-${canvasFontKey}`}
                      className="teach__glyph-ink"
                      x={glyphX}
                      y={glyphY}
                      textAnchor="middle"
                      lang="sa"
                      fontSize={STROKE_GUIDE_FONT_SIZE}
                      style={{ fontFamily: canvasFontFamily }}
                      mask={`url(#${maskId})`}
                    >
                      {glyph}
                    </text>
                    <StrokeArrowLayer strokes={recorded} emphasizeLatest />
                  </>
                )}
              </svg>
            </div>
              <ScriptFontQuickBar
                track={track}
                variant="record"
                strokeCount={info.strokeCount}
              />
            </div>
          ) : (
            <p className="teach__message teach__message--warn">
              이 글자는 그리기 윤곽을 불러올 수 없습니다.
            </p>
          )}
        </div>

        <div className="teach__rail">
          <div className="teach__letter-nav" role="group" aria-label="글자 이동">
            <button
              type="button"
              className="teach__btn teach__btn--letter-nav motion-press"
              disabled={!hasPrevLetter || !onPrevLetter || saving}
              onClick={onPrevLetter}
            >
              <LetterNavChevron dir="prev" />
              이전 글자
            </button>
            <button
              type="button"
              className="teach__btn teach__btn--letter-nav motion-press"
              disabled={!hasNextLetter || !onNextLetter || saving}
              onClick={onNextLetter}
            >
              다음 글자
              <LetterNavChevron dir="next" />
            </button>
          </div>

          <div className="teach__rail-rule" role="separator" aria-hidden="true" />

          <div className="teach__rail-body">
            {mode === 'draw' ? (
              <StrokeHistoryRail
                undoDisabled={recorded.length === 0 || saving}
                redoDisabled={redoStack.length === 0 || saving}
                onUndo={undoStroke}
                onRedo={redoStroke}
              />
            ) : null}

            <div className="teach__actions-stack">
              <div className="teach__actions-row">
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
                      <input
                        className="teach__step-input"
                        type="text"
                        value={
                          labelDrafts[recorded.length] ||
                          labels[recorded.length] ||
                          `획 ${recorded.length + 1}`
                        }
                        disabled={saving}
                        aria-label={`${recorded.length + 1}번 획 이름 (그리는 중)`}
                        onChange={(e) => renameStroke(recorded.length, e.target.value)}
                        onBlur={() => commitStrokeLabel(recorded.length)}
                      />
                    </li>
                  </>
                )}
            </ol>
          ) : null}

          <div
            ref={advancedRef}
            className={`teach__advanced ${advancedOpen ? 'is-open' : ''}`}
          >
            <button
              type="button"
              className="teach__advanced-summary motion-press"
              aria-expanded={advancedOpen}
              onClick={toggleAdvanced}
            >
              <FoldChevron open={advancedOpen} />
              그리기 설정
            </button>
            <div className={`fold-panel ${advancedOpen ? 'is-expanded' : ''}`}>
              <div className="fold-panel__inner">
                <div className="teach__advanced-body">
                  <div className="teach__brush" role="group" aria-label="그리기 입력">
                    <button
                      type="button"
                      className={`teach__brush-btn ${penOnly ? 'is-active' : ''}`}
                      title="손바닥·손가락 입력 무시 (S Pen만)"
                      disabled={saving}
                      tabIndex={advancedOpen ? 0 : -1}
                      onClick={() => setPenOnlyState(setPenOnly(!penOnly))}
                    >
                      Spen 모드
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

          <StrokeVersionPanel
            script={script}
            letterId={letterId}
            fontFace={getScriptFontChoice(script)}
            disabled={saving}
            onRestored={() => {
              void (async () => {
                await refreshCloudStore({ force: true })
                refresh()
                setRecorded([])
                setRedoStack([])
                setDrawing([])
                setFlash('이전 버전으로 복원했습니다')
                onSyncChange?.()
              })()
            }}
          />
          </div>
        </div>
      </div>
    </section>
  )
}
