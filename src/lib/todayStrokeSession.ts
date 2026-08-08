import type { StrokeScript } from '../data/glyphStrokes'

const STORAGE_KEY = 'sambyakku-today-stroke-session'

export type TodayUploadStatus = 'success' | 'local-only' | 'failed'

export type TodayStrokeRecord = {
  id: string
  script: StrokeScript
  letterId: string
  fontFace: string
  fontLabel: string
  strokeCount: number
  recordedAt: string
  upload: TodayUploadStatus
  error?: string
}

export type TodayStrokeSession = {
  day: string
  records: TodayStrokeRecord[]
}

function todayKey(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function recordId(script: StrokeScript, letterId: string, fontFace: string): string {
  return `${script}:${letterId}:${fontFace}`
}

function readRaw(): TodayStrokeSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as TodayStrokeSession
  } catch {
    return null
  }
}

function writeRaw(session: TodayStrokeSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function getTodayStrokeSession(): TodayStrokeSession {
  const day = todayKey()
  const existing = readRaw()
  if (existing?.day === day) return existing
  const fresh: TodayStrokeSession = { day, records: [] }
  writeRaw(fresh)
  return fresh
}

export function listTodayStrokeRecords(): TodayStrokeRecord[] {
  return getTodayStrokeSession().records.slice().sort((a, b) => {
    return new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
  })
}

export function recordTodayStrokeAttempt(input: {
  script: StrokeScript
  letterId: string
  fontFace: string
  fontLabel: string
  strokeCount: number
  upload: TodayUploadStatus
  error?: string
}): TodayStrokeRecord {
  const session = getTodayStrokeSession()
  const recordedAt = new Date().toISOString()
  const id = recordId(input.script, input.letterId, input.fontFace)
  const next: TodayStrokeRecord = {
    id,
    script: input.script,
    letterId: input.letterId,
    fontFace: input.fontFace,
    fontLabel: input.fontLabel,
    strokeCount: input.strokeCount,
    recordedAt,
    upload: input.upload,
    ...(input.error ? { error: input.error } : {}),
  }
  session.records = [next, ...session.records.filter((r) => r.id !== id)]
  writeRaw(session)
  return next
}

export function todayStrokeSummary() {
  const records = listTodayStrokeRecords()
  return {
    total: records.length,
    success: records.filter((r) => r.upload === 'success').length,
    localOnly: records.filter((r) => r.upload === 'local-only').length,
    failed: records.filter((r) => r.upload === 'failed').length,
  }
}
