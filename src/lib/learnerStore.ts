import { letters, type Letter } from '../data/letters'
import type { ScriptTrack } from '../types/track'

const STORAGE_KEY = 'sambyakku-learner-v1'

export type SrsCard = {
  ease: number
  interval: number
  repetitions: number
  dueAt: string
  lastResult?: 'again' | 'hard' | 'good' | 'easy'
}

export type LetterProgress = {
  seen: boolean
  learned: boolean
  quizCorrect: number
  quizWrong: number
  writeBest: number
  lastSeenAt?: string
  srs: SrsCard
}

export type TrackProgress = Record<string, LetterProgress>

export type JournalDay = {
  merit: number
  quiz: number
  write: number
  review: number
  daily: number
}

export type LearnerPathState = {
  merit: number
  streak: number
  lastActiveDate: string | null
  journal: Record<string, JournalDay>
}

export type LearnerState = {
  favorites: Partial<Record<ScriptTrack, string[]>>
  tracks: Partial<Record<ScriptTrack, TrackProgress>>
  daily: Partial<
    Record<
      ScriptTrack,
      {
        date: string
        letterIds: string[]
        doneIds: string[]
      }
    >
  >
  path?: LearnerPathState
}

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function yesterdayKey(from = todayKey()): string {
  const d = new Date(`${from}T12:00:00`)
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function defaultSrs(): SrsCard {
  return {
    ease: 2.5,
    interval: 0,
    repetitions: 0,
    dueAt: new Date(0).toISOString(),
  }
}

export function defaultLetterProgress(): LetterProgress {
  return {
    seen: false,
    learned: false,
    quizCorrect: 0,
    quizWrong: 0,
    writeBest: 0,
    srs: defaultSrs(),
  }
}

export function defaultPathState(): LearnerPathState {
  return {
    merit: 0,
    streak: 0,
    lastActiveDate: null,
    journal: {},
  }
}

function emptyJournal(): JournalDay {
  return { merit: 0, quiz: 0, write: 0, review: 0, daily: 0 }
}

function emptyState(): LearnerState {
  return { favorites: {}, tracks: {}, daily: {}, path: defaultPathState() }
}

export function loadLearner(): LearnerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as LearnerState
    return {
      ...emptyState(),
      ...parsed,
      path: { ...defaultPathState(), ...parsed.path },
    }
  } catch {
    return emptyState()
  }
}

function saveLearner(state: LearnerState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function saveLearnerPath(path: LearnerPathState) {
  const state = loadLearner()
  state.path = path
  saveLearner(state)
}

export type MeritKind = 'quiz' | 'write' | 'review' | 'daily'

export function grantMerit(kind: MeritKind, amount: number) {
  if (amount <= 0) return
  const state = loadLearner()
  const path = { ...defaultPathState(), ...state.path }
  const today = todayKey()
  const yday = yesterdayKey(today)

  if (path.lastActiveDate === today) {
    // keep streak
  } else if (path.lastActiveDate === yday) {
    path.streak += 1
  } else {
    path.streak = 1
  }
  path.lastActiveDate = today
  path.merit += amount

  const day = path.journal[today] ?? emptyJournal()
  day.merit += amount
  day[kind] += 1
  path.journal[today] = day

  const keys = Object.keys(path.journal).sort()
  if (keys.length > 40) {
    for (const k of keys.slice(0, keys.length - 40)) delete path.journal[k]
  }

  state.path = path
  saveLearner(state)
}

export function getLetterProgress(
  track: ScriptTrack,
  letterId: string,
): LetterProgress {
  const state = loadLearner()
  return state.tracks[track]?.[letterId] ?? defaultLetterProgress()
}

function updateLetter(
  track: ScriptTrack,
  letterId: string,
  updater: (prev: LetterProgress) => LetterProgress,
) {
  const state = loadLearner()
  if (!state.tracks[track]) state.tracks[track] = {}
  const prev = state.tracks[track]![letterId] ?? defaultLetterProgress()
  state.tracks[track]![letterId] = updater(prev)
  saveLearner(state)
  return state.tracks[track]![letterId]
}

export function markLetterSeen(track: ScriptTrack, letterId: string) {
  return updateLetter(track, letterId, (p) => ({
    ...p,
    seen: true,
    lastSeenAt: new Date().toISOString(),
  }))
}

export function markLetterLearned(track: ScriptTrack, letterId: string) {
  return updateLetter(track, letterId, (p) => ({
    ...p,
    seen: true,
    learned: true,
    lastSeenAt: new Date().toISOString(),
  }))
}

function applySrs(
  track: ScriptTrack,
  letterId: string,
  grade: 'again' | 'hard' | 'good' | 'easy',
) {
  return updateLetter(track, letterId, (p) => {
    const srs = { ...p.srs }
    const now = Date.now()

    if (grade === 'again') {
      srs.repetitions = 0
      srs.interval = 0
      srs.dueAt = new Date(now + 10 * 60 * 1000).toISOString()
      srs.ease = Math.max(1.3, srs.ease - 0.2)
    } else {
      if (srs.repetitions === 0) srs.interval = grade === 'easy' ? 3 : 1
      else if (srs.repetitions === 1) srs.interval = grade === 'easy' ? 6 : 3
      else {
        const mult = grade === 'hard' ? 1.2 : grade === 'easy' ? 1.4 : 1
        srs.interval = Math.round(srs.interval * srs.ease * mult)
      }
      srs.repetitions += 1
      if (grade === 'hard') srs.ease = Math.max(1.3, srs.ease - 0.15)
      if (grade === 'easy') srs.ease += 0.15
      srs.dueAt = new Date(now + srs.interval * 24 * 60 * 60 * 1000).toISOString()
    }

    srs.lastResult = grade
    return {
      ...p,
      seen: true,
      learned: p.learned || grade === 'good' || grade === 'easy',
      srs,
      lastSeenAt: new Date().toISOString(),
    }
  })
}

export function recordQuizResult(
  track: ScriptTrack,
  letterId: string,
  correct: boolean,
) {
  updateLetter(track, letterId, (p) => ({
    ...p,
    seen: true,
    quizCorrect: p.quizCorrect + (correct ? 1 : 0),
    quizWrong: p.quizWrong + (correct ? 0 : 1),
    lastSeenAt: new Date().toISOString(),
  }))
  applySrs(track, letterId, correct ? 'good' : 'again')
  grantMerit('quiz', correct ? 3 : 1)
}

export function recordWriteScore(
  track: ScriptTrack,
  letterId: string,
  score: number,
) {
  const result = updateLetter(track, letterId, (p) => ({
    ...p,
    seen: true,
    writeBest: Math.max(p.writeBest, score),
    learned: p.learned || score >= 70,
    lastSeenAt: new Date().toISOString(),
  }))
  grantMerit('write', Math.max(1, Math.round(score / 20)))
  return result
}

/** Simple SM-2 style intervals (days). */
export function reviewSrs(
  track: ScriptTrack,
  letterId: string,
  grade: 'again' | 'hard' | 'good' | 'easy',
) {
  const result = applySrs(track, letterId, grade)
  const merit =
    grade === 'easy' ? 3 : grade === 'good' ? 2 : grade === 'hard' ? 1 : 0
  if (merit) grantMerit('review', merit)
  return result
}

export function getDueLetters(track: ScriptTrack, limit = 20): Letter[] {
  const state = loadLearner()
  const now = Date.now()
  const map = state.tracks[track] ?? {}
  const due = letters
    .map((l) => {
      const p = map[l.id] ?? defaultLetterProgress()
      return { letter: l, due: new Date(p.srs.dueAt).getTime(), seen: p.seen }
    })
    .filter((x) => x.due <= now)
    .sort((a, b) => a.due - b.due)

  if (due.length === 0) {
    const unseen = letters.filter((l) => !map[l.id]?.seen)
    return (unseen.length ? unseen : letters).slice(0, limit)
  }
  return due.slice(0, limit).map((x) => x.letter)
}

export function getWeakLetters(track: ScriptTrack, limit = 20): Letter[] {
  const state = loadLearner()
  const map = state.tracks[track] ?? {}
  return [...letters]
    .map((l) => {
      const p = map[l.id] ?? defaultLetterProgress()
      const total = p.quizCorrect + p.quizWrong
      const rate = total === 0 ? 0.5 : p.quizCorrect / total
      const score = rate * 100 + p.writeBest * 0.2
      return { letter: l, score, total, wrong: p.quizWrong }
    })
    .filter((x) => x.wrong > 0 || (x.total > 0 && x.score < 70))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((x) => x.letter)
}

export function toggleFavorite(track: ScriptTrack, letterId: string): boolean {
  const state = loadLearner()
  const list = new Set(state.favorites[track] ?? [])
  if (list.has(letterId)) list.delete(letterId)
  else list.add(letterId)
  state.favorites[track] = [...list]
  saveLearner(state)
  return list.has(letterId)
}

export function isFavorite(track: ScriptTrack, letterId: string): boolean {
  return (loadLearner().favorites[track] ?? []).includes(letterId)
}

export function getFavorites(track: ScriptTrack): Letter[] {
  const ids = loadLearner().favorites[track] ?? []
  return ids
    .map((id) => letters.find((l) => l.id === id))
    .filter((l): l is Letter => Boolean(l))
}

function hashDay(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h
}

export function getDailyCourse(
  track: ScriptTrack,
  count = 5,
): { date: string; letters: Letter[]; doneIds: string[] } {
  const state = loadLearner()
  const date = todayKey()
  const existing = state.daily[track]
  if (existing?.date === date && existing.letterIds.length) {
    return {
      date,
      letters: existing.letterIds
        .map((id) => letters.find((l) => l.id === id))
        .filter((l): l is Letter => Boolean(l)),
      doneIds: existing.doneIds,
    }
  }

  const map = state.tracks[track] ?? {}
  const ranked = [...letters].sort((a, b) => {
    const pa = map[a.id]
    const pb = map[b.id]
    const sa = (pa?.learned ? 2 : 0) + (pa?.seen ? 1 : 0)
    const sb = (pb?.learned ? 2 : 0) + (pb?.seen ? 1 : 0)
    return sa - sb
  })

  const start = hashDay(`${date}-${track}`) % Math.max(1, ranked.length - count + 1)
  const picked = ranked.slice(start, start + count)
  const letterIds = picked.map((l) => l.id)
  state.daily[track] = { date, letterIds, doneIds: [] }
  saveLearner(state)
  return { date, letters: picked, doneIds: [] }
}

export function markDailyDone(track: ScriptTrack, letterId: string) {
  const state = loadLearner()
  const date = todayKey()
  const daily = state.daily[track]
  if (!daily || daily.date !== date) return
  const already = daily.doneIds.includes(letterId)
  if (!already) daily.doneIds.push(letterId)
  saveLearner(state)
  markLetterLearned(track, letterId)
  if (!already) grantMerit('daily', 2)
}

export type ProgressSummary = {
  total: number
  seen: number
  learned: number
  due: number
  favorites: number
  avgWrite: number
  quizAccuracy: number
}

export function getProgressSummary(track: ScriptTrack): ProgressSummary {
  const state = loadLearner()
  const map = state.tracks[track] ?? {}
  let seen = 0
  let learned = 0
  let due = 0
  let writeSum = 0
  let writeN = 0
  let correct = 0
  let wrong = 0
  const now = Date.now()

  for (const l of letters) {
    const p = map[l.id]
    if (!p) continue
    if (p.seen) seen += 1
    if (p.learned) learned += 1
    if (new Date(p.srs.dueAt).getTime() <= now && p.seen) due += 1
    if (p.writeBest > 0) {
      writeSum += p.writeBest
      writeN += 1
    }
    correct += p.quizCorrect
    wrong += p.quizWrong
  }

  const quizTotal = correct + wrong
  return {
    total: letters.length,
    seen,
    learned,
    due,
    favorites: (state.favorites[track] ?? []).length,
    avgWrite: writeN ? Math.round(writeSum / writeN) : 0,
    quizAccuracy: quizTotal ? Math.round((correct / quizTotal) * 100) : 0,
  }
}
