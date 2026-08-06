import { CONJUNCT_SAMPLES } from '../data/conjuncts'
import { getLetterById, type Letter } from '../data/letters'
import './tools.css'

type Props = {
  onBack: () => void
  backLabel?: string
  onOpenLetter: (letter: Letter) => void
}

export function ConjunctsPage({ onBack, backLabel = '← 학습', onOpenLetter }: Props) {
  return (
    <main className="tool">
      <header className="tool__bar">
        <button type="button" className="tool__back motion-press" onClick={onBack}>
          {backLabel}
        </button>
        <h1>합자 · 음절 맛보기</h1>
      </header>
      <p className="tool__lead">
        자음이 비라마(्)로 이어진 합자입니다. 구성 글자를 눌러 단음 학습으로 이어갈 수 있습니다.
      </p>

      {CONJUNCT_SAMPLES.map((item) => {
        const parts = item.parts
          .map((id) => getLetterById(id))
          .filter((l): l is Letter => Boolean(l))
        return (
          <section key={item.id} className="tool__block">
            <div className="tool__pair" style={{ marginBottom: '0.65rem' }}>
              <div className="tool__pair-glyph tool__pair-glyph--deva" lang="sa">
                {item.dewa}
                <div className="tool__chip-sub">데바나가리</div>
              </div>
              <span className="tool__pair-vs">·</span>
              <div className="tool__pair-glyph tool__pair-glyph--siddham" lang="sa">
                {item.siddham}
                <div className="tool__chip-sub">실담</div>
              </div>
            </div>
            <p className="tool__corr-iast" style={{ textAlign: 'center', margin: '0 0 0.2rem' }}>
              {item.iast}
            </p>
            <p className="tool__meta" style={{ textAlign: 'center', marginBottom: '0.65rem' }}>
              {item.hangulHint} · {item.note}
            </p>
            <div className="tool__chips">
              {parts.map((letter) => (
                <button
                  key={letter.id}
                  type="button"
                  className="tool__chip motion-press"
                  onClick={() => onOpenLetter(letter)}
                >
                  <span className="tool__chip-glyph tool__chip-glyph--deva" lang="sa">
                    {letter.dewa}
                  </span>
                  <span className="tool__chip-sub">{letter.iast}</span>
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </main>
  )
}
