import { useMemo, useState } from 'react'
import type { Letter } from '../data/letters'
import type { ScriptTrack } from '../types/track'
import { getFavorites } from '../lib/learnerStore'
import { getWeakLetters } from '../lib/learnerStore'
import './tools.css'

type Props = {
  track: ScriptTrack
  onBack: () => void
  onOpenLetter: (letter: Letter) => void
}

export function FavoritesPage({ track, onBack, onOpenLetter }: Props) {
  const [tab, setTab] = useState<'fav' | 'weak'>('fav')
  const favs = useMemo(() => getFavorites(track), [track])
  const weak = useMemo(() => getWeakLetters(track, 24), [track])
  const list = tab === 'fav' ? favs : weak
  const glyphClass =
    track === 'sanskrit' ? 'tool__chip-glyph--deva' : 'tool__chip-glyph--siddham'

  return (
    <main className="tool">
      <header className="tool__bar">
        <button type="button" className="tool__back motion-press" onClick={onBack}>
          ← 홈
        </button>
        <h1>즐겨찾기 · 약점</h1>
      </header>

      <div className="tool__row" style={{ marginBottom: '0.85rem' }}>
        <button
          type="button"
          className={`tool__btn motion-press ${tab === 'fav' ? 'tool__btn--primary' : ''}`}
          onClick={() => setTab('fav')}
        >
          즐겨찾기
        </button>
        <button
          type="button"
          className={`tool__btn motion-press ${tab === 'weak' ? 'tool__btn--primary' : ''}`}
          onClick={() => setTab('weak')}
        >
          약점
        </button>
      </div>

      <section className="tool__block">
        {list.length === 0 ? (
          <p className="tool__empty">
            {tab === 'fav'
              ? '글자 상세에서 ★로 즐겨찾기를 추가할 수 있습니다.'
              : '퀴즈를 풀면 틀린 글자가 여기에 모입니다.'}
          </p>
        ) : (
          <div className="tool__row">
            {list.map((letter) => (
              <button
                key={letter.id}
                type="button"
                className="tool__chip motion-press"
                onClick={() => onOpenLetter(letter)}
              >
                <span className={`tool__chip-glyph ${glyphClass}`} lang="sa">
                  {track === 'sanskrit' ? letter.dewa : letter.siddham}
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
