import { letters, type Letter } from '../data/letters'
import { glyphForTrack } from './scriptDisplay'
import type { ScriptTrack } from '../types/track'

export type QuizMode = 'glyph-to-iast' | 'iast-to-glyph'

export type PromptScript = 'deva' | 'siddham' | 'latin'
export type ChoiceScript = 'deva' | 'siddham' | 'latin'

export type QuizQuestion = {
  id: string
  mode: QuizMode
  letter: Letter
  prompt: string
  promptScript: PromptScript
  choices: string[]
  choiceScript: ChoiceScript
  answer: string
  modeLabel: string
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function glyphOf(letter: Letter, track: ScriptTrack): string {
  return glyphForTrack(letter, track)
}

function scriptOf(track: ScriptTrack): 'deva' | 'siddham' {
  return track === 'sanskrit' ? 'deva' : 'siddham'
}

function iastLabel(letter: Letter): string {
  return `${letter.iast} · ${letter.hangulHint}`
}

function buildQuestion(
  letter: Letter,
  mode: QuizMode,
  track: ScriptTrack,
  index: number,
): QuizQuestion {
  const glyph = glyphOf(letter, track)
  const script = scriptOf(track)
  const scriptName = track === 'sanskrit' ? '데바나가리' : 'Siddhaṃ'

  if (mode === 'glyph-to-iast') {
    const answer = iastLabel(letter)
    const distractors = shuffle(letters.filter((l) => l.id !== letter.id))
      .slice(0, 3)
      .map(iastLabel)
    return {
      id: `${track}-${letter.id}-${mode}-${index}`,
      mode,
      letter,
      prompt: glyph,
      promptScript: script,
      choices: shuffle([answer, ...distractors]),
      choiceScript: 'latin',
      answer,
      modeLabel: `${scriptName} → 로마자·한글`,
    }
  }

  const answer = glyph
  const distractors = shuffle(letters.filter((l) => l.id !== letter.id))
    .slice(0, 3)
    .map((l) => glyphOf(l, track))
  return {
    id: `${track}-${letter.id}-${mode}-${index}`,
    mode,
    letter,
    prompt: `${letter.iast} (${letter.hangulHint})`,
    promptScript: 'latin',
    choices: shuffle([answer, ...distractors]),
    choiceScript: script,
    answer,
      modeLabel: `로마자·한글 → ${scriptName}`,
  }
}

export type QuizDirection = 'glyph-to-iast' | 'iast-to-glyph' | 'mixed'

/** 10 | 20 | all letters in the dataset. */
export type QuizCountMode = 10 | 20 | 'all'

export const QUIZ_LETTER_TOTAL = letters.length

export function resolveQuizCount(mode: QuizCountMode): number {
  return mode === 'all' ? letters.length : Math.min(mode, letters.length)
}

export function createQuiz(
  track: ScriptTrack,
  count = 10,
  direction: QuizDirection = 'mixed',
): QuizQuestion[] {
  const selected = shuffle(letters).slice(0, Math.min(count, letters.length))
  return selected.map((letter, index) => {
    const mode: QuizMode =
      direction === 'mixed'
        ? index % 2 === 0
          ? 'glyph-to-iast'
          : 'iast-to-glyph'
        : direction
    return buildQuestion(letter, mode, track, index)
  })
}
