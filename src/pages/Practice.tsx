import { useMemo, useState } from 'react'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { createQuiz, type QuizQuestion } from '../lib/quiz'
import { recordQuizResult } from '../lib/learnerStore'
import { MotionPage } from '../components/MotionPage'
import type { ScriptTrack } from '../types/track'
import { trackMeta } from '../types/track'
import './Practice.css'

type Props = {
  track: ScriptTrack
  onBack: () => void
}

type Phase = 'ready' | 'quiz' | 'done'

function scriptClass(kind: 'deva' | 'siddham' | 'latin', role: 'prompt' | 'choice') {
  if (kind === 'latin') return role === 'prompt' ? 'practice__prompt' : undefined
  if (kind === 'deva') {
    return role === 'prompt'
      ? 'practice__prompt practice__prompt--deva'
      : 'practice__choice-script practice__choice-script--deva'
  }
  return role === 'prompt'
    ? 'practice__prompt practice__prompt--siddham'
    : 'practice__choice-script practice__choice-script--siddham'
}

export function Practice({ track, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const meta = trackMeta[track]

  const current = questions[index]
  const progress = useMemo(() => {
    if (!questions.length) return 0
    return Math.round((index / questions.length) * 100)
  }, [index, questions.length])

  function start() {
    setQuestions(createQuiz(track, 10))
    setIndex(0)
    setScore(0)
    setSelected(null)
    setLocked(false)
    setPhase('quiz')
  }

  async function choose(choice: string) {
    if (!current || locked) return
    setSelected(choice)
    setLocked(true)
    const correct = choice === current.answer
    if (correct) {
      setScore((s) => s + 1)
      try {
        await Haptics.impact({ style: ImpactStyle.Light })
      } catch {
        // browser may not support haptics
      }
    }
    recordQuizResult(track, current.letter.id, correct)
  }

  function next() {
    if (index + 1 >= questions.length) {
      setPhase('done')
      return
    }
    setIndex((i) => i + 1)
    setSelected(null)
    setLocked(false)
  }

  if (phase === 'ready') {
    return (
      <MotionPage motionKey="ready" variant="fade-up">
        <main className="practice">
          <header className="practice__bar">
            <button
              type="button"
              className="practice__back motion-press"
              onClick={onBack}
            >
              ← 홈
            </button>
            <h1>{meta.title} 연습</h1>
          </header>
          <section className="practice__ready motion-sheet__panel">
            <h2>{meta.scriptLabel} 퀴즈</h2>
            <p>
              {meta.scriptLabel} 글자와 로마자(IAST)·한글 힌트를 맞춰 봅니다.
              10문제로 구성됩니다.
            </p>
            <button type="button" className="practice__cta motion-press" onClick={start}>
              시작하기
            </button>
          </section>
        </main>
      </MotionPage>
    )
  }

  if (phase === 'done') {
    return (
      <MotionPage motionKey="done" variant="pop">
        <main className="practice">
          <header className="practice__bar">
            <button
              type="button"
              className="practice__back motion-press"
              onClick={onBack}
            >
              ← 홈
            </button>
            <h1>결과</h1>
          </header>
          <section className="practice__ready practice__result">
            <h2>
              {score} / {questions.length}
            </h2>
            <p>
              {score >= 8
                ? `훌륭해요. ${meta.title} 자모가 잘 익숙해지고 있어요.`
                : score >= 5
                  ? '좋아요. 틀린 글자를 학습에서 다시 확인해 보세요.'
                  : '괜찮아요. 모음·계열을 나눠 천천히 복습해 보세요.'}
            </p>
            <button type="button" className="practice__cta motion-press" onClick={start}>
              다시 풀기
            </button>
            <button
              type="button"
              className="practice__secondary motion-press"
              onClick={onBack}
            >
              홈으로
            </button>
          </section>
        </main>
      </MotionPage>
    )
  }

  if (!current) return null

  return (
    <main className="practice">
      <header className="practice__bar">
        <button type="button" className="practice__back motion-press" onClick={onBack}>
          ← 홈
        </button>
        <h1>
          {index + 1} / {questions.length}
        </h1>
      </header>

      <div className="practice__progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      <MotionPage motionKey={current.id} variant="slide-left">
        <div className="practice__prompt-block">
          <p className="practice__mode">{current.modeLabel}</p>
          <p
            className={scriptClass(current.promptScript, 'prompt')}
            lang={current.promptScript === 'latin' ? undefined : 'sa'}
          >
            {current.prompt}
          </p>
        </div>

        <ul className="practice__choices motion-stagger">
          {current.choices.map((choice) => {
            let state = ''
            let flash = ''
            if (selected) {
              if (choice === current.answer) {
                state = 'is-correct'
                flash = 'motion-flash-correct'
              } else if (choice === selected) {
                state = 'is-wrong'
                flash = 'motion-flash-wrong'
              }
            }
            return (
              <li key={choice}>
                <button
                  type="button"
                  className={`practice__choice motion-press ${state} ${flash}`}
                  onClick={() => choose(choice)}
                  disabled={locked}
                >
                  <span
                    className={scriptClass(current.choiceScript, 'choice')}
                    lang={current.choiceScript === 'latin' ? undefined : 'sa'}
                  >
                    {choice}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </MotionPage>

      {selected ? (
        <button
          type="button"
          className="practice__cta motion-press practice__cta--enter"
          onClick={next}
        >
          {index + 1 >= questions.length ? '결과 보기' : '다음'}
        </button>
      ) : null}
    </main>
  )
}
