import type { ScriptTrack } from '../types/track'
import { getAllSimilarPairs } from '../data/similarLetters'
import './tools.css'

type Props = {
  track: ScriptTrack
  onBack: () => void
  backLabel?: string
}

export function SimilarPage({ track, onBack, backLabel = '← 학습' }: Props) {
  const pairs = getAllSimilarPairs()
  const glyphClass =
    track === 'sanskrit' ? 'tool__chip-glyph--deva' : 'tool__chip-glyph--siddham'

  return (
    <main className="tool">
      <header className="tool__bar">
        <button type="button" className="tool__back motion-press" onClick={onBack}>
          {backLabel}
        </button>
        <h1>유사 글자 대비</h1>
      </header>
      <p className="tool__lead">헷갈리기 쉬운 쌍을 나란히 보고 차이를 익히세요.</p>

      {pairs.map(({ a, b, reason }) => (
        <section key={`${a.id}-${b.id}`} className="tool__block">
          <p className="tool__meta">{reason}</p>
          <div className="tool__pair">
            <div className={`tool__pair-glyph ${glyphClass}`} lang="sa">
              {track === 'sanskrit' ? a.dewa : a.siddham}
              <div className="tool__chip-sub">{a.iast}</div>
            </div>
            <span className="tool__pair-vs">vs</span>
            <div className={`tool__pair-glyph ${glyphClass}`} lang="sa">
              {track === 'sanskrit' ? b.dewa : b.siddham}
              <div className="tool__chip-sub">{b.iast}</div>
            </div>
          </div>
        </section>
      ))}
    </main>
  )
}
