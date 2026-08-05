import { MANTRA_SAMPLES } from '../data/mantras'
import { mantraUnlockStage } from '../data/pathStages'
import { isMantraUnlocked } from '../lib/pathProgress'
import { speakIast } from '../lib/audio'
import './tools.css'

type Props = {
  onBack: () => void
  backLabel?: string
}

export function MantrasPage({ onBack, backLabel = '← 학습' }: Props) {
  return (
    <main className="tool">
      <header className="tool__bar">
        <button type="button" className="tool__back motion-press" onClick={onBack}>
          {backLabel}
        </button>
        <h1>짧은 구절 맛보기</h1>
      </header>
      <p className="tool__lead">
        수행 단계가 열릴 때마다 짧은 구절이 해금됩니다. 독송 지도가 아니라 글자 연결 연습용입니다.
      </p>

      {MANTRA_SAMPLES.map((m) => {
        const open = isMantraUnlocked(m.id)
        const need = mantraUnlockStage(m.id)
        return (
          <section key={m.id} className={`tool__block ${open ? '' : 'is-dim'}`}>
            <h2>
              {m.titleKo}
              {!open && need ? (
                <span className="tool__meta" style={{ marginLeft: '0.45rem' }}>
                  · {need.nameKo}에서 열림
                </span>
              ) : null}
            </h2>
            {open ? (
              <>
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
              </>
            ) : (
              <p className="tool__empty">아직 잠겨 있습니다. 자모를 익혀 단계를 열어 보세요.</p>
            )}
          </section>
        )
      })}
    </main>
  )
}
