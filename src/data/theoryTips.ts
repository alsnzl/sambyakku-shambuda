import { getLetterById, letters } from './letters'

/** Extra stroke / shape theory beyond Letter.note */
export const STROKE_THEORY: Record<string, string> = {
  a: '데바나가리 अ는 왼쪽 열린 곡선과 오른쪽 기둥·곡선이 균형을 이룹니다. 시로레카(윗선)를 먼저 익히면 이후 자음이 수월합니다.',
  ka: 'क는 시로레카 → 세로 기둥 → 왼쪽 고리·오른쪽 곡선 순이 흔합니다. 기식음 ख와 비교해 숨소리 유무를 구분하세요.',
  ta: '치음 त는 혀끝이 이 뒤에 닿는 소리. 권설 ट와 모양이 비슷해 대비 학습이 중요합니다.',
  tta: '권설 ट는 혀를 말아 올리는 소리. 치음 त보다 기둥이 두툼하고 굴곡이 다릅니다.',
  sa: 'स는 치찰음. श(경구개)·ष(권설)와 세 치찰음을 함께 외우면 헷갈림이 줄어듭니다.',
}

export const GROUP_THEORY: Record<string, string> = {
  svara: '모음(스와라)은 단독으로도 쓰고, 자음에 붙어 소리를 바꿉니다. 짧은/긴 짝(a/ā, i/ī…)을 먼저 구분하세요.',
  'ka-varga': '카 계열은 연구개음. 무성·유성 × 무기·유기 + 비음(ṅa) 다섯이 한 묶음입니다.',
  'ca-varga': '차 계열은 경구개(입천장) 소리. 한국어 “자/차”와 비슷하지만 정확히 같지는 않습니다.',
  'tta-varga': '권설 계열은 혀를 말아 올립니다. 치음 계열과 모양이 닮아 대비 연습이 필요합니다.',
  'ta-varga': '치음 계열은 혀끝이 이 뒤에 닿습니다. 권설과 구분해 쓰기를 연습하세요.',
  'pa-varga': '파 계열은 입술 소리(순음). pha/bha의 기식을 과장하지 않게 익히세요.',
  antahstha: '반모음 ya ra la va는 모음과 자음 사이 성질을 가집니다.',
  ushman: '치찰음·하는 숨이 섞인 소리. ś ṣ s ha를 자리(조음점)로 기억하세요.',
}

export function getTheoryBlurb(letterId: string): string | null {
  if (STROKE_THEORY[letterId]) return STROKE_THEORY[letterId]
  const letter = getLetterById(letterId)
  if (!letter) return null
  return GROUP_THEORY[letter.group] ?? letter.note ?? null
}

export function allLettersWithNotes() {
  return letters.filter((l) => l.note || STROKE_THEORY[l.id] || GROUP_THEORY[l.group])
}
