import { useEffect, useState } from 'react'
import type { ScriptTrack } from '../types/track'
import type { OpenMode } from './Home'
import './Home.css'

type Props = {
  onBack: () => void
  onOpen: (track: ScriptTrack, mode: OpenMode) => void
  onOpenGlobal: (
    mode: 'convert' | 'mantras' | 'correspondence' | 'conjuncts' | 'settings',
  ) => void
}

const SANSKRIT_SETS = [
  ['अ', 'आ', 'इ', 'ई', 'क', 'ख', 'ग'],
  ['च', 'छ', 'ज', 'झ', 'ट', 'ठ', 'ड'],
  ['त', 'थ', 'द', 'ध', 'प', 'फ', 'ब'],
  ['य', 'र', 'ल', 'व', 'श', 'ष', 'स'],
  ['उ', 'ऊ', 'ऋ', 'ए', 'ऐ', 'ओ', 'औ'],
]

/* Muktamsiddham uses Devanagari codepoints for Siddhaṃ shapes. */
const SIDDHAM_SETS = [
  ['अ', 'आ', 'इ', 'ई', 'क', 'ख', 'ग'],
  ['च', 'छ', 'ज', 'झ', 'ट', 'ठ', 'ड'],
  ['त', 'थ', 'द', 'ध', 'प', 'फ', 'ब'],
  ['य', 'र', 'ल', 'व', 'श', 'ष', 'स'],
  ['उ', 'ऊ', 'ऋ', 'ए', 'ऐ', 'ओ', 'औ'],
]

const CYCLE_MS = 6000
const STAGGER_S = 0.07

function SampleRow({
  chars,
  scriptClass,
}: {
  chars: string[]
  scriptClass: string
}) {
  const durationS = CYCLE_MS / 1000 - (chars.length - 1) * STAGGER_S

  return (
    <p className={`home__track-sample ${scriptClass}`} lang="sa" aria-hidden="true">
      {chars.map((char, index) => (
        <span
          key={`${char}-${index}`}
          className="home__track-glyph"
          style={{
            animationDelay: `${index * STAGGER_S}s`,
            animationDuration: `${durationS}s`,
          }}
        >
          {char}
        </span>
      ))}
    </p>
  )
}

function TrackCard({
  track,
  title,
  subtitle,
  chars,
  sampleClass,
  variant,
  delay,
  onOpen,
}: {
  track: ScriptTrack
  title: string
  subtitle: string
  chars: string[]
  sampleClass: string
  variant?: 'siddham'
  delay?: string
  onOpen: (track: ScriptTrack, mode: OpenMode) => void
}) {
  const [toolsOpen, setToolsOpen] = useState(false)

  return (
    <section
      className={`home__track ${variant === 'siddham' ? 'home__track--siddham' : ''} motion-page`}
      style={delay ? { animationDelay: delay } : undefined}
      aria-labelledby={`track-${track}`}
    >
      <div className="home__track-head">
        <h2 id={`track-${track}`}>{title}</h2>
        <p>{subtitle}</p>
        <SampleRow
          key={`${track}-${chars.join('')}`}
          chars={chars}
          scriptClass={sampleClass}
        />
      </div>

      <button
        type="button"
        className="home__btn home__btn--primary home__btn--block motion-press"
        onClick={() => onOpen(track, 'learn')}
      >
        학습 시작
      </button>

      <div className="home__track-links">
        <button type="button" className="home__link motion-press" onClick={() => onOpen(track, 'practice')}>
          연습
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" className="home__link motion-press" onClick={() => onOpen(track, 'chart')}>
          전체 문자
        </button>
      </div>

      <div className={`home__track-more ${toolsOpen ? 'is-open' : ''}`}>
        <button
          type="button"
          className="home__track-more-toggle motion-press"
          aria-expanded={toolsOpen}
          onClick={() => setToolsOpen((v) => !v)}
        >
          <span>{toolsOpen ? '▾' : '▸'} 더 보기</span>
          <span className="home__track-more-hint">복습 · 진도 · 즐겨찾기</span>
        </button>
        {toolsOpen ? (
          <div className="home__tools">
            <button type="button" className="home__tool motion-press" onClick={() => onOpen(track, 'daily')}>
              오늘 학습
            </button>
            <button type="button" className="home__tool motion-press" onClick={() => onOpen(track, 'review')}>
              복습
            </button>
            <button
              type="button"
              className="home__tool motion-press"
              onClick={() => onOpen(track, 'progress')}
            >
              진도
            </button>
            <button
              type="button"
              className="home__tool motion-press"
              onClick={() => onOpen(track, 'favorites')}
            >
              즐겨찾기
            </button>
            <button
              type="button"
              className="home__tool motion-press"
              onClick={() => onOpen(track, 'similar')}
            >
              유사 글자
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function TracksPage({ onBack, onOpen, onOpenGlobal }: Props) {
  const [setIndex, setSetIndex] = useState(0)
  const [extraOpen, setExtraOpen] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => {
      setSetIndex((prev) => (prev + 1) % SANSKRIT_SETS.length)
    }, CYCLE_MS)
    return () => window.clearInterval(id)
  }, [])

  return (
    <main className="home home--tracks">
      <header className="home__tracks-bar">
        <button type="button" className="home__tracks-back motion-press" onClick={onBack}>
          ← 홈
        </button>
        <h1>학습하기</h1>
      </header>
      <p className="home__tracks-lead">문자를 고르고, 학습부터 시작해 보세요.</p>

      <TrackCard
        track="sanskrit"
        title="산스크리트"
        subtitle="데바나가리 문자"
        chars={SANSKRIT_SETS[setIndex]}
        sampleClass="home__track-sample--deva"
        onOpen={onOpen}
      />

      <TrackCard
        track="siddham"
        title="실담"
        subtitle="Siddhaṃ 문자"
        chars={SIDDHAM_SETS[setIndex]}
        sampleClass="home__track-sample--siddham"
        variant="siddham"
        delay="0.08s"
        onOpen={onOpen}
      />

      <section className={`home__shared home__shared--fold ${extraOpen ? 'is-open' : ''}`}>
        <button
          type="button"
          className="home__shared-toggle motion-press"
          aria-expanded={extraOpen}
          onClick={() => setExtraOpen((v) => !v)}
        >
          <span>{extraOpen ? '▾' : '▸'} 공통 도구</span>
          <span>대응 · 합자 · 구절 · 변환</span>
        </button>
        {extraOpen ? (
          <div className="home__tools home__tools--shared">
            <button
              type="button"
              className="home__tool motion-press"
              onClick={() => onOpenGlobal('correspondence')}
            >
              실담 ↔ 데바나가리
            </button>
            <button
              type="button"
              className="home__tool motion-press"
              onClick={() => onOpenGlobal('conjuncts')}
            >
              합자 맛보기
            </button>
            <button
              type="button"
              className="home__tool motion-press"
              onClick={() => onOpenGlobal('convert')}
            >
              IAST 변환
            </button>
            <button
              type="button"
              className="home__tool motion-press"
              onClick={() => onOpenGlobal('mantras')}
            >
              짧은 구절
            </button>
          </div>
        ) : null}
      </section>
    </main>
  )
}
