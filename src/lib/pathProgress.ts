import { letters } from '../data/letters'
import { PATH_STAGES, type PathStageDef, type PathStageId } from '../data/pathStages'
import {
  defaultPathState,
  getProgressSummary,
  loadLearner,
  type JournalDay,
  type LearnerPathState,
} from './learnerStore'

export type PathSnapshot = {
  path: LearnerPathState
  stage: PathStageDef
  stageIndex: number
  reached: PathStageId[]
  next: PathStageDef | null
  petals: boolean[]
  practicedToday: boolean
  balanceTip: string | null
  journalToday: JournalDay
  dueHint: string | null
}

function emptyJournal(): JournalDay {
  return { merit: 0, quiz: 0, write: 0, review: 0, daily: 0 }
}

function countLearned(
  track: 'sanskrit' | 'siddham',
  pred: (id: string, group: string) => boolean,
) {
  const map = loadLearner().tracks[track] ?? {}
  let n = 0
  for (const l of letters) {
    if (!pred(l.id, l.group)) continue
    if (map[l.id]?.learned) n += 1
  }
  return n
}

function countGroupLearned(track: 'sanskrit' | 'siddham', group: string) {
  const total = letters.filter((l) => l.group === group).length
  const learned = countLearned(track, (_id, g) => g === group)
  return { learned, total }
}

function countWriteSamples(track: 'sanskrit' | 'siddham') {
  const map = loadLearner().tracks[track] ?? {}
  let n = 0
  for (const p of Object.values(map)) {
    if (p.writeBest > 0) n += 1
  }
  return n
}

function quizAttempts(): number {
  const state = loadLearner()
  let total = 0
  for (const track of ['sanskrit', 'siddham'] as const) {
    const map = state.tracks[track] ?? {}
    for (const p of Object.values(map)) {
      total += p.quizCorrect + p.quizWrong
    }
  }
  return total
}

function stageReached(index: number, path: LearnerPathState): boolean {
  const sa = getProgressSummary('sanskrit')
  const si = getProgressSummary('siddham')
  const bestLearned = Math.max(sa.learned, si.learned)
  const vowelsSa = countGroupLearned('sanskrit', 'svara')
  const vowelsSi = countGroupLearned('siddham', 'svara')
  const vowelsDone =
    vowelsSa.learned >= vowelsSa.total || vowelsSi.learned >= vowelsSi.total
  const consonantsLearned = Math.max(
    countLearned('sanskrit', (_id, g) => g !== 'svara'),
    countLearned('siddham', (_id, g) => g !== 'svara'),
  )
  const writeSamples = Math.max(
    countWriteSamples('sanskrit'),
    countWriteSamples('siddham'),
  )
  const quizOk =
    quizAttempts() >= 20 &&
    (sa.quizAccuracy >= 70 || si.quizAccuracy >= 70 || combinedQuizAccuracy() >= 70)

  switch (index) {
    case 0:
      return sa.seen + si.seen >= 1 || path.merit > 0
    case 1:
      return vowelsDone
    case 2:
      return path.streak >= 7
    case 3:
      return consonantsLearned >= 25 || bestLearned >= 30
    case 4:
      return writeSamples >= 5 && (sa.avgWrite >= 70 || si.avgWrite >= 70)
    case 5:
      return quizOk
    case 6:
      return sa.learned >= 30 && si.learned >= 30
    default:
      return false
  }
}

function combinedQuizAccuracy(): number {
  const state = loadLearner()
  let c = 0
  let w = 0
  for (const track of ['sanskrit', 'siddham'] as const) {
    const map = state.tracks[track] ?? {}
    for (const p of Object.values(map)) {
      c += p.quizCorrect
      w += p.quizWrong
    }
  }
  const t = c + w
  return t ? Math.round((c / t) * 100) : 0
}

function balanceTip(): string | null {
  const sa = getProgressSummary('sanskrit')
  const si = getProgressSummary('siddham')
  if (sa.learned === 0 && si.learned === 0) return null
  if (sa.learned >= 10 && si.learned === 0) {
    return '산스크리트만 익히고 있어요. 실담도 조금 열어 양손 합장처럼 맞춰 보세요.'
  }
  if (si.learned >= 10 && sa.learned === 0) {
    return '실담만 익히고 있어요. 산스크리트도 함께 보면 균형이 잡힙니다.'
  }
  if (sa.learned >= 15 && si.learned > 0 && sa.learned >= si.learned * 3) {
    return '실담 쪽을 조금 더 보면 두 문자가 고르게 자랍니다.'
  }
  if (si.learned >= 15 && sa.learned > 0 && si.learned >= sa.learned * 3) {
    return '산스크리트 쪽을 조금 더 보면 두 문자가 고르게 자랍니다.'
  }
  return null
}

export function getCurrentStageIndex(
  path = loadLearner().path ?? defaultPathState(),
): number {
  let highest = -1
  for (let i = 0; i < PATH_STAGES.length; i++) {
    if (stageReached(i, path)) highest = i
  }
  return highest
}

export function isMantraUnlocked(mantraId: string): boolean {
  const path = loadLearner().path ?? defaultPathState()
  for (const stage of PATH_STAGES) {
    if (stage.unlockMantraIds.includes(mantraId)) {
      return stageReached(stage.index, path)
    }
  }
  return false
}

export function getPathSnapshot(): PathSnapshot {
  const state = loadLearner()
  const path = { ...defaultPathState(), ...state.path }
  const petals = PATH_STAGES.map((_, i) => stageReached(i, path))
  const highest = getCurrentStageIndex(path)
  const stageIndex = Math.max(0, highest)
  const stage =
    highest < 0
      ? {
          ...PATH_STAGES[0],
          nameKo: '출발',
          verseKo: '글자를 하나 열면 초발심의 문이 열립니다.',
          hintKo: PATH_STAGES[0].hintKo,
        }
      : PATH_STAGES[stageIndex]
  const reached = PATH_STAGES.filter((_, i) => petals[i]).map((s) => s.id)
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const practicedToday = path.lastActiveDate === todayKey
  const journalToday = path.journal[todayKey] ?? emptyJournal()
  const sa = getProgressSummary('sanskrit')
  const si = getProgressSummary('siddham')
  const due = sa.due + si.due
  const dueHint =
    !practicedToday && due > 0
      ? `오늘 복습 인연이 ${due}장 남아 있습니다.`
      : !practicedToday
        ? '오늘 아직 수행 기록이 없습니다. 글자 하나만 열어 보세요.'
        : null

  return {
    path,
    stage,
    stageIndex: highest < 0 ? -1 : stageIndex,
    reached,
    next: PATH_STAGES.find((s) => !petals[s.index]) ?? null,
    petals,
    practicedToday,
    balanceTip: balanceTip(),
    journalToday,
    dueHint,
  }
}
