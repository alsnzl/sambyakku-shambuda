import { useId, useState } from 'react'
import type { ScriptTrack } from '../types/track'
import {
  DEVA_FONT_OPTIONS,
  SIDDHAM_FONT_OPTIONS,
  getActiveScriptFontLabel,
  getScriptFontChoice,
  scriptFontErrorMessage,
  setScriptFontChoice,
  type ScriptFontChoice,
  type ScriptFontSlot,
} from '../lib/customScriptFonts'
import { useScriptFontEpoch } from '../lib/useScriptFontEpoch'
import { FoldChevron } from './FoldChevron'
import './ScriptFontQuickBar.css'

type Props = {
  track: ScriptTrack
  /**
   * `record`: teach “기록 폰트” badge + fold-out picker.
   * Default: compact top bar used on chart / learn / practice.
   */
  variant?: 'default' | 'record'
  /** Active-font stroke count — only used with `variant="record"`. */
  strokeCount?: number
}

function slotForTrack(track: ScriptTrack): ScriptFontSlot {
  return track === 'sanskrit' ? 'deva' : 'siddham'
}

function bundledForSlot(slot: ScriptFontSlot) {
  return slot === 'deva' ? DEVA_FONT_OPTIONS : SIDDHAM_FONT_OPTIONS
}

/**
 * Collapsible bundled-font switcher for teach / learn / practice / write.
 * Deva: Noto Sans Devanagari | Tiro Devanagari Sanskrit.
 * Siddham: Muktamsiddham | Noto Sans Siddham.
 */
export function ScriptFontQuickBar({ track, variant = 'default', strokeCount = 0 }: Props) {
  useScriptFontEpoch()
  const panelId = useId()
  const slot = slotForTrack(track)
  const options = bundledForSlot(slot)
  const choice = getScriptFontChoice(slot)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (options.length < 2) return null

  const activeLabel =
    options.find((o) => o.id === choice)?.label ?? getActiveScriptFontLabel(slot)
  const isRecord = variant === 'record'
  const strokeLabel = strokeCount > 0 ? `${strokeCount}획 저장됨` : '미기록'

  async function pick(next: ScriptFontChoice) {
    if (next === choice || busy) return
    setBusy(true)
    setError(null)
    try {
      await setScriptFontChoice(slot, next)
    } catch (err) {
      setError(scriptFontErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={`script-font-bar ${isRecord ? 'script-font-bar--record' : ''} ${
        open ? 'is-open' : ''
      }`}
    >
      <button
        type="button"
        className="script-font-bar__toggle motion-press"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        {isRecord ? (
          <>
            <FoldChevron open={open} />
            <span className="script-font-bar__record-main">
              <span className="script-font-bar__title">기록 폰트</span>
              <strong className="script-font-bar__current">{activeLabel}</strong>
            </span>
            <span
              className={`script-font-bar__stroke-state${
                strokeCount > 0 ? ' is-saved' : ' is-empty'
              }`}
            >
              {strokeLabel}
            </span>
          </>
        ) : (
          <>
            <span className="script-font-bar__toggle-main">
              <span className="script-font-bar__title">폰트</span>
              <span className="script-font-bar__current">{activeLabel}</span>
            </span>
            <FoldChevron open={open} />
          </>
        )}
      </button>
      <div id={panelId} className={`fold-panel ${open ? 'is-expanded' : ''}`}>
        <div className="fold-panel__inner">
          <div className="script-font-bar__body" role="group" aria-label="기본 폰트 선택">
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`script-font-bar__opt motion-press ${choice === opt.id ? 'is-active' : ''}`}
                aria-pressed={choice === opt.id}
                disabled={busy}
                onClick={() => void pick(opt.id)}
              >
                <span
                  className={`script-font-bar__sample${
                    opt.id === 'noto-siddham' ? ' script-font-bar__sample--noto' : ''
                  }`}
                  lang="sa"
                  style={{ fontFamily: `"${opt.family}", sans-serif` }}
                  aria-hidden="true"
                >
                  {slot === 'siddham' && opt.id === 'noto-siddham' ? '𑖀' : 'अ'}
                </span>
                <span className="script-font-bar__opt-label">{opt.label}</span>
              </button>
            ))}
            {error ? <p className="script-font-bar__error">{error}</p> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
