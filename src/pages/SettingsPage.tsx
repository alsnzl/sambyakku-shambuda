import { useState } from 'react'
import {
  GLYPH_SIZE_OPTIONS,
  THEME_OPTIONS,
  getGlyphSize,
  getThemePref,
  setGlyphSize,
  setThemePref,
  type GlyphSize,
  type ThemePref,
} from '../lib/prefsStore'
import './tools.css'

type Props = {
  onBack: () => void
}

export function SettingsPage({ onBack }: Props) {
  const [glyphSize, setGlyphSizeState] = useState<GlyphSize>(() => getGlyphSize())
  const [theme, setThemeState] = useState<ThemePref>(() => getThemePref())

  return (
    <main className="tool">
      <header className="tool__bar">
        <button type="button" className="tool__back motion-press" onClick={onBack}>
          ← 홈
        </button>
        <h1>설정</h1>
      </header>
      <p className="tool__lead">학습 글자 크기와 화면 밝기를 조절합니다. 값은 이 기기에 저장됩니다.</p>

      <section className="tool__block" aria-label="글자 크기">
        <h2>글자 크기</h2>
        <p className="tool__meta" style={{ marginBottom: '0.75rem' }}>
          학습 타일·상세·퀴즈 등 자모와 발음 표기에 적용됩니다. 메뉴 글씨는 그대로입니다.
        </p>
        <div className="tool__seg" role="group" aria-label="글자 크기 선택">
          {GLYPH_SIZE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`tool__seg-btn motion-press ${glyphSize === opt.id ? 'is-active' : ''}`}
              aria-pressed={glyphSize === opt.id}
              onClick={() => setGlyphSizeState(setGlyphSize(opt.id))}
            >
              <span className={`tool__seg-preview tool__seg-preview--${opt.id}`} aria-hidden="true">
                अ
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section className="tool__block" aria-label="화면 테마">
        <h2>화면 테마</h2>
        <p className="tool__meta" style={{ marginBottom: '0.75rem' }}>
          어두운 모드는 밤 공부용입니다. 시스템은 기기 설정을 따릅니다.
        </p>
        <div className="tool__seg" role="group" aria-label="테마 선택">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`tool__seg-btn motion-press ${theme === opt.id ? 'is-active' : ''}`}
              aria-pressed={theme === opt.id}
              onClick={() => setThemeState(setThemePref(opt.id))}
            >
              <span className="tool__seg-title">{opt.label}</span>
              <span className="tool__seg-hint">{opt.hint}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}
