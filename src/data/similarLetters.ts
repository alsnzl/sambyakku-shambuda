import { getLetterById, type Letter } from './letters'

/** Pedagogical similar / confusable pairs for contrast practice. */
export const SIMILAR_PAIRS: [string, string][] = [
  ['a', 'aa'],
  ['i', 'ii'],
  ['u', 'uu'],
  ['e', 'ai'],
  ['o', 'au'],
  ['r', 'rr'],
  ['ka', 'kha'],
  ['ga', 'gha'],
  ['ca', 'cha'],
  ['ja', 'jha'],
  ['tta', 'ttha'],
  ['dda', 'ddha'],
  ['ta', 'tha'],
  ['da', 'dha'],
  ['pa', 'pha'],
  ['ba', 'bha'],
  ['ta', 'tta'],
  ['da', 'dda'],
  ['sa', 'sha'],
  ['sa', 'ssa'],
  ['sha', 'ssa'],
  ['na', 'nna'],
  ['na', 'nya'],
  ['na', 'nga'],
  ['ra', 'la'],
  ['ya', 'ja'],
  ['va', 'ba'],
  ['ha', 'kha'],
]

export function getSimilarLetters(letterId: string): Letter[] {
  const ids = new Set<string>()
  for (const [a, b] of SIMILAR_PAIRS) {
    if (a === letterId) ids.add(b)
    if (b === letterId) ids.add(a)
  }
  return [...ids]
    .map((id) => getLetterById(id))
    .filter((l): l is Letter => Boolean(l))
}

export function getAllSimilarPairs(): { a: Letter; b: Letter; reason: string }[] {
  const reasons: Record<string, string> = {
    'a|aa': '짧은/긴 모음',
    'i|ii': '짧은/긴 모음',
    'u|uu': '짧은/긴 모음',
    'e|ai': '단모음 / 이중모음',
    'o|au': '단모음 / 이중모음',
    'ka|kha': '무기음 / 유기음',
    'ga|gha': '무기음 / 유기음',
    'ca|cha': '무기음 / 유기음',
    'ja|jha': '무기음 / 유기음',
    'tta|ttha': '권설 무기/유기',
    'dda|ddha': '권설 무기/유기',
    'ta|tha': '치음 무기/유기',
    'da|dha': '치음 무기/유기',
    'pa|pha': '순음 무기/유기',
    'ba|bha': '순음 무기/유기',
    'ta|tta': '치음 / 권설',
    'da|dda': '치음 / 권설',
    'sa|sha': '치찰음 자리',
    'sa|ssa': '치찰음 자리',
    'sha|ssa': '경구개 / 권설 치찰',
    'na|nna': '치음 / 권설 나',
    'na|nya': '치음 / 경구개 나',
    'na|nga': '치음 / 연구개 나',
    'ra|la': '유음 대비',
    'ya|ja': '반모음 / 파찰',
    'va|ba': '순음 대비',
    'ha|kha': '숨소리 계열',
    'r|rr': '짧은/긴 ṛ',
  }

  return SIMILAR_PAIRS.map(([aid, bid]) => {
    const a = getLetterById(aid)
    const b = getLetterById(bid)
    if (!a || !b) return null
    const key = `${aid}|${bid}`
    return { a, b, reason: reasons[key] ?? '헷갈리기 쉬운 쌍' }
  }).filter((x): x is { a: Letter; b: Letter; reason: string } => Boolean(x))
}
