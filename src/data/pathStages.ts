import type { MantraSample } from './mantras'
import { MANTRA_SAMPLES } from './mantras'

export type PathStageId =
  | 'chobal'
  | 'cheongjeong'
  | 'jeonggeun'
  | 'baramil'
  | 'borisim'
  | 'banya'
  | 'yeolban'

export type PathStageDef = {
  id: PathStageId
  index: number
  nameKo: string
  /** One calm line shown on home / path page */
  verseKo: string
  hintKo: string
  unlockMantraIds: string[]
}

/** Seven soft practice stages — not “become Buddha”, but walk closer through letters. */
export const PATH_STAGES: PathStageDef[] = [
  {
    id: 'chobal',
    index: 0,
    nameKo: '초발심',
    verseKo: '처음 마음을 내는 것이 수행의 문입니다.',
    hintKo: '아무 글자나 하나 열어 보세요.',
    unlockMantraIds: ['om'],
  },
  {
    id: 'cheongjeong',
    index: 1,
    nameKo: '청정',
    verseKo: '모음을 바르게 익히면 소리가 맑아집니다.',
    hintKo: '모음(스와라)을 모두 학습 완료하세요.',
    unlockMantraIds: ['namah'],
  },
  {
    id: 'jeonggeun',
    index: 2,
    nameKo: '정근',
    verseKo: '하루하루 이어지는 공부도 수행입니다.',
    hintKo: '7일 연속으로 자모를 익혀 보세요.',
    unlockMantraIds: ['shanti'],
  },
  {
    id: 'baramil',
    index: 3,
    nameKo: '바라밀',
    verseKo: '자음을 쌓아 가며 글자의 강이 넓어집니다.',
    hintKo: '자음 학습 완료 25자 이상.',
    unlockMantraIds: ['gate'],
  },
  {
    id: 'borisim',
    index: 4,
    nameKo: '보리심',
    verseKo: '손으로 쓰는 획에도 마음이 담깁니다.',
    hintKo: '쓰기 평균 70점 이상(5자 이상).',
    unlockMantraIds: ['buddha'],
  },
  {
    id: 'banya',
    index: 5,
    nameKo: '반야',
    verseKo: '닮은 글자를 구분할 때 지혜가 자랍니다.',
    hintKo: '퀴즈 정답률 70% 이상(20문항+).',
    unlockMantraIds: [],
  },
  {
    id: 'yeolban',
    index: 6,
    nameKo: '열반의 문',
    verseKo: '양손 합장처럼, 두 문자를 함께 익힙니다.',
    hintKo: '산스크리트·실담 각 30자 이상 학습 완료.',
    unlockMantraIds: [],
  },
]

export function mantraUnlockStage(mantraId: string): PathStageDef | null {
  for (const stage of PATH_STAGES) {
    if (stage.unlockMantraIds.includes(mantraId)) return stage
  }
  return PATH_STAGES[0]
}

export function mantrasForStage(stageIndex: number): MantraSample[] {
  const unlocked = new Set<string>()
  for (const stage of PATH_STAGES) {
    if (stage.index <= stageIndex) {
      for (const id of stage.unlockMantraIds) unlocked.add(id)
    }
  }
  return MANTRA_SAMPLES.filter((m) => unlocked.has(m.id))
}
