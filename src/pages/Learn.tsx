import { useMemo, useState } from 'react'
import { getLetterGroups, type Letter } from '../data/letters'
import { LetterCard } from '../components/LetterCard'
import { MotionPage } from '../components/MotionPage'
import type { ScriptTrack } from '../types/track'
import { trackMeta } from '../types/track'
import { getActiveScriptFontStack } from '../lib/customScriptFonts'
import { glyphForTrack } from '../lib/scriptDisplay'
import { useHardwareBack } from '../lib/useHardwareBack'
import { useScriptFontEpoch } from '../lib/useScriptFontEpoch'
import { ScriptFontQuickBar } from '../components/ScriptFontQuickBar'
import './Learn.css'

type Props = {
  track: ScriptTrack
  startInChart?: boolean
  initialLetterId?: string | null
  onBack: () => void
  backLabel?: string
}

type View = 'menu' | 'chart' | 'group' | 'letter'

export function Learn({
  track,
  startInChart = false,
  initialLetterId = null,
  onBack,
  backLabel = '← 학습',
}: Props) {
  const groups = useMemo(() => getLetterGroups(), [])
  const initialLetter = initialLetterId
    ? groups.flatMap((g) => g.letters).find((l) => l.id === initialLetterId) ?? null
    : null
  const [view, setView] = useState<View>(
    initialLetter ? 'letter' : startInChart ? 'chart' : 'menu',
  )
  const [groupId, setGroupId] = useState<string | null>(initialLetter?.group ?? null)
  const [letter, setLetter] = useState<Letter | null>(initialLetter)
  const [letterReturn, setLetterReturn] = useState<'chart' | 'group'>(
    startInChart ? 'chart' : 'group',
  )
  const [fromTools] = useState(() => Boolean(initialLetterId))
  const [slide, setSlide] = useState<'slide-left' | 'slide-right' | 'pop'>('pop')
  const [letterWriting, setLetterWriting] = useState(false)
  const fontEpoch = useScriptFontEpoch()
  const meta = trackMeta[track]
  const isSanskrit = track === 'sanskrit'

  const activeGroup = groups.find((g) => g.id === groupId) ?? null

  function openLetter(item: Letter, from: 'chart' | 'group') {
    setLetter(item)
    setLetterReturn(from)
    setSlide('pop')
    setView('letter')
  }

  function openGroup(id: string) {
    setGroupId(id)
    setView('group')
  }

  function backFromLetter() {
    setLetterWriting(false)
    if (fromTools) {
      onBack()
      return
    }
    setLetter(null)
    setView(letterReturn === 'chart' ? 'chart' : 'group')
  }

  function backFromGroup() {
    setGroupId(null)
    setView('menu')
  }

  function goPrev(prev: Letter) {
    setSlide('slide-right')
    setLetter(prev)
  }

  function goNext(next: Letter) {
    setSlide('slide-left')
    setLetter(next)
  }

  const charClass = isSanskrit
    ? 'learn__tile-char learn__tile-char--deva'
    : 'learn__tile-char learn__tile-char--siddham'
  const scriptStack = getActiveScriptFontStack(isSanskrit ? 'deva' : 'siddham')

  useHardwareBack(() => {
    if (view === 'letter') {
      backFromLetter()
      return true
    }
    if (view === 'group') {
      backFromGroup()
      return true
    }
    if (view === 'chart') {
      if (startInChart) onBack()
      else setView('menu')
      return true
    }
    onBack()
    return true
  })

  if (view === 'letter' && letter) {
    const sequence =
      letterReturn === 'chart'
        ? groups.flatMap((g) => g.letters)
        : (activeGroup?.letters ?? [letter])
    const index = sequence.findIndex((item) => item.id === letter.id)
    const prev = index > 0 ? sequence[index - 1] : null
    const next = index >= 0 && index < sequence.length - 1 ? sequence[index + 1] : null

    return (
      <main className="learn">
        <header className="learn__bar">
          <button
            type="button"
            className="learn__back motion-press"
            onClick={backFromLetter}
          >
            ← 목록
          </button>
          <h1>
            {index + 1} / {sequence.length}
          </h1>
        </header>

        <div className="learn__focus">
          <div className="learn__focus-backdrop" aria-hidden="true" />
          {letterWriting ? null : <ScriptFontQuickBar track={track} />}
          <div className="learn__sheet" role="dialog" aria-modal="true">
            <div className="learn__sheet-panel">
              <LetterCard
                letter={letter}
                track={track}
                navMotion={slide}
                onWritingChange={setLetterWriting}
                onOpenLetter={(item) => openLetter(item, letterReturn)}
                hasPrev={Boolean(prev)}
                hasNext={Boolean(next)}
                onPrev={prev ? () => goPrev(prev) : undefined}
                onNext={next ? () => goNext(next) : undefined}
              />
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (view === 'group' && activeGroup) {
    return (
      <MotionPage motionKey={`group-${activeGroup.id}`} variant="fade-up">
        <main className="learn">
          <header className="learn__bar">
            <button
              type="button"
              className="learn__back motion-press"
              onClick={backFromGroup}
            >
              ← 계열
            </button>
            <h1>{activeGroup.labelKo}</h1>
          </header>
          <ScriptFontQuickBar track={track} />
          <ul key={`learn-group-${fontEpoch}`} className="learn__grid motion-stagger">
            {activeGroup.letters.map((item) => (
              <li key={item.id} className="learn__cell">
                <button
                  type="button"
                  className="learn__tile motion-press"
                  onClick={() => openLetter(item, 'group')}
                >
                  <span className="learn__tile-glyph" aria-hidden="true">
                    <span className={charClass} lang="sa" style={{ fontFamily: scriptStack }}>
                      {glyphForTrack(item, track)}
                    </span>
                  </span>
                  <span className="learn__tile-iast">{item.iast}</span>
                </button>
              </li>
            ))}
          </ul>
        </main>
      </MotionPage>
    )
  }

  if (view === 'chart') {
    return (
      <MotionPage motionKey={`chart-${track}`} variant="fade-up">
        <main className="learn">
          <header className="learn__bar">
            <button
              type="button"
              className="learn__back motion-press"
              onClick={() => (startInChart ? onBack() : setView('menu'))}
            >
              {startInChart ? backLabel : '← 메뉴'}
            </button>
            <h1>전체 문자</h1>
          </header>
          <ScriptFontQuickBar track={track} />
          <p className="learn__intro">
            {meta.scriptLabel} 전체 자모입니다. 계열은 얇은 선으로 구분됩니다.
          </p>

          <div className="learn__chart">
            {groups.map((group, index) => (
              <section
                key={group.id}
                className={
                  index === 0
                    ? 'learn__chart-section'
                    : 'learn__chart-section learn__chart-section--divided'
                }
                aria-labelledby={`chart-${group.id}`}
              >
                <div className="learn__chart-head">
                  <h2 id={`chart-${group.id}`}>{group.labelKo}</h2>
                  <span>
                    {group.type === 'vowel' ? '모음' : '자음'} ·{' '}
                    {group.letters.length}자
                  </span>
                </div>
                <ul
                  key={`learn-chart-${fontEpoch}`}
                  className="learn__grid learn__grid--chart motion-stagger"
                >
                  {group.letters.map((item) => (
                    <li key={item.id} className="learn__cell">
                      <button
                        type="button"
                        className="learn__tile learn__tile--compact motion-press"
                        onClick={() => openLetter(item, 'chart')}
                      >
                        <span className="learn__tile-glyph" aria-hidden="true">
                          <span className={charClass} lang="sa" style={{ fontFamily: scriptStack }}>
                            {glyphForTrack(item, track)}
                          </span>
                        </span>
                        <span className="learn__tile-iast">{item.iast}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </main>
      </MotionPage>
    )
  }

  return (
    <main className="learn">
      <header className="learn__bar">
        <button type="button" className="learn__back motion-press" onClick={onBack}>
          {backLabel}
        </button>
        <h1>{meta.title} 학습</h1>
      </header>
      <ScriptFontQuickBar track={track} />
      <p className="learn__intro">
        {meta.subtitle} 모음부터 보고, 자음은 조음 위치 계열(varga) 단위로
        익혀 보세요.
      </p>

      <button
        type="button"
        className="learn__all-btn motion-press"
        onClick={() => setView('chart')}
      >
        전체 문자 보기
      </button>

      <ul className="learn__groups motion-stagger">
        {groups.map((group) => (
          <li key={group.id}>
            <button
              type="button"
              className="learn__group motion-press"
              onClick={() => openGroup(group.id)}
            >
              <span className="learn__group-label">{group.labelKo}</span>
              <span className="learn__group-meta">
                {group.type === 'vowel' ? '모음' : '자음'} · {group.letters.length}
                자
              </span>
              <span
                className={
                  isSanskrit
                    ? 'learn__group-preview learn__group-preview--deva'
                    : 'learn__group-preview learn__group-preview--siddham'
                }
                lang="sa"
              >
                {group.letters
                  .slice(0, 5)
                  .map((l) => glyphForTrack(l, track))
                  .join(' ')}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
