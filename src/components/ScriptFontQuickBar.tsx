import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
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
   * `record`: teach “기록 폰트” — always expanded picker + stroke badge.
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

/** Ping-pong scroll only when label overflows its slot; edges fade via CSS mask. */
function OverflowPingPongText({ text, className }: { text: string; className?: string }) {
  const wrapRef = useRef<HTMLSpanElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [overflowPx, setOverflowPx] = useState(0)

  useEffect(() => {
    const wrap = wrapRef.current
    const el = textRef.current
    if (!wrap || !el) return

    let cancelled = false

    const measure = () => {
      if (cancelled) return
      /* Wrap must be width-constrained by parent; compare natural text width. */
      const wrapW = wrap.clientWidth
      const textW = el.scrollWidth
      if (wrapW < 2) {
        setOverflowPx(0)
        return
      }
      const delta = Math.ceil(textW - wrapW)
      setOverflowPx(delta > 2 ? delta : 0)
    }

    const run = () => {
      measure()
      requestAnimationFrame(measure)
    }

    run()
    const ro = new ResizeObserver(run)
    ro.observe(wrap)
    if (wrap.parentElement) ro.observe(wrap.parentElement)

    const fontsReady =
      typeof document !== 'undefined' && document.fonts?.ready
        ? document.fonts.ready.then(run)
        : null

    return () => {
      cancelled = true
      ro.disconnect()
      void fontsReady
    }
  }, [text])

  const overflowing = overflowPx > 0
  /* ~24px/s with pause at ends — readable on tablet */
  const durationSec = overflowing ? Math.min(8, Math.max(4, overflowPx / 24)) : 0

  return (
    <span
      ref={wrapRef}
      className={`sfb-marquee${overflowing ? ' is-overflow' : ''}${className ? ` ${className}` : ''}`}
    >
      <span
        ref={textRef}
        className="sfb-marquee__text"
        style={
          overflowing
            ? ({
                '--sfb-marquee-x': `-${overflowPx}px`,
                '--sfb-marquee-duration': `${durationSec}s`,
              } as CSSProperties)
            : undefined
        }
      >
        {text}
      </span>
    </span>
  )
}

/**
 * Bundled-font switcher for teach / learn / practice / write.
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

  const optionButtons = (
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
          <OverflowPingPongText text={opt.label} className="script-font-bar__opt-label" />
        </button>
      ))}
      {error ? <p className="script-font-bar__error">{error}</p> : null}
    </div>
  )

  /* Teach record: always open — no fold/chevron */
  if (isRecord) {
    return (
      <div className="script-font-bar script-font-bar--record script-font-bar--always-open is-open">
        <div className="script-font-bar__record-head">
          <span className="script-font-bar__record-main">
            <span className="script-font-bar__title">기록 폰트</span>
            <OverflowPingPongText text={activeLabel} className="script-font-bar__current" />
          </span>
          <span
            className={`script-font-bar__stroke-state${
              strokeCount > 0 ? ' is-saved' : ' is-empty'
            }`}
          >
            {strokeLabel}
          </span>
        </div>
        {optionButtons}
      </div>
    )
  }

  return (
    <div className={`script-font-bar ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="script-font-bar__toggle motion-press"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <FoldChevron open={open} />
        <span className="script-font-bar__toggle-main">
          <span className="script-font-bar__title">폰트</span>
          <OverflowPingPongText text={activeLabel} className="script-font-bar__current" />
        </span>
      </button>
      <div id={panelId} className={`fold-panel ${open ? 'is-expanded' : ''}`}>
        <div className="fold-panel__inner">{optionButtons}</div>
      </div>
    </div>
  )
}
