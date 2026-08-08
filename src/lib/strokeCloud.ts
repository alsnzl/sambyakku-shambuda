import type { GlyphStrokeData, StrokeScript } from '../data/glyphStrokes'
import type { TaughtEntry, TaughtStore } from '../data/taughtStrokes'
import { setTaughtFontEntry } from '../data/taughtStrokes'
import { getScriptFontChoice } from './customScriptFonts'
import {
  countFontMapLetters,
  getFontMapEntry,
  normalizeTaughtFontMap,
  resolveStrokeFontFace,
  strokeFontLabel,
} from './strokeFontScope'
import { recordAutoStrokeVersion } from './strokeVersionsStore'

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

/** Token from localStorage only (ignores VITE_STROKE_CLOUD_TOKEN). */
export function getLocalCloudToken(): string | null {
  try {
    const t = localStorage.getItem(TOKEN_KEY)
    return t?.trim() || null
  } catch {
    return null
  }
}

export function cloudTokenSource(): 'env' | 'local' | 'none' {
  const fromEnv = (import.meta.env.VITE_STROKE_CLOUD_TOKEN as string | undefined)?.trim()
  if (fromEnv) return 'env'
  if (getLocalCloudToken()) return 'local'
  return 'none'
}

export type CloudTokenProbe = {
  ok: boolean
  kind: 'ok' | 'missing' | 'unauthorized' | 'forbidden' | 'error'
  detail: string
  repo: string
}

/** Lightweight check: can this token read the cloud file path on GitHub? */
export async function probeCloudToken(
  token: string | null = getCloudToken(),
): Promise<CloudTokenProbe> {
  const cfg = getCloudConfig()
  const repo = `${cfg.owner}/${cfg.repo}`
  if (!token?.trim()) {
    return { ok: false, kind: 'missing', detail: '토큰이 없습니다', repo }
  }

  const url = `${contentsApiUrl(cfg)}?ref=${encodeURIComponent(cfg.branch)}`
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        Authorization: `Bearer ${token.trim()}`,
      },
    })
    if (res.status === 401) {
      return { ok: false, kind: 'unauthorized', detail: '토큰이 유효하지 않습니다', repo }
    }
    if (res.status === 403) {
      return {
        ok: false,
        kind: 'forbidden',
        detail: '저장소 접근 권한이 없습니다 (Contents 권한 확인)',
        repo,
      }
    }
    // 200 = file visible with this token
    if (res.ok) {
      return { ok: true, kind: 'ok', detail: '활성화 · 저장소 접근 가능', repo }
    }
    // 404 with token: either file missing OR token cannot see it (GitHub hides with 404).
    if (res.status === 404) {
      const anon = await fetch(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })
      if (anon.ok) {
        return {
          ok: false,
          kind: 'forbidden',
          detail:
            '공개 파일은 보이지만 이 토큰으로는 읽히지 않습니다. 저장소 접근 + Contents 읽기·쓰기를 확인하세요.',
          repo,
        }
      }
      return { ok: true, kind: 'ok', detail: '활성화 · 저장소 접근 가능(파일 아직 없음)', repo }
    }
    const body = await res.text()
    return {
      ok: false,
      kind: 'error',
      detail: `확인 실패 (${res.status}): ${body.slice(0, 120)}`,
      repo,
    }
  } catch (err) {
    return {
      ok: false,
      kind: 'error',
      detail: err instanceof Error ? err.message : String(err),
      repo,
    }
  }
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
  fontFace: string = getScriptFontChoice(script),
): TaughtEntry | null {
  const store = readCloudCache()
  return getFontMapEntry(script, store?.[script]?.[letterId], fontFace)
}

export function listCloudTaughtFontsForLetter(
  letterId: string,
  script: StrokeScript,
): { face: string; entry: TaughtEntry }[] {
  const store = readCloudCache()
  const map = normalizeTaughtFontMap(script, store?.[script]?.[letterId])
  return Object.entries(map).map(([face, entry]) => ({ face, entry }))
}

export function getCloudTaughtStrokes(
  letterId: string,
  script: StrokeScript,
  fontFace: string = getScriptFontChoice(script),
): GlyphStrokeData | null {
  const entry = getCloudTaughtEntry(letterId, script, fontFace)
  if (!entry) return null
  return { d: entry.d, strokes: entry.strokes }
}

function recount(store: TaughtStore) {
  store.meta.taughtCount = {
    deva: countFontMapLetters(store.deva as Record<string, unknown>, 'deva'),
    siddham: countFontMapLetters(store.siddham as Record<string, unknown>, 'siddham'),
  }
  store.meta.updatedAt = new Date().toISOString()
}

function rawUrl(cfg: StrokeCloudConfig) {
  return `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${cfg.path}`
}

function contentsApiUrl(cfg: StrokeCloudConfig) {
  return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}`
}

export function formatCloudWriteError(status: number, body: string): string {
  const snippet = body.replace(/\s+/g, ' ').slice(0, 160)
  if (status === 401) {
    return '토큰이 유효하지 않습니다. 설정에서 GitHub 토큰을 다시 저장하세요.'
  }
  if (status === 403) {
    return '저장 권한이 없습니다. fine-grained PAT에 이 저장소 Contents 읽기·쓰기 권한이 있는지 확인하세요.'
  }
  if (status === 404) {
    return '저장소 접근이 거절되었습니다(GitHub는 권한 없음을 404로 숨깁니다). 토큰에 이 저장소 + Contents 쓰기를 주세요.'
  }
  if (status === 409) {
    // GitHub wording is often "{path} does not match {sha}" — not about the PAT.
    return '파일 버전(SHA)이 맞지 않습니다. 토큰 문제가 아니라 기존 cloud 파일을 덮어쓸 때 최신 SHA가 필요합니다. 다시 저장해 보세요.'
  }
  if (status === 422) {
    if (/sha/i.test(snippet)) {
      return '기존 클라우드 파일이 있는데 SHA 없이 저장을 시도했습니다. 토큰의 저장소 Contents 읽기·쓰기를 확인한 뒤 다시 저장하세요.'
    }
    return `GitHub가 저장을 거절했습니다: ${snippet || 'sha/경로를 확인하세요'}`
  }
  return `클라우드 저장 실패 (${status})${snippet ? `: ${snippet}` : ''}`
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

  async function once(auth: string | null) {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    if (auth) headers.Authorization = `Bearer ${auth}`
    return fetch(url, { headers, cache: 'no-store' })
  }

  let res = await once(token)
  // Limited PATs can 404 public files; anonymous read still works and gives the real sha.
  if (res.status === 404 && token) {
    res = await once(null)
  }
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

async function putTaughtStore(
  cfg: StrokeCloudConfig,
  token: string,
  store: TaughtStore,
  sha: string | null,
  message: string,
): Promise<{ ok: true; sha: string | null } | { ok: false; status: number; body: string }> {
  const body: Record<string, string> = {
    message,
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

  if (!res.ok) {
    return { ok: false, status: res.status, body: await res.text() }
  }

  const result = (await res.json()) as { content?: { sha?: string } }
  return { ok: true, sha: result.content?.sha ?? sha }
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
  font?: { fontFace?: string | null; fontLabel?: string | null } | null,
): Promise<TaughtEntry> {
  const token = getCloudToken()
  if (!token) {
    throw new Error(
      '클라우드 저장 토큰이 없습니다. 설정에서 GitHub 토큰을 먼저 저장하세요.',
    )
  }

  const cfg = getCloudConfig()
  const face = resolveStrokeFontFace(script, font?.fontFace)
  const label = strokeFontLabel(script, face, font?.fontLabel)
  const entry: TaughtEntry = {
    d: data.d,
    strokes: data.strokes,
    taughtAt: new Date().toISOString(),
    fontFace: face,
    fontLabel: label,
    ...(note ? { note } : {}),
  }
  const message = `teach: ${script}/${letterId}@${face} (${entry.strokes.length} strokes, ${label})`

  let lastFail: { status: number; body: string } | null = null

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let store = emptyStore()
    let sha: string | null = null
    const latest = await fetchViaContentsApi(cfg, token)
    if (latest) {
      store = latest.store
      sha = latest.sha
    }

    setTaughtFontEntry(store[script], letterId, script, entry)
    recount(store)

    const result = await putTaughtStore(cfg, token, store, sha, message)
    if (result.ok) {
      writeCloudCache(store, result.sha)
      // Version snapshot lives under cloud/versions/ — never rewrites live taughtStrokes here.
      void recordAutoStrokeVersion({
        script,
        letterId,
        entry,
        message,
        kind: 'auto-publish',
      })
      return entry
    }

    lastFail = { status: result.status, body: result.body }
    // Conflict: another write landed — reload and retry once
    if (result.status !== 409) break
  }

  throw new Error(
    formatCloudWriteError(lastFail?.status ?? 0, lastFail?.body ?? ''),
  )
}

export function cloudRepoLabel(): string {
  const cfg = getCloudConfig()
  return `${cfg.owner}/${cfg.repo}`
}
