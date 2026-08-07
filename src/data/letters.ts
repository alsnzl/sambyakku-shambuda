export type LetterType = 'vowel' | 'consonant'

export type Letter = {
  id: string
  /** 데바나가리 */
  dewa: string
  /** Siddhaṃ (실담) */
  siddham: string
  iast: string
  hangulHint: string
  type: LetterType
  group: string
  groupKo: string
  note?: string
  audioSrc?: string
}

export type LetterGroup = {
  id: string
  labelKo: string
  type: LetterType
  letters: Letter[]
}

function v(
  id: string,
  dewa: string,
  siddham: string,
  iast: string,
  hangulHint: string,
  note?: string,
): Letter {
  return {
    id,
    dewa,
    siddham,
    iast,
    hangulHint,
    type: 'vowel',
    group: 'svara',
    groupKo: '모음',
    note,
  }
}

function c(
  group: string,
  groupKo: string,
  id: string,
  dewa: string,
  siddham: string,
  iast: string,
  hangulHint: string,
  note?: string,
): Letter {
  return {
    id,
    dewa,
    siddham,
    iast,
    hangulHint,
    type: 'consonant',
    group,
    groupKo,
    note,
  }
}

/** 독립 모음 — Devanagari + Siddhaṃ */
export const vowels: Letter[] = [
  v('a', 'अ', '𑖀', 'a', '아', '짧은 기본 모음. 자음에 붙으면 기본 소리.'),
  v('aa', 'आ', '𑖁', 'ā', '아ː', '긴 a. 짧게 끊지 않고 늘여 발음.'),
  v('i', 'इ', '𑖂', 'i', '이', '짧은 i.'),
  v('ii', 'ई', '𑖃', 'ī', '이ː', '긴 i.'),
  v('u', 'उ', '𑖄', 'u', '우', '짧은 u.'),
  v('uu', 'ऊ', '𑖅', 'ū', '우ː', '긴 u.'),
  v('r', 'ऋ', '𑖆', 'ṛ', '르', '혀를 말아 짧게 진동하는 소리에 가깝습니다.'),
  v('rr', 'ॠ', '𑖇', 'ṝ', '르ː', '긴 ṛ. 고전 산스크리트에서 드뭅니다.'),
  v('l', 'ऌ', '𑖈', 'ḷ', '르(설측)', '설측으로 내는 모음. 매우 드뭅니다.'),
  v('e', 'ए', '𑖊', 'e', '에', '단모음 e (영어 day의 이중모음과 다름).'),
  v('ai', 'ऐ', '𑖋', 'ai', '아이', 'a + i에 가까운 이중모음.'),
  v('o', 'ओ', '𑖌', 'o', '오', '단모음 o.'),
  v('au', 'औ', '𑖍', 'au', '아우', 'a + u에 가까운 이중모음.'),
  v('am', 'अं', '𑖀𑖽', 'aṃ', '앙', '아누스바라(anusvāra). 콧소리로 끝남.'),
  v('ah', 'अः', '𑖀𑖾', 'aḥ', '아흐', '비사르가(visarga). 가벼운 h 숨소리.'),
]

const ka = '카 계열 · 연구개'
const ca = '차 계열 · 경구개'
const taRetro = '타 계열 · 권설(혀를 말아)'
const taDental = '타 계열 · 치음'
const pa = '파 계열 · 순음'
const semi = '반모음'
const sibilant = '치찰음 · 하'

/** 자음 — Devanagari + Siddhaṃ (varga 순) */
export const consonants: Letter[] = [
  c('ka-varga', ka, 'ka', 'क', '𑖎', 'ka', '카', '무성 · 무기음'),
  c('ka-varga', ka, 'kha', 'ख', '𑖏', 'kha', '카(기식)', '무성 · 유기음 (숨이 많음)'),
  c('ka-varga', ka, 'ga', 'ग', '𑖐', 'ga', '가', '유성 · 무기음'),
  c('ka-varga', ka, 'gha', 'घ', '𑖑', 'gha', '가(기식)', '유성 · 유기음'),
  c('ka-varga', ka, 'nga', 'ङ', '𑖒', 'ṅa', '응아', '연구개 비음'),

  c('ca-varga', ca, 'ca', 'च', '𑖓', 'ca', '차', '무성 · 무기음'),
  c('ca-varga', ca, 'cha', 'छ', '𑖔', 'cha', '차(기식)', '무성 · 유기음'),
  c('ca-varga', ca, 'ja', 'ज', '𑖕', 'ja', '자', '유성 · 무기음'),
  c('ca-varga', ca, 'jha', 'झ', '𑖖', 'jha', '자(기식)', '유성 · 유기음'),
  c('ca-varga', ca, 'nya', 'ञ', '𑖗', 'ña', '냐', '경구개 비음'),

  c('tta-varga', taRetro, 'tta', 'ट', '𑖘', 'ṭa', '타(권설)', '혀끝을 말아 올림'),
  c('tta-varga', taRetro, 'ttha', 'ठ', '𑖙', 'ṭha', '타(권설·기식)', '권설 + 유기음'),
  c('tta-varga', taRetro, 'dda', 'ड', '𑖚', 'ḍa', '다(권설)', '유성 권설'),
  c('tta-varga', taRetro, 'ddha', 'ढ', '𑖛', 'ḍha', '다(권설·기식)', '유성 권설 + 유기음'),
  c('tta-varga', taRetro, 'nna', 'ण', '𑖜', 'ṇa', '나(권설)', '권설 비음'),

  c('ta-varga', taDental, 'ta', 'त', '𑖝', 'ta', '타', '이 뒤에 혀를 댐 (한국어 ㅌ에 가까움)'),
  c('ta-varga', taDental, 'tha', 'थ', '𑖞', 'tha', '타(기식)', '치음 + 유기음'),
  c('ta-varga', taDental, 'da', 'द', '𑖟', 'da', '다', '치음 유성'),
  c('ta-varga', taDental, 'dha', 'ध', '𑖠', 'dha', '다(기식)', '치음 유성 + 유기음'),
  c('ta-varga', taDental, 'na', 'न', '𑖡', 'na', '나', '치음 비음'),

  c('pa-varga', pa, 'pa', 'प', '𑖢', 'pa', '파', '무성 · 무기음'),
  c('pa-varga', pa, 'pha', 'फ', '𑖣', 'pha', '파(기식)', '무성 · 유기음'),
  c('pa-varga', pa, 'ba', 'ब', '𑖤', 'ba', '바', '유성 · 무기음'),
  c('pa-varga', pa, 'bha', 'भ', '𑖥', 'bha', '바(기식)', '유성 · 유기음'),
  c('pa-varga', pa, 'ma', 'म', '𑖦', 'ma', '마', '양순 비음'),

  c('antahstha', semi, 'ya', 'य', '𑖧', 'ya', '야', '경구개 반모음'),
  c('antahstha', semi, 'ra', 'र', '𑖨', 'ra', '라(탄설)', '혀를 가볍게 튕김'),
  c('antahstha', semi, 'la', 'ल', '𑖩', 'la', '라', '설측음'),
  c('antahstha', semi, 'va', 'व', '𑖪', 'va', '바/와', '순치 또는 양순에 가깝게'),

  c('ushman', sibilant, 'sha', 'श', '𑖫', 'śa', '샤', '경구개 치찰음'),
  c('ushman', sibilant, 'ssa', 'ष', '𑖬', 'ṣa', '샤(권설)', '권설 치찰음'),
  c('ushman', sibilant, 'sa', 'स', '𑖭', 'sa', '사', '치음 치찰음'),
  c('ushman', sibilant, 'ha', 'ह', '𑖮', 'ha', '하', '성문 마찰음'),
]

export const letters: Letter[] = [...vowels, ...consonants]

const groupOrder = [
  'svara',
  'ka-varga',
  'ca-varga',
  'tta-varga',
  'ta-varga',
  'pa-varga',
  'antahstha',
  'ushman',
]

export function getLetterGroups(): LetterGroup[] {
  return groupOrder.map((id) => {
    const groupLetters = letters.filter((l) => l.group === id)
    return {
      id,
      labelKo: groupLetters[0]?.groupKo ?? id,
      type: groupLetters[0]?.type ?? 'consonant',
      letters: groupLetters,
    }
  })
}

export function getLetterById(id: string): Letter | undefined {
  return letters.find((l) => l.id === id)
}

export function getGroupById(id: string): LetterGroup | undefined {
  return getLetterGroups().find((g) => g.id === id)
}
