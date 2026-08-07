import { useState } from 'react'
import { MANTRA_SAMPLES, type MantraSample, type MantraSyllable } from '../data/mantras'
import { getLetterById, type Letter } from '../data/letters'
import { mantraUnlockStage } from '../data/pathStages'
import { isMantraUnlocked } from '../lib/pathProgress'
import { speakIast } from '../lib/audio'
import './tools.css'

type Props = {
  onBack: () => void
  backLabel?: string
  onOpenLetter: (letter: Letter) => void
}

function MantraCard({
  mantra,
  onOpenLetter,
}: {
  mantra: MantraSample
  onOpenLetter: (letter: Letter) => void
}) {
  const [step, setStep] = useState(0)
  const open = isMantraUnlocked(mantra.id)
  const need = mantraUnlockStage(mantra.id)
  const active = mantra.syllables[step] ?? mantra.syllables[0]

  function speakStep(syl: MantraSyllable) {
    void speakIast(syl.iast)
  }

  function openRelated(syl: MantraSyllable) {
    const first = syl.letterIds.map((id) => getLetterById(id)).find(Boolean)
    if (first) onOpenLetter(first)
  }

  return (
    <section className={`tool__block ${open ? '' : 'is-dim'}`}>
      <h2>
        {mantra.titleKo}
        {!open && need ? (
          <span className="tool__meta" style={{ marginLeft: '0.45rem' }}>
            · {need.nameKo}에서 열림
          </span>
        ) : null}
      </h2>
      {open ? (
        <>
          <p className="tool__meta">{mantra.iast}</p>
          <div className="tool__mantra-scripts">
            <div className="tool__output tool__output--deva" lang="sa">
              {mantra.dewa}
            </div>
            <div className="tool__output tool__output--siddham" lang="sa">
              {mantra.dewa}
            </div>
          </div>

          <p className="tool__mantra-label">따라 읽기 · 음절을 눌러 보세요</p>
          <div className="tool__mantra-steps" role="list">
            {mantra.syllables.map((syl, i) => (
              <button
                key={`${mantra.id}-${syl.iast}-${i}`}
                type="button"
                role="listitem"
                className={`tool__mantra-step motion-press ${i === step ? 'is-active' : ''}`}
                onClick={() => {
                  setStep(i)
                  speakStep(syl)
                }}
              >
                <span className="tool__mantra-step-deva" lang="sa">
                  {syl.dewa}
                </span>
                <span className="tool__mantra-step-iast">{syl.iast}</span>
              </button>
            ))}
          </div>

          {active ? (
            <div className="tool__mantra-focus">
              <div className="tool__mantra-focus-row">
                <span className="tool__mantra-focus-deva" lang="sa">
                  {active.dewa}
                </span>
                <span className="tool__mantra-focus-siddham" lang="sa">
                  {active.dewa}
                </span>
              </div>
              <div className="tool__chips" style={{ marginTop: '0.65rem' }}>
                {active.letterIds.map((id) => {
                  const letter = getLetterById(id)
                  if (!letter) return null
                  return (
                    <button
                      key={id}
                      type="button"
                      className="tool__chip motion-press"
                      onClick={() => onOpenLetter(letter)}
                    >
                      <span className="tool__chip-glyph tool__chip-glyph--deva" lang="sa">
                        {letter.dewa}
                      </span>
                      <span className="tool__chip-sub">{letter.iast}</span>
                    </button>
                  )
                })}
                <button
                  type="button"
                  className="tool__chip motion-press"
                  onClick={() => openRelated(active)}
                >
                  <span className="tool__chip-sub" style={{ marginTop: 0 }}>
                    관련 글자
                  </span>
                </button>
              </div>
            </div>
          ) : null}

          <p className="tool__lead" style={{ marginBottom: '0.65rem' }}>
            {mantra.meaningKo}
          </p>
          {mantra.note ? <p className="tool__meta">{mantra.note}</p> : null}
          <button
            type="button"
            className="tool__btn tool__btn--primary motion-press"
            onClick={() => speakIast(mantra.iast)}
          >
            전체 발음 들어보기
          </button>
        </>
      ) : (
        <p className="tool__empty">아직 잠겨 있습니다. 자모를 익혀 단계를 열어 보세요.</p>
      )}
    </section>
  )
}

export function MantrasPage({ onBack, backLabel = '← 학습', onOpenLetter }: Props) {
  return (
    <main className="tool">
      <header className="tool__bar">
        <button type="button" className="tool__back motion-press" onClick={onBack}>
          {backLabel}
        </button>
        <h1>짧은 구절 맛보기</h1>
      </header>
      <p className="tool__lead">
        수행 단계가 열릴 때마다 짧은 구절이 해금됩니다. 음절을 따라 읽고, 글자를 눌러 학습으로
        이어 보세요.
      </p>

      {MANTRA_SAMPLES.map((m) => (
        <MantraCard key={m.id} mantra={m} onOpenLetter={onOpenLetter} />
      ))}
    </main>
  )
}
