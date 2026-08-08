import { formatCloudWriteError, getCloudToken, hasCloudWriteToken } from './strokeCloud'
import { recordTextCloudVersion } from './textCloudVersions'

const LOCAL_KEY = 'sambyakku-letter-memo-overrides'
const CACHE_KEY = 'sambyakku-letter-memo-cloud-cache'
const CACHE_META_KEY = 'sambyakku-letter-memo-cloud-meta'

export type LetterMemoEntry = {
  text: string
  updatedAt: string
}

export type LetterMemosStore = {
  meta: {
    description: string
    updatedAt: string | null
  }
  memos: Record<string, LetterMemoEntry>
}

type LocalDraft = LetterMemoEntry

type CacheMeta = {
  fetchedAt: string
  sha: string | null
}

type LetterMemoCloudConfig = {
  owner: string
  repo: string
  branch: string
  path: string
}

function emptyStore(): LetterMemosStore {
  return {
    meta: {
      description: '교사가 적은 글자 메모 — letterId 키.',
      updatedAt: null,
    },
    memos: {},
  }
}

/** Accept slightly malformed cloud JSON and coerce into LetterMemosStore. */
function normalizeStore(raw: unknown): LetterMemosStore {
  const base = emptyStore()
  if (!raw || typeof raw !== 'object') return base
  const obj = raw as Record<string, unknown>
  const metaIn = obj.meta
  if (metaIn && typeof metaIn === 'object') {
    const m = metaIn as Record<string, unknown>
    if (typeof m.description === 'string') base.meta.description = m.description
    if (typeof m.updatedAt === 'string' || m.updatedAt === null) {
      base.meta.updatedAt = (m.updatedAt as string | null) ?? null
    }
  }
  const memosIn = obj.memos
  if (memosIn && typeof memosIn === 'object') {
    const out: Record<string, LetterMemoEntry> = {}
    for (const [id, value] of Object.entries(memosIn as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue
      const v = value as Record<string, unknown>
      const text = typeof v.text === 'string' ? v.text.trim() : ''
      if (!text) continue
      out[id] = {
        text,
        updatedAt:
          typeof v.updatedAt === 'string' ? v.updatedAt : new Date().toISOString(),
      }
    }
    base.memos = out
  }
  return base
}

function getLetterMemoCloudConfig(): LetterMemoCloudConfig {
  return {
    owner: import.meta.env.VITE_STROKE_CLOUD_OWNER || 'alsnzl',
    repo: import.meta.env.VITE_STROKE_CLOUD_REPO || 'sambyakku-shambuda',
    branch: import.meta.env.VITE_STROKE_CLOUD_BRANCH || 'main',
    path: import.meta.env.VITE_LETTER_MEMO_CLOUD_PATH || 'cloud/letterMemos.json',
  }
}

export function letterMemoCloudRepoPath(): string {
  const cfg = getLetterMemoCloudConfig()
  return `${cfg.owner}/${cfg.repo}/${cfg.path}`
}

function rawUrl(cfg: LetterMemoCloudConfig) {
  return `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${cfg.path}`
}

function contentsApiUrl(cfg: LetterMemoCloudConfig) {
  return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}`
}

function decodeBase64Utf8(b64: string): string {
  const bin = atob(b64.replace(/\n/g, ''))
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function readLocalAll(): Record<string, LocalDraft> {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, LocalDraft>
  } catch {
    return {}
  }
}

function writeLocalAll(map: Record<string, LocalDraft>) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(map))
}

export function loadLocalLetterMemo(letterId: string): LocalDraft | null {
  return readLocalAll()[letterId] ?? null
}

export function saveLocalLetterMemo(letterId: string, text: string): LocalDraft {
  const entry: LocalDraft = { text: text.trim(), updatedAt: new Date().toISOString() }
  const map = readLocalAll()
  if (!entry.text) {
    delete map[letterId]
    writeLocalAll(map)
    return entry
  }
  map[letterId] = entry
  writeLocalAll(map)
  return entry
}

export function clearLocalLetterMemo(letterId: string) {
  const map = readLocalAll()
  delete map[letterId]
  writeLocalAll(map)
}

function readMeta(): CacheMeta | null {
  try {
    const raw = localStorage.getItem(CACHE_META_KEY)
    return raw ? (JSON.parse(raw) as CacheMeta) : null
  } catch {
    return null
  }
}

function writeMeta(meta: CacheMeta) {
  localStorage.setItem(CACHE_META_KEY, JSON.stringify(meta))
}

export function readLetterMemoCloudCache(): LetterMemosStore | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return normalizeStore(JSON.parse(raw))
  } catch {
    return null
  }
}

function writeLetterMemoCloudCache(store: LetterMemosStore, sha: string | null = null) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(normalizeStore(store)))
  writeMeta({
    fetchedAt: new Date().toISOString(),
    sha: sha ?? readMeta()?.sha ?? null,
  })
}

export function getCloudLetterMemo(letterId: string): LetterMemoEntry | null {
  return readLetterMemoCloudCache()?.memos?.[letterId] ?? null
}

export type LetterMemoSource = 'cloud' | 'local' | 'empty'

export type EffectiveLetterMemo = {
  text: string
  source: LetterMemoSource
  updatedAt: string | null
}

/** Resolve: local draft → cloud cache. */
export function getEffectiveLetterMemo(letterId: string): EffectiveLetterMemo {
  const local = loadLocalLetterMemo(letterId)
  if (local?.text) {
    return {
      text: local.text,
      source: 'local',
      updatedAt: local.updatedAt,
    }
  }
  const cloud = getCloudLetterMemo(letterId)
  if (cloud) {
    return {
      text: cloud.text,
      source: 'cloud',
      updatedAt: cloud.updatedAt,
    }
  }
  return { text: '', source: 'empty', updatedAt: null }
}

type ContentsResponse = {
  sha: string
  content?: string
}

async function fetchViaContentsApi(
  cfg: LetterMemoCloudConfig,
  token: string | null,
): Promise<{ store: LetterMemosStore; sha: string } | null> {
  const url = `${contentsApiUrl(cfg)}?ref=${encodeURIComponent(cfg.branch)}`

  async function once(auth: string | null) {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    if (auth) headers.Authorization = `Bearer ${auth}`
    return fetch(url, { headers, cache: 'no-store' })
  }

  let res = await once(token)
  if (res.status === 404 && token) {
    res = await once(null)
  }
  if (res.status === 404) return null
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`글 메모 클라우드 읽기 실패 (${res.status}): ${body.slice(0, 200)}`)
  }
  const json = (await res.json()) as ContentsResponse
  if (!json.content) throw new Error('글 메모 클라우드 파일이 비어 있습니다.')
  const store = normalizeStore(JSON.parse(decodeBase64Utf8(json.content)))
  return { store, sha: json.sha }
}

async function fetchViaRaw(cfg: LetterMemoCloudConfig): Promise<LetterMemosStore | null> {
  const res = await fetch(`${rawUrl(cfg)}?t=${Date.now()}`, { cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`글 메모 raw 읽기 실패 (${res.status})`)
  return normalizeStore(await res.json())
}

/**
 * Pull letterMemos.json into local cache.
 * Missing remote file → empty store so first publish can create it.
 */
export async function refreshLetterMemoCloudStore(options?: {
  force?: boolean
  maxAgeMs?: number
}): Promise<LetterMemosStore> {
  const maxAge = options?.maxAgeMs ?? 60_000
  const cached = readLetterMemoCloudCache()
  const meta = readMeta()
  if (
    !options?.force &&
    cached &&
    meta?.fetchedAt &&
    Date.now() - new Date(meta.fetchedAt).getTime() < maxAge
  ) {
    return cached
  }

  const cfg = getLetterMemoCloudConfig()
  const token = getCloudToken()

  try {
    const viaApi = await fetchViaContentsApi(cfg, token)
    if (viaApi) {
      writeLetterMemoCloudCache(viaApi.store, viaApi.sha)
      return viaApi.store
    }
  } catch (err) {
    try {
      const raw = await fetchViaRaw(cfg)
      if (raw) {
        writeLetterMemoCloudCache(raw, null)
        return raw
      }
    } catch {
      /* fall through */
    }
    if (!token) {
      const empty = emptyStore()
      writeLetterMemoCloudCache(empty, null)
      return empty
    }
    throw err
  }

  const empty = emptyStore()
  writeLetterMemoCloudCache(empty, null)
  return empty
}

/** Create, update, or clear one letter's memo in cloud/letterMemos.json. */
export async function publishLetterMemoToCloud(
  letterId: string,
  text: string,
): Promise<LetterMemoEntry | null> {
  const token = getCloudToken()
  if (!token) {
    throw new Error('클라우드 저장 토큰이 없습니다. 설정에서 GitHub 토큰을 먼저 저장하세요.')
  }

  const cfg = getLetterMemoCloudConfig()
  const trimmed = text.trim()
  const entry: LetterMemoEntry | null = trimmed
    ? { text: trimmed, updatedAt: new Date().toISOString() }
    : null

  let lastFail: { status: number; body: string } | null = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let sha: string | null = null
    let store = emptyStore()
    try {
      const latest = await fetchViaContentsApi(cfg, token)
      if (latest) {
        store = latest.store
        sha = latest.sha
      }
    } catch {
      /* Creating a new file — start from empty. */
    }

    store = normalizeStore(store)
    if (entry) {
      store.memos[letterId] = entry
      store.meta.updatedAt = entry.updatedAt
    } else {
      delete store.memos[letterId]
      store.meta.updatedAt = new Date().toISOString()
    }
    store.meta.description =
      store.meta.description || '교사가 적은 글자 메모 — letterId 키.'

    const body: Record<string, string> = {
      message: entry ? `memo: ${letterId}` : `memo: clear ${letterId}`,
      content: encodeBase64Utf8(`${JSON.stringify(store, null, 2)}\n`),
      branch: cfg.branch,
    }
    if (sha) body.sha = sha

    const res = await fetch(contentsApiUrl(cfg), {
      method: 'PUT',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      const result = (await res.json()) as { content?: { sha?: string } }
      writeLetterMemoCloudCache(store, result.content?.sha ?? sha)
      if (entry) {
        void recordTextCloudVersion({
          kind: 'letterMemos',
          letterId,
          text: entry.text,
          message: `memo: ${letterId}`,
        })
      }
      return entry
    }

    const errText = await res.text()
    lastFail = { status: res.status, body: errText }
    if (res.status !== 409 && res.status !== 422) break
  }

  throw new Error(formatCloudWriteError(lastFail?.status ?? 0, lastFail?.body ?? ''))
}

export { hasCloudWriteToken }
