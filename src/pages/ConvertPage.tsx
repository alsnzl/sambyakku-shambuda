import { useState } from 'react'
import { convertIastInput, lookupByIastFragment } from '../lib/iastConvert'
import './tools.css'

type Props = {
  onBack: () => void
  backLabel?: string
}

export function ConvertPage({ onBack, backLabel = '← 학습' }: Props) {
  const [text, setText] = useState('namaḥ')
  const result = convertIastInput(text)
  const hints = lookupByIastFragment(text).slice(0, 8)

  return (
    <main className="tool">
      <header className="tool__bar">
        <button type="button" className="tool__back motion-press" onClick={onBack}>
          {backLabel}
        </button>
        <h1>IAST 변환</h1>
      </header>
      <p className="tool__lead">
        로마자(IAST 또는 비슷하게)를 입력하면 데바나가리·실담 미리보기를 보여 줍니다. 학습용
        간단 변환입니다.
      </p>

      <section className="tool__block">
        <h2>입력</h2>
        <input
          className="tool__input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="예: śāntiḥ, buddha, ka"
          spellCheck={false}
          autoCapitalize="off"
        />
        <p className="tool__meta">정규화: {result.normalized || '—'}</p>
        <div className="tool__output tool__output--deva" lang="sa">
          {result.dewa || '…'}
        </div>
        <div className="tool__output tool__output--siddham" lang="sa">
          {result.dewa || '…'}
        </div>
      </section>

      <section className="tool__block">
        <h2>토큰</h2>
        <div className="tool__row">
          {result.hits.map((h, i) => (
            <div key={`${h.token}-${i}`} className="tool__chip">
              <span className="tool__chip-glyph tool__chip-glyph--deva" lang="sa">
                {h.dewa}
              </span>
              <span className="tool__chip-sub">{h.iast}</span>
            </div>
          ))}
        </div>
      </section>

      {hints.length > 0 && (
        <section className="tool__block">
          <h2>비슷한 자모</h2>
          <div className="tool__row">
            {hints.map((l) => (
              <div key={l.id} className="tool__chip">
                <span className="tool__chip-glyph tool__chip-glyph--deva" lang="sa">
                  {l.dewa}
                </span>
                <span className="tool__chip-sub">{l.iast}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
