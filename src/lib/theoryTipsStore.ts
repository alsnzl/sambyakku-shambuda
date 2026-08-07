import { getTheoryBlurb } from '../data/theoryTips'
import { getCloudToken, hasCloudWriteToken } from './strokeCloud'

const LOCAL_KEY = 'sambyakku-theory-overrides'
const CACHE_KEY = 'sambyakku-theory-cloud-cache'
const CACHE_META_KEY = 'sambyakku-theory-cloud-meta'

export type TheoryTipEntry = {
  text: string
  updatedAt: string
}

export type TheoryTipsStore = {
  meta: {
    description: string
    updatedAt: string | null
  }
  tips: Record<string, TheoryTipEntry>
}

type LocalDraft = TheoryTipEntry

type CacheMeta = {
  fetchedAt: string
  sha: string | null
}

type TheoryCloudConfig = {
  owner: string
  repo: string
  branch: string
  path: string
}

function emptyStore(): TheoryTipsStore {
  return {
    meta: {
      description: '교사가 편집한 이론·쓰기 팁 — letterId 키.',
      updatedAt: null,
    },
    tips: {},
  }
}

function getTheoryCloudConfig(): TheoryCloudConfig {
  return {
    owner: import.meta.env.VITE_STROKE_CLOUD_OWNER || 'alsnzl',
    repo: import.meta.env.VITE_STROKE_CLOUD_REPO || 'sambyakku-shambuda',
    branch: import.meta.env.VITE_STROKE_CLOUD_BRANCH || 'main',
    path: import.meta.env.VITE_THEORY_CLOUD_PATH || 'cloud/theoryTips.json',
  }
}

function rawUrl(cfg: TheoryCloudConfig) {
  return `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${cfg.path}`
}

function contentsApiUrl(cfg: TheoryCloudConfig) {
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

export function loadLocalTheoryTip(letterId: string): LocalDraft | null {
  return readLocalAll()[letterId] ?? null
}

export function saveLocalTheoryTip(letterId: string, text: string): LocalDraft {
  const entry: LocalDraft = { text: text.trim(), updatedAt: new Date().toISOString() }
  const map = readLocalAll()
  map[letterId] = entry
  writeLocalAll(map)
  return entry
}

export function clearLocalTheoryTip(letterId: string) {
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

export function readTheoryCloudCache(): TheoryTipsStore | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as TheoryTipsStore
  } catch {
    return null
  }
}

function writeTheoryCloudCache(store: TheoryTipsStore, sha: string | null = null) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(store))
  writeMeta({
    fetchedAt: new Date().toISOString(),
    sha: sha ?? readMeta()?.sha ?? null,
  })
}

export function getCloudTheoryTip(letterId: string): TheoryTipEntry | null {
  return readTheoryCloudCache()?.tips?.[letterId] ?? null
}

/** Bundled default from theoryTips.ts / letter.note */
export function getDefaultTheoryBlurb(letterId: string): string | null {
  return getTheoryBlurb(letterId)
}

export type TheoryTipSource = 'cloud' | 'local' | 'default' | 'empty'

export type EffectiveTheoryTip = {
  text: string
  source: TheoryTipSource
  updatedAt: string | null
  defaultText: string | null
}

/** Resolve: local draft → cloud cache → bundled default. */
export function getEffectiveTheoryTip(letterId: string): EffectiveTheoryTip {
  const defaultText = getDefaultTheoryBlurb(letterId)
  const local = loadLocalTheoryTip(letterId)
  if (local) {
    return {
      text: local.text,
      source: 'local',
      updatedAt: local.updatedAt,
      defaultText,
    }
  }
  const cloud = getCloudTheoryTip(letterId)
  if (cloud) {
    return {
      text: cloud.text,
      source: 'cloud',
      updatedAt: cloud.updatedAt,
      defaultText,
    }
  }
  if (defaultText) {
    return {
      text: defaultText,
      source: 'default',
      updatedAt: null,
      defaultText,
    }
  }
  return { text: '', source: 'empty', updatedAt: null, defaultText: null }
}

type ContentsResponse = {
  sha: string
  content?: string
}

async function fetchViaContentsApi(
  cfg: TheoryCloudConfig,
  token: string | null,
): Promise<{ store: TheoryTipsStore; sha: string } | null> {
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
    throw new Error(`이론 팁 클라우드 읽기 실패 (${res.status}): ${body.slice(0, 200)}`)
  }
  const json = (await res.json()) as ContentsResponse
  if (!json.content) throw new Error('이론 팁 클라우드 파일이 비어 있습니다.')
  const store = JSON.parse(decodeBase64Utf8(json.content)) as TheoryTipsStore
  return { store, sha: json.sha }
}

async function fetchViaRaw(cfg: TheoryCloudConfig): Promise<TheoryTipsStore | null> {
  const res = await fetch(`${rawUrl(cfg)}?t=${Date.now()}`, { cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`이론 팁 raw 읽기 실패 (${res.status})`)
  return (await res.json()) as TheoryTipsStore
}

export async function refreshTheoryCloudStore(options?: {
  force?: boolean
  maxAgeMs?: number
}): Promise<TheoryTipsStore> {
  const maxAge = options?.maxAgeMs ?? 60_000
  const cached = readTheoryCloudCache()
  const meta = readMeta()
  if (
    !options?.force &&
    cached &&
    meta?.fetchedAt &&
    Date.now() - new Date(meta.fetchedAt).getTime() < maxAge
  ) {
    return cached
  }

  const cfg = getTheoryCloudConfig()
  const token = getCloudToken()

  try {
    const viaApi = await fetchViaContentsApi(cfg, token)
    if (viaApi) {
      writeTheoryCloudCache(viaApi.store, viaApi.sha)
      return viaApi.store
    }
  } catch (err) {
    if (!token) {
      const raw = await fetchViaRaw(cfg)
      if (raw) {
        writeTheoryCloudCache(raw, null)
        return raw
      }
      const empty = emptyStore()
      writeTheoryCloudCache(empty, null)
      return empty
    }
    throw err
  }

  const empty = emptyStore()
  writeTheoryCloudCache(empty, null)
  return empty
}

export async function publishTheoryTipToCloud(
  letterId: string,
  text: string,
): Promise<TheoryTipEntry> {
  const token = getCloudToken()
  if (!token) {
    throw new Error('클라우드 저장 토큰이 없습니다. 설정에서 GitHub 토큰을 먼저 저장하세요.')
  }

  const cfg = getTheoryCloudConfig()
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  let sha: string | null = null
  let store = emptyStore()
  const latest = await fetchViaContentsApi(cfg, token)
  if (latest) {
    store = latest.store
    sha = latest.sha
  }

  const entry: TheoryTipEntry = {
    text: text.trim(),
    updatedAt: new Date().toISOString(),
  }
  store.tips[letterId] = entry
  store.meta.updatedAt = entry.updatedAt

  const body: Record<string, string> = {
    message: `theory: ${letterId}`,
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
    const errText = await res.text()
    throw new Error(`이론 팁 클라우드 저장 실패 (${res.status}): ${errText.slice(0, 240)}`)
  }

  const result = (await res.json()) as { content?: { sha?: string } }
  writeTheoryCloudCache(store, result.content?.sha ?? sha)
  return entry
}

export { hasCloudWriteToken }
