import { useEffect, useState } from 'react'
import type { ScriptTrack } from '../types/track'
import {
  getEffectiveHangulHint,
  hasCloudWriteToken,
  refreshHangulCloudStore,
  type HangulHintSource,
} from '../lib/hangulHintsStore'
import { getTeachingInfo } from '../lib/strokeRecord'
import { refreshCloudStore } from '../lib/strokeCloud'
import {
  getEffectiveTheoryTip,
  refreshTheoryCloudStore,
  type TheoryTipSource,
} from '../lib/theoryTipsStore'
import './TeachSyncStatusBar.css'

type Props = {
  letterId: string
  track: ScriptTrack
  /** Bump to re-read local status after saves. */
  refreshKey?: number
}

type CellKind = 'theory' | 'guide' | 'hangul'

type CellStatus =
  | 'checking'
  | 'synced'
  | 'local'
  | 'bundled'
  | 'default'
  | 'empty'
  | 'no-token'
  | 'error'

type Cell = {
  kind: CellKind
  label: string
  status: CellStatus
  detail: string
}

const STATUS_TEXT: Record<CellStatus, string> = {
  checking: '확인 중…',
  synced: '클라우드 저장됨',
  local: '기기 초안',
  bundled: '앱 내장',
  default: '기본',
  empty: '미기록',
  'no-token': '토큰 없음',
  error: '오류',
}

function theoryStatus(source: TheoryTipSource, checking: boolean, errored: boolean): CellStatus {
  if (checking) return 'checking'
  if (errored) return 'error'
  if (source === 'local') return 'local'
  if (source === 'cloud') return 'synced'
  if (source === 'default') return 'default'
  if (!hasCloudWriteToken()) return 'no-token'
  return 'empty'
}

function hangulStatus(source: HangulHintSource, checking: boolean, errored: boolean): CellStatus {
  if (checking) return 'checking'
  if (errored) return 'error'
  if (source === 'local') return 'local'
  if (source === 'cloud') return 'synced'
  if (source === 'default') return 'default'
  if (!hasCloudWriteToken()) return 'no-token'
  return 'empty'
}

function guideStatus(
  letterId: string,
  track: ScriptTrack,
  checking: boolean,
  errored: boolean,
): CellStatus {
  if (checking) return 'checking'
  if (errored) return 'error'
  const script = track === 'sanskrit' ? 'deva' : 'siddham'
  const info = getTeachingInfo(letterId, script)
  if (info.source === 'local' || info.source === 'draft-over-official') return 'local'
  if (info.source === 'cloud') return 'synced'
  if (info.source === 'taught') return 'bundled'
  if (!hasCloudWriteToken()) return 'no-token'
  return 'empty'
}

function buildCells(
  letterId: string,
  track: ScriptTrack,
  checking: Record<CellKind, boolean>,
  errors: Record<CellKind, boolean>,
): Cell[] {
  const theory = getEffectiveTheoryTip(letterId)
  const hangul = getEffectiveHangulHint(letterId)

  return [
    {
      kind: 'theory',
      label: '이론·쓰기 팁',
      status: theoryStatus(theory.source, checking.theory, errors.theory),
      detail: theory.updatedAt
        ? `갱신 ${theory.updatedAt.slice(0, 10)}`
        : theory.source === 'default'
          ? '번들 기본값'
          : '클라우드 theoryTips',
    },
    {
      kind: 'guide',
      label: '획 가이드',
      status: guideStatus(letterId, track, checking.guide, errors.guide),
      detail: '획·라벨·기록 팁',
    },
    {
      kind: 'hangul',
      label: '한글 발음',
      status: hangulStatus(hangul.source, checking.hangul, errors.hangul),
      detail: hangul.updatedAt
        ? `갱신 ${hangul.updatedAt.slice(0, 10)}`
        : hangul.source === 'default'
          ? '번들 기본값'
          : '클라우드 hangulHints',
    },
  ]
}

export function TeachSyncStatusBar({ letterId, track, refreshKey = 0 }: Props) {
  const [tick, setTick] = useState(0)
  const [checking, setChecking] = useState<Record<CellKind, boolean>>({
    theory: true,
    guide: true,
    hangul: true,
  })
  const [errors, setErrors] = useState<Record<CellKind, boolean>>({
    theory: false,
    guide: false,
    hangul: false,
  })

  useEffect(() => {
    let cancelled = false
    setChecking({ theory: true, guide: true, hangul: true })
    setErrors({ theory: false, guide: false, hangul: false })

    async function run(
      kind: CellKind,
      task: () => Promise<unknown>,
    ) {
      try {
        await task()
        if (!cancelled) {
          setErrors((prev) => ({ ...prev, [kind]: false }))
        }
      } catch {
        if (!cancelled) {
          setErrors((prev) => ({ ...prev, [kind]: true }))
        }
      } finally {
        if (!cancelled) {
          setChecking((prev) => ({ ...prev, [kind]: false }))
          setTick((n) => n + 1)
        }
      }
    }

    void run('theory', () => refreshTheoryCloudStore({ maxAgeMs: 15_000 }))
    void run('guide', () => refreshCloudStore({ maxAgeMs: 15_000 }))
    void run('hangul', () => refreshHangulCloudStore({ maxAgeMs: 15_000 }))

    return () => {
      cancelled = true
    }
  }, [letterId, refreshKey])

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 2000)
    return () => window.clearInterval(id)
  }, [letterId])

  void tick
  const cells = buildCells(letterId, track, checking, errors)

  return (
    <section className="teach-sync" aria-label="클라우드 저장·동기화 상태">
      <div className="teach-sync__grid" role="list">
        {cells.map((cell) => (
          <div key={cell.kind} className="teach-sync__cell" role="listitem">
            <p className="teach-sync__label">{cell.label}</p>
            <p
              className={`teach-sync__status teach-sync__status--${cell.status}`}
              title={cell.detail}
            >
              <span className="teach-sync__dot" aria-hidden="true" />
              {STATUS_TEXT[cell.status]}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
