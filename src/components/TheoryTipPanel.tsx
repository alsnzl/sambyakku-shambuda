import { useEffect, useRef, useState } from 'react'
import {
  clearLocalTheoryTip,
  getEffectiveTheoryTip,
  hasCloudWriteToken,
  publishTheoryTipToCloud,
  refreshTheoryCloudStore,
  saveLocalTheoryTip,
  type EffectiveTheoryTip,
  type TheoryTipSource,
} from '../lib/theoryTipsStore'
import { renderTheoryTipText, wrapTheoryTipBold } from '../lib/theoryTipFormat'
import './TheoryTipPanel.css'

type Props = {
  letterId: string
  /** When false, tip is read-only (learner view). Default true. */
  editable?: boolean
  /** Fired after local/cloud save so parent can refresh sync status. */
  onUpdated?: () => void
}

const sourceLabel: Record<TheoryTipSource, string> = {
  cloud: '클라우드',
  local: '기기 초안',
  default: '기본',
  empty: '없음',
}

export function TheoryTipPanel({ letterId, editable = true, onUpdated }: Props) {
  const [tick, setTick] = useState(0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const tip: EffectiveTheoryTip = getEffectiveTheoryTip(letterId)
  void tick

  useEffect(() => {
    setEditing(false)
    setDraft('')
    setFlash(null)
    let cancelled = false
    ;(async () => {
      try {
        await refreshTheoryCloudStore({ maxAgeMs: 30_000 })
        if (!cancelled) setTick((n) => n + 1)
      } catch {
        /* keep cached / default */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [letterId])

  function startEdit() {
    setDraft(tip.text)
    setEditing(true)
    setFlash(null)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft('')
    setFlash(null)
  }

  function restoreDefault() {
    const fallback = tip.defaultText ?? ''
    setDraft(fallback)
  }

  function applyBold() {
    const el = textareaRef.current
    const start = el?.selectionStart ?? draft.length
    const end = el?.selectionEnd ?? draft.length
    const next = wrapTheoryTipBold(draft, start, end)
    setDraft(next.text)
    requestAnimationFrame(() => {
      const node = textareaRef.current
      if (!node) return
      node.focus()
      node.setSelectionRange(next.selectionStart, next.selectionEnd)
    })
  }

  async function handleSave() {
    if (saving) return
    const text = draft.trim()
    if (!text) {
      setFlash('내용을 입력해 주세요.')
      return
    }

    saveLocalTheoryTip(letterId, text)
    setTick((n) => n + 1)
    onUpdated?.()

    if (!hasCloudWriteToken()) {
      setEditing(false)
      setFlash('이 기기에만 저장했어요. (설정에서 토큰을 저장하세요)')
      return
    }

    setSaving(true)
    setFlash('클라우드에 저장 중…')
    try {
      await publishTheoryTipToCloud(letterId, text)
      clearLocalTheoryTip(letterId)
      await refreshTheoryCloudStore({ force: true })
      setTick((n) => n + 1)
      onUpdated?.()
      setEditing(false)
      setFlash('클라우드에 저장했어요')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setFlash(`클라우드 실패 · 기기에만 보관됨 (${msg.slice(0, 80)})`)
      setTick((n) => n + 1)
      onUpdated?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="theory-tip">
      <div className="theory-tip__head">
        <h4>이론 · 쓰기 팁</h4>
        <div className="theory-tip__head-actions">
          {editable && !editing ? (
            <span className={`theory-tip__badge theory-tip__badge--${tip.source}`}>
              {sourceLabel[tip.source]}
            </span>
          ) : null}
          {editable ? (
            <button
              type="button"
              className="theory-tip__edit motion-press"
              onClick={editing ? cancelEdit : startEdit}
              disabled={saving}
              aria-label={editing ? '편집 취소' : '이론·쓰기 팁 편집'}
              title={editing ? '취소' : '편집'}
            >
              {editing ? (
                '닫기'
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.04a1.003 1.003 0 0 0 0-1.42l-2.5-2.5a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.99-1.66z"
                  />
                </svg>
              )}
            </button>
          ) : null}
        </div>
      </div>

      {editable && editing ? (
        <div className="theory-tip__editor">
          <div className="theory-tip__toolbar" role="toolbar" aria-label="서식">
            <button
              type="button"
              className="theory-tip__fmt motion-press"
              disabled={saving}
              onClick={applyBold}
              aria-label="굵게"
              title="굵게 (**선택**)"
            >
              <strong>B</strong>
            </button>
            <span className="theory-tip__fmt-hint">선택 후 B · 또는 **텍스트**</span>
          </div>
          <textarea
            ref={textareaRef}
            className="theory-tip__textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
                e.preventDefault()
                applyBold()
              }
            }}
            rows={5}
            disabled={saving}
            placeholder="이론·쓰기 팁을 적어 주세요. 굵게는 **이렇게** 또는 B 버튼."
          />
          <div className="theory-tip__bar">
            {tip.defaultText ? (
              <button
                type="button"
                className="theory-tip__btn"
                disabled={saving}
                onClick={restoreDefault}
              >
                기본값
              </button>
            ) : null}
            <button
              type="button"
              className="theory-tip__btn"
              disabled={saving}
              onClick={cancelEdit}
            >
              취소
            </button>
            <button
              type="button"
              className="theory-tip__btn theory-tip__btn--primary"
              disabled={saving || !draft.trim()}
              onClick={() => void handleSave()}
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      ) : tip.text ? (
        <div className="theory-tip__body">{renderTheoryTipText(tip.text)}</div>
      ) : (
        <p className="theory-tip__body theory-tip__body--empty">
          {editable ? '아직 팁이 없습니다. 편집 아이콘으로 추가할 수 있어요.' : '아직 팁이 없습니다.'}
        </p>
      )}

      {flash ? <p className="theory-tip__flash">{flash}</p> : null}
    </div>
  )
}
