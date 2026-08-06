export type MantraSyllable = {
  iast: string
  dewa: string
  siddham: string
  /** Related independent letters for “글자 보기” */
  letterIds: string[]
}

export type MantraSample = {
  id: string
  titleKo: string
  iast: string
  dewa: string
  siddham: string
  meaningKo: string
  note?: string
  syllables: MantraSyllable[]
}

/** Short beginner-friendly samples (not liturgical instruction). */
export const MANTRA_SAMPLES: MantraSample[] = [
  {
    id: 'om',
    titleKo: '옴',
    iast: 'oṃ',
    dewa: 'ॐ',
    siddham: '𑖌𑖼',
    meaningKo: '가장 잘 알려진 성음. 자모 학습의 출발점으로 자주 만납니다.',
    note: '앱에서는 모양·읽기 맛보기로만 다룹니다.',
    syllables: [{ iast: 'oṃ', dewa: 'ॐ', siddham: '𑖌𑖼', letterIds: ['o', 'am'] }],
  },
  {
    id: 'namah',
    titleKo: '나마하',
    iast: 'namaḥ',
    dewa: 'नमः',
    siddham: '𑖡𑖦𑖽',
    meaningKo: '“경배합니다”에 가까운 짧은 표현.',
    syllables: [
      { iast: 'na', dewa: 'न', siddham: '𑖡', letterIds: ['na'] },
      { iast: 'maḥ', dewa: 'मः', siddham: '𑖦𑖽', letterIds: ['ma', 'ah'] },
    ],
  },
  {
    id: 'shanti',
    titleKo: '샨티',
    iast: 'śāntiḥ',
    dewa: 'शान्तिः',
    siddham: '𑖫𑖯𑖡𑖿𑖝𑖰𑖽',
    meaningKo: '평화·고요. 자모 ś, ā, n, t, i, ḥ를 이어서 읽어 봅니다.',
    syllables: [
      { iast: 'śā', dewa: 'शा', siddham: '𑖫𑖯', letterIds: ['sha', 'aa'] },
      { iast: 'ntiḥ', dewa: 'न्तिः', siddham: '𑖡𑖿𑖝𑖰𑖽', letterIds: ['na', 'ta', 'i', 'ah'] },
    ],
  },
  {
    id: 'gate',
    titleKo: '가테 (맛보기)',
    iast: 'gate',
    dewa: 'गते',
    siddham: '𑖐𑖝𑖸',
    meaningKo: '반야심경 등에서 만나는 짧은 음절 조각 맛보기.',
    note: '전문 독송 학습이 아니라 글자 연결 연습용입니다.',
    syllables: [
      { iast: 'ga', dewa: 'ग', siddham: '𑖐', letterIds: ['ga'] },
      { iast: 'te', dewa: 'ते', siddham: '𑖝𑖸', letterIds: ['ta', 'e'] },
    ],
  },
  {
    id: 'buddha',
    titleKo: '붓다',
    iast: 'buddha',
    dewa: 'बुद्ध',
    siddham: '𑖤𑖲𑖟𑖿𑖠',
    meaningKo: '부처. b, u, ddh, a 조합을 확인합니다.',
    syllables: [
      { iast: 'bu', dewa: 'बु', siddham: '𑖤𑖲', letterIds: ['ba', 'u'] },
      { iast: 'ddha', dewa: 'द्ध', siddham: '𑖟𑖿𑖠', letterIds: ['da', 'dha'] },
    ],
  },
]
