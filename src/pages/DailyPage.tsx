import type { Letter } from '../data/letters'
import type { ScriptTrack } from '../types/track'
import {
  getDailyCourse,
  markDailyDone,
} from '../lib/learnerStore'
import './tools.css'

type Props = {
  track: ScriptTrack
  onBack: () => void
  backLabel?: string
  onOpenLetter: (letter: Letter) => void
}

export function DailyPage({ track, onBack, backLabel = '← 학습', onOpenLetter }: Props) {
  const course = getDailyCourse(track, 5)
  const done = new Set(course.doneIds)
  const glyphClass =
    track === 'sanskrit' ? 'tool__chip-glyph--deva' : 'tool__chip-glyph--siddham'

  return (
    <main className="tool">
      <header className="tool__bar">
        <button type="button" className="tool__back motion-press" onClick={onBack}>
          {backLabel}
        </button>
        <h1>오늘 학습</h1>
      </header>
      <p className="tool__lead">
        오늘({course.date}) 추천 글자 {course.letters.length}개입니다. 눌러서 보고·써 보세요.
      </p>
      <section className="tool__block">
        <h2>
          진행 {done.size}/{course.letters.length}
        </h2>
        <div className="tool__row">
          {course.letters.map((letter) => (
            <button
              key={letter.id}
              type="button"
              className={`tool__chip motion-press ${done.has(letter.id) ? 'is-done' : ''}`}
              onClick={() => {
                markDailyDone(track, letter.id)
                onOpenLetter(letter)
              }}
            >
              <span
                className={`tool__chip-glyph ${glyphClass}`}
                lang="sa"
              >
                {track === 'sanskrit' ? letter.dewa : letter.siddham}
              </span>
              <span className="tool__chip-sub">{letter.iast}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}
