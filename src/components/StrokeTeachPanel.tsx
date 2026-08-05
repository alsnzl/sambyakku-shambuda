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
  clearCloudToken,
  getCloudToken,
  hasCloudWriteToken,
  publishLetterToCloud,
  refreshCloudStore,
  setCloudToken,
} from '../lib/strokeCloud'
import {
  appendPoint,
  commitFreehandStroke,
  freehandPreviewPath,
} from '../lib/freehandStroke'
import './StrokeTeachPanel.css'

type Props = {
  letterId: string
  glyph: string
  track: ScriptTrack
}

type PanelMode = 'idle' | 'record' | 'preview'

const SPEED = 0.32
const MIN_STROKE_MS = 220
const LIFT_MS = 55
const glide = (t: number) => 1 - (1 - t) ** 1.25

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

  const [tick, setTick] = useState(0)
  const info = getTeachingInfo(letterId, script)
  const theoryData = info.data ?? null

  const [mode, setMode] = useState<PanelMode>('idle')
  const [recorded, setRecorded] = useState<GlyphStroke[]>([])
  const [drawing, setDrawing] = useState<[number, number][]>([])
  const [playId, setPlayId] = useState(0)
  const [activeStep, setActiveStep] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [tokenDraft, setTokenDraft] = useState(() => getCloudToken() ?? '')
  const [showToken, setShowToken] = useState(false)

  const outlineD = generated?.d
  const maskId = `${useId()}-teach-mask`
  const svgRef = useRef<SVGSVGElement>(null)
  const revealRefs = useRef<(SVGPathElement | null)[]>([])
  const tipRef = useRef<SVGCircleElement | null>(null)
  const drawingRef = useRef(false)
  const pointsRef = useRef<[number, number][]>([])

  const refresh = () => setTick((n) => n + 1)

  useEffect(() => {
    setMode('idle')
    setRecorded([])
    setDrawing([])
    setActiveStep(0)
    drawingRef.current = false
    pointsRef.current = []
  }, [letterId, script])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await refreshCloudStore({ maxAgeMs: 30_000 })
        if (!cancelled) refresh()
      } catch {
        // offline — use cache / baked-in
      }
    })()
    return () => {
      cancelled = true
    }
  }, [letterId, script])

  /** Preview: fill glyph along recorded freehand strokes */
  useEffect(() => {
    if (mode !== 'preview' || !theoryData?.strokes.length) return

    let cancelled = false
    let raf = 0
    const strokeCount = theoryData.strokes.length
    const strokeSnapshot = theoryData.strokes.map((s) => ({ ...s }))

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
      }

      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(start)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [mode, playId, tick, letterId, script, theoryData?.strokes.length, theoryData?.d])

  function pointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (mode !== 'record' || !outlineD) return
    e.preventDefault()

    const svg = svgRef.current
    if (!svg) return
    svg.setPointerCapture(e.pointerId)
    drawingRef.current = true
    setActiveStep(recorded.length)

    const pt = clientToSvgPoint(svg, e.clientX, e.clientY)
    pointsRef.current = [pt]
    setDrawing([pt])
  }

  function pointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!drawingRef.current || mode !== 'record') return
    const svg = svgRef.current
    if (!svg) return
    const pt = clientToSvgPoint(svg, e.clientX, e.clientY)
    pointsRef.current = appendPoint(pointsRef.current, pt)
    setDrawing(pointsRef.current)
  }

  function endStroke(e: React.PointerEvent<SVGSVGElement>) {
    if (mode !== 'record') return
    // Guard: pointerup + pointerleave would otherwise commit twice
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
      setActiveStep(index + 1)
    }
  }

  function startRecord() {
    if (!outlineD) return
    setRecorded([])
    setDrawing([])
    pointsRef.current = []
    drawingRef.current = false
    setMode('record')
    setActiveStep(0)
    setMessage(null)
  }

  function startPreview() {
    if (!theoryData) {
      setMessage('아직 저장된 이론값이 없습니다. 먼저 기록해 주세요.')
      return
    }
    setMode('preview')
    setPlayId((n) => n + 1)
    setMessage(null)
  }

  async function handleSaveTheory() {
    if (!outlineD || recorded.length === 0 || saving) return
    const count = recorded.length
    const data = { d: outlineD, strokes: recorded }

    // Always keep a local mirror for offline / retry
    saveUserStrokes(script, letterId, data)

    if (!hasCloudWriteToken()) {
      refresh()
      setMode('preview')
      setPlayId((n) => n + 1)
      setRecorded([])
      setDrawing([])
      setMessage(
        `${count}획이 이 기기에만 임시 저장됐습니다. 아래에 GitHub 토큰을 넣고 「클라우드에 올리기」를 누르세요.`,
      )
      setShowToken(true)
      return
    }

    setSaving(true)
    setMessage('클라우드에 이론값 저장 중…')
    try {
      await publishLetterToCloud(script, letterId, data)
      clearUserStrokes(script, letterId)
      refresh()
      setMode('preview')
      setPlayId((n) => n + 1)
      setRecorded([])
      setDrawing([])
      setMessage(
        `${count}획이 GitHub(${cloudRepoLabel()}) 이론값으로 저장됐습니다. 다른 기기에서도 동기화됩니다.`,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessage(`클라우드 저장 실패 — 기기에 임시 보관됨. ${msg}`)
      refresh()
      setMode('preview')
      setPlayId((n) => n + 1)
      setRecorded([])
      setDrawing([])
      setShowToken(true)
    } finally {
      setSaving(false)
    }
  }

  async function handlePublishLocal() {
    if (!theoryData || saving) return
    if (!hasCloudWriteToken()) {
      setShowToken(true)
      setMessage('먼저 GitHub 토큰을 저장하세요.')
      return
    }
    setSaving(true)
    setMessage('클라우드에 올리는 중…')
    try {
      await publishLetterToCloud(script, letterId, theoryData)
      clearUserStrokes(script, letterId)
      refresh()
      setMessage(`클라우드 이론값으로 반영했습니다 (${cloudRepoLabel()}).`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessage(`업로드 실패: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleSyncCloud() {
    setSyncing(true)
    setMessage('클라우드에서 불러오는 중…')
    try {
      await refreshCloudStore({ force: true })
      refresh()
      setMessage(`클라우드 동기화 완료 (${cloudRepoLabel()}).`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessage(`동기화 실패: ${msg}`)
    } finally {
      setSyncing(false)
    }
  }

  function handleSaveToken() {
    if (!tokenDraft.trim()) {
      clearCloudToken()
      setMessage('토큰을 지웠습니다.')
      return
    }
    setCloudToken(tokenDraft)
    setMessage('토큰을 이 기기에만 저장했습니다. 이론값 저장 시 클라우드에 올라갑니다.')
    setShowToken(false)
  }

  function handleClearDraft() {
    clearUserStrokes(script, letterId)
    refresh()
    setMode('idle')
    setMessage('이 기기의 임시 저장을 삭제했습니다.')
  }

  function handleReteach() {
    clearUserStrokes(script, letterId)
    refresh()
    startRecord()
    setMessage('처음부터 다시 기록합니다. 저장하면 클라우드 이론값을 덮어씁니다.')
  }

  function undoStroke() {
    if (drawingRef.current) return
    setRecorded((p) => {
      const next = p.slice(0, -1)
      setActiveStep(next.length)
      return next
    })
    setDrawing([])
    pointsRef.current = []
  }

  const statusLabel =
    info.source === 'cloud'
      ? '클라우드 이론값'
      : info.source === 'taught'
        ? '앱 내장 이론값'
        : info.source === 'draft-over-official'
          ? '임시 (업로드 필요)'
          : info.source === 'local'
            ? '임시 저장'
            : '미기록'

  const statusClass =
    info.source === 'cloud' || info.source === 'taught'
      ? 'teach__status--official'
      : info.source === 'draft-over-official' || info.source === 'local'
        ? 'teach__status--draft'
        : 'teach__status--empty'

  const previewPath = freehandPreviewPath(drawing)
  const needsUpload =
    info.source === 'local' || info.source === 'draft-over-official'
  void tick

  return (
    <section className="teach" aria-label="획 가르치기">
      <div className="teach__head">
        <h3>획 가르치기</h3>
        <span className={`teach__status ${statusClass}`}>{statusLabel}</span>
      </div>

      <div className="teach__meta">
        {info.strokeCount > 0 ? (
          <>
            <span>{info.strokeCount}획</span>
            {info.savedAt ? <span>· {formatWhen(info.savedAt)}</span> : null}
            <span> · {cloudRepoLabel()}</span>
          </>
        ) : (
          <span>아직 기록 없음 · 원하는 만큼 획을 그려 주세요</span>
        )}
      </div>

      {mode === 'idle' && (
        <>
          <div className="teach__actions">
            <button type="button" className="teach__btn teach__btn--primary" onClick={startRecord}>
              {info.source === 'generated' ? '기록하기' : '다시 기록하기'}
            </button>
            <button type="button" className="teach__btn" onClick={startPreview} disabled={!theoryData}>
              확인
            </button>
            <button
              type="button"
              className="teach__btn"
              onClick={handleSyncCloud}
              disabled={syncing}
            >
              {syncing ? '동기화…' : '클라우드 불러오기'}
            </button>
            {needsUpload && (
              <button
                type="button"
                className="teach__btn teach__btn--primary"
                onClick={handlePublishLocal}
                disabled={saving}
              >
                클라우드에 올리기
              </button>
            )}
            {theoryData && (
              <button type="button" className="teach__btn teach__btn--warn" onClick={handleReteach}>
                덮어쓰기
              </button>
            )}
            {needsUpload && (
              <button type="button" className="teach__btn" onClick={handleClearDraft}>
                임시 삭제
              </button>
            )}
            <button
              type="button"
              className="teach__btn"
              onClick={() => setShowToken((v) => !v)}
            >
              {hasCloudWriteToken() ? '토큰 설정' : '토큰 필요'}
            </button>
          </div>

          {showToken && (
            <div className="teach__token">
              <p>
                GitHub Personal Access Token (Contents 쓰기). 이 기기 localStorage에만 저장되며
                저장소에 커밋되지 않습니다. 공개 저장소면 읽기는 토큰 없이 됩니다.
              </p>
              <input
                type="password"
                className="teach__token-input"
                value={tokenDraft}
                onChange={(e) => setTokenDraft(e.target.value)}
                placeholder="ghp_… 또는 github_pat_…"
                autoComplete="off"
                spellCheck={false}
              />
              <div className="teach__actions">
                <button type="button" className="teach__btn teach__btn--primary" onClick={handleSaveToken}>
                  토큰 저장
                </button>
                <button
                  type="button"
                  className="teach__btn"
                  onClick={() => {
                    clearCloudToken()
                    setTokenDraft('')
                    setMessage('토큰을 지웠습니다.')
                  }}
                >
                  토큰 지우기
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {mode === 'record' && (
        <>
          <p className="teach__hint">
            글자 안을 <strong>색칠하듯</strong> 그리면 글자가 채워집니다 ({recorded.length}획).
            손을 떼면 다음 획, 다 그렸으면 「이론값 저장」→ 클라우드.
          </p>
          <div className="teach__bar">
            <button type="button" className="teach__btn" onClick={() => setMode('idle')}>
              취소
            </button>
            <button type="button" className="teach__btn" onClick={undoStroke} disabled={!recorded.length}>
              한 획 취소
            </button>
            <button
              type="button"
              className="teach__btn teach__btn--primary"
              disabled={recorded.length === 0 || saving}
              onClick={handleSaveTheory}
            >
              {saving ? '저장 중…' : '이론값 저장'}
            </button>
          </div>
        </>
      )}

      {mode === 'preview' && (
        <div className="teach__bar">
          <button type="button" className="teach__btn" onClick={() => setPlayId((n) => n + 1)}>
            다시 확인
          </button>
          {needsUpload && (
            <button
              type="button"
              className="teach__btn teach__btn--primary"
              onClick={handlePublishLocal}
              disabled={saving}
            >
              클라우드에 올리기
            </button>
          )}
          <button type="button" className="teach__btn teach__btn--warn" onClick={handleReteach}>
            다시 가르치기
          </button>
          <button type="button" className="teach__btn" onClick={() => setMode('idle')}>
            닫기
          </button>
        </div>
      )}

      {message && <p className="teach__message">{message}</p>}

      {mode === 'record' && outlineD && (
        <div className="teach__stage">
          <svg
            ref={svgRef}
            className="teach__svg teach__svg--trace"
            viewBox={`0 0 ${STROKE_VIEWBOX} ${STROKE_VIEWBOX}`}
            role="img"
            aria-label={`${glyph} 획 직접 기록`}
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
            <path className="teach__glyph-guide" d={outlineD} />
            <path className="teach__glyph-ink" d={outlineD} mask={`url(#${maskId})`} />
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
      )}

      {mode === 'preview' && theoryData && (
        <div className="teach__stage">
          <svg
            ref={svgRef}
            className="teach__svg"
            viewBox={`0 0 ${STROKE_VIEWBOX} ${STROKE_VIEWBOX}`}
            role="img"
            aria-label={`${glyph} 이론값 확인`}
          >
            <defs>
              <mask id={`${maskId}-preview`} maskUnits="userSpaceOnUse">
                <rect width={STROKE_VIEWBOX} height={STROKE_VIEWBOX} fill="black" />
                {theoryData.strokes.map((s, i) => (
                  <path
                    key={`${letterId}-teach-${playId}-${i}`}
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

            <path className="teach__glyph-guide" d={theoryData.d} />
            <path
              className="teach__glyph-ink"
              d={theoryData.d}
              mask={`url(#${maskId}-preview)`}
            />
            <circle ref={tipRef} className="teach__tip" r={6} cx={-50} cy={-50} />
          </svg>

          <ol className="teach__steps">
            {theoryData.strokes.map((s, i) => {
              const state = activeStep === i ? 'is-active' : activeStep > i ? 'is-done' : ''
              return (
                <li key={`teach-prev-${letterId}-${i}`} className={`teach__step ${state}`}>
                  <span className="teach__step-num">{i + 1}</span>
                  <span className="teach__step-label">{s.label}</span>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </section>
  )
}
