import type { Letter } from '../data/letters'
import type { ScriptTrack } from '../types/track'
import { trackMeta } from '../types/track'
import { getProgressSummary, getWeakLetters } from '../lib/learnerStore'
import { getPathSnapshot } from '../lib/pathProgress'
import { glyphForTrack } from '../lib/scriptDisplay'
import './tools.css'

type Props = {
  track: ScriptTrack
  onBack: () => void
  backLabel?: string
  onOpenLetter?: (letter: Letter) => void
  onOpenPath?: () => void
}

export function ProgressPage({
  track,
  onBack,
  backLabel = '← 학습',
  onOpenLetter,
  onOpenPath,
}: Props) {
  const s = getProgressSummary(track)
  const weak = getWeakLetters(track, 8)
  const path = getPathSnapshot()
  const glyphClass =
    track === 'sanskrit' ? 'tool__chip-glyph--deva' : 'tool__chip-glyph--siddham'
  const pct = Math.round((s.learned / Math.max(s.total, 1)) * 100)

  return (
    <main className="tool">
      <header className="tool__bar">
        <button type="button" className="tool__back motion-press" onClick={onBack}>
          {backLabel}
        </button>
        <h1>진도</h1>
      </header>
      <p className="tool__lead">{trackMeta[track].title} 트랙 학습 현황입니다.</p>

      <section className="tool__block">
        <h2>수행 · {path.stage.nameKo}</h2>
        <p className="tool__meta">
          공덕 {path.path.merit} · 연속 {path.path.streak}일
        </p>
        {onOpenPath ? (
          <button
            type="button"
            className="tool__btn tool__btn--primary motion-press"
            onClick={onOpenPath}
          >
            수행 길 보기
          </button>
        ) : null}
      </section>

      <section className="tool__block">
        <h2>요약</h2>
        <p className="tool__meta">학습 완료율 {pct}%</p>
        <div className="tool__stat-grid">
          <div className="tool__stat">
            <strong>
              {s.learned}/{s.total}
            </strong>
            <span>학습 완료</span>
          </div>
          <div className="tool__stat">
            <strong>{s.seen}</strong>
            <span>본 글자</span>
          </div>
          <div className="tool__stat">
            <strong>{s.due}</strong>
            <span>복습 대기</span>
          </div>
          <div className="tool__stat">
            <strong>{s.favorites}</strong>
            <span>즐겨찾기</span>
          </div>
          <div className="tool__stat">
            <strong>{s.quizAccuracy}%</strong>
            <span>퀴즈 정답률</span>
          </div>
          <div className="tool__stat">
            <strong>{s.avgWrite || '—'}</strong>
            <span>쓰기 평균 점수</span>
          </div>
        </div>
      </section>

      <section className="tool__block">
        <h2>약점 글자</h2>
        {weak.length === 0 ? (
          <p className="tool__empty">아직 약점으로 잡힌 글자가 없습니다. 퀴즈를 풀어 보세요.</p>
        ) : (
          <div className="tool__row">
            {weak.map((letter) => (
              <button
                key={letter.id}
                type="button"
                className="tool__chip motion-press"
                onClick={() => onOpenLetter?.(letter)}
              >
                <span className={`tool__chip-glyph ${glyphClass}`} lang="sa">
                  {glyphForTrack(letter, track)}
                </span>
                <span className="tool__chip-sub">{letter.iast}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
