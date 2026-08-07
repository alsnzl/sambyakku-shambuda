import { useEffect, useId, useRef, useState } from 'react'
import type { ScriptTrack } from '../types/track'
import type { GlyphStroke } from '../data/glyphStrokes'
import { STROKE_VIEWBOX, getGlyphStrokes } from '../data/glyphStrokes'
import {
  avgStrokeWidth,
  clearUserStrokes,
  clientToSvgPoint,
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
  appendPoint,
  commitFreehandStroke,
  freehandPreviewPath,
} from '../lib/freehandStroke'
import { StrokeArrowLayer } from './StrokeArrowLayer'
import './StrokeTeachPanel.css'

type Props = {
  letterId: string
  glyph: string
  track: ScriptTrack
}

type CloudUiStatus =
  | 'checking'
  | 'saving'
  | 'synced'
  | 'bundled'
  | 'local'
  | 'empty'
  | 'no-token'
  | 'error'

function formatWhen(iso: string | null) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function StrokeTeachPanel({ letterId, glyph, track }: Props) {
  const script = track === 'sanskrit' ? 'deva' : 'siddham'
  const generated = getGlyphStrokes(letterId, script)
  const labels = defaultLabels(letterId, track)
  const inkWidth = avgStrokeWidth(generated)
  const outlineD = generated?.d
  /** UI glyph face — Muktamsiddham for Siddhaṃ (Devanagari codepoints in `glyph`). */
  const fontFamily = track === 'sanskrit' ? 'var(--deva)' : 'var(--siddham)'
  const glyphX = STROKE_VIEWBOX / 2
  const glyphY = STROKE_VIEWBOX * 0.7

  const [tick, setTick] = useState(0)
  const info = getTeachingInfo(letterId, script)

  const [recorded, setRecorded] = useState<GlyphStroke[]>([])
  const [drawing, setDrawing] = useState<[number, number][]>([])
  const [saving, setSaving] = useState(false)
  const [cloudPhase, setCloudPhase] = useState<'checking' | 'idle' | 'error'>('checking')
  const [cloudError, setCloudError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const maskId = `${useId()}-teach-mask`
  const svgRef = useRef<SVGSVGElement>(null)
  const drawingRef = useRef(false)
  const pointsRef = useRef<[number, number][]>([])

  const refresh = () => setTick((n) => n + 1)

  useEffect(() => {
    setRecorded([])
    setDrawing([])
    setFlash(null)
    setCloudError(null)
    setCloudPhase('checking')
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

  function pointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!glyph || saving) return
    e.preventDefault()

    const svg = svgRef.current
    if (!svg) return
    svg.setPointerCapture(e.pointerId)
    drawingRef.current = true

    const pt = clientToSvgPoint(svg, e.clientX, e.clientY)
    pointsRef.current = [pt]
    setDrawing([pt])
  }

  function pointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!drawingRef.current) return
    const svg = svgRef.current
    if (!svg) return
    const pt = clientToSvgPoint(svg, e.clientX, e.clientY)
    pointsRef.current = appendPoint(pointsRef.current, pt)
    setDrawing(pointsRef.current)
  }

  function endStroke(e: React.PointerEvent<SVGSVGElement>) {
    if (!drawingRef.current) return
    drawingRef.current = false

    const svg = svgRef.current
    if (svg?.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId)

    const index = recorded.length
    const stroke = commitFreehandStroke(
      pointsRef.current,
      labels[index] ?? `획 ${index + 1}`,
      inkWidth,
    )
    pointsRef.current = []
    setDrawing([])

    if (stroke) {
      setRecorded((rs) => [...rs, stroke])
      setFlash(null)
    }
  }

  function handleEdit() {
    clearUserStrokes(script, letterId)
    setRecorded([])
    setDrawing([])
    drawingRef.current = false
    pointsRef.current = []
    setFlash('다시 그을 수 있어요. 그린 뒤 저장을 눌러 주세요.')
    refresh()
  }

  async function handleSave() {
    if (!glyph || recorded.length === 0 || saving) return
    const count = recorded.length
    // Keep a path outline for playback fill when available; UI itself uses the face font.
    const data = { d: outlineD || `M${glyphX} ${glyphY}`, strokes: recorded }

    saveUserStrokes(script, letterId, data)
    refresh()

    if (!hasCloudWriteToken()) {
      setFlash(`${count}획을 이 기기에만 저장했어요. (토큰 없음)`)
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
      setDrawing([])
      setCloudPhase('idle')
      setFlash(`${count}획 · 클라우드 저장 완료`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setCloudPhase('error')
      setCloudError(msg)
      setFlash(`클라우드 저장 실패 · 기기에만 보관됨`)
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

  const previewPath = freehandPreviewPath(drawing)
  void tick

  return (
    <section className="teach is-open" aria-label="획 가르치기">
      <div className="teach__head">
        <h3>획 가르치기</h3>
        <span
          className={`teach__status ${statusClass[cloudStatus]}`}
          title={cloudError ?? cloudRepoLabel()}
        >
          <span className="teach__status-dot" aria-hidden="true" />
          {statusText[cloudStatus]}
        </span>
      </div>

      <p className="teach__meta">
        {recorded.length > 0
          ? `${recorded.length}획 그리는 중`
          : info.strokeCount > 0
            ? `${info.strokeCount}획 · ${formatWhen(info.savedAt) || '저장됨'}`
            : '글자 위에 바로 그려 주세요'}
      </p>

      <div className="teach__bar teach__bar--simple">
        <button
          type="button"
          className="teach__btn teach__btn--primary"
          disabled={recorded.length === 0 || saving}
          onClick={handleSave}
        >
          {saving ? '저장 중…' : '저장'}
        </button>
        <button type="button" className="teach__btn" disabled={saving} onClick={handleEdit}>
          수정
        </button>
      </div>

      {flash ? <p className="teach__message">{flash}</p> : null}
      {cloudStatus === 'error' && cloudError ? (
        <p className="teach__message teach__message--warn">{cloudError}</p>
      ) : null}

      {glyph ? (
        <div className="teach__stage">
          <svg
            ref={svgRef}
            className="teach__svg teach__svg--trace"
            viewBox={`0 0 ${STROKE_VIEWBOX} ${STROKE_VIEWBOX}`}
            role="img"
            aria-label={`${glyph} 획 기록`}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
          >
            <defs>
              <mask id={maskId} maskUnits="userSpaceOnUse">
                <rect width={STROKE_VIEWBOX} height={STROKE_VIEWBOX} fill="black" />
                {recorded.map((s, i) => (
                  <path
                    key={`mask-rec-${i}`}
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
          </svg>

          <ol className="teach__steps">
            {recorded.map((s, i) => (
              <li key={`teach-${letterId}-${i}`} className="teach__step is-done">
                <span className="teach__step-num">{i + 1}</span>
                <span className="teach__step-label">{s.label}</span>
              </li>
            ))}
            <li className="teach__step is-active">
              <span className="teach__step-num">{recorded.length + 1}</span>
              <span className="teach__step-label">
                {labels[recorded.length] ?? `획 ${recorded.length + 1}`} (그리는 중)
              </span>
            </li>
          </ol>
        </div>
      ) : (
        <p className="teach__message teach__message--warn">이 글자는 그리기 윤곽을 불러올 수 없습니다.</p>
      )}
    </section>
  )
}
