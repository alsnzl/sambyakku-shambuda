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
import { getActiveScriptFontStack } from '../lib/customScriptFonts'
import {
  getEffectiveHangulHint,
  refreshHangulCloudStore,
} from '../lib/hangulHintsStore'
import { glyphForTrack } from '../lib/scriptDisplay'
import { useHardwareBack } from '../lib/useHardwareBack'
import { useScriptFontEpoch } from '../lib/useScriptFontEpoch'
import { WritePractice } from './WritePractice'
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
  /** Letter paging motion — canvas slides; copy blurs in. */
  navMotion?: 'slide-left' | 'slide-right' | 'pop'
  /** Notify parent when write practice is open (e.g. hide outer font bar). */
  onWritingChange?: (writing: boolean) => void
}

function SideNavChevron({ dir }: { dir: 'prev' | 'next' }) {
  return (
    <svg className="letter-card__side-nav-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      {dir === 'prev' ? (
        <path
          d="M14.5 5.5 8 12l6.5 6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M9.5 5.5 16 12l-6.5 6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

export function LetterCard({
  letter,
  track,
  onOpenLetter,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  navMotion = 'pop',
  onWritingChange,
}: Props) {
  const fontEpoch = useScriptFontEpoch()
  const glyph = glyphForTrack(letter, track)
  const [fav, setFav] = useState(() => isFavorite(track, letter.id))
  const [writeOpen, setWriteOpen] = useState(false)
  const [hangulTick, setHangulTick] = useState(0)
  const similar = getSimilarLetters(letter.id)
  const glyphClass =
    track === 'sanskrit' ? 'letter-card__similar-glyph--deva' : 'letter-card__similar-glyph--siddham'
  const heroClass =
    track === 'sanskrit' ? 'letter-card__hero--deva' : 'letter-card__hero--siddham'
  const scriptStack = getActiveScriptFontStack(track === 'sanskrit' ? 'deva' : 'siddham')
  const heroMotionClass =
    navMotion === 'slide-left'
      ? 'letter-card__hero--slide-next'
      : navMotion === 'slide-right'
        ? 'letter-card__hero--slide-prev'
        : 'letter-card__hero--pop'
  void hangulTick
  const hangul = getEffectiveHangulHint(letter.id).text

  useEffect(() => {
    markLetterSeen(track, letter.id)
    setFav(isFavorite(track, letter.id))
    setWriteOpen(false)
  }, [letter.id, track])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await refreshHangulCloudStore({ maxAgeMs: 30_000 })
        if (!cancelled) setHangulTick((n) => n + 1)
      } catch {
        /* keep cached / default */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [letter.id])

  useEffect(() => {
    onWritingChange?.(writeOpen)
  }, [writeOpen, onWritingChange])

  useHardwareBack(() => {
    setWriteOpen(false)
    return true
  }, writeOpen)

  return (
    <article className={`letter-card ${writeOpen ? 'letter-card--writing' : ''}`}>
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
        <div className="letter-card__write-wrap">
          <WritePractice
            letterId={letter.id}
            glyph={glyph}
            track={track}
            onClose={() => setWriteOpen(false)}
          />
        </div>
      ) : (
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
                <SideNavChevron dir="prev" />
              </button>

              <div className="letter-card__hero-frame">
                <p
                  key={`hero-${letter.id}-${fontEpoch}`}
                  className={`letter-card__hero ${heroClass} ${heroMotionClass}`}
                  lang="sa"
                  aria-label={letter.iast}
                  style={{ fontFamily: scriptStack }}
                >
                  {glyph}
                </p>
              </div>

              <button
                type="button"
                className="letter-card__side-nav motion-press"
                onClick={onNext}
                disabled={!hasNext || !onNext}
                aria-label="다음 글자"
              >
                <SideNavChevron dir="next" />
              </button>
            </div>

            <div className="letter-card__actions">
              <button
                type="button"
                className="letter-card__write-btn motion-press"
                onClick={() => setWriteOpen(true)}
              >
                쓰기 연습 시작
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

          <div key={`rail-${letter.id}`} className="letter-card__rail letter-card__blur-swap">
            <div className="letter-card__meta">
              <p className="letter-card__iast">{letter.iast}</p>
              <p className="letter-card__hangul">{hangul}</p>
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
          </div>
        </>
      )}
    </article>
  )
}
