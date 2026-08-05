import { MANTRA_SAMPLES } from '../data/mantras'
import { speakIast } from '../lib/audio'
import './tools.css'

type Props = {
  onBack: () => void
}

export function MantrasPage({ onBack }: Props) {
  return (
    <main className="tool">
      <header className="tool__bar">
        <button type="button" className="tool__back motion-press" onClick={onBack}>
          ← 홈
        </button>
        <h1>짧은 구절 맛보기</h1>
      </header>
      <p className="tool__lead">
        배운 자모를 이어서 읽어 보는 짧은 예시입니다. 독송 지도가 아니라 글자 연결 연습용입니다.
      </p>

      {MANTRA_SAMPLES.map((m) => (
        <section key={m.id} className="tool__block">
          <h2>{m.titleKo}</h2>
          <p className="tool__meta">{m.iast}</p>
          <div className="tool__output tool__output--deva" lang="sa">
            {m.dewa}
          </div>
          {m.siddham ? (
            <div className="tool__output tool__output--siddham" lang="sa">
              {m.siddham}
            </div>
          ) : null}
          <p className="tool__lead" style={{ marginBottom: '0.65rem' }}>
            {m.meaningKo}
          </p>
          {m.note ? <p className="tool__meta">{m.note}</p> : null}
          <button
            type="button"
            className="tool__btn tool__btn--primary motion-press"
            onClick={() => speakIast(m.iast)}
          >
            발음 들어보기
          </button>
        </section>
      ))}
    </main>
  )
}
