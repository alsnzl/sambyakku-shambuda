import type { GlyphStrokeData, StrokeScript } from '../data/glyphStrokes'
import type { TaughtEntry, TaughtStore } from '../data/taughtStrokes'

const CACHE_KEY = 'sambyakku-stroke-cloud-cache'
const TOKEN_KEY = 'sambyakku-stroke-cloud-token'
const CACHE_META_KEY = 'sambyakku-stroke-cloud-meta'

export type StrokeCloudConfig = {
  owner: string
  repo: string
  branch: string
  path: string
}

type CacheMeta = {
  fetchedAt: string
  sha: string | null
}

function emptyStore(): TaughtStore {
  return {
    meta: {
      description:
        '교사가 클라우드에 저장한 획 — 배포 전 src/data/taughtStrokes.json 으로 내장합니다.',
      updatedAt: null,
      taughtCount: { deva: 0, siddham: 0 },
    },
    deva: {},
    siddham: {},
  }
}

/** Defaults match the GitHub repo created for this project. Override with VITE_STROKE_CLOUD_*. */
export function getCloudConfig(): StrokeCloudConfig {
  return {
    owner: import.meta.env.VITE_STROKE_CLOUD_OWNER || 'alsnzl',
    repo: import.meta.env.VITE_STROKE_CLOUD_REPO || 'sambyakku-shambuda',
    branch: import.meta.env.VITE_STROKE_CLOUD_BRANCH || 'main',
    path: import.meta.env.VITE_STROKE_CLOUD_PATH || 'cloud/taughtStrokes.json',
  }
}

export function getCloudToken(): string | null {
  const fromEnv = import.meta.env.VITE_STROKE_CLOUD_TOKEN as string | undefined
  if (fromEnv?.trim()) return fromEnv.trim()
  try {
    const t = localStorage.getItem(TOKEN_KEY)
    return t?.trim() || null
  } catch {
    return null
  }
}

export function setCloudToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token.trim())
}

export function clearCloudToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export function hasCloudWriteToken(): boolean {
  return Boolean(getCloudToken())
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

export function readCloudCache(): TaughtStore | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as TaughtStore
  } catch {
    return null
  }
}

export function writeCloudCache(store: TaughtStore, sha: string | null = null) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(store))
  writeMeta({
    fetchedAt: new Date().toISOString(),
    sha: sha ?? readMeta()?.sha ?? null,
  })
}

export function getCloudCacheMeta(): CacheMeta | null {
  return readMeta()
}

export function getCloudTaughtEntry(
  letterId: string,
  script: StrokeScript,
): TaughtEntry | null {
  const store = readCloudCache()
  return store?.[script]?.[letterId] ?? null
}

export function getCloudTaughtStrokes(
  letterId: string,
  script: StrokeScript,
): GlyphStrokeData | null {
  const entry = getCloudTaughtEntry(letterId, script)
  if (!entry) return null
  return { d: entry.d, strokes: entry.strokes }
}

function recount(store: TaughtStore) {
  store.meta.taughtCount = {
    deva: Object.keys(store.deva).length,
    siddham: Object.keys(store.siddham).length,
  }
  store.meta.updatedAt = new Date().toISOString()
}

function rawUrl(cfg: StrokeCloudConfig) {
  return `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${cfg.path}`
}

function contentsApiUrl(cfg: StrokeCloudConfig) {
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

type ContentsResponse = {
  sha: string
  content?: string
  encoding?: string
  message?: string
}

async function fetchViaContentsApi(
  cfg: StrokeCloudConfig,
  token: string | null,
): Promise<{ store: TaughtStore; sha: string } | null> {
  const url = `${contentsApiUrl(cfg)}?ref=${encodeURIComponent(cfg.branch)}`
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url, { headers })
  if (res.status === 404) return null
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`클라우드 읽기 실패 (${res.status}): ${body.slice(0, 200)}`)
  }
  const json = (await res.json()) as ContentsResponse
  if (!json.content) throw new Error('클라우드 파일 내용이 비어 있습니다.')
  const text = decodeBase64Utf8(json.content)
  const store = JSON.parse(text) as TaughtStore
  return { store, sha: json.sha }
}

async function fetchViaRaw(cfg: StrokeCloudConfig): Promise<TaughtStore | null> {
  const res = await fetch(`${rawUrl(cfg)}?t=${Date.now()}`, {
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`클라우드 raw 읽기 실패 (${res.status})`)
  }
  return (await res.json()) as TaughtStore
}

/** Pull latest taught strokes from GitHub into local cache. */
export async function refreshCloudStore(options?: {
  force?: boolean
  maxAgeMs?: number
}): Promise<TaughtStore> {
  const maxAge = options?.maxAgeMs ?? 60_000
  const cached = readCloudCache()
  const meta = readMeta()
  if (
    !options?.force &&
    cached &&
    meta?.fetchedAt &&
    Date.now() - new Date(meta.fetchedAt).getTime() < maxAge
  ) {
    return cached
  }

  const cfg = getCloudConfig()
  const token = getCloudToken()

  try {
    const viaApi = await fetchViaContentsApi(cfg, token)
    if (viaApi) {
      writeCloudCache(viaApi.store, viaApi.sha)
      return viaApi.store
    }
  } catch (err) {
    // Fall back to raw if API fails (e.g. no token on public repo)
    if (!token) {
      const raw = await fetchViaRaw(cfg)
      if (raw) {
        writeCloudCache(raw, null)
        return raw
      }
      const empty = emptyStore()
      writeCloudCache(empty, null)
      return empty
    }
    throw err
  }

  // File missing — initialize empty locally; first publish will create it
  const empty = emptyStore()
  writeCloudCache(empty, null)
  return empty
}

export async function publishLetterToCloud(
  script: StrokeScript,
  letterId: string,
  data: GlyphStrokeData,
  note?: string,
): Promise<TaughtEntry> {
  const token = getCloudToken()
  if (!token) {
    throw new Error(
      '클라우드 저장 토큰이 없습니다. 획 가르치기에서 GitHub 토큰을 먼저 저장하세요.',
    )
  }

  const cfg = getCloudConfig()
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  // Re-read latest to avoid overwriting other devices' work
  let sha: string | null = null
  let store = emptyStore()
  const latest = await fetchViaContentsApi(cfg, token)
  if (latest) {
    store = latest.store
    sha = latest.sha
  }

  const entry: TaughtEntry = {
    d: data.d,
    strokes: data.strokes,
    taughtAt: new Date().toISOString(),
    ...(note ? { note } : {}),
  }
  store[script][letterId] = entry
  recount(store)

  const body: Record<string, string> = {
    message: `teach: ${script}/${letterId} (${entry.strokes.length} strokes)`,
    content: encodeBase64Utf8(`${JSON.stringify(store, null, 2)}\n`),
    branch: cfg.branch,
  }
  if (sha) body.sha = sha

  const res = await fetch(contentsApiUrl(cfg), {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`클라우드 저장 실패 (${res.status}): ${text.slice(0, 240)}`)
  }

  const result = (await res.json()) as { content?: { sha?: string } }
  writeCloudCache(store, result.content?.sha ?? sha)
  return entry
}

export function cloudRepoLabel(): string {
  const cfg = getCloudConfig()
  return `${cfg.owner}/${cfg.repo}`
}
