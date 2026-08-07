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
import { glyphForTrack } from '../lib/scriptDisplay'
import { WritePractice } from './WritePractice'
import { StrokeTeachPanel } from './StrokeTeachPanel'
import { TheoryTipPanel } from './TheoryTipPanel'
import './LetterCard.css'

type Props = {
  letter: Letter
  track: ScriptTrack
  onOpenLetter?: (letter: Letter) => void
  onPrev?: () => void
  onNext?: () => void
  hasPrev?: boolean
  hasNext?: boolean
}

type CardMode = 'learn' | 'teach'

export function LetterCard({
  letter,
  track,
  onOpenLetter,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
}: Props) {
  const glyph = glyphForTrack(letter, track)
  const [fav, setFav] = useState(() => isFavorite(track, letter.id))
  const [writeOpen, setWriteOpen] = useState(false)
  const [cardMode, setCardMode] = useState<CardMode>('learn')
  const similar = getSimilarLetters(letter.id)
  const glyphClass =
    track === 'sanskrit' ? 'letter-card__similar-glyph--deva' : 'letter-card__similar-glyph--siddham'
  const heroClass =
    track === 'sanskrit' ? 'letter-card__hero--deva' : 'letter-card__hero--siddham'

  useEffect(() => {
    markLetterSeen(track, letter.id)
    setFav(isFavorite(track, letter.id))
    setWriteOpen(false)
    setCardMode('learn')
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

      <div className="letter-card__modes" role="tablist" aria-label="글자 보기 방식">
        <button
          type="button"
          role="tab"
          aria-selected={cardMode === 'learn'}
          className={`letter-card__mode motion-press ${cardMode === 'learn' ? 'is-active' : ''}`}
          onClick={() => {
            setCardMode('learn')
            setWriteOpen(false)
          }}
        >
          배우기
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={cardMode === 'teach'}
          className={`letter-card__mode motion-press ${cardMode === 'teach' ? 'is-active' : ''}`}
          onClick={() => {
            setCardMode('teach')
            setWriteOpen(false)
          }}
        >
          가르치기
        </button>
      </div>

      {cardMode === 'learn' ? (
        <>
          <div className="letter-card__view">
            <div className="letter-card__stage">
              <button
                type="button"
                className="letter-card__side-nav motion-press"
                onClick={onPrev}
                disabled={!hasPrev || !onPrev}
                aria-label="이전 글자"
              >
                ‹
              </button>

              {writeOpen ? (
                <WritePractice
                  letterId={letter.id}
                  glyph={glyph}
                  track={track}
                  onClose={() => setWriteOpen(false)}
                />
              ) : (
                <div className="letter-card__hero-frame">
                  <p className={`letter-card__hero ${heroClass}`} lang="sa" aria-label={letter.iast}>
                    {glyph}
                  </p>
                </div>
              )}

              <button
                type="button"
                className="letter-card__side-nav motion-press"
                onClick={onNext}
                disabled={!hasNext || !onNext}
                aria-label="다음 글자"
              >
                ›
              </button>
            </div>

            {!writeOpen ? (
              <div className="letter-card__actions">
                <button
                  type="button"
                  className="letter-card__write-btn motion-press"
                  onClick={() => setWriteOpen(true)}
                >
                  따라 쓰기
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
            ) : null}
          </div>

          <div className="letter-card__meta">
            <p className="letter-card__iast">{letter.iast}</p>
            <p className="letter-card__hangul">{letter.hangulHint}</p>
            {letter.note ? <p className="letter-card__note">{letter.note}</p> : null}
          </div>

          <TheoryTipPanel letterId={letter.id} editable={false} />

          {similar.length > 0 && (
            <div className="letter-card__similar">
              <h4>비슷한 글자</h4>
              <div className="letter-card__similar-row">
                {similar.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="letter-card__similar-btn motion-press"
                    onClick={() => onOpenLetter?.(s)}
                  >
                    <span className={glyphClass} lang="sa">
                      {glyphForTrack(s, track)}
                    </span>
                    <span>{s.iast}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="letter-card__teach">
          <p className="letter-card__teach-lead">
            글자 위에 획을 그려 저장하면, 따라 쓰기·보기에서 쓸 수 있어요.
          </p>
          <div className="letter-card__teach-glyph" lang="sa" aria-hidden="true">
            <span className={heroClass}>{glyph}</span>
            <span className="letter-card__teach-iast">{letter.iast}</span>
          </div>
          <StrokeTeachPanel letterId={letter.id} glyph={glyph} track={track} />
          <TheoryTipPanel letterId={letter.id} editable />
        </div>
      )}
    </article>
  )
}
