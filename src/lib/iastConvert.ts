import { letters } from '../data/letters'
import { getEffectiveHangulHint } from './hangulHintsStore'

const NORM: Record<string, string> = {
  ā: 'aa',
  ī: 'ii',
  ū: 'uu',
  ṛ: 'r',
  ṝ: 'rr',
  ḷ: 'l',
  ṃ: 'm',
  ḥ: 'h',
  ś: 'sh',
  ṣ: 'ss',
  ñ: 'ny',
  ṅ: 'ng',
  ṇ: 'nn',
  ṭ: 'tt',
  ḍ: 'dd',
}

/** Map IAST (or ascii-ish) token → letter id when possible. */
const IAST_TO_ID: Record<string, string> = Object.fromEntries(
  letters.map((l) => [l.iast.toLowerCase(), l.id]),
)

// ascii aliases
Object.assign(IAST_TO_ID, {
  aa: 'aa',
  ii: 'ii',
  uu: 'uu',
  ri: 'r',
  rii: 'rr',
  li: 'l',
  ai: 'ai',
  au: 'au',
  am: 'am',
  ah: 'ah',
  sh: 'sha',
  ss: 'ssa',
  ny: 'nya',
  ng: 'nga',
  nn: 'nna',
  tt: 'tta',
  dd: 'dda',
  th: 'tha',
  dh: 'dha',
  ph: 'pha',
  bh: 'bha',
  ch: 'cha',
  jh: 'jha',
  kh: 'kha',
  gh: 'gha',
  tth: 'ttha',
  ddh: 'ddha',
})

function normalizeIast(input: string): string {
  let s = input.trim().toLowerCase()
  for (const [from, to] of Object.entries(NORM)) {
    s = s.split(from).join(to)
  }
  return s.replace(/\s+/g, '')
}

export type ConvertHit = {
  token: string
  letterId: string | null
  dewa: string
  siddham: string
  iast: string
}

const TOKEN_ORDER = [
  'tth',
  'ddh',
  'kh',
  'gh',
  'ch',
  'jh',
  'th',
  'dh',
  'ph',
  'bh',
  'ny',
  'ng',
  'nn',
  'tt',
  'dd',
  'sh',
  'ss',
  'aa',
  'ii',
  'uu',
  'ai',
  'au',
  'am',
  'ah',
  'rii',
  'ri',
  'li',
]

export function convertIastInput(raw: string): {
  normalized: string
  hits: ConvertHit[]
  dewa: string
  siddham: string
} {
  const normalized = normalizeIast(raw)
  if (!normalized) {
    return { normalized: '', hits: [], dewa: '', siddham: '' }
  }

  const hits: ConvertHit[] = []
  let i = 0
  while (i < normalized.length) {
    let matched = false
    for (const tok of TOKEN_ORDER) {
      if (normalized.startsWith(tok, i)) {
        const id = IAST_TO_ID[tok] ?? null
        const letter = id ? letters.find((l) => l.id === id) : null
        hits.push({
          token: tok,
          letterId: id,
          dewa: letter?.dewa ?? '·',
          siddham: letter?.siddham ?? '·',
          iast: letter?.iast ?? tok,
        })
        i += tok.length
        matched = true
        break
      }
    }
    if (matched) continue

    const ch = normalized[i]
    const id = IAST_TO_ID[ch] ?? null
    const letter = id ? letters.find((l) => l.id === id) : null
    hits.push({
      token: ch,
      letterId: id,
      dewa: letter?.dewa ?? (ch === "'" || ch === '-' ? '' : '·'),
      siddham: letter?.siddham ?? (ch === "'" || ch === '-' ? '' : '·'),
      iast: letter?.iast ?? ch,
    })
    i += 1
  }

  return {
    normalized,
    hits,
    dewa: hits.map((h) => h.dewa).join(''),
    siddham: hits.map((h) => h.siddham).join(''),
  }
}

export function lookupByIastFragment(q: string) {
  const n = normalizeIast(q)
  if (!n) return []
  return letters.filter((l) => {
    const hangul = getEffectiveHangulHint(l.id).text || l.hangulHint
    return (
      l.iast.toLowerCase().includes(n) ||
      l.id.includes(n) ||
      hangul.includes(q.trim()) ||
      l.hangulHint.includes(q.trim())
    )
  })
}
