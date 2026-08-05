import { MANTRA_SAMPLES } from '../data/mantras'
import { PATH_STAGES, mantraUnlockStage } from '../data/pathStages'
import { getPathSnapshot, isMantraUnlocked } from '../lib/pathProgress'
import { speakIast } from '../lib/audio'
import './tools.css'

type Props = {
  onBack: () => void
}

export function PathPage({ onBack }: Props) {
  const snap = getPathSnapshot()
  const j = snap.journalToday

  return (
    <main className="tool">
      <header className="tool__bar">
        <button type="button" className="tool__back motion-press" onClick={onBack}>
          ← 홈
        </button>
        <h1>수행 길</h1>
      </header>

      <section className="tool__block">
        <h2>
          {snap.stage.nameKo}
          <span className="tool__meta" style={{ marginLeft: '0.5rem' }}>
            · 공덕 {snap.path.merit} · {snap.path.streak}일째
          </span>
        </h2>
        <p className="tool__lead" style={{ marginBottom: '0.5rem' }}>
          {snap.stage.verseKo}
        </p>
        <div className="path-lotus-wrap">
          <div className="path-lotus path-lotus--lg" aria-hidden="true">
            {snap.petals.map((on, i) => (
              <span key={PATH_STAGES[i].id} className={`path-lotus__petal ${on ? 'is-on' : ''}`} />
            ))}
          </div>
        </div>
        {snap.next ? (
          <p className="path-next tool__meta">
            다음 · {snap.next.nameKo}: {snap.next.hintKo}
          </p>
        ) : (
          <p className="path-next tool__meta">일곱 단계를 모두 열었습니다. 천천히 이어 가 보세요.</p>
        )}
      </section>

      {(snap.dueHint || snap.balanceTip) && (
        <section className="tool__block">
          <h2>오늘의 인연</h2>
          {snap.dueHint ? <p className="tool__lead">{snap.dueHint}</p> : null}
          {snap.balanceTip ? <p className="tool__lead">{snap.balanceTip}</p> : null}
        </section>
      )}

      <section className="tool__block">
        <h2>오늘 수행 일기</h2>
        {j.merit === 0 && j.quiz + j.write + j.review + j.daily === 0 ? (
          <p className="tool__empty">아직 기록이 없습니다. 학습·복습·쓰기를 하면 여기에 쌓입니다.</p>
        ) : (
          <div className="tool__stat-grid">
            <div className="tool__stat">
              <strong>{j.merit}</strong>
              <span>공덕</span>
            </div>
            <div className="tool__stat">
              <strong>{j.quiz}</strong>
              <span>퀴즈</span>
            </div>
            <div className="tool__stat">
              <strong>{j.write}</strong>
              <span>쓰기</span>
            </div>
            <div className="tool__stat">
              <strong>{j.review}</strong>
              <span>복습</span>
            </div>
            <div className="tool__stat">
              <strong>{j.daily}</strong>
              <span>오늘 학습</span>
            </div>
          </div>
        )}
      </section>

      <section className="tool__block">
        <h2>단계</h2>
        <ul className="path-stages">
          {PATH_STAGES.map((s, i) => (
            <li key={s.id} className={snap.petals[i] ? 'is-open' : ''}>
              <strong>
                {snap.petals[i] ? '○' : '·'} {s.nameKo}
              </strong>
              <span>{s.hintKo}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="tool__block">
        <h2>열린 구절</h2>
        <div className="tool__row">
          {MANTRA_SAMPLES.map((m) => {
            const open = isMantraUnlocked(m.id)
            const need = mantraUnlockStage(m.id)
            return (
              <button
                key={m.id}
                type="button"
                className={`tool__chip motion-press ${open ? '' : 'is-locked'}`}
                disabled={!open}
                onClick={() => open && speakIast(m.iast)}
                title={open ? m.iast : `${need?.nameKo}에서 열림`}
              >
                <span className="tool__chip-glyph tool__chip-glyph--deva" lang="sa">
                  {open ? m.dewa : '·'}
                </span>
                <span className="tool__chip-sub">{open ? m.titleKo : need?.nameKo}</span>
              </button>
            )
          })}
        </div>
      </section>
    </main>
  )
}
