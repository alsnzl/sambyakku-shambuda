import { useState } from 'react'
import type { ScriptTrack } from '../types/track'
import {
  DEVA_FONT_OPTIONS,
  SIDDHAM_FONT_OPTIONS,
  getActiveScriptFontLabel,
  getScriptFontChoice,
  setScriptFontChoice,
  type ScriptFontChoice,
  type ScriptFontSlot,
} from '../lib/customScriptFonts'
import { useScriptFontEpoch } from '../lib/useScriptFontEpoch'
import './ScriptFontQuickBar.css'

type Props = {
  track: ScriptTrack
}

function slotForTrack(track: ScriptTrack): ScriptFontSlot {
  return track === 'sanskrit' ? 'deva' : 'siddham'
}

function bundledForSlot(slot: ScriptFontSlot) {
  return slot === 'deva' ? DEVA_FONT_OPTIONS : SIDDHAM_FONT_OPTIONS
}

/**
 * Collapsible bundled-font switcher for teach / write.
 * Siddham: Muktamsiddham | Noto Sans Siddham. Deva: Noto (single). No user-upload.
 * Always visible so the control is findable on every track.
 */
export function ScriptFontQuickBar({ track }: Props) {
  useScriptFontEpoch()
  const slot = slotForTrack(track)
  const options = bundledForSlot(slot)
  const choice = getScriptFontChoice(slot)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const activeLabel =
    options.find((o) => o.id === choice)?.label ?? getActiveScriptFontLabel(slot)

  async function pick(next: ScriptFontChoice) {
    if (next === choice || busy) return
    setBusy(true)
    try {
      await setScriptFontChoice(slot, next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`script-font-bar ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="script-font-bar__toggle motion-press"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="script-font-bar__toggle-main">
          <span className="script-font-bar__title">폰트</span>
          <span className="script-font-bar__current">{activeLabel}</span>
        </span>
        <span className="script-font-bar__count">{open ? '접기' : '펴기'}</span>
      </button>
      <div className={`fold-panel ${open ? 'is-expanded' : ''}`}>
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
                  className="script-font-bar__sample"
                  lang="sa"
                  style={{ fontFamily: `"${opt.family}", sans-serif` }}
                  aria-hidden="true"
                >
                  {slot === 'siddham' && opt.id === 'noto-siddham' ? '𑖀' : 'अ'}
                </span>
                <span className="script-font-bar__opt-label">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
