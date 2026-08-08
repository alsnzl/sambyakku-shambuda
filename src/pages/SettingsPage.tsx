import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import {
  GLYPH_SIZE_OPTIONS,
  PALETTE_OPTIONS,
  THEME_OPTIONS,
  getGlyphSize,
  getPalettePref,
  getThemePref,
  setGlyphSize,
  setPalettePref,
  setThemePref,
  type GlyphSize,
  type PalettePref,
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
import {
  DEVA_FONT_OPTIONS,
  SCRIPT_FONT_MAX_BYTES,
  SCRIPT_FONT_SAMPLE,
  SIDDHAM_FONT_OPTIONS,
  getActiveScriptFontLabel,
  getScriptFontChoice,
  getScriptFontMeta,
  getScriptFontSample,
  getUserScriptFontFamily,
  installScriptFont,
  resetScriptFont,
  scriptFontErrorMessage,
  setScriptFontChoice,
  type ScriptFontChoice,
  type ScriptFontSlot,
} from '../lib/customScriptFonts'
import { FoldChevron } from '../components/FoldChevron'
import './tools.css'

type Props = {
  onBack: () => void
}

type TokenUiPhase = 'idle' | 'checking' | 'ready'

type FontSlotUi = {
  label: string
  busy: boolean
  error: string | null
  hasUser: boolean
  choice: ScriptFontChoice
}

function emptyFontUi(slot: ScriptFontSlot): FontSlotUi {
  return {
    label: getActiveScriptFontLabel(slot),
    busy: false,
    error: null,
    hasUser: Boolean(getScriptFontMeta(slot)),
    choice: getScriptFontChoice(slot),
  }
}

export function SettingsPage({ onBack }: Props) {
  const [glyphSize, setGlyphSizeState] = useState<GlyphSize>(() => getGlyphSize())
  const [theme, setThemeState] = useState<ThemePref>(() => getThemePref())
  const [palette, setPaletteState] = useState<PalettePref>(() => getPalettePref())
  const [devaFont, setDevaFont] = useState<FontSlotUi>(() => emptyFontUi('deva'))
  const [siddhamFont, setSiddhamFont] = useState<FontSlotUi>(() => emptyFontUi('siddham'))
  const [previewTick, setPreviewTick] = useState(0)
  const [labsOpen, setLabsOpen] = useState(false)

  const [tokenDraft, setTokenDraft] = useState('')
  const [editingToken, setEditingToken] = useState(() => !hasCloudWriteToken())
  const [tokenSource, setTokenSource] = useState(() => cloudTokenSource())
  const [probePhase, setProbePhase] = useState<TokenUiPhase>('idle')
  const [probe, setProbe] = useState<CloudTokenProbe | null>(null)

  const devaInputRef = useRef<HTMLInputElement>(null)
  const siddhamInputRef = useRef<HTMLInputElement>(null)
  const devaInputId = useId()
  const siddhamInputId = useId()

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

  function setFontUi(slot: ScriptFontSlot, next: FontSlotUi) {
    if (slot === 'deva') setDevaFont(next)
    else setSiddhamFont(next)
  }

  async function handleFontFile(slot: ScriptFontSlot, file: File | undefined) {
    if (!file) return
    setFontUi(slot, {
      ...emptyFontUi(slot),
      busy: true,
      error: null,
      label: file.name,
    })
    try {
      const meta = await installScriptFont(slot, file)
      setFontUi(slot, {
        label: meta.fileName,
        busy: false,
        error: null,
        hasUser: true,
        choice: 'user',
      })
      setPreviewTick((n) => n + 1)
    } catch (err) {
      setFontUi(slot, {
        ...emptyFontUi(slot),
        busy: false,
        error: scriptFontErrorMessage(err),
      })
    }
  }

  async function handleFontChoice(slot: ScriptFontSlot, choice: ScriptFontChoice) {
    setFontUi(slot, { ...emptyFontUi(slot), busy: true, error: null })
    try {
      await setScriptFontChoice(slot, choice)
      setFontUi(slot, emptyFontUi(slot))
      setPreviewTick((n) => n + 1)
    } catch (err) {
      setFontUi(slot, {
        ...emptyFontUi(slot),
        busy: false,
        error: scriptFontErrorMessage(err),
      })
    }
  }

  async function handleFontReset(slot: ScriptFontSlot) {
    setFontUi(slot, { ...emptyFontUi(slot), busy: true, error: null })
    try {
      await resetScriptFont(slot)
      setFontUi(slot, emptyFontUi(slot))
      setPreviewTick((n) => n + 1)
    } catch (err) {
      setFontUi(slot, {
        ...emptyFontUi(slot),
        busy: false,
        error: scriptFontErrorMessage(err),
      })
    }
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

  function renderFontSlot(
    slot: ScriptFontSlot,
    title: string,
    ui: FontSlotUi,
    inputId: string,
    inputRef: RefObject<HTMLInputElement | null>,
    note?: string,
  ) {
    const bundled = slot === 'deva' ? DEVA_FONT_OPTIONS : SIDDHAM_FONT_OPTIONS
    const userFamily = getUserScriptFontFamily(slot)
    const userMeta = getScriptFontMeta(slot)
    return (
      <div className="tool__font-slot">
        <div className="tool__font-slot-head">
          <h3>{title}</h3>
          <span className={`tool__font-badge ${ui.choice === 'user' ? 'is-custom' : ''}`}>
            {ui.choice === 'user' ? '사용자' : '기본'}
          </span>
        </div>
        {note ? <p className="tool__meta tool__font-note">{note}</p> : null}

        <div
          key={`${slot}-${previewTick}`}
          className="tool__font-choices"
          role="group"
          aria-label={`${title} 폰트 선택`}
        >
          {bundled.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`tool__font-card motion-press ${ui.choice === opt.id ? 'is-active' : ''}`}
              aria-pressed={ui.choice === opt.id}
              disabled={ui.busy}
              onClick={() => void handleFontChoice(slot, opt.id)}
            >
              <span
                className={`tool__font-preview${opt.id === 'noto-siddham' ? ' tool__font-preview--noto-siddham' : ''}`}
                lang="sa"
                style={{ fontFamily: `"${opt.family}", sans-serif` }}
              >
                {getScriptFontSample(slot, opt.id)}
              </span>
              <span className="tool__font-card-label">{opt.label}</span>
            </button>
          ))}
          <button
            type="button"
            className={`tool__font-card motion-press ${ui.hasUser ? '' : 'is-empty'} ${ui.choice === 'user' ? 'is-active' : ''}`}
            aria-pressed={ui.choice === 'user'}
            disabled={ui.busy || !ui.hasUser}
            onClick={() => void handleFontChoice(slot, 'user')}
          >
            {ui.hasUser ? (
              <>
                <span
                  className="tool__font-preview"
                  lang="sa"
                  style={{ fontFamily: `"${userFamily}", sans-serif` }}
                >
                  {SCRIPT_FONT_SAMPLE}
                </span>
                <span className="tool__font-card-label">사용자</span>
                <span className="tool__font-card-file" title={userMeta?.fileName}>
                  {userMeta?.fileName}
                </span>
              </>
            ) : (
              <>
                <span className="tool__font-preview tool__font-preview--placeholder" aria-hidden="true">
                  —
                </span>
                <span className="tool__font-card-label">사용자</span>
                <span className="tool__font-card-file">아직 없음</span>
              </>
            )}
          </button>
        </div>

        <p className="tool__font-status">
          {ui.busy ? '적용 중…' : `현재: ${ui.label}`}
        </p>
        {ui.error ? <p className="tool__font-error">{ui.error}</p> : null}
        <div className="tool__row tool__font-actions">
          <input
            id={inputId}
            ref={inputRef}
            className="tool__font-input"
            type="file"
            accept=".otf,.ttf,font/otf,font/ttf,application/x-font-ttf,application/x-font-opentype"
            disabled={ui.busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              void handleFontFile(slot, file)
            }}
          />
          <button
            type="button"
            className="tool__btn tool__btn--primary motion-press"
            disabled={ui.busy}
            onClick={() => inputRef.current?.click()}
          >
            파일 선택
          </button>
          <button
            type="button"
            className="tool__btn tool__btn--ghost motion-press"
            disabled={ui.busy || !ui.hasUser}
            onClick={() => void handleFontReset(slot)}
          >
            사용자 폰트 삭제
          </button>
        </div>
      </div>
    )
  }

  return (
    <main className="tool">
      <header className="tool__bar">
        <button type="button" className="tool__back motion-press" onClick={onBack}>
          ← 홈
        </button>
        <h1>설정</h1>
      </header>
      <p className="tool__lead">글자 크기·화면 밝기·색감을 조절합니다. 값은 이 기기에 저장됩니다.</p>

      <section className="tool__block" aria-label="글자 크기">
        <h2>글자 크기</h2>
        <p className="tool__meta">
          설명·타일·퀴즈 등 일반 글씨에 적용됩니다. 획 기록·따라쓰기 캔버스와 화살표는 중간 크기로 고정됩니다.
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
        <p className="tool__meta">
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

      <section className="tool__block" aria-label="색감">
        <h2>색감</h2>
        <p className="tool__meta">
          밝기(라이트·다크)와 따로 적용됩니다. 각 색감은 밝은·어두운 모드 모두에 맞춰져 있습니다.
        </p>
        <div className="tool__seg tool__seg--palette" role="group" aria-label="색감 선택">
          {PALETTE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`tool__seg-btn motion-press ${palette === opt.id ? 'is-active' : ''}`}
              aria-pressed={palette === opt.id}
              onClick={() => setPaletteState(setPalettePref(opt.id))}
            >
              <span
                className="tool__palette-swatch"
                style={{ background: opt.swatch }}
                aria-hidden="true"
              />
              <span className="tool__seg-title">{opt.label}</span>
              <span className="tool__seg-hint">{opt.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={`tool__block tool__labs ${labsOpen ? 'is-open' : ''}`} aria-label="실험용">
        <button
          type="button"
          className="tool__labs-toggle motion-press"
          aria-expanded={labsOpen}
          onClick={() => setLabsOpen((v) => !v)}
        >
          <span className="tool__labs-toggle-main">
            <FoldChevron open={labsOpen} />
            <span>
              <span className="tool__labs-title">실험용</span>
              <span className="tool__labs-hint">불안정할 수 있는 기능</span>
            </span>
          </span>
        </button>
        <div className={`fold-panel ${labsOpen ? 'is-expanded' : ''}`}>
          <div className="fold-panel__inner">
            <div className="tool__labs-body">
              <h3 className="tool__labs-section-title">스크립트 폰트</h3>
              <p className="tool__meta">
                기본 폰트를 고르거나 OTF·TTF를 올리면 학습·쓰기·퀴즈 표시가 바뀝니다. 획 순서는
                기록값 그대로입니다. 최대 {SCRIPT_FONT_MAX_BYTES / (1024 * 1024)}MB · 사용권이 있는
                파일만 올려 주세요.
              </p>
              {renderFontSlot(
                'deva',
                '산스크리트 (데바나가리)',
                devaFont,
                devaInputId,
                devaInputRef,
                'Noto는 기본 표시용, Tiro는 전통 문학용입니다. 사용자 폰트는 데바나가리(अ आ क)가 들어 있는 OTF·TTF만 올려 주세요.',
              )}
              {renderFontSlot(
                'siddham',
                '실담',
                siddhamFont,
                siddhamInputId,
                siddhamInputRef,
                'Muktam은 데바나가리 코드에 실담 모양을 얹고, Noto는 유니코드 실담을 씁니다. 사용자 폰트는 데바나가리(अ आ क) 글자를 담아 주세요.',
              )}
            </div>
          </div>
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
          획 가르치기·이론/쓰기 팁·한글 발음·글 메모를 GitHub({cloudRepoLabel()})에 올리는 데 씁니다.
          fine-grained PAT에 이 저장소 접근 + Contents 읽기·쓰기가 필요합니다. (읽기만 있으면
          확인은 되고 저장은 실패합니다.)
          대상 파일: cloud/taughtStrokes.json, cloud/theoryTips.json, cloud/hangulHints.json,
          cloud/letterMemos.json
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
