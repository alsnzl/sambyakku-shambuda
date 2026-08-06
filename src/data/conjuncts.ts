export type ConjunctSample = {
  id: string
  iast: string
  dewa: string
  siddham: string
  hangulHint: string
  /** Independent akṣara ids that compose this cluster */
  parts: string[]
  note: string
}

/**
 * Beginner conjunct / syllable clusters (virama joins).
 * Siddham forms use U+115BF (𑖿) as virama between consonants.
 */
export const CONJUNCT_SAMPLES: ConjunctSample[] = [
  {
    id: 'kka',
    iast: 'kka',
    dewa: 'क्क',
    siddham: '𑖎𑖿𑖎',
    hangulHint: '까',
    parts: ['ka', 'ka'],
    note: '같은 자음이 비라마(्)로 이어집니다.',
  },
  {
    id: 'tra',
    iast: 'tra',
    dewa: 'त्र',
    siddham: '𑖝𑖿𑖨',
    hangulHint: '트라',
    parts: ['ta', 'ra'],
    note: 'ta + ra. 산스크리트에서 자주 만납니다.',
  },
  {
    id: 'pra',
    iast: 'pra',
    dewa: 'प्र',
    siddham: '𑖢𑖿𑖨',
    hangulHint: '프라',
    parts: ['pa', 'ra'],
    note: 'pa + ra.',
  },
  {
    id: 'sva',
    iast: 'sva',
    dewa: 'स्व',
    siddham: '𑖭𑖿𑖪',
    hangulHint: '스바',
    parts: ['sa', 'va'],
    note: 'sa + va. svāhā 등의 시작.',
  },
  {
    id: 'jña',
    iast: 'jña',
    dewa: 'ज्ञ',
    siddham: '𑖕𑖿𑖗',
    hangulHint: '즈냐',
    parts: ['ja', 'nya'],
    note: 'ja + ña. 모양이 독립 글자와 달라 익숙해질 필요가 있습니다.',
  },
  {
    id: 'ddha',
    iast: 'ddha',
    dewa: 'द्ध',
    siddham: '𑖟𑖿𑖠',
    hangulHint: '따(유성)',
    parts: ['da', 'dha'],
    note: 'da + dha. buddha의 핵심 합자입니다.',
  },
  {
    id: 'kṣa',
    iast: 'kṣa',
    dewa: 'क्ष',
    siddham: '𑖎𑖿𑖬',
    hangulHint: '크샤',
    parts: ['ka', 'ssa'],
    note: 'ka + ṣa. 자주 쓰이는 합자.',
  },
  {
    id: 'nta',
    iast: 'nta',
    dewa: 'न्त',
    siddham: '𑖡𑖿𑖝',
    hangulHint: 'ㄴ타',
    parts: ['na', 'ta'],
    note: 'na + ta. śānti 등에서 만납니다.',
  },
]
