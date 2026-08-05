/**
 * Merge teacher-recorded stroke JSON from taught-strokes/inbox/
 * into src/data/taughtStrokes.json (app-wide canonical source).
 *
 * Also syncs stroke labels into src/data/strokes.ts so theory text matches paths.
 *
 * Usage:
 *   1. App → 직접 기록 → 저장 → 내보내기
 *   2. JSON 파일을 taught-strokes/inbox/ 에 넣기
 *   3. npm run strokes:teach
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const inbox = path.join(root, 'taught-strokes', 'inbox')
const archive = path.join(root, 'taught-strokes', 'archive')
const taughtPath = path.join(root, 'src', 'data', 'taughtStrokes.json')
const strokesPath = path.join(root, 'src', 'data', 'strokes.ts')

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function escapeLabel(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/** Update one script's label array inside a letter block in strokes.ts */
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

function normalizeEntry(raw) {
  const { script, letterId, d, strokes, note, taughtAt } = raw
  if (!script || !letterId || !d || !Array.isArray(strokes) || strokes.length === 0) {
    throw new Error('script, letterId, d, strokes[] 필수')
  }
  if (script !== 'deva' && script !== 'siddham') {
    throw new Error(`script must be deva|siddham, got ${script}`)
  }
  return {
    script,
    letterId,
    entry: {
      d,
      strokes: strokes.map((s, i) => ({
        d: s.d,
        width: s.width ?? 26,
        length: s.length ?? 1,
        label: s.label ?? `획 ${i + 1}`,
      })),
      taughtAt: taughtAt ?? new Date().toISOString(),
      ...(note ? { note } : {}),
    },
  }
}

fs.mkdirSync(inbox, { recursive: true })
fs.mkdirSync(archive, { recursive: true })

const files = fs.readdirSync(inbox).filter((f) => f.endsWith('.json'))
if (files.length === 0) {
  console.log('taught-strokes/inbox/ 에 JSON이 없습니다.')
  console.log('앱에서 내보낸 파일을 inbox에 넣은 뒤 다시 실행하세요.')
  process.exit(0)
}

const store = readJson(taughtPath)
let strokesSrc = fs.readFileSync(strokesPath, 'utf8')
let merged = 0

for (const file of files) {
  const full = path.join(inbox, file)
  try {
    const raw = readJson(full)
    const { script, letterId, entry } = normalizeEntry(raw)
    store[script][letterId] = entry
    strokesSrc = syncStrokeLabels(
      strokesSrc,
      letterId,
      script,
      entry.strokes.map((s) => s.label),
    )
    fs.renameSync(full, path.join(archive, `${Date.now()}-${file}`))
    console.log(`✓ ${script}/${letterId} (${entry.strokes.length}획)`)
    merged++
  } catch (err) {
    console.error(`✗ ${file}: ${err.message}`)
  }
}

store.meta.updatedAt = new Date().toISOString()
store.meta.taughtCount = {
  deva: Object.keys(store.deva).length,
  siddham: Object.keys(store.siddham).length,
}

writeJson(taughtPath, store)
fs.writeFileSync(strokesPath, strokesSrc, 'utf8')

console.log(`\n${merged}개 반영 → taughtStrokes.json (${store.meta.taughtCount.deva} deva, ${store.meta.taughtCount.siddham} siddham)`)
console.log('strokes.ts 라벨도 동기화됐습니다. npm run dev 로 확인하세요.')
