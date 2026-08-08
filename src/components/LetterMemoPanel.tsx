import { useEffect, useState } from 'react'
import {
  clearLocalLetterMemo,
  getEffectiveLetterMemo,
  hasCloudWriteToken,
  publishLetterMemoToCloud,
  refreshLetterMemoCloudStore,
  saveLocalLetterMemo,
  type EffectiveLetterMemo,
  type LetterMemoSource,
} from '../lib/letterMemosStore'
import './LetterMemoPanel.css'

type Props = {
  letterId: string
  disabled?: boolean
  onUpdated?: () => void
}

const sourceLabel: Record<LetterMemoSource, string> = {
  cloud: '클라우드',
  local: '기기 초안',
  empty: '없음',
}

export function LetterMemoPanel({ letterId, disabled = false, onUpdated }: Props) {
  const [tick, setTick] = useState(0)
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  const memo: EffectiveLetterMemo = getEffectiveLetterMemo(letterId)
  void tick

  useEffect(() => {
    setFlash(null)
    setDirty(false)
    let cancelled = false
    ;(async () => {
      try {
        await refreshLetterMemoCloudStore({ maxAgeMs: 30_000 })
      } catch {
        /* keep cached */
      }
      if (cancelled) return
      setTick((n) => n + 1)
      setDraft(getEffectiveLetterMemo(letterId).text)
      setDirty(false)
    })()
    return () => {
      cancelled = true
    }
  }, [letterId])

  function onDraftChange(value: string) {
    setDraft(value)
    setDirty(true)
    setFlash(null)
  }

  async function handleSave() {
    if (saving || disabled) return
    const text = draft.trim()

    saveLocalLetterMemo(letterId, text)
    setTick((n) => n + 1)
    setDirty(false)
    onUpdated?.()

    if (!hasCloudWriteToken()) {
      setFlash(text ? '이 기기에만 저장했어요. (설정에서 토큰을 저장하세요)' : '기기 초안을 비웠어요')
      return
    }

    setSaving(true)
    setFlash('클라우드에 저장 중…')
    try {
      await publishLetterMemoToCloud(letterId, text)
      clearLocalLetterMemo(letterId)
      await refreshLetterMemoCloudStore({ force: true })
      setTick((n) => n + 1)
      setDraft(getEffectiveLetterMemo(letterId).text)
      setDirty(false)
      onUpdated?.()
      setFlash(text ? '클라우드에 저장했어요' : '클라우드 메모를 지웠어요')
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
    <div className="letter-memo">
      <div className="letter-memo__head">
        <h4>글 메모</h4>
        <div className="letter-memo__head-actions">
          <span className={`letter-memo__badge letter-memo__badge--${memo.source}`}>
            {sourceLabel[memo.source]}
          </span>
          <button
            type="button"
            className="letter-memo__save motion-press"
            disabled={disabled || saving || (!dirty && draft.trim() === memo.text)}
            onClick={() => void handleSave()}
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>

      <textarea
        className="letter-memo__textarea"
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        disabled={disabled || saving}
        placeholder="이 글자에 대한 메모를 적어 주세요."
        aria-label="글 메모"
      />

      {flash ? <p className="letter-memo__flash">{flash}</p> : null}
    </div>
  )
}
