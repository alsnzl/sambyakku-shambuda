/**
 * Pull cloud/taughtStrokes.json (GitHub) into src/data/taughtStrokes.json
 * and sync stroke labels into src/data/strokes.ts — for release bake-in.
 *
 * Usage:
 *   npm run strokes:pull
 *
 * Env (optional):
 *   STROKE_CLOUD_OWNER, STROKE_CLOUD_REPO, STROKE_CLOUD_BRANCH, STROKE_CLOUD_PATH
 *   GITHUB_TOKEN — needed if the repo is private
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const taughtPath = path.join(root, 'src', 'data', 'taughtStrokes.json')
const strokesPath = path.join(root, 'src', 'data', 'strokes.ts')

const owner = process.env.STROKE_CLOUD_OWNER || 'alsnzl'
const repo = process.env.STROKE_CLOUD_REPO || 'sambyakku-shambuda'
const branch = process.env.STROKE_CLOUD_BRANCH || 'main'
const cloudPath = process.env.STROKE_CLOUD_PATH || 'cloud/taughtStrokes.json'
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function escapeLabel(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function syncStrokeLabels(src, letterId, script, labels) {
  const blockRe = new RegExp(`(${letterId}:\\s*\\{[\\s\\S]*?)(\\n\\s*\\},)`, 'm')
  const match = src.match(blockRe)
  if (!match) {
    console.warn(`  ⚠ strokes.ts 에 ${letterId} 없음 — 라벨 동기화 건너뜀`)
    return src
  }
  let block = match[1]
  const arrRe = new RegExp(`(${script}:\\s*\\[)[^\\]]*(\\])`)
  if (!arrRe.test(block)) {
    console.warn(`  ⚠ ${letterId}.${script} 블록 없음`)
    return src
  }
  const joined = labels.map((l) => `'${escapeLabel(l)}'`).join(', ')
  block = block.replace(arrRe, `$1${joined}$2`)
  return src.replace(blockRe, `${block}${match[2]}`)
}

async function fetchCloud() {
  if (token) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${cloudPath}?ref=${encodeURIComponent(branch)}`
    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    if (!res.ok) {
      throw new Error(`GitHub API ${res.status}: ${(await res.text()).slice(0, 200)}`)
    }
    const json = await res.json()
    const text = Buffer.from(json.content.replace(/\n/g, ''), 'base64').toString('utf8')
    return JSON.parse(text)
  }

  const raw = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${cloudPath}?t=${Date.now()}`
  const res = await fetch(raw, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`raw.githubusercontent.com ${res.status} — private repo면 GITHUB_TOKEN 을 설정하세요.`)
  }
  return res.json()
}

const store = await fetchCloud()
if (!store?.deva || !store?.siddham) {
  throw new Error('클라우드 JSON 형식이 올바르지 않습니다 (deva/siddham 필요).')
}

store.meta = store.meta || {}
store.meta.description =
  store.meta.description ||
  '교사가 직접 쓴 획 — 앱의 공식 기준. auto-generated보다 항상 우선.'
store.meta.updatedAt = new Date().toISOString()

function isEntry(v) {
  return v && typeof v === 'object' && typeof v.d === 'string' && Array.isArray(v.strokes)
}

function fontMapForLetter(raw) {
  if (!raw) return {}
  if (isEntry(raw)) {
    const face = raw.fontFace || 'legacy'
    return { [face]: raw }
  }
  const out = {}
  for (const [k, v] of Object.entries(raw)) {
    if (isEntry(v)) out[v.fontFace || k] = v
  }
  return out
}

function countLetters(bucket) {
  return Object.values(bucket || {}).filter((raw) => Object.keys(fontMapForLetter(raw)).length > 0)
    .length
}

store.meta.taughtCount = {
  deva: countLetters(store.deva),
  siddham: countLetters(store.siddham),
}

writeJson(taughtPath, store)

let strokesSrc = fs.readFileSync(strokesPath, 'utf8')
for (const script of ['deva', 'siddham']) {
  for (const [letterId, raw] of Object.entries(store[script])) {
    const map = fontMapForLetter(raw)
    // Prefer default outline faces for label bake-in; else first available.
    const preferred =
      map[script === 'deva' ? 'noto-deva' : 'noto-siddham'] ||
      map[script === 'deva' ? 'tiro-deva' : 'muktam'] ||
      Object.values(map)[0]
    if (!preferred?.strokes?.length) continue
    strokesSrc = syncStrokeLabels(
      strokesSrc,
      letterId,
      script,
      preferred.strokes.map((s) => s.label ?? '획'),
    )
  }
}
fs.writeFileSync(strokesPath, strokesSrc, 'utf8')

console.log(
  `✓ 클라우드 → taughtStrokes.json (${store.meta.taughtCount.deva} deva, ${store.meta.taughtCount.siddham} siddham)`,
)
console.log(`  출처: ${owner}/${repo}@${branch}:${cloudPath}`)
console.log('strokes.ts 라벨도 동기화했습니다. 출시 전 획 가르치기 UI를 제거하면 됩니다.')
