import { useEffect, useMemo, useState } from 'react'
import type { StrokeScript } from '../data/glyphStrokes'
import { STROKE_VIEWBOX } from '../data/glyphStrokes'
import { FoldChevron } from './FoldChevron'
import { restoreLetterFromVersion } from '../lib/strokeCloud'
import {
  fetchStrokeVersionIndex,
  fetchStrokeVersionSnapshot,
  type StrokeVersionMeta,
  type StrokeVersionSnapshot,
} from '../lib/strokeVersionsStore'
import './StrokeVersionPanel.css'

type Props = {
  script: StrokeScript
  letterId: string
  fontFace?: string | null
  disabled?: boolean
  onRestored?: () => void
}

function formatWhen(iso: string) {
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat('ko-KR', {
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d)
  } catch {
    return iso
  }
}

function versionKindLabel(kind: StrokeVersionMeta['kind']) {
  if (kind === 'pre-restore') return '복원 전 보관'
  if (kind === 'manual') return '복원한 기록'
  return '저장한 기록'
}

function versionTitle(v: StrokeVersionMeta) {
  return `${formatWhen(v.createdAt)} · ${v.strokeCount}획`
}

function versionSubtitle(v: StrokeVersionMeta) {
  return versionKindLabel(v.kind)
}

export function StrokeVersionPanel({
  script,
  letterId,
  fontFace = null,
  disabled = false,
  onRestored,
}: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [versions, setVersions] = useState<StrokeVersionMeta[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [preview, setPreview] = useState<StrokeVersionSnapshot | null>(null)
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    return versions.filter((v) => {
      if (v.script !== script || v.letterId !== letterId) return false
      if (fontFace && v.fontFace !== fontFace) return false
      return true
    })
  }, [versions, script, letterId, fontFace])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetchStrokeVersionIndex()
      .then((index) => {
        if (cancelled) return
        setVersions(index.versions)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, script, letterId, fontFace])

  useEffect(() => {
    if (!selectedId) {
      setPreview(null)
      return
    }
    const meta = filtered.find((v) => v.id === selectedId)
    if (!meta) {
      setPreview(null)
      return
    }
    let cancelled = false
    setBusy(true)
    void fetchStrokeVersionSnapshot(meta.path)
      .then((snap) => {
        if (!cancelled) setPreview(snap)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setPreview(null)
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId, filtered])

  async function handleRestore() {
    if (!preview || disabled || busy) return
    const ok = window.confirm(
      '이 버전으로 클라우드 획을 복원할까요?\n지금 내용은 복원 전 스냅샷으로 먼저 저장된 뒤 덮어씁니다.',
    )
    if (!ok) return
    setBusy(true)
    setError(null)
    try {
      await restoreLetterFromVersion(preview)
      onRestored?.()
      const index = await fetchStrokeVersionIndex()
      setVersions(index.versions)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`stroke-version ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="stroke-version__toggle motion-press"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <FoldChevron open={open} />
        획 버전 기록
      </button>
      <div className={`fold-panel ${open ? 'is-expanded' : ''}`}>
        <div className="fold-panel__inner">
          <div className="stroke-version__body">
            <p className="stroke-version__lead">
              이 글자·폰트의 이전 클라우드 스냅샷을 보고 복원할 수 있습니다. 라이브 파일은 확인 후에만
              바뀝니다.
            </p>
            {loading ? <p className="stroke-version__meta">목록 불러오는 중…</p> : null}
            {error ? (
              <p className="stroke-version__error" role="alert">
                {error}
              </p>
            ) : null}
            {!loading && filtered.length === 0 ? (
              <p className="stroke-version__meta">아직 저장된 버전이 없습니다.</p>
            ) : null}
            {filtered.length > 0 ? (
              <ul className="stroke-version__list" role="listbox" aria-label="획 버전 목록">
                {filtered.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      className={`stroke-version__item motion-press ${
                        selectedId === v.id ? 'is-selected' : ''
                      }`}
                      role="option"
                      aria-selected={selectedId === v.id}
                      disabled={busy}
                      onClick={() => setSelectedId(v.id)}
                    >
                      <span className="stroke-version__item-when">{versionTitle(v)}</span>
                      <span className="stroke-version__item-meta">{versionSubtitle(v)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {preview ? (
              <div className="stroke-version__preview">
                <svg
                  className="stroke-version__svg"
                  viewBox={`0 0 ${STROKE_VIEWBOX} ${STROKE_VIEWBOX}`}
                  aria-label="선택한 버전 미리보기"
                >
                  <rect
                    width={STROKE_VIEWBOX}
                    height={STROKE_VIEWBOX}
                    fill="color-mix(in srgb, var(--ink) 4%, transparent)"
                  />
                  {preview.entry.strokes?.map((stroke, i) => (
                    <path
                      key={`${preview.meta.createdAt}-${i}`}
                      d={stroke.d}
                      fill="none"
                      stroke="var(--ink)"
                      strokeWidth={stroke.width || 12}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.9}
                    />
                  ))}
                </svg>
                <button
                  type="button"
                  className="stroke-version__restore motion-press"
                  disabled={disabled || busy}
                  onClick={() => void handleRestore()}
                >
                  {busy ? '처리 중…' : '이 버전으로 복원'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
