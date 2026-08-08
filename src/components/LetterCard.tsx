import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { Letter } from '../data/letters'
import { STROKE_VIEWBOX } from '../data/glyphStrokes'
import { getSimilarLetters } from '../data/similarLetters'
import type { ScriptTrack } from '../types/track'
import { trackMeta } from '../types/track'
import { playLetterPronunciation } from '../lib/audio'
import {
  getActiveScriptFontStack,
  getScriptFontChoice,
  getScriptFontStack,
  matchesGeneratedOutlineFont,
  parseScriptFontChoice,
} from '../lib/customScriptFonts'
import {
  getEffectiveHangulHint,
  refreshHangulCloudStore,
} from '../lib/hangulHintsStore'
import {
  isFavorite,
  markLetterSeen,
  toggleFavorite,
} from '../lib/learnerStore'
import { glyphHasCombiningMarks } from '../lib/complexScriptGlyph'
import { glyphForTrack } from '../lib/scriptDisplay'
import { refreshCloudStore } from '../lib/strokeCloud'
import { startStrokeRevealPlayback } from '../lib/strokePlayback'
import { getTaughtGlyphStrokes, getTeachingInfo } from '../lib/strokeRecord'
import { useHardwareBack } from '../lib/useHardwareBack'
import { useScriptFontEpoch } from '../lib/useScriptFontEpoch'
import { ScriptCanvasGlyph } from './ScriptCanvasGlyph'
import { WritePractice } from './WritePractice'
import { TheoryTipPanel } from './TheoryTipPanel'
import './LetterCard.css'

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

type Props = {
  letter: Letter
  track: ScriptTrack
  onOpenLetter?: (letter: Letter) => void
  onPrev?: () => void
  onNext?: () => void
  hasPrev?: boolean
  hasNext?: boolean
  /** Letter paging motion — canvas slides; copy blurs in. */
  navMotion?: 'slide-left' | 'slide-right' | 'pop'
  /** Notify parent when write practice is open (e.g. hide outer font bar). */
  onWritingChange?: (writing: boolean) => void
}

function SideNavChevron({ dir }: { dir: 'prev' | 'next' }) {
  return (
    <svg className="letter-card__side-nav-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      {dir === 'prev' ? (
        <path
          d="M14.5 5.5 8 12l6.5 6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M9.5 5.5 16 12l-6.5 6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

export function LetterCard({
  letter,
  track,
  onOpenLetter,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  navMotion = 'pop',
  onWritingChange,
}: Props) {
  const fontEpoch = useScriptFontEpoch()
  const glyph = glyphForTrack(letter, track)
  const script = track === 'sanskrit' ? 'deva' : 'siddham'
  const [fav, setFav] = useState(() => isFavorite(track, letter.id))
  const [writeOpen, setWriteOpen] = useState(false)
  const [hangulTick, setHangulTick] = useState(0)
  const [cloudTick, setCloudTick] = useState(0)
  const [introDoneKey, setIntroDoneKey] = useState<string | null>(null)
  const [slideReadyKey, setSlideReadyKey] = useState<string | null>(null)
  const revealRefs = useRef<(SVGPathElement | null)[]>([])
  const maskIdRaw = useId().replace(/:/g, '')
  const maskId = `letter-hero-mask-${maskIdRaw}`
  const similar = getSimilarLetters(letter.id)
  const glyphClass =
    track === 'sanskrit' ? 'letter-card__similar-glyph--deva' : 'letter-card__similar-glyph--siddham'
  const scriptStack = getActiveScriptFontStack(script)
  const teachInfo = getTeachingInfo(letter.id, script)
  const taughtData = getTaughtGlyphStrokes(letter.id, script)
  void cloudTick
  const hasRecordedStrokes = Boolean(taughtData?.strokes.length)
  const introKey = `${letter.id}|${script}|${fontEpoch}|${taughtData?.d ?? ''}|${taughtData?.strokes.length ?? 0}`
  const recordedFontChoice = parseScriptFontChoice(script, teachInfo.fontFace)
  const watchFontFamily = recordedFontChoice
    ? getScriptFontStack(script, recordedFontChoice)
    : scriptStack
  const usePathGuide =
    Boolean(taughtData?.d) &&
    !recordedFontChoice &&
    matchesGeneratedOutlineFont(script, getScriptFontChoice(script))
  /*
   * iOS WebKit draws U+25CC dotted circles for combining marks inside SVG <text>.
   * Skip SVG-text stroke intros for those glyphs; path outlines stay fine.
   */
  const hasCombining = glyphHasCombiningMarks(glyph)
  const needsStrokeIntro =
    hasRecordedStrokes &&
    !prefersReducedMotion() &&
    (usePathGuide || !hasCombining)
  const introDone = !needsStrokeIntro || introDoneKey === introKey
  const slideReady = slideReadyKey === introKey
  const heroMotionClass =
    navMotion === 'slide-left'
      ? 'letter-card__hero--slide-next'
      : navMotion === 'slide-right'
        ? 'letter-card__hero--slide-prev'
        : 'letter-card__hero--pop'
  const slideMs = navMotion === 'pop' ? 400 : 480
  void hangulTick
  const hangul = getEffectiveHangulHint(letter.id).text

  useEffect(() => {
    markLetterSeen(track, letter.id)
    setFav(isFavorite(track, letter.id))
    setWriteOpen(false)
  }, [letter.id, track])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await refreshHangulCloudStore({ maxAgeMs: 30_000 })
        if (!cancelled) setHangulTick((n) => n + 1)
      } catch {
        /* keep cached / default */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [letter.id])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await refreshCloudStore({ maxAgeMs: 30_000 })
      } catch {
        /* keep cache */
      } finally {
        if (!cancelled) setCloudTick((n) => n + 1)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [letter.id, script, fontEpoch])

  /** Hide stroke mask until playback so only the gray template shows during slide-in. */
  useLayoutEffect(() => {
    if (!needsStrokeIntro || introDone || !taughtData?.strokes.length) return
    const strokeCount = taughtData.strokes.length
    for (let i = 0; i < strokeCount; i++) {
      const el = revealRefs.current[i]
      if (!el) continue
      const len = el.getTotalLength()
      const safe = len > 0.5 ? len : 1
      el.style.strokeDasharray = `${safe}`
      el.style.strokeDashoffset = `${safe}`
    }
  }, [needsStrokeIntro, introDone, introKey, taughtData?.strokes.length, taughtData?.d])

  /** Wait for canvas slide-in before stroke reveal (animated letters only). */
  useEffect(() => {
    if (!needsStrokeIntro || introDone) return
    setSlideReadyKey((prev) => (prev === introKey ? prev : null))
    const t = window.setTimeout(() => setSlideReadyKey(introKey), slideMs)
    return () => clearTimeout(t)
  }, [needsStrokeIntro, introDone, introKey, slideMs])

  useEffect(() => {
    if (!needsStrokeIntro || introDone || !slideReady || !taughtData?.strokes.length) return

    let cancelled = false
    let raf = 0
    let stopPlayback: (() => void) | null = null
    const strokeCount = taughtData.strokes.length
    const strokeSnapshot = taughtData.strokes.map((s) => ({ ...s }))
    const doneKey = introKey
    revealRefs.current = revealRefs.current.slice(0, strokeCount)

    const start = () => {
      if (cancelled) return
      const paths = revealRefs.current.slice(0, strokeCount)
      if (paths.some((el) => !el) || paths.length < strokeCount) {
        raf = requestAnimationFrame(start)
        return
      }

      stopPlayback = startStrokeRevealPlayback({
        paths: paths as SVGPathElement[],
        tip: null,
        strokeWidths: strokeSnapshot.map((s) => s.width),
        /* Learn intro: snappier than write/watch practice */
        speed: 0.52,
        minStrokeMs: 140,
        liftMs: 32,
        onStep: () => undefined,
        onDone: () => {
          if (!cancelled) setIntroDoneKey(doneKey)
        },
      })
    }

    raf = requestAnimationFrame(start)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      stopPlayback?.()
    }
  }, [
    needsStrokeIntro,
    introDone,
    slideReady,
    introKey,
    taughtData?.strokes.length,
    taughtData?.d,
  ])

  useEffect(() => {
    onWritingChange?.(writeOpen)
  }, [writeOpen, onWritingChange])

  useHardwareBack(() => {
    setWriteOpen(false)
    return true
  }, writeOpen)

  return (
    <article className={`letter-card ${writeOpen ? 'letter-card--writing' : ''}`}>
      <div className="letter-card__top">
        <div>
          <p className="letter-card__group">{letter.groupKo}</p>
          <p className="letter-card__script-label">{trackMeta[track].scriptLabel}</p>
        </div>
        <button
          type="button"
          className={`letter-card__fav motion-press ${fav ? 'is-on' : ''}`}
          onClick={() => setFav(toggleFavorite(track, letter.id))}
          aria-label={fav ? '즐겨찾기 해제' : '즐겨찾기 추가'}
        >
          {fav ? '★' : '☆'}
        </button>
      </div>

      {writeOpen ? (
        <div className="letter-card__write-wrap">
          <WritePractice
            letterId={letter.id}
            glyph={glyph}
            track={track}
            onClose={() => setWriteOpen(false)}
          />
        </div>
      ) : (
        <>
          <div className="letter-card__view">
            <div className="letter-card__stage">
              <button
                type="button"
                className="letter-card__side-nav motion-press"
                onClick={onPrev}
                disabled={!hasPrev || !onPrev}
                aria-label="이전 글자"
              >
                <SideNavChevron dir="prev" />
              </button>

              <div className="letter-card__hero-frame">
                {/*
                  Keep the final glyph inside the same SVG viewBox as the stroke
                  reveal (fontSize 158 / 240) so size never drifts. Combining marks
                  use foreignObject via ScriptCanvasGlyph for iOS shaping.
                */}
                <svg
                  key={`hero-${introKey}`}
                  className={`letter-card__hero-reveal ${heroMotionClass}`}
                  viewBox={`0 0 ${STROKE_VIEWBOX} ${STROKE_VIEWBOX}`}
                  role="img"
                  aria-label={letter.iast}
                >
                  {needsStrokeIntro && taughtData?.strokes.length ? (
                    <>
                      <defs>
                        <mask id={maskId} maskUnits="userSpaceOnUse">
                          <rect width={STROKE_VIEWBOX} height={STROKE_VIEWBOX} fill="black" />
                          {taughtData.strokes.map((s, i) => (
                            <path
                              key={`${letter.id}-intro-${i}`}
                              ref={(el) => {
                                revealRefs.current[i] = el
                              }}
                              d={s.d}
                              stroke="white"
                              strokeWidth={s.width}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              fill="none"
                            />
                          ))}
                        </mask>
                      </defs>
                      {usePathGuide ? (
                        <>
                          <path
                            className={`letter-card__hero-guide${introDone ? ' is-done' : ''}`}
                            d={taughtData.d}
                          />
                          <path
                            className="letter-card__hero-ink"
                            d={taughtData.d}
                            mask={`url(#${maskId})`}
                          />
                        </>
                      ) : (
                        <>
                          <ScriptCanvasGlyph
                            className={`letter-card__hero-guide${introDone ? ' is-done' : ''}`}
                            glyph={glyph}
                            fontFamily={watchFontFamily}
                          />
                          <ScriptCanvasGlyph
                            className="letter-card__hero-ink"
                            glyph={glyph}
                            fontFamily={watchFontFamily}
                            mask={`url(#${maskId})`}
                          />
                        </>
                      )}
                    </>
                  ) : null}
                  <ScriptCanvasGlyph
                    className={`letter-card__hero-final${introDone ? ' is-visible' : ''}`}
                    glyph={glyph}
                    fontFamily={scriptStack}
                  />
                </svg>
              </div>

              <button
                type="button"
                className="letter-card__side-nav motion-press"
                onClick={onNext}
                disabled={!hasNext || !onNext}
                aria-label="다음 글자"
              >
                <SideNavChevron dir="next" />
              </button>
            </div>

            <div className="letter-card__actions">
              <button
                type="button"
                className="letter-card__write-btn motion-press"
                onClick={() => setWriteOpen(true)}
              >
                쓰기 연습 시작
              </button>
              <button
                type="button"
                className="letter-card__audio motion-press"
                onClick={() => playLetterPronunciation(letter)}
                title="발음 듣기"
              >
                발음 듣기
              </button>
            </div>
          </div>

          <div key={`rail-${letter.id}`} className="letter-card__rail letter-card__blur-swap">
            <div className="letter-card__meta">
              <p className="letter-card__iast">{letter.iast}</p>
              <p className="letter-card__hangul">{hangul}</p>
              {letter.note ? <p className="letter-card__note">{letter.note}</p> : null}
            </div>

            <TheoryTipPanel letterId={letter.id} editable={false} />

            {similar.length > 0 && (
              <div className="letter-card__similar">
                <h4>비슷한 글자</h4>
                <div className="letter-card__similar-row">
                  {similar.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="letter-card__similar-btn motion-press"
                      onClick={() => onOpenLetter?.(s)}
                    >
                      <span className={glyphClass} lang="sa">
                        {glyphForTrack(s, track)}
                      </span>
                      <span className="letter-card__similar-iast">{s.iast}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </article>
  )
}
