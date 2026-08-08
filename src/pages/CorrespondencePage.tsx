import { getLetterGroups, type Letter } from '../data/letters'
import { getEffectiveHangulHint } from '../lib/hangulHintsStore'
import './tools.css'

type Props = {
  onBack: () => void
  backLabel?: string
  onOpenLetter: (letter: Letter, track: 'sanskrit' | 'siddham') => void
}

export function CorrespondencePage({
  onBack,
  backLabel = '← 학습',
  onOpenLetter,
}: Props) {
  const groups = getLetterGroups()

  return (
    <main className="tool">
      <header className="tool__bar">
        <button type="button" className="tool__back motion-press" onClick={onBack}>
          {backLabel}
        </button>
        <h1>실담 ↔ 데바나가리</h1>
      </header>
      <p className="tool__lead">
        같은 발음의 두 문자를 나란히 봅니다. 글자를 누르면 해당 트랙 학습으로 이동합니다.
      </p>

      {groups.map((group) => (
        <section key={group.id} className="tool__block">
          <h2>
            {group.labelKo}
            <span className="tool__meta" style={{ marginLeft: '0.45rem' }}>
              · {group.letters.length}자
            </span>
          </h2>
          <ul className="tool__corr-list">
            {group.letters.map((letter) => (
              <li key={letter.id} className="tool__corr-row">
                <button
                  type="button"
                  className="tool__corr-glyph tool__corr-glyph--deva motion-press"
                  lang="sa"
                  onClick={() => onOpenLetter(letter, 'sanskrit')}
                  aria-label={`${letter.iast} 데바나가리 학습`}
                >
                  {letter.dewa}
                </button>
                <div className="tool__corr-mid">
                  <span className="tool__corr-iast">{letter.iast}</span>
                  <span className="tool__corr-hangul">
                    {getEffectiveHangulHint(letter.id).text || letter.hangulHint}
                  </span>
                </div>
                <button
                  type="button"
                  className="tool__corr-glyph tool__corr-glyph--siddham motion-press"
                  lang="sa"
                  onClick={() => onOpenLetter(letter, 'siddham')}
                  aria-label={`${letter.iast} 실담 학습`}
                >
                  {letter.dewa}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
