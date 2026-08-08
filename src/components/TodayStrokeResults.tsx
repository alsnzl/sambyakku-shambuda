import { useEffect, useMemo, useState } from 'react'
import type { ScriptTrack } from '../types/track'
import { STROKE_VIEWBOX } from '../data/glyphStrokes'
import { getLetterById } from '../data/letters'
import { FoldChevron } from './FoldChevron'
import { getCloudTaughtStrokes } from '../lib/strokeCloud'
import { glyphForTrack } from '../lib/scriptDisplay'
import {
  listTodayStrokeRecords,
  todayStrokeSummary,
  type TodayStrokeRecord,
} from '../lib/todayStrokeSession'
import './TodayStrokeResults.css'

type Props = {
  track: ScriptTrack
  /** Bump to reload session after a save. */
  epoch?: number
  onOpenLetter: (letterId: string) => void
}

type ViewMode = 'grid' | 'one'

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function uploadLabel(upload: TodayStrokeRecord['upload']) {
  if (upload === 'success') return '업로드 완료'
  if (upload === 'local-only') return '기기에만'
  return '업로드 실패'
}

function MiniCanvas({ record }: { record: TodayStrokeRecord }) {
  const data = getCloudTaughtStrokes(record.letterId, record.script, record.fontFace)
  return (
    <svg
      className="today-results__svg"
      viewBox={`0 0 ${STROKE_VIEWBOX} ${STROKE_VIEWBOX}`}
      aria-hidden="true"
    >
      <rect
        width={STROKE_VIEWBOX}
        height={STROKE_VIEWBOX}
        fill="color-mix(in srgb, var(--ink) 4%, transparent)"
      />
      {(data?.strokes ?? []).map((stroke, i) => (
        <path
          key={`${record.id}-${i}`}
          d={stroke.d}
          fill="none"
          stroke="var(--ink)"
          strokeWidth={stroke.width || 12}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}

export function TodayStrokeResults({ track, epoch = 0, onOpenLetter }: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<ViewMode>('grid')
  const [cursor, setCursor] = useState(0)
  const [records, setRecords] = useState<TodayStrokeRecord[]>([])

  useEffect(() => {
    setRecords(listTodayStrokeRecords())
  }, [epoch, open])

  const forTrack = useMemo(() => {
    const script = track === 'sanskrit' ? 'deva' : 'siddham'
    return records.filter((r) => r.script === script)
  }, [records, track])

  const summary = todayStrokeSummary()
  const one = forTrack[Math.min(cursor, Math.max(forTrack.length - 1, 0))] ?? null

  useEffect(() => {
    if (cursor >= forTrack.length) setCursor(0)
  }, [forTrack.length, cursor])

  return (
    <section className={`today-results ${open ? 'is-open' : ''}`} aria-label="오늘 획 기록 확인">
      <button
        type="button"
        className="today-results__toggle motion-press"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="today-results__toggle-main">
          <FoldChevron open={open} />
          오늘 기록 확인
        </span>
        <span className="today-results__toggle-meta">
          {summary.total}자 · 성공 {summary.success}
          {summary.failed ? ` · 실패 ${summary.failed}` : ''}
        </span>
      </button>

      <div className={`fold-panel ${open ? 'is-expanded' : ''}`}>
        <div className="fold-panel__inner">
          <div className="today-results__body">
            <p className="today-results__lead">
              오늘 이 기기에서 저장한 획입니다. 업로드 상태를 확인하고, 글자를 눌러 바로 다시
              고칠 수 있습니다.
            </p>

            <div className="today-results__modes" role="group" aria-label="보기 방식">
              <button
                type="button"
                className={`today-results__mode motion-press ${mode === 'grid' ? 'is-active' : ''}`}
                aria-pressed={mode === 'grid'}
                onClick={() => setMode('grid')}
              >
                모아보기
              </button>
              <button
                type="button"
                className={`today-results__mode motion-press ${mode === 'one' ? 'is-active' : ''}`}
                aria-pressed={mode === 'one'}
                onClick={() => setMode('one')}
              >
                하나씩
              </button>
            </div>

            {forTrack.length === 0 ? (
              <p className="today-results__empty">오늘 이 스크립트에서 저장한 획이 없습니다.</p>
            ) : null}

            {mode === 'grid' && forTrack.length > 0 ? (
              <ul className="today-results__grid">
                {forTrack.map((record) => {
                  const letter = getLetterById(record.letterId)
                  const glyph = letter ? glyphForTrack(letter, track) : record.letterId
                  return (
                    <li key={record.id}>
                      <button
                        type="button"
                        className={`today-results__card motion-press upload-${record.upload}`}
                        onClick={() => onOpenLetter(record.letterId)}
                      >
                        <MiniCanvas record={record} />
                        <span className="today-results__glyph">{glyph}</span>
                        <span className="today-results__iast">{letter?.iast ?? record.letterId}</span>
                        <span className="today-results__status">{uploadLabel(record.upload)}</span>
                        <span className="today-results__when">
                          {record.strokeCount}획 · {formatWhen(record.recordedAt)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : null}

            {mode === 'one' && one ? (
              <div className="today-results__one">
                <div className="today-results__one-nav">
                  <button
                    type="button"
                    className="today-results__nav-btn motion-press"
                    disabled={cursor <= 0}
                    onClick={() => setCursor((c) => Math.max(0, c - 1))}
                  >
                    이전
                  </button>
                  <span>
                    {cursor + 1} / {forTrack.length}
                  </span>
                  <button
                    type="button"
                    className="today-results__nav-btn motion-press"
                    disabled={cursor >= forTrack.length - 1}
                    onClick={() => setCursor((c) => Math.min(forTrack.length - 1, c + 1))}
                  >
                    다음
                  </button>
                </div>
                <MiniCanvas record={one} />
                <p className="today-results__one-title">
                  {getLetterById(one.letterId)?.iast ?? one.letterId} · {one.fontLabel}
                </p>
                <p className="today-results__one-meta">
                  {uploadLabel(one.upload)} · {one.strokeCount}획 · {formatWhen(one.recordedAt)}
                </p>
                {one.error ? <p className="today-results__error">{one.error}</p> : null}
                <button
                  type="button"
                  className="today-results__edit motion-press"
                  onClick={() => onOpenLetter(one.letterId)}
                >
                  이 글자 다시 수정
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
