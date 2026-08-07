import { useMemo, useState } from 'react'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import {
  createQuiz,
  QUIZ_LETTER_TOTAL,
  resolveQuizCount,
  type QuizCountMode,
  type QuizDirection,
  type QuizQuestion,
} from '../lib/quiz'
import { recordQuizResult } from '../lib/learnerStore'
import { MotionPage } from '../components/MotionPage'
import { ScriptFontQuickBar } from '../components/ScriptFontQuickBar'
import { useScriptFontEpoch } from '../lib/useScriptFontEpoch'
import type { ScriptTrack } from '../types/track'
import { trackMeta } from '../types/track'
import './Practice.css'

type Props = {
  track: ScriptTrack
  onBack: () => void
  backLabel?: string
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

const DIRECTION_OPTIONS: {
  id: QuizDirection
  title: string
  body: (scriptLabel: string) => string
}[] = [
  {
    id: 'glyph-to-iast',
    title: '글자 → 로마자·한글',
    body: (scriptLabel) => `${scriptLabel} 글자를 보고 로마자·한글을 고릅니다.`,
  },
  {
    id: 'iast-to-glyph',
    title: '로마자·한글 → 글자',
    body: (scriptLabel) => `로마자·한글을 보고 ${scriptLabel} 글자를 고릅니다.`,
  },
  {
    id: 'mixed',
    title: '섞어서',
    body: () => '두 방향을 번갈아 출제합니다.',
  },
]

const COUNT_OPTIONS: { id: QuizCountMode; label: string }[] = [
  { id: 10, label: '10문제' },
  { id: 20, label: '20문제' },
  { id: 'all', label: `전체 ${QUIZ_LETTER_TOTAL}자` },
]

export function Practice({ track, onBack, backLabel = '← 학습' }: Props) {
  const fontEpoch = useScriptFontEpoch()
  const [phase, setPhase] = useState<Phase>('ready')
  const [direction, setDirection] = useState<QuizDirection>('glyph-to-iast')
  const [countMode, setCountMode] = useState<QuizCountMode>(10)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const meta = trackMeta[track]
  const quizSize = resolveQuizCount(countMode)

  const current = questions[index]
  const progress = useMemo(() => {
    if (!questions.length) return 0
    return Math.round((index / questions.length) * 100)
  }, [index, questions.length])

  function start(nextDirection = direction, nextCount = countMode) {
    setDirection(nextDirection)
    setCountMode(nextCount)
    setQuestions(createQuiz(track, resolveQuizCount(nextCount), nextDirection))
    setIndex(0)
    setScore(0)
    setSelected(null)
    setLocked(false)
    setPhase('quiz')
  }

  /** Switch direction mid-quiz without resetting progress. */
  function switchDirection(next: QuizDirection) {
    if (next === direction) return
    setDirection(next)
    const nextQuestions = createQuiz(track, resolveQuizCount(countMode), next)
    setQuestions(nextQuestions)
    setIndex((i) => Math.min(i, nextQuestions.length - 1))
    setSelected(null)
    setLocked(false)
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
              {backLabel}
            </button>
            <h1>{meta.title} 연습</h1>
          </header>
          <ScriptFontQuickBar track={track} />
          <section className="practice__ready motion-sheet__panel">
            <h2>{meta.scriptLabel} 퀴즈</h2>
            <p>문제 수와 출제 방향을 고른 뒤 시작하세요.</p>

            <p className="practice__section-label">문제 수</p>
            <div className="practice__switch practice__switch--ready" role="group" aria-label="문제 수">
              {COUNT_OPTIONS.map((opt) => (
                <button
                  key={String(opt.id)}
                  type="button"
                  className={`practice__switch-btn motion-press ${countMode === opt.id ? 'is-active' : ''}`}
                  onClick={() => setCountMode(opt.id)}
                  aria-pressed={countMode === opt.id}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <p className="practice__section-label">출제 방향</p>
            <div className="practice__modes" role="group" aria-label="출제 방향">
              {DIRECTION_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`practice__mode-card motion-press ${direction === opt.id ? 'is-active' : ''}`}
                  onClick={() => setDirection(opt.id)}
                  aria-pressed={direction === opt.id}
                >
                  <span className="practice__mode-card-title">{opt.title}</span>
                  <span className="practice__mode-card-body">{opt.body(meta.scriptLabel)}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="practice__cta motion-press"
              onClick={() => start(direction, countMode)}
            >
              {countMode === 'all' ? `전체 ${quizSize}자 시작` : `${quizSize}문제 시작`}
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
              {backLabel}
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
            <button
              type="button"
              className="practice__cta motion-press"
              onClick={() => start(direction, countMode)}
            >
              다시 풀기
            </button>
            <button
              type="button"
              className="practice__secondary motion-press"
              onClick={() => setPhase('ready')}
            >
              방향 바꾸기
            </button>
            <button type="button" className="practice__secondary motion-press" onClick={onBack}>
              돌아가기
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
          {backLabel}
        </button>
        <h1>
          {index + 1} / {questions.length}
        </h1>
      </header>

      <ScriptFontQuickBar track={track} />

      <div className="practice__progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="practice__switch" role="group" aria-label="출제 방향 전환">
        {(
          [
            ['glyph-to-iast', '글자→로마'],
            ['iast-to-glyph', '로마→글자'],
            ['mixed', '섞기'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`practice__switch-btn motion-press ${direction === id ? 'is-active' : ''}`}
            onClick={() => switchDirection(id)}
            aria-pressed={direction === id}
          >
            {label}
          </button>
        ))}
      </div>

      <MotionPage motionKey={`${direction}-${current.id}`} variant="slide-left">
        <div key={`prompt-${fontEpoch}`} className="practice__prompt-block">
          <p className="practice__mode">{current.modeLabel}</p>
          <p
            className={scriptClass(current.promptScript, 'prompt')}
            lang={current.promptScript === 'latin' ? undefined : 'sa'}
          >
            {current.prompt}
          </p>
        </div>

        <ul key={`choices-${fontEpoch}`} className="practice__choices motion-stagger">
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
