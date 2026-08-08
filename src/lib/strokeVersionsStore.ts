import type { StrokeScript } from '../data/glyphStrokes'
import type { TaughtEntry } from '../data/taughtStrokes'

const VERSIONS_DIR = 'cloud/versions/taughtStrokes'
const INDEX_PATH = `${VERSIONS_DIR}/index.json`
const INDEX_MAX = 200
const TOKEN_KEY = 'sambyakku-stroke-cloud-token'

type CloudRepoConfig = {
  owner: string
  repo: string
  branch: string
}

function getRepoConfig(): CloudRepoConfig {
  return {
    owner: import.meta.env.VITE_STROKE_CLOUD_OWNER || 'alsnzl',
    repo: import.meta.env.VITE_STROKE_CLOUD_REPO || 'sambyakku-shambuda',
    branch: import.meta.env.VITE_STROKE_CLOUD_BRANCH || 'main',
  }
}

function getWriteToken(): string | null {
  const fromEnv = import.meta.env.VITE_STROKE_CLOUD_TOKEN as string | undefined
  if (fromEnv?.trim()) return fromEnv.trim()
  try {
    return localStorage.getItem(TOKEN_KEY)?.trim() || null
  } catch {
    return null
  }
}

export type StrokeVersionKind = 'auto-publish' | 'pre-restore' | 'manual'

export type StrokeVersionMeta = {
  id: string
  createdAt: string
  script: StrokeScript
  letterId: string
  fontFace: string
  fontLabel: string
  strokeCount: number
  path: string
  message: string
  kind: StrokeVersionKind
}

export type StrokeVersionIndex = {
  meta: {
    description: string
    updatedAt: string | null
  }
  versions: StrokeVersionMeta[]
}

export type StrokeVersionSnapshot = {
  meta: {
    createdAt: string
    kind: StrokeVersionKind
    message: string
  }
  script: StrokeScript
  letterId: string
  fontFace: string
  fontLabel: string
  entry: TaughtEntry
}

function emptyIndex(): StrokeVersionIndex {
  return {
    meta: {
      description: '획 기록 버전 인덱스 — 라이브 taughtStrokes.json 과 별도. 복원·미리보기용.',
      updatedAt: null,
    },
    versions: [],
  }
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

function contentsUrl(cfg: CloudRepoConfig, path: string) {
  return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`
}

function versionId(
  createdAt: string,
  script: StrokeScript,
  letterId: string,
  fontFace: string,
): string {
  const stamp = createdAt.replace(/[:.]/g, '-').replace(/Z$/, 'Z')
  const face = fontFace.replace(/[^a-zA-Z0-9_-]+/g, '-')
  return `${stamp}_${script}_${letterId}_${face}`
}

async function getJsonFile<T>(
  cfg: CloudRepoConfig,
  path: string,
  token: string | null,
): Promise<{ data: T; sha: string } | null> {
  const url = `${contentsUrl(cfg, path)}?ref=${encodeURIComponent(cfg.branch)}`
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  let res = await fetch(url, { headers, cache: 'no-store' })
  if (res.status === 404 && token) {
    res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      cache: 'no-store',
    })
  }
  if (res.status === 404) return null
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`버전 파일 읽기 실패 (${res.status}): ${body.slice(0, 160)}`)
  }
  const json = (await res.json()) as { sha: string; content?: string }
  if (!json.content) throw new Error('버전 파일 내용이 비어 있습니다.')
  return { data: JSON.parse(decodeBase64Utf8(json.content)) as T, sha: json.sha }
}

async function putJsonFile(
  cfg: CloudRepoConfig,
  path: string,
  token: string,
  data: unknown,
  sha: string | null,
  message: string,
): Promise<{ ok: true; sha: string | null } | { ok: false; status: number; body: string }> {
  const body: Record<string, string> = {
    message,
    content: encodeBase64Utf8(`${JSON.stringify(data, null, 2)}\n`),
    branch: cfg.branch,
  }
  if (sha) body.sha = sha

  const res = await fetch(contentsUrl(cfg, path), {
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

/** Load version index (empty if missing). Does not touch live taughtStrokes.json. */
export async function fetchStrokeVersionIndex(): Promise<StrokeVersionIndex> {
  const cfg = getRepoConfig()
  const token = getWriteToken()
  const found = await getJsonFile<StrokeVersionIndex>(cfg, INDEX_PATH, token)
  return found?.data ?? emptyIndex()
}

export async function fetchStrokeVersionSnapshot(
  pathOrId: string,
): Promise<StrokeVersionSnapshot | null> {
  const cfg = getRepoConfig()
  const token = getWriteToken()
  const path = pathOrId.includes('/')
    ? pathOrId
    : `${VERSIONS_DIR}/${pathOrId}.json`
  const found = await getJsonFile<StrokeVersionSnapshot>(cfg, path, token)
  return found?.data ?? null
}

export type SaveStrokeVersionInput = {
  script: StrokeScript
  letterId: string
  entry: TaughtEntry
  message: string
  kind?: StrokeVersionKind
}

/**
 * Write a letter snapshot + index entry under cloud/versions/taughtStrokes/.
 * Never writes cloud/taughtStrokes.json.
 */
export async function saveStrokeVersionSnapshot(
  input: SaveStrokeVersionInput,
): Promise<StrokeVersionMeta> {
  const token = getWriteToken()
  if (!token) {
    throw new Error('버전 저장에는 클라우드 토큰이 필요합니다.')
  }

  const cfg = getRepoConfig()
  const createdAt = new Date().toISOString()
  const kind = input.kind ?? 'auto-publish'
  const fontFace = input.entry.fontFace || 'default'
  const fontLabel = input.entry.fontLabel || fontFace
  const id = versionId(createdAt, input.script, input.letterId, fontFace)
  const path = `${VERSIONS_DIR}/${id}.json`

  const snapshot: StrokeVersionSnapshot = {
    meta: { createdAt, kind, message: input.message },
    script: input.script,
    letterId: input.letterId,
    fontFace,
    fontLabel,
    entry: input.entry,
  }

  const snapPut = await putJsonFile(
    cfg,
    path,
    token,
    snapshot,
    null,
    `version: ${input.script}/${input.letterId}@${fontFace} (${kind})`,
  )
  if (!snapPut.ok) {
    throw new Error(
      `버전 스냅샷 저장 실패 (${snapPut.status}): ${snapPut.body.slice(0, 160)}`,
    )
  }

  const meta: StrokeVersionMeta = {
    id,
    createdAt,
    script: input.script,
    letterId: input.letterId,
    fontFace,
    fontLabel,
    strokeCount: input.entry.strokes?.length ?? 0,
    path,
    message: input.message,
    kind,
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await getJsonFile<StrokeVersionIndex>(cfg, INDEX_PATH, token)
    const index = current?.data ?? emptyIndex()
    index.versions = [meta, ...index.versions.filter((v) => v.id !== meta.id)].slice(
      0,
      INDEX_MAX,
    )
    index.meta.updatedAt = createdAt

    const indexPut = await putJsonFile(
      cfg,
      INDEX_PATH,
      token,
      index,
      current?.sha ?? null,
      `version-index: ${input.script}/${input.letterId}@${fontFace}`,
    )
    if (indexPut.ok) return meta
    if (indexPut.status !== 409) {
      throw new Error(
        `버전 인덱스 저장 실패 (${indexPut.status}): ${indexPut.body.slice(0, 160)}`,
      )
    }
  }

  throw new Error('버전 인덱스 저장 충돌이 반복되었습니다.')
}

/** Best-effort snapshot after a successful live publish. Never fails the caller. */
export async function recordAutoStrokeVersion(
  input: SaveStrokeVersionInput,
): Promise<StrokeVersionMeta | null> {
  try {
    return await saveStrokeVersionSnapshot({ ...input, kind: input.kind ?? 'auto-publish' })
  } catch (err) {
    console.warn('[strokeVersions] auto snapshot skipped', err)
    return null
  }
}
