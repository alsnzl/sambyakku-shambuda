import { useEffect, useState } from 'react'
import type { ScriptTrack } from '../types/track'
import './Home.css'

export type OpenMode =
  | 'learn'
  | 'practice'
  | 'chart'
  | 'daily'
  | 'review'
  | 'progress'
  | 'favorites'
  | 'similar'
  | 'convert'
  | 'mantras'
  | 'about'

type Props = {
  onOpen: (track: ScriptTrack, mode: OpenMode) => void
  onAbout: () => void
  onOpenGlobal: (mode: 'convert' | 'mantras' | 'about') => void
}

const SANSKRIT_SETS = [
  ['अ', 'आ', 'इ', 'ई', 'क', 'ख', 'ग'],
  ['च', 'छ', 'ज', 'झ', 'ट', 'ठ', 'ड'],
  ['त', 'थ', 'द', 'ध', 'प', 'फ', 'ब'],
  ['य', 'र', 'ल', 'व', 'श', 'ष', 'स'],
  ['उ', 'ऊ', 'ऋ', 'ए', 'ऐ', 'ओ', 'औ'],
]

const SIDDHAM_SETS = [
  ['𑖀', '𑖁', '𑖂', '𑖃', '𑖎', '𑖏', '𑖐'],
  ['𑖓', '𑖔', '𑖕', '𑖖', '𑖘', '𑖙', '𑖚'],
  ['𑖝', '𑖞', '𑖟', '𑖠', '𑖢', '𑖣', '𑖤'],
  ['𑖧', '𑖨', '𑖩', '𑖪', '𑖫', '𑖬', '𑖭'],
  ['𑖄', '𑖅', '𑖆', '𑖊', '𑖋', '𑖌', '𑖍'],
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
    <p
      className={`home__track-sample ${scriptClass}`}
      lang="sa"
      aria-hidden="true"
    >
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

function TrackTools({
  track,
  onOpen,
}: {
  track: ScriptTrack
  onOpen: (track: ScriptTrack, mode: OpenMode) => void
}) {
  return (
    <div className="home__tools">
      <button type="button" className="home__tool motion-press" onClick={() => onOpen(track, 'daily')}>
        오늘 학습
      </button>
      <button type="button" className="home__tool motion-press" onClick={() => onOpen(track, 'review')}>
        복습
      </button>
      <button type="button" className="home__tool motion-press" onClick={() => onOpen(track, 'progress')}>
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
  )
}

export function Home({ onOpen, onAbout, onOpenGlobal }: Props) {
  const [setIndex, setSetIndex] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setSetIndex((prev) => (prev + 1) % SANSKRIT_SETS.length)
    }, CYCLE_MS)
    return () => window.clearInterval(id)
  }, [])

  const sanskritChars = SANSKRIT_SETS[setIndex]
  const siddhamChars = SIDDHAM_SETS[setIndex]

  return (
    <main className="home">
      <header className="home__hero">
        <p className="home__brand">삼뱌꾸샴붓다</p>
        <h1>산스크리트 · 실담 자모</h1>
        <p className="home__lead">
          데바나가리와 Siddhaṃ을 트랙별로 천천히 익힙니다.
        </p>
        <button type="button" className="home__about motion-press" onClick={onAbout}>
          산스크리트 · 실담이 뭔가요?
        </button>
      </header>

      <section className="home__track motion-page" aria-labelledby="track-sanskrit">
        <div className="home__track-head">
          <h2 id="track-sanskrit">산스크리트</h2>
          <p>데바나가리 문자</p>
          <SampleRow
            key={`sa-${setIndex}`}
            chars={sanskritChars}
            scriptClass="home__track-sample--deva"
          />
        </div>
        <div className="home__track-actions">
          <button
            type="button"
            className="home__btn home__btn--primary motion-press"
            onClick={() => onOpen('sanskrit', 'learn')}
          >
            학습
          </button>
          <button
            type="button"
            className="home__btn motion-press"
            onClick={() => onOpen('sanskrit', 'practice')}
          >
            연습
          </button>
          <button
            type="button"
            className="home__btn home__btn--wide motion-press"
            onClick={() => onOpen('sanskrit', 'chart')}
          >
            전체 문자 보기
          </button>
        </div>
        <TrackTools track="sanskrit" onOpen={onOpen} />
      </section>

      <section
        className="home__track home__track--siddham motion-page"
        style={{ animationDelay: '0.08s' }}
        aria-labelledby="track-siddham"
      >
        <div className="home__track-head">
          <h2 id="track-siddham">실담</h2>
          <p>Siddhaṃ 문자</p>
          <SampleRow
            key={`si-${setIndex}`}
            chars={siddhamChars}
            scriptClass="home__track-sample--siddham"
          />
        </div>
        <div className="home__track-actions">
          <button
            type="button"
            className="home__btn home__btn--primary motion-press"
            onClick={() => onOpen('siddham', 'learn')}
          >
            학습
          </button>
          <button
            type="button"
            className="home__btn motion-press"
            onClick={() => onOpen('siddham', 'practice')}
          >
            연습
          </button>
          <button
            type="button"
            className="home__btn home__btn--wide motion-press"
            onClick={() => onOpen('siddham', 'chart')}
          >
            전체 문자 보기
          </button>
        </div>
        <TrackTools track="siddham" onOpen={onOpen} />
      </section>

      <section className="home__shared" aria-label="공통 도구">
        <h2>공통 도구</h2>
        <div className="home__tools home__tools--shared">
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
      </section>

      <p className="home__hint">
        발음은 녹음 파일이 있으면 파일을, 없으면 브라우저 TTS(IAST)로 들려 줍니다. 학습 기록은
        이 기기 localStorage에 저장됩니다.
      </p>
    </main>
  )
}
