import { useEffect, useId, useRef } from 'react'
import { getBundledScriptFontFamily } from '../lib/customScriptFonts'
import { useScriptFontEpoch } from '../lib/useScriptFontEpoch'
import './GlyphReel.css'

type Props = {
  chars: string[]
  className?: string
  /** Auto-scroll speed in px per second. */
  speedPx?: number
}

const SPEED = 28
const FRICTION = 0.92
const MAX_FLICK = 2400

/**
 * Infinite horizontal glyph reel (lock / iOS-wheel feel).
 * Drag to spin; soft fades on both ends — content always fills the viewport.
 */
export function GlyphReel({ chars, className = '', speedPx = SPEED }: Props) {
  const fontEpoch = useScriptFontEpoch()
  const uid = useId()
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const setRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(0)
  const velocityRef = useRef(speedPx)
  const draggingRef = useRef(false)
  const lastXRef = useRef(0)
  const lastTRef = useRef(0)
  const loopWidthRef = useRef(0)
  const dirRef = useRef(1)
  const reduceMotionRef = useRef(false)
  const readyRef = useRef(false)

  const sequence = chars.length > 0 ? chars : ['·']

  useEffect(() => {
    reduceMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    velocityRef.current = reduceMotionRef.current ? 0 : speedPx
  }, [speedPx])

  useEffect(() => {
    const setEl = setRef.current
    const track = trackRef.current
    const viewport = viewportRef.current
    if (!setEl || !track || !viewport) return

    const measure = () => {
      const w = setEl.offsetWidth
      if (w > 8) {
        loopWidthRef.current = w
        if (!readyRef.current) {
          offsetRef.current = 0
          readyRef.current = true
        } else {
          offsetRef.current = ((offsetRef.current % w) + w) % w
        }
        track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`
      }
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(setEl)
    ro.observe(viewport)

    const onOrient = () => {
      offsetRef.current = 0
      readyRef.current = false
      requestAnimationFrame(() => {
        measure()
        readyRef.current = true
      })
    }
    window.addEventListener('orientationchange', onOrient)
    window.addEventListener('resize', onOrient)

    let cancelled = false
    void (async () => {
      try {
        await document.fonts?.ready
        const slot = className.includes('siddham') ? 'siddham' : 'deva'
        const family = getBundledScriptFontFamily(slot)
        await document.fonts?.load?.(`40px "${family}"`)
        await document.fonts?.load?.(`40px "Noto Sans Devanagari"`)
        await document.fonts?.load?.(`40px "Tiro Devanagari Sanskrit"`)
        await document.fonts?.load?.(`40px "Muktamsiddham"`)
      } catch {
        /* ignore */
      }
      if (!cancelled) {
        offsetRef.current = 0
        readyRef.current = false
        measure()
        readyRef.current = true
      }
    })()

    return () => {
      cancelled = true
      ro.disconnect()
      window.removeEventListener('orientationchange', onOrient)
      window.removeEventListener('resize', onOrient)
    }
  }, [sequence.join(''), className, uid, fontEpoch])

  useEffect(() => {
    let raf = 0
    let last = performance.now()

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const loop = loopWidthRef.current

      if (readyRef.current && loop > 8 && !draggingRef.current && !reduceMotionRef.current) {
        let v = velocityRef.current
        const cruise = speedPx * dirRef.current
        if (Math.abs(v) > Math.abs(cruise) * 1.15) {
          v *= Math.pow(FRICTION, dt * 60)
          if (Math.abs(v) < Math.abs(cruise)) v = cruise
        } else {
          v = cruise
        }
        velocityRef.current = v
        offsetRef.current += v * dt
        offsetRef.current = ((offsetRef.current % loop) + loop) % loop
      }

      const el = trackRef.current
      if (el) {
        const x = -offsetRef.current
        // Avoid subpixel thrash that looks stuttery on 120Hz OLED
        el.style.transform = `translate3d(${Math.round(x * 100) / 100}px, 0, 0)`
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [speedPx])

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 && e.pointerType !== 'touch') return
    const viewport = viewportRef.current
    if (!viewport) return
    draggingRef.current = true
    lastXRef.current = e.clientX
    lastTRef.current = performance.now()
    velocityRef.current = 0
    viewport.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    const loop = loopWidthRef.current
    const now = performance.now()
    const dx = e.clientX - lastXRef.current
    const dt = Math.max((now - lastTRef.current) / 1000, 0.001)
    offsetRef.current -= dx
    if (loop > 8) {
      offsetRef.current = ((offsetRef.current % loop) + loop) % loop
    }
    const pxPerSec = -dx / dt
    velocityRef.current = Math.max(-MAX_FLICK, Math.min(MAX_FLICK, pxPerSec))
    if (Math.abs(velocityRef.current) > 12) {
      dirRef.current = velocityRef.current > 0 ? 1 : -1
    }
    lastXRef.current = e.clientX
    lastTRef.current = now
    const el = trackRef.current
    if (el) el.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    draggingRef.current = false
    try {
      viewportRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    if (Math.abs(velocityRef.current) < speedPx * 0.5 && !reduceMotionRef.current) {
      velocityRef.current = speedPx * dirRef.current
    }
  }

  function renderSet(copy: number) {
    return (
      <div
        ref={copy === 0 ? setRef : undefined}
        className="glyph-reel__set"
        aria-hidden={copy > 0 ? true : undefined}
      >
        {sequence.map((char, index) => (
          <span key={`${copy}-${index}-${char}`} className="glyph-reel__glyph">
            {char}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div
      key={`reel-${fontEpoch}`}
      ref={viewportRef}
      className={`glyph-reel ${className}`.trim()}
      lang="sa"
      aria-hidden="true"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="glyph-reel__fog glyph-reel__fog--start" />
      <div className="glyph-reel__fog glyph-reel__fog--end" />
      <div ref={trackRef} className="glyph-reel__track">
        {renderSet(0)}
        {renderSet(1)}
        {renderSet(2)}
      </div>
    </div>
  )
}
