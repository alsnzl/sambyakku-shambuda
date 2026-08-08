import { useMemo, useState } from 'react'
import type { ScriptTrack } from '../types/track'
import { getDueLetters, reviewSrs } from '../lib/learnerStore'
import { playLetterPronunciation } from '../lib/audio'
import { getEffectiveHangulHint } from '../lib/hangulHintsStore'
import { glyphForTrack } from '../lib/scriptDisplay'
import './tools.css'

type Props = {
  track: ScriptTrack
  onBack: () => void
  backLabel?: string
}

export function ReviewPage({ track, onBack, backLabel = '← 학습' }: Props) {
  const queue = useMemo(() => getDueLetters(track, 15), [track])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const current = queue[index]
  const glyphClass =
    track === 'sanskrit' ? 'tool__chip-glyph--deva' : 'tool__chip-glyph--siddham'

  function grade(g: 'again' | 'hard' | 'good' | 'easy') {
    if (!current) return
    reviewSrs(track, current.id, g)
    setFlipped(false)
    setIndex((i) => i + 1)
  }

  if (!current) {
    return (
      <main className="tool">
        <header className="tool__bar">
          <button type="button" className="tool__back motion-press" onClick={onBack}>
            {backLabel}
          </button>
          <h1>복습</h1>
        </header>
        <section className="tool__block">
          <p className="tool__empty">지금은 복습할 카드가 없습니다. 학습·퀴즈를 조금 더 해보세요.</p>
        </section>
      </main>
    )
  }

  return (
    <main className="tool">
      <header className="tool__bar">
        <button type="button" className="tool__back motion-press" onClick={onBack}>
          {backLabel}
        </button>
        <h1>
          복습 {index + 1}/{queue.length}
        </h1>
      </header>
      <p className="tool__lead">카드를 눌러 답을 확인한 뒤, 기억 정도를 고르세요.</p>

      <button
        type="button"
        className="tool__block motion-press"
        style={{ width: '100%', textAlign: 'center', cursor: 'pointer' }}
        onClick={() => setFlipped((f) => !f)}
      >
        {!flipped ? (
          <span className={`tool__chip-glyph ${glyphClass}`} style={{ fontSize: '3.2rem' }} lang="sa">
            {glyphForTrack(current, track)}
          </span>
        ) : (
          <>
            <h2 className="tool__iast">{current.iast}</h2>
            <p className="tool__meta">{getEffectiveHangulHint(current.id).text || current.hangulHint}</p>
            {current.note ? <p className="tool__lead">{current.note}</p> : null}
          </>
        )}
      </button>

      <div className="tool__row" style={{ marginTop: '0.35rem' }}>
        <button type="button" className="tool__btn motion-press" onClick={() => playLetterPronunciation(current)}>
          발음
        </button>
        {!flipped ? (
          <button type="button" className="tool__btn tool__btn--primary motion-press" onClick={() => setFlipped(true)}>
            정답 보기
          </button>
        ) : (
          <>
            <button type="button" className="tool__btn motion-press" onClick={() => grade('again')}>
              다시
            </button>
            <button type="button" className="tool__btn motion-press" onClick={() => grade('hard')}>
              어려움
            </button>
            <button type="button" className="tool__btn tool__btn--primary motion-press" onClick={() => grade('good')}>
              좋음
            </button>
            <button type="button" className="tool__btn motion-press" onClick={() => grade('easy')}>
              쉬움
            </button>
          </>
        )}
      </div>
    </main>
  )
}
