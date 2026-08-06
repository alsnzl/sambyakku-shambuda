import { useState } from 'react'
import type { ScriptTrack } from '../types/track'
import { getPathSnapshot } from '../lib/pathProgress'
import { getHomeFeed } from '../lib/homeFeed'
import { PATH_STAGES } from '../data/pathStages'
import {
  GLYPH_SIZE_OPTIONS,
  getGlyphSize,
  setGlyphSize,
  type GlyphSize,
} from '../lib/prefsStore'
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
  | 'path'
  | 'tracks'

type Props = {
  onOpen: (track: ScriptTrack, mode: OpenMode) => void
  onAbout: () => void
  onOpenGlobal: (mode: 'convert' | 'mantras' | 'about' | 'path' | 'tracks') => void
  onOpenLetter: (track: ScriptTrack, letterId: string) => void
}

export function Home({ onOpen, onAbout, onOpenGlobal, onOpenLetter }: Props) {
  const path = getPathSnapshot()
  const openPetals = path.petals.filter(Boolean).length
  const feed = getHomeFeed()
  const [feedOpen, setFeedOpen] = useState(true)
  const [glyphSize, setGlyphSizeState] = useState<GlyphSize>(() => getGlyphSize())
  const [glyphSizeOpen, setGlyphSizeOpen] = useState(false)
  const glyphSizeLabel =
    GLYPH_SIZE_OPTIONS.find((opt) => opt.id === glyphSize)?.label ?? '보통'

  function openFeedTarget(target: (typeof feed)[number]['target']) {
    if (target.type === 'global') {
      if (target.mode === 'about') onAbout()
      else onOpenGlobal(target.mode)
      return
    }
    if (target.mode === 'learn' && target.letterId) {
      onOpenLetter(target.track, target.letterId)
      return
    }
    onOpen(target.track, target.mode)
  }

  function onPickGlyphSize(size: GlyphSize) {
    setGlyphSizeState(setGlyphSize(size))
  }

  return (
    <main className="home home--gate">
      <header className="home__hero home__hero--gate">
        <h1 className="home__brand">삼뱌꾸샴붓다</h1>
        <p className="home__lead">산스크리트 · 실담 자모</p>
        <button type="button" className="home__about motion-press" onClick={onAbout}>
          산스크리트 · 실담이 뭔가요?
        </button>
      </header>

      <button
        type="button"
        className="home__card home__card--path motion-press"
        onClick={() => onOpenGlobal('path')}
      >
        <p className="home__card-kicker">수행 길</p>
        <p className="home__card-title home__card-title--path">{path.stage.nameKo}</p>
        <div className="home__path-lotus" aria-hidden="true">
          <div className="path-lotus path-lotus--md">
            {path.petals.map((on, i) => (
              <span
                key={PATH_STAGES[i].id}
                className={`path-lotus__petal ${on ? 'is-on' : ''}`}
              />
            ))}
          </div>
        </div>
        <p className="home__card-verse">{path.stage.verseKo}</p>
        <div className="home__card-foot home__card-foot--center">
          <span>공덕 {path.path.merit}</span>
          <span>{path.path.streak}일째</span>
          <span>연꽃 {openPetals}/7</span>
        </div>
        {path.dueHint ? <p className="home__card-hint">{path.dueHint}</p> : null}
      </button>

      <button
        type="button"
        className="home__card home__card--learn motion-press"
        onClick={() => onOpenGlobal('tracks')}
      >
        <div className="home__card-top">
          <div>
            <p className="home__card-kicker">학습하기</p>
            <p className="home__card-title">산스크리트 · 실담</p>
          </div>
          <span className="home__card-glyphs" lang="sa" aria-hidden="true">
            <span className="home__card-glyphs-deva">अ</span>
            <span className="home__card-glyphs-siddham">𑖀</span>
          </span>
        </div>
        <p className="home__card-verse">
          데바나가리와 Siddhaṃ을 트랙별로 보고, 쓰고, 복습합니다.
        </p>
        <p className="home__card-cta">트랙 선택 →</p>
      </button>

      <section
        className={`home__feed ${feedOpen ? 'is-open' : 'is-collapsed'}`}
        aria-label="오늘의 피드"
      >
        <button
          type="button"
          className="home__feed-toggle motion-press"
          aria-expanded={feedOpen}
          onClick={() => setFeedOpen((v) => !v)}
        >
          <span className="home__feed-toggle-main">
            <span className="home__feed-chevron" aria-hidden="true">
              {feedOpen ? '▾' : '▸'}
            </span>
            <span>
              <span className="home__feed-toggle-title">오늘의 인연</span>
              <span className="home__feed-toggle-sub">
                {feedOpen
                  ? '가볍게 훑어보고, 끌리는 것만 눌러 보세요.'
                  : `${feed.length}개의 인연 · 눌러서 펼치기`}
              </span>
            </span>
          </span>
        </button>
        {feedOpen ? (
          <ul className="home__feed-list">
            {feed.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="home__feed-item motion-press"
                  onClick={() => openFeedTarget(item.target)}
                >
                  {item.glyph ? (
                    <span
                      className={`home__feed-glyph home__feed-glyph--${item.script ?? 'deva'}`}
                      lang="sa"
                      aria-hidden="true"
                    >
                      {item.glyph}
                    </span>
                  ) : (
                    <span className="home__feed-dot" aria-hidden="true" />
                  )}
                  <span className="home__feed-body">
                    <span className="home__feed-kicker">{item.kicker}</span>
                    <span className="home__feed-title">{item.title}</span>
                    <span className="home__feed-text">{item.body}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section
        className={`home__glyph-size ${glyphSizeOpen ? 'is-open' : 'is-collapsed'}`}
        aria-label="학습 글자 크기"
      >
        <button
          type="button"
          className="home__glyph-size-toggle motion-press"
          aria-expanded={glyphSizeOpen}
          onClick={() => setGlyphSizeOpen((v) => !v)}
        >
          <span className="home__glyph-size-toggle-main">
            <span className="home__glyph-size-chevron" aria-hidden="true">
              {glyphSizeOpen ? '▾' : '▸'}
            </span>
            <span>
              <span className="home__glyph-size-toggle-title">글자 크기</span>
              <span className="home__glyph-size-toggle-sub">
                {glyphSizeOpen
                  ? '학습·퀴즈에 보이는 자모 크기입니다.'
                  : `현재 ${glyphSizeLabel} · 눌러서 조절`}
              </span>
            </span>
          </span>
        </button>
        {glyphSizeOpen ? (
          <div className="home__glyph-size-panel" role="group" aria-label="글자 크기 선택">
            <div className="home__glyph-size-options">
              {GLYPH_SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`home__glyph-size-btn motion-press ${glyphSize === opt.id ? 'is-active' : ''}`}
                  aria-pressed={glyphSize === opt.id}
                  onClick={() => onPickGlyphSize(opt.id)}
                >
                  <span
                    className={`home__glyph-size-preview home__glyph-size-preview--${opt.id}`}
                    aria-hidden="true"
                  >
                    अ
                  </span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  )
}
