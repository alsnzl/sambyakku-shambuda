import { letters, type Letter } from '../data/letters'
import { MANTRA_SAMPLES } from '../data/mantras'
import { PATH_STAGES } from '../data/pathStages'
import { getEffectiveHangulHint } from './hangulHintsStore'
import {
  getDailyCourse,
  getProgressSummary,
} from './learnerStore'
import { getPathSnapshot, isMantraUnlocked } from './pathProgress'
import type { ScriptTrack } from '../types/track'

export type HomeFeedItem = {
  id: string
  kicker: string
  title: string
  body: string
  glyph?: string
  script?: 'deva' | 'siddham'
  target:
    | { type: 'global'; mode: 'path' | 'mantras' | 'tracks' | 'about' }
    | { type: 'track'; track: ScriptTrack; mode: 'daily' | 'review' | 'learn'; letterId?: string }
}

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function hashDay(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h
}

function letterOfDay(): Letter {
  const i = hashDay(todayKey()) % letters.length
  return letters[i]
}

/** Soft chronological-feeling tips for the home feed (3–5 items). */
export function getHomeFeed(): HomeFeedItem[] {
  const path = getPathSnapshot()
  const sa = getProgressSummary('sanskrit')
  const si = getProgressSummary('siddham')
  const items: HomeFeedItem[] = []
  const dayLetter = letterOfDay()

  items.push({
    id: 'letter-day',
    kicker: '오늘의 글자',
    title: dayLetter.iast,
    body: `${getEffectiveHangulHint(dayLetter.id).text || dayLetter.hangulHint}${dayLetter.note ? ` · ${dayLetter.note}` : ' · 눌러서 학습으로 가 보세요.'}`,
    glyph: dayLetter.dewa,
    script: 'deva',
    target: { type: 'track', track: 'sanskrit', mode: 'learn', letterId: dayLetter.id },
  })

  const dueTrack: ScriptTrack = sa.due >= si.due ? 'sanskrit' : 'siddham'
  const dueCount = Math.max(sa.due, si.due)
  if (dueCount > 0) {
    items.push({
      id: 'due',
      kicker: '복습 인연',
      title: `${dueCount}장이 기다리고 있어요`,
      body:
        dueTrack === 'sanskrit'
          ? '산스크리트 복습으로 오늘 인연을 이어 보세요.'
          : '실담 복습으로 오늘 인연을 이어 보세요.',
      target: { type: 'track', track: dueTrack, mode: 'review' },
    })
  } else if (!path.practicedToday) {
    items.push({
      id: 'nudge',
      kicker: '오늘의 한 걸음',
      title: '아직 수행 기록이 없어요',
      body: '글자 하나만 열어도 공덕이 쌓입니다.',
      target: { type: 'global', mode: 'tracks' },
    })
  }

  const dailySa = getDailyCourse('sanskrit', 5)
  const dailyLeft = dailySa.letters.length - dailySa.doneIds.length
  if (dailyLeft > 0 && dailyLeft < dailySa.letters.length) {
    items.push({
      id: 'daily',
      kicker: '오늘 학습',
      title: `${dailySa.doneIds.length}/${dailySa.letters.length} 완료`,
      body: '남은 추천 글자를 이어서 보면 좋아요.',
      target: { type: 'track', track: 'sanskrit', mode: 'daily' },
    })
  }

  if (path.next) {
    items.push({
      id: 'next-stage',
      kicker: '다음 단계',
      title: path.next.nameKo,
      body: path.next.hintKo,
      target: { type: 'global', mode: 'path' },
    })
  }

  if (path.balanceTip) {
    items.push({
      id: 'balance',
      kicker: '양손 합장',
      title: '트랙 균형',
      body: path.balanceTip,
      target: { type: 'global', mode: 'tracks' },
    })
  }

  const unlocked = MANTRA_SAMPLES.filter((m) => isMantraUnlocked(m.id))
  if (unlocked.length > 0) {
    const m = unlocked[unlocked.length - 1]
    items.push({
      id: 'mantra',
      kicker: '열린 구절',
      title: m.titleKo,
      body: m.meaningKo,
      glyph: m.dewa,
      script: 'deva',
      target: { type: 'global', mode: 'mantras' },
    })
  } else {
    const first = PATH_STAGES[0]
    items.push({
      id: 'mantra-locked',
      kicker: '구절 맛보기',
      title: '아직 잠긴 짧은 구절',
      body: `${first.nameKo}을 열면 「옴」이 해금됩니다.`,
      target: { type: 'global', mode: 'path' },
    })
  }

  if (path.journalToday.merit > 0) {
    items.push({
      id: 'journal',
      kicker: '오늘 일기',
      title: `공덕 ${path.journalToday.merit}`,
      body: `퀴즈 ${path.journalToday.quiz} · 쓰기 ${path.journalToday.write} · 복습 ${path.journalToday.review}`,
      target: { type: 'global', mode: 'path' },
    })
  }

  // Keep feed calm — max 5, prioritize earlier actionable items
  return items.slice(0, 5)
}
