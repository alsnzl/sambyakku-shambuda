import { useEffect, useState } from 'react'
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
import {
  clearCloudToken,
  cloudRepoLabel,
  cloudTokenSource,
  hasCloudWriteToken,
  probeCloudToken,
  setCloudToken,
  type CloudTokenProbe,
} from '../lib/strokeCloud'
import './tools.css'

type Props = {
  onBack: () => void
}

type TokenUiPhase = 'idle' | 'checking' | 'ready'

export function SettingsPage({ onBack }: Props) {
  const [glyphSize, setGlyphSizeState] = useState<GlyphSize>(() => getGlyphSize())
  const [theme, setThemeState] = useState<ThemePref>(() => getThemePref())

  const [tokenDraft, setTokenDraft] = useState('')
  const [editingToken, setEditingToken] = useState(() => !hasCloudWriteToken())
  const [tokenSource, setTokenSource] = useState(() => cloudTokenSource())
  const [probePhase, setProbePhase] = useState<TokenUiPhase>('idle')
  const [probe, setProbe] = useState<CloudTokenProbe | null>(null)

  async function runProbe() {
    if (!hasCloudWriteToken()) {
      setProbePhase('ready')
      setProbe(null)
      return
    }
    setProbePhase('checking')
    const result = await probeCloudToken()
    setProbe(result)
    setProbePhase('ready')
  }

  useEffect(() => {
    void runProbe()
  }, [])

  function handleSaveToken() {
    const next = tokenDraft.trim()
    if (!next) return
    setCloudToken(next)
    setTokenDraft('')
    setTokenSource(cloudTokenSource())
    setEditingToken(false)
    void runProbe()
  }

  function handleClearToken() {
    clearCloudToken()
    setTokenDraft('')
    setTokenSource(cloudTokenSource())
    setEditingToken(true)
    setProbe(null)
    setProbePhase('ready')
  }

  const statusClass = (() => {
    if (probePhase === 'checking') return 'tool__token-status--draft'
    if (!hasCloudWriteToken()) return 'tool__token-status--empty'
    if (probe?.ok) return 'tool__token-status--ok'
    return 'tool__token-status--warn'
  })()

  const statusLabel = (() => {
    if (probePhase === 'checking') return '확인 중…'
    if (!hasCloudWriteToken()) return '토큰 없음'
    if (probe?.ok) return '활성화'
    if (probe?.kind === 'unauthorized') return '토큰 무효'
    if (probe?.kind === 'forbidden') return '권한 부족'
    return '확인 실패'
  })()

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

      <section className="tool__block" aria-label="클라우드 토큰">
        <div className="tool__token-head">
          <h2>클라우드 토큰</h2>
          <span className={`tool__token-status ${statusClass}`} title={probe?.detail ?? cloudRepoLabel()}>
            <span className="tool__token-status-dot" aria-hidden="true" />
            {statusLabel}
          </span>
        </div>
        <p className="tool__meta" style={{ marginBottom: '0.75rem' }}>
          획 가르치기 결과를 GitHub({cloudRepoLabel()})에 올리는 데 씁니다. fine-grained PAT에
          Contents 읽기·쓰기 권한이 필요합니다.
        </p>

        {!editingToken && hasCloudWriteToken() ? (
          <div className="tool__token-summary">
            <p className="tool__token-detail">
              {probePhase === 'checking'
                ? '저장소 접근을 확인하는 중…'
                : probe?.detail ?? '토큰이 이 기기에 저장되어 있습니다.'}
              {tokenSource === 'env' ? ' (환경 변수)' : ''}
            </p>
            <div className="tool__row">
              <button
                type="button"
                className="tool__btn tool__btn--ghost motion-press"
                disabled={probePhase === 'checking'}
                onClick={() => void runProbe()}
              >
                다시 확인
              </button>
              {tokenSource === 'local' ? (
                <>
                  <button
                    type="button"
                    className="tool__btn tool__btn--ghost motion-press"
                    onClick={() => {
                      setEditingToken(true)
                      setTokenDraft('')
                    }}
                  >
                    변경
                  </button>
                  <button
                    type="button"
                    className="tool__btn tool__btn--ghost motion-press"
                    onClick={handleClearToken}
                  >
                    삭제
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="tool__token-form">
            <label className="tool__token-label" htmlFor="cloud-token-input">
              GitHub 토큰
            </label>
            <input
              id="cloud-token-input"
              className="tool__input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="github_pat_…"
              value={tokenDraft}
              onChange={(e) => setTokenDraft(e.target.value)}
            />
            <div className="tool__row" style={{ marginTop: '0.65rem' }}>
              <button
                type="button"
                className="tool__btn tool__btn--primary motion-press"
                disabled={!tokenDraft.trim()}
                onClick={handleSaveToken}
              >
                저장
              </button>
              {hasCloudWriteToken() ? (
                <button
                  type="button"
                  className="tool__btn tool__btn--ghost motion-press"
                  onClick={() => {
                    setEditingToken(false)
                    setTokenDraft('')
                  }}
                >
                  취소
                </button>
              ) : null}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
