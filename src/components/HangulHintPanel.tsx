import { useEffect, useState } from 'react'
import {
  clearLocalHangulHint,
  getEffectiveHangulHint,
  hasCloudWriteToken,
  publishHangulHintToCloud,
  refreshHangulCloudStore,
  saveLocalHangulHint,
  type EffectiveHangulHint,
  type HangulHintSource,
} from '../lib/hangulHintsStore'
import './HangulHintPanel.css'

type Props = {
  letterId: string
  /** When false, hint is read-only. Default true. */
  editable?: boolean
  /** Fired after local/cloud save so parent can refresh displays. */
  onUpdated?: () => void
}

const sourceLabel: Record<HangulHintSource, string> = {
  cloud: '클라우드',
  local: '기기 초안',
  default: '기본',
  empty: '없음',
}

export function HangulHintPanel({ letterId, editable = true, onUpdated }: Props) {
  const [tick, setTick] = useState(0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  const hint: EffectiveHangulHint = getEffectiveHangulHint(letterId)
  void tick

  useEffect(() => {
    setEditing(false)
    setDraft('')
    setFlash(null)
    let cancelled = false
    ;(async () => {
      try {
        await refreshHangulCloudStore({ maxAgeMs: 30_000 })
        if (!cancelled) setTick((n) => n + 1)
      } catch {
        /* keep cached / default */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [letterId])

  function bump() {
    setTick((n) => n + 1)
    onUpdated?.()
  }

  function startEdit() {
    setDraft(hint.text)
    setEditing(true)
    setFlash(null)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft('')
    setFlash(null)
  }

  function restoreDefault() {
    setDraft(hint.defaultText ?? '')
  }

  async function handleSave() {
    if (saving) return
    const text = draft.trim()
    if (!text) {
      setFlash('발음을 입력해 주세요.')
      return
    }

    saveLocalHangulHint(letterId, text)
    bump()

    if (!hasCloudWriteToken()) {
      setEditing(false)
      setFlash('이 기기에만 저장')
      return
    }

    setSaving(true)
    setFlash('저장 중…')
    try {
      await publishHangulHintToCloud(letterId, text)
      clearLocalHangulHint(letterId)
      await refreshHangulCloudStore({ force: true })
      bump()
      setEditing(false)
      setFlash('클라우드 저장')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setFlash(`실패 · 기기만 (${msg.slice(0, 40)})`)
      bump()
    } finally {
      setSaving(false)
    }
  }

  if (!editable) {
    return null
  }

  return (
    <div className={`hangul-hint${editing ? ' is-editing' : ''}`}>
      <div className="hangul-hint__head">
        <h4>한글 발음</h4>
        <span className={`hangul-hint__badge hangul-hint__badge--${hint.source}`}>
          {sourceLabel[hint.source]}
        </span>
      </div>

      {editing ? (
        <div className="hangul-hint__editor">
          <input
            className="hangul-hint__input"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={saving}
            placeholder="예: 아"
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
          <div className="hangul-hint__bar">
            {hint.defaultText ? (
              <button
                type="button"
                className="hangul-hint__btn"
                disabled={saving}
                onClick={restoreDefault}
              >
                기본
              </button>
            ) : null}
            <button
              type="button"
              className="hangul-hint__btn"
              disabled={saving}
              onClick={cancelEdit}
            >
              취소
            </button>
            <button
              type="button"
              className="hangul-hint__btn hangul-hint__btn--primary"
              disabled={saving || !draft.trim()}
              onClick={() => void handleSave()}
            >
              {saving ? '…' : '저장'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="hangul-hint__open motion-press"
          onClick={startEdit}
          disabled={saving}
        >
          <span className="hangul-hint__open-label">수정</span>
          <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
            <path
              fill="currentColor"
              d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.04a1.003 1.003 0 0 0 0-1.42l-2.5-2.5a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.99-1.66z"
            />
          </svg>
        </button>
      )}

      {flash ? <p className="hangul-hint__flash">{flash}</p> : null}
    </div>
  )
}
