import { useEffect, useState } from 'react'
import type { Letter } from '../data/letters'
import type { ScriptTrack } from '../types/track'
import { trackMeta } from '../types/track'
import { playLetterPronunciation } from '../lib/audio'
import {
  isFavorite,
  markLetterSeen,
  toggleFavorite,
} from '../lib/learnerStore'
import { getSimilarLetters } from '../data/similarLetters'
import { getTheoryBlurb } from '../data/theoryTips'
import { WritePractice } from './WritePractice'
import { StrokeTeachPanel } from './StrokeTeachPanel'
import './LetterCard.css'

type Props = {
  letter: Letter
  track: ScriptTrack
  onOpenLetter?: (letter: Letter) => void
}

export function LetterCard({ letter, track, onOpenLetter }: Props) {
  const glyph = track === 'sanskrit' ? letter.dewa : letter.siddham
  const [fav, setFav] = useState(() => isFavorite(track, letter.id))
  const [writeOpen, setWriteOpen] = useState(false)
  const similar = getSimilarLetters(letter.id)
  const theory = getTheoryBlurb(letter.id)
  const glyphClass =
    track === 'sanskrit' ? 'letter-card__similar-glyph--deva' : 'letter-card__similar-glyph--siddham'
  const heroClass =
    track === 'sanskrit' ? 'letter-card__hero--deva' : 'letter-card__hero--siddham'

  useEffect(() => {
    markLetterSeen(track, letter.id)
    setFav(isFavorite(track, letter.id))
    setWriteOpen(false)
  }, [letter.id, track])

  return (
    <article className="letter-card">
      <div className="letter-card__top">
        <div>
          <p className="letter-card__group">{letter.groupKo}</p>
          <p className="letter-card__script-label">{trackMeta[track].scriptLabel}</p>
        </div>
        <button
          type="button"
          className={`letter-card__fav motion-press ${fav ? 'is-on' : ''}`}
          onClick={() => setFav(toggleFavorite(track, letter.id))}
          aria-label={fav ? '즐겨찾기 해제' : '즐겨찾기 추가'}
        >
          {fav ? '★' : '☆'}
        </button>
      </div>

      {writeOpen ? (
        <WritePractice
          letterId={letter.id}
          glyph={glyph}
          track={track}
          onClose={() => setWriteOpen(false)}
        />
      ) : (
        <div className="letter-card__view">
          <div className="letter-card__hero-frame">
            <p className={`letter-card__hero ${heroClass}`} lang="sa" aria-label={letter.iast}>
              {glyph}
            </p>
          </div>
          <div className="letter-card__actions">
            <button
              type="button"
              className="letter-card__write-btn motion-press"
              onClick={() => setWriteOpen(true)}
            >
              쓰기 연습
            </button>
            <button
              type="button"
              className="letter-card__audio motion-press"
              onClick={() => playLetterPronunciation(letter)}
              title="발음 듣기"
            >
              발음 듣기
            </button>
          </div>
        </div>
      )}

      <StrokeTeachPanel letterId={letter.id} glyph={glyph} track={track} />

      <div className="letter-card__meta">
        <p className="letter-card__iast">{letter.iast}</p>
        <p className="letter-card__hangul">{letter.hangulHint}</p>
        {letter.note ? <p className="letter-card__note">{letter.note}</p> : null}
      </div>

      {theory && theory !== letter.note ? (
        <div className="letter-card__theory">
          <h4>이론 · 쓰기 팁</h4>
          <p>{theory}</p>
        </div>
      ) : null}

      {similar.length > 0 && (
        <div className="letter-card__similar">
          <h4>유사 글자</h4>
          <div className="letter-card__similar-row">
            {similar.map((s) => (
              <button
                key={s.id}
                type="button"
                className="letter-card__similar-btn motion-press"
                onClick={() => onOpenLetter?.(s)}
              >
                <span className={glyphClass} lang="sa">
                  {track === 'sanskrit' ? s.dewa : s.siddham}
                </span>
                <span>{s.iast}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  )
}
