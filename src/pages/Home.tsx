import { useState } from 'react'
import type { ScriptTrack } from '../types/track'
import { getPathSnapshot } from '../lib/pathProgress'
import { getHomeFeed } from '../lib/homeFeed'
import { PATH_STAGES } from '../data/pathStages'
import { FoldChevron } from '../components/FoldChevron'
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
  | 'correspondence'
  | 'conjuncts'
  | 'settings'
  | 'about'
  | 'path'
  | 'tracks'
  | 'teach'

type GlobalMode = Extract<
  OpenMode,
  | 'convert'
  | 'mantras'
  | 'about'
  | 'path'
  | 'tracks'
  | 'settings'
  | 'correspondence'
  | 'conjuncts'
  | 'teach'
>

type Props = {
  onOpen: (track: ScriptTrack, mode: OpenMode) => void
  onAbout: () => void
  onOpenGlobal: (mode: GlobalMode) => void
  onOpenLetter: (track: ScriptTrack, letterId: string) => void
}

export function Home({ onOpen, onAbout, onOpenGlobal, onOpenLetter }: Props) {
  const path = getPathSnapshot()
  const feed = getHomeFeed()
  const [feedOpen, setFeedOpen] = useState(false)

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

  return (
    <main className="home home--gate">
      <header className="home__hero home__hero--gate">
        <h1 className="home__brand">붓다의 언어교실</h1>
        <p className="home__lead">산스크리트 · 실담 자모</p>
        <p className="home__hero-hint">글자를 보고, 듣고, 따라 써 보세요.</p>
        <button type="button" className="home__about motion-press" onClick={onAbout}>
          이게 뭔가요?
        </button>
      </header>

      <button
        type="button"
        className="home__card home__card--learn home__card--primary motion-press"
        onClick={() => onOpenGlobal('tracks')}
      >
        <div className="home__card-top">
          <div>
            <p className="home__card-kicker">시작하기</p>
            <p className="home__card-title">글자 배우기</p>
          </div>
          <span className="home__card-glyphs home__card-glyphs--learn" aria-hidden="true">
            <svg className="home__card-glyphs-icon" viewBox="0 0 24 24" width="22" height="22" fill="none">
              <path
                d="M14.06 4.42 19.58 9.94M4 20h4.5L18.88 9.62a1.5 1.5 0 0 0 0-2.12L16.5 5.12a1.5 1.5 0 0 0-2.12 0L4 15.5V20Z"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
        <p className="home__card-verse">산스크리트와 실담 글자를 고르고 학습합니다.</p>
        <p className="home__card-cta">글자 고르기 →</p>
      </button>

      <button
        type="button"
        className="home__card home__card--teach motion-press"
        onClick={() => onOpenGlobal('teach')}
      >
        <div className="home__card-top">
          <div>
            <p className="home__card-kicker">기록하기</p>
            <p className="home__card-title">획 기록하기</p>
          </div>
          <span className="home__card-glyphs home__card-glyphs--teach" aria-hidden="true">
            <span className="home__card-glyphs-mark">획</span>
          </span>
        </div>
        <p className="home__card-verse">
          글자 획과 이론·쓰기 팁을 그려 저장합니다. 따라 쓰기에서 쓰입니다.
        </p>
        <p className="home__card-cta">기록하러 가기 →</p>
      </button>

      <button
        type="button"
        className="home__card home__card--path home__card--secondary motion-press"
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
        <div className="home__card-foot home__card-foot--center home__path-stats">
          <span className="home__path-stat">
            <svg className="home__path-stat-icon" viewBox="0 0 16 16" aria-hidden="true">
              <ellipse cx="8" cy="8.2" rx="3.4" ry="4.2" fill="currentColor" opacity="0.88" />
              <ellipse cx="6.8" cy="6.4" rx="1.15" ry="1.55" fill="var(--paper)" opacity="0.55" />
            </svg>
            <span>공덕 {path.path.merit}</span>
          </span>
          <span className="home__path-stat">
            <svg className="home__path-stat-icon" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="2.6" fill="currentColor" />
              <g stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" opacity="0.9">
                <path d="M8 2.2v1.4M8 12.4v1.4M2.2 8h1.4M12.4 8h1.4" />
                <path d="M3.9 3.9l1 1M11.1 11.1l1 1M12.1 3.9l-1 1M4.9 11.1l-1 1" />
              </g>
            </svg>
            <span>{path.path.streak}일째</span>
          </span>
        </div>
        {path.dueHint ? <p className="home__card-hint">{path.dueHint}</p> : null}
      </button>

      <div className="home__side">
        <section
          className={`home__feed ${feedOpen ? 'is-open' : 'is-collapsed'}`}
          aria-label="오늘의 추천"
        >
          <button
            type="button"
            className="home__feed-toggle motion-press"
            aria-expanded={feedOpen}
            onClick={() => setFeedOpen((v) => !v)}
          >
            <span className="home__feed-toggle-main">
              <span className="home__feed-toggle-title">오늘의 추천</span>
              <span className="home__feed-toggle-sub">
                {feedOpen ? '원하는 것만 눌러 보세요' : `추천 글자 ${feed.length}개`}
              </span>
            </span>
            <FoldChevron open={feedOpen} className="home__feed-chevron" />
          </button>
          <div className={`fold-panel ${feedOpen ? 'is-expanded' : ''}`}>
            <div className="fold-panel__inner">
              <ul className="home__feed-list">
                {feed.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="home__feed-item motion-press"
                      onClick={() => openFeedTarget(item.target)}
                      tabIndex={feedOpen ? 0 : -1}
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
            </div>
          </div>
        </section>

        <button
          type="button"
          className="home__settings-entry motion-press"
          onClick={() => onOpenGlobal('settings')}
        >
          <span className="home__settings-entry-title">설정</span>
          <span className="home__settings-entry-sub">글자 크기 · 화면 밝기 · 색감 · 클라우드 토큰</span>
        </button>
      </div>
    </main>
  )
}
