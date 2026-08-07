import { useMemo, useState } from 'react'
import { getLetterGroups, type Letter } from '../data/letters'
import { MotionPage } from '../components/MotionPage'
import { StrokeTeachPanel } from '../components/StrokeTeachPanel'
import { TheoryTipPanel } from '../components/TheoryTipPanel'
import type { ScriptTrack } from '../types/track'
import { trackMeta } from '../types/track'
import { glyphForTrack } from '../lib/scriptDisplay'
import { useHardwareBack } from '../lib/useHardwareBack'
import { useScriptFontEpoch } from '../lib/useScriptFontEpoch'
import { ScriptFontQuickBar } from '../components/ScriptFontQuickBar'
import './Learn.css'
import './TeachPage.css'

type Props = {
  onBack: () => void
}

type View = 'tracks' | 'chart' | 'letter'

export function TeachPage({ onBack }: Props) {
  const groups = useMemo(() => getLetterGroups(), [])
  const [view, setView] = useState<View>('tracks')
  const [track, setTrack] = useState<ScriptTrack>('sanskrit')
  const [letter, setLetter] = useState<Letter | null>(null)
  const [slide, setSlide] = useState<'slide-left' | 'slide-right' | 'pop'>('pop')
  useScriptFontEpoch()

  const meta = trackMeta[track]
  const isSanskrit = track === 'sanskrit'
  const charClass = isSanskrit
    ? 'learn__tile-char learn__tile-char--deva'
    : 'learn__tile-char learn__tile-char--siddham'
  const heroClass = isSanskrit ? 'teach-page__glyph--deva' : 'teach-page__glyph--siddham'

  function pickTrack(next: ScriptTrack) {
    setTrack(next)
    setLetter(null)
    setView('chart')
  }

  function openLetter(item: Letter) {
    setLetter(item)
    setSlide('pop')
    setView('letter')
  }

  function backFromLetter() {
    setLetter(null)
    setView('chart')
  }

  function goPrev(prev: Letter) {
    setSlide('slide-right')
    setLetter(prev)
  }

  function goNext(next: Letter) {
    setSlide('slide-left')
    setLetter(next)
  }

  useHardwareBack(() => {
    if (view === 'letter') {
      backFromLetter()
      return true
    }
    if (view === 'chart') {
      setView('tracks')
      return true
    }
    onBack()
    return true
  })

  if (view === 'letter' && letter) {
    const sequence = groups.flatMap((g) => g.letters)
    const index = sequence.findIndex((item) => item.id === letter.id)
    const prev = index > 0 ? sequence[index - 1] : null
    const next = index >= 0 && index < sequence.length - 1 ? sequence[index + 1] : null
    const glyph = glyphForTrack(letter, track)

    return (
      <main className="learn teach-page">
        <header className="learn__bar">
          <button type="button" className="learn__back motion-press" onClick={backFromLetter}>
            ← 글자 목록
          </button>
          <h1>
            {index + 1} / {sequence.length}
          </h1>
          <div className="teach-page__nav">
            <button
              type="button"
              className="teach-page__nav-btn motion-press"
              disabled={!prev}
              onClick={prev ? () => goPrev(prev) : undefined}
              aria-label="이전 글자"
            >
              ◀
            </button>
            <button
              type="button"
              className="teach-page__nav-btn motion-press"
              disabled={!next}
              onClick={next ? () => goNext(next) : undefined}
              aria-label="다음 글자"
            >
              ▶
            </button>
          </div>
        </header>

        <ScriptFontQuickBar track={track} />

        <div className="teach-page__stage">
          <MotionPage
            motionKey={`${track}-${letter.id}`}
            variant={slide}
            className={slide === 'pop' ? '' : 'teach-page__stage-slide'}
          >
            <article className="teach-page__card">
              <div className="teach-page__identity">
                <p className="teach-page__script">{meta.scriptLabel}</p>
                <div className="teach-page__identity-row">
                  <span className={`teach-page__glyph ${heroClass}`} lang="sa">
                    {glyph}
                  </span>
                  <div>
                    <p className="teach-page__iast">{letter.iast}</p>
                    <p className="teach-page__hangul">{letter.hangulHint}</p>
                  </div>
                </div>
                <p className="teach-page__lead">
                  글자 위에 획을 그려 저장하면, 따라 쓰기·보기에서 쓸 수 있어요.
                </p>
              </div>
              <StrokeTeachPanel letterId={letter.id} glyph={glyph} track={track} />
              <TheoryTipPanel letterId={letter.id} editable />
            </article>
          </MotionPage>
        </div>
      </main>
    )
  }

  if (view === 'chart') {
    return (
      <MotionPage motionKey={`teach-chart-${track}`} variant="fade-up">
        <main className="learn teach-page">
          <header className="learn__bar">
            <button
              type="button"
              className="learn__back motion-press"
              onClick={() => setView('tracks')}
            >
              ← 문자 고르기
            </button>
            <h1>획 기록 · {meta.title}</h1>
          </header>
          <p className="learn__intro teach-page__intro">
            기록할 글자를 고르세요. 그린 획은 따라 쓰기 연습에 쓰입니다.
          </p>

          <div className="learn__chart">
            {groups.map((group, index) => (
              <section
                key={group.id}
                className={
                  index === 0
                    ? 'learn__chart-section'
                    : 'learn__chart-section learn__chart-section--divided'
                }
                aria-labelledby={`teach-chart-${group.id}`}
              >
                <div className="learn__chart-head">
                  <h2 id={`teach-chart-${group.id}`}>{group.labelKo}</h2>
                  <span>
                    {group.type === 'vowel' ? '모음' : '자음'} · {group.letters.length}자
                  </span>
                </div>
                <ul className="learn__grid learn__grid--chart motion-stagger">
                  {group.letters.map((item) => (
                    <li key={item.id} className="learn__cell">
                      <button
                        type="button"
                        className="learn__tile learn__tile--compact motion-press"
                        onClick={() => openLetter(item)}
                      >
                        <span className="learn__tile-glyph" aria-hidden="true">
                          <span className={charClass} lang="sa">
                            {glyphForTrack(item, track)}
                          </span>
                        </span>
                        <span className="learn__tile-iast">{item.iast}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </main>
      </MotionPage>
    )
  }

  return (
    <main className="learn teach-page">
      <header className="learn__bar">
        <button type="button" className="learn__back motion-press" onClick={onBack}>
          ← 홈
        </button>
        <h1>획 기록하기</h1>
      </header>
      <p className="learn__intro teach-page__intro">
        먼저 산스크리트 또는 실담을 고른 뒤, 글자마다 획을 그려 저장하세요.
      </p>

      <div className="teach-page__tracks">
        <button
          type="button"
          className="teach-page__track motion-press"
          onClick={() => pickTrack('sanskrit')}
        >
          <span className="teach-page__track-kicker">데바나가리</span>
          <span className="teach-page__track-title">산스크리트</span>
          <span className="teach-page__track-sample" lang="sa" aria-hidden="true">
            अ आ इ ई क
          </span>
          <span className="teach-page__track-cta">글자 고르기 →</span>
        </button>
        <button
          type="button"
          className="teach-page__track teach-page__track--siddham motion-press"
          onClick={() => pickTrack('siddham')}
        >
          <span className="teach-page__track-kicker">Siddhaṃ</span>
          <span className="teach-page__track-title">실담</span>
          <span
            className="teach-page__track-sample teach-page__track-sample--siddham"
            lang="sa"
            aria-hidden="true"
          >
            अ आ इ ई क
          </span>
          <span className="teach-page__track-cta">글자 고르기 →</span>
        </button>
      </div>
    </main>
  )
}
