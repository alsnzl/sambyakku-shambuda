/**
 * Version snapshots for theory tips / hangul hints.
 * Writes only under cloud/versions/{kind}/ — never rewrites live tip/hint JSON.
 */

const TOKEN_KEY = 'sambyakku-stroke-cloud-token'
const INDEX_MAX = 200

export type TextVersionKind = 'theoryTips' | 'hangulHints' | 'letterMemos'

type RepoConfig = {
  owner: string
  repo: string
  branch: string
}

export type TextVersionMeta = {
  id: string
  createdAt: string
  letterId: string
  path: string
  message: string
  kind: 'auto-publish'
}

export type TextVersionIndex = {
  meta: { description: string; updatedAt: string | null }
  versions: TextVersionMeta[]
}

export type TextVersionSnapshot = {
  meta: { createdAt: string; message: string; kind: 'auto-publish' }
  letterId: string
  text: string
}

function getRepoConfig(): RepoConfig {
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

function versionsDir(kind: TextVersionKind) {
  return `cloud/versions/${kind}`
}

function indexPath(kind: TextVersionKind) {
  return `${versionsDir(kind)}/index.json`
}

function emptyIndex(kind: TextVersionKind): TextVersionIndex {
  const description =
    kind === 'theoryTips'
      ? '이론·쓰기 팁 버전 인덱스 — 라이브 theoryTips.json 과 별도.'
      : kind === 'hangulHints'
        ? '한글 발음 힌트 버전 인덱스 — 라이브 hangulHints.json 과 별도.'
        : '글 메모 버전 인덱스 — 라이브 letterMemos.json 과 별도.'
  return {
    meta: {
      description,
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

function contentsUrl(cfg: RepoConfig, path: string) {
  return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`
}

async function getJsonFile<T>(
  cfg: RepoConfig,
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
  if (!res.ok) throw new Error(`버전 읽기 실패 (${res.status})`)
  const json = (await res.json()) as { sha: string; content?: string }
  if (!json.content) throw new Error('버전 파일이 비어 있습니다.')
  return { data: JSON.parse(decodeBase64Utf8(json.content)) as T, sha: json.sha }
}

async function putJsonFile(
  cfg: RepoConfig,
  path: string,
  token: string,
  data: unknown,
  sha: string | null,
  message: string,
): Promise<boolean> {
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
  return res.ok
}

/** Best-effort letter text snapshot. Never touches live tip/hint files. */
export async function recordTextCloudVersion(input: {
  kind: TextVersionKind
  letterId: string
  text: string
  message: string
}): Promise<void> {
  try {
    const token = getWriteToken()
    if (!token) return
    const cfg = getRepoConfig()
    const createdAt = new Date().toISOString()
    const id = `${createdAt.replace(/[:.]/g, '-')}_${input.letterId}`
    const path = `${versionsDir(input.kind)}/${id}.json`
    const snapshot: TextVersionSnapshot = {
      meta: { createdAt, message: input.message, kind: 'auto-publish' },
      letterId: input.letterId,
      text: input.text,
    }
    const snapOk = await putJsonFile(
      cfg,
      path,
      token,
      snapshot,
      null,
      `version-${input.kind}: ${input.letterId}`,
    )
    if (!snapOk) return

    const meta: TextVersionMeta = {
      id,
      createdAt,
      letterId: input.letterId,
      path,
      message: input.message,
      kind: 'auto-publish',
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = await getJsonFile<TextVersionIndex>(
        cfg,
        indexPath(input.kind),
        token,
      )
      const index = current?.data ?? emptyIndex(input.kind)
      index.versions = [meta, ...index.versions.filter((v) => v.id !== meta.id)].slice(
        0,
        INDEX_MAX,
      )
      index.meta.updatedAt = createdAt
      const ok = await putJsonFile(
        cfg,
        indexPath(input.kind),
        token,
        index,
        current?.sha ?? null,
        `version-index-${input.kind}: ${input.letterId}`,
      )
      if (ok) return
    }
  } catch (err) {
    console.warn('[textCloudVersions] snapshot skipped', err)
  }
}
