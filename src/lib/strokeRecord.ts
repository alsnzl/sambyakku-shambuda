import type { GlyphStroke, GlyphStrokeData, StrokeScript } from '../data/glyphStrokes'
import { getGlyphStrokes } from '../data/glyphStrokes'
import {
  getTaughtStrokes,
  getTaughtEntry,
  getTaughtFontMap,
  isTaughtLetter,
  type TaughtEntry,
} from '../data/taughtStrokes'
import { getStrokeSteps } from '../data/strokes'
import type { ScriptTrack } from '../types/track'
import { getScriptFontChoice } from './customScriptFonts'
import {
  getCloudTaughtEntry,
  getCloudTaughtStrokes,
  listCloudTaughtFontsForLetter,
} from './strokeCloud'
import {
  resolveStrokeFontFace,
  strokeFontLabel,
  type TaughtFontMap,
} from './strokeFontScope'

const STORAGE_KEY = 'sambyakku-stroke-overrides'
const STORAGE_VERSION_KEY = 'sambyakku-stroke-overrides-v'

export type StrokeSource = 'cloud' | 'taught' | 'local' | 'generated'

export type RecordedStroke = {
  /** raw points in 0–240 viewBox */
  points: [number, number][]
}

type StoredEntry = GlyphStrokeData & {
  savedAt: string
  note?: string
  fontFace?: string
  fontLabel?: string
}

export const DEFAULT_TEACH_GUIDE_TIP = '펜으로 · 획 순서대로 · 윤곽을 충분히 덮기'

/** script → letterId → fontFace → entry */
type Store = Partial<Record<StrokeScript, Record<string, TaughtFontMap>>>

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return migrateStore(JSON.parse(raw) as Record<string, unknown>)
  } catch {
    return {}
  }
}

function normalizeLocalLetter(script: StrokeScript, raw: unknown): TaughtFontMap {
  if (!raw || typeof raw !== 'object') return {}

  const asFlat = raw as StoredEntry & TaughtEntry
  if (typeof asFlat.d === 'string' && Array.isArray(asFlat.strokes)) {
    const face = resolveStrokeFontFace(script, asFlat.fontFace)
    return {
      [face]: {
        d: asFlat.d,
        strokes: asFlat.strokes,
        taughtAt: asFlat.taughtAt || asFlat.savedAt || new Date().toISOString(),
        note: asFlat.note,
        fontFace: face,
        fontLabel: strokeFontLabel(script, face, asFlat.fontLabel),
      },
    }
  }

  const out: TaughtFontMap = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue
    const e = value as StoredEntry & TaughtEntry
    if (typeof e.d !== 'string' || !Array.isArray(e.strokes)) continue
    const face = resolveStrokeFontFace(script, e.fontFace ?? key)
    out[face] = {
      d: e.d,
      strokes: e.strokes,
      taughtAt: e.taughtAt || e.savedAt || new Date().toISOString(),
      note: e.note,
      fontFace: face,
      fontLabel: strokeFontLabel(script, face, e.fontLabel),
    }
  }
  return out
}

function migrateStore(parsed: Record<string, unknown>): Store {
  const out: Store = {}
  for (const script of ['deva', 'siddham'] as StrokeScript[]) {
    const bucket = parsed[script]
    if (!bucket || typeof bucket !== 'object') continue
    out[script] = {}
    for (const [letterId, raw] of Object.entries(bucket as Record<string, unknown>)) {
      const map = normalizeLocalLetter(script, raw)
      if (Object.keys(map).length > 0) out[script]![letterId] = map
    }
  }
  return out
}

function writeStore(store: Store) {
  const serializable: Partial<
    Record<StrokeScript, Record<string, Record<string, StoredEntry>>>
  > = {}
  for (const script of ['deva', 'siddham'] as StrokeScript[]) {
    const bucket = store[script]
    if (!bucket) continue
    serializable[script] = {}
    for (const [letterId, fontMap] of Object.entries(bucket)) {
      const slot: Record<string, StoredEntry> = {}
      for (const [face, entry] of Object.entries(fontMap)) {
        slot[face] = {
          d: entry.d,
          strokes: entry.strokes,
          savedAt: entry.taughtAt,
          note: entry.note,
          fontFace: face,
          fontLabel: entry.fontLabel,
        }
      }
      serializable[script]![letterId] = slot
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable))
  try {
    localStorage.setItem(STORAGE_VERSION_KEY, '2')
  } catch {
    /* ignore */
  }
}

function activeFace(script: StrokeScript, fontFace?: string | null): string {
  return resolveStrokeFontFace(script, fontFace ?? getScriptFontChoice(script))
}

export function getStrokeSource(
  letterId: string,
  script: StrokeScript,
  fontFace?: string | null,
): StrokeSource {
  const face = activeFace(script, fontFace)
  if (getCloudTaughtStrokes(letterId, script, face)) return 'cloud'
  if (isTaughtLetter(letterId, script, face)) return 'taught'
  if (loadUserStrokes(script, letterId, face)) return 'local'
  return 'generated'
}

export function hasUserStrokes(
  script: StrokeScript,
  letterId: string,
  fontFace?: string | null,
): boolean {
  return getStrokeSource(letterId, script, fontFace) !== 'generated'
}

function loadUserEntry(
  script: StrokeScript,
  letterId: string,
  fontFace?: string | null,
): TaughtEntry | null {
  const face = activeFace(script, fontFace)
  return readStore()[script]?.[letterId]?.[face] ?? null
}

export function loadUserStrokes(
  script: StrokeScript,
  letterId: string,
  fontFace?: string | null,
): GlyphStrokeData | null {
  const entry = loadUserEntry(script, letterId, fontFace)
  if (!entry) return null
  return { d: entry.d, strokes: entry.strokes }
}

export function loadUserStrokesNote(
  script: StrokeScript,
  letterId: string,
  fontFace?: string | null,
): string | null {
  const note = loadUserEntry(script, letterId, fontFace)?.note
  return typeof note === 'string' && note.trim() ? note : null
}

export function loadUserStrokesMeta(
  script: StrokeScript,
  letterId: string,
  fontFace?: string | null,
): { savedAt: string; strokeCount: number } | null {
  const entry = loadUserEntry(script, letterId, fontFace)
  if (!entry) return null
  return { savedAt: entry.taughtAt, strokeCount: entry.strokes.length }
}

export function loadUserStrokesFont(
  script: StrokeScript,
  letterId: string,
  fontFace?: string | null,
): { fontFace: string | null; fontLabel: string | null } {
  const entry = loadUserEntry(script, letterId, fontFace)
  if (!entry) return { fontFace: null, fontLabel: null }
  return {
    fontFace: entry.fontFace?.trim() || null,
    fontLabel: entry.fontLabel?.trim() || null,
  }
}

export type FontStrokeSummary = {
  fontFace: string
  fontLabel: string
  strokeCount: number
  source: 'cloud' | 'taught' | 'local'
  isActive: boolean
}

function sourcePriority(s: FontStrokeSummary['source']): number {
  if (s === 'cloud') return 0
  if (s === 'taught') return 1
  return 2
}

/** All fonts that have saved strokes for this letter (any source). */
export function listFontStrokeSummaries(
  letterId: string,
  script: StrokeScript,
): FontStrokeSummary[] {
  const active = activeFace(script)
  const byFace = new Map<string, FontStrokeSummary>()

  const bump = (
    face: string,
    label: string | undefined,
    count: number,
    source: FontStrokeSummary['source'],
  ) => {
    const key = resolveStrokeFontFace(script, face)
    const next: FontStrokeSummary = {
      fontFace: key,
      fontLabel: strokeFontLabel(script, key, label),
      strokeCount: count,
      source,
      isActive: key === active,
    }
    const prev = byFace.get(key)
    if (!prev || sourcePriority(source) < sourcePriority(prev.source)) {
      byFace.set(key, next)
    }
  }

  for (const [face, entry] of Object.entries(readStore()[script]?.[letterId] ?? {})) {
    bump(face, entry.fontLabel, entry.strokes.length, 'local')
  }
  for (const [face, entry] of Object.entries(getTaughtFontMap(letterId, script))) {
    bump(face, entry.fontLabel, entry.strokes.length, 'taught')
  }
  for (const { face, entry } of listCloudTaughtFontsForLetter(letterId, script)) {
    bump(face, entry.fontLabel, entry.strokes.length, 'cloud')
  }

  return [...byFace.values()].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
    return a.fontLabel.localeCompare(b.fontLabel, 'ko')
  })
}

export type TeachingInfo = {
  source: StrokeSource | 'draft-over-official'
  data: GlyphStrokeData | null
  savedAt: string | null
  officialAt: string | null
  strokeCount: number
  hasOfficial: boolean
  hasCloud: boolean
  note: string | null
  /** Active font scope (always set). */
  fontFace: string
  fontLabel: string
  /** Other fonts that have strokes for this letter. */
  otherFonts: FontStrokeSummary[]
}

export function getTeachingInfo(
  letterId: string,
  script: StrokeScript,
  fontFace?: string | null,
): TeachingInfo {
  const face = activeFace(script, fontFace)
  const faceLabel = strokeFontLabel(script, face)
  const cloud = getCloudTaughtEntry(letterId, script, face)
  const hasOfficial = isTaughtLetter(letterId, script, face)
  const official = getTaughtEntry(letterId, script, face)
  const local = loadUserStrokes(script, letterId, face)
  const localMeta = loadUserStrokesMeta(script, letterId, face)
  const localNote = loadUserStrokesNote(script, letterId, face)
  const hasCloud = Boolean(cloud)
  const resolvedNote =
    localNote ??
    (cloud?.note?.trim() ? cloud.note : null) ??
    (official?.note?.trim() ? official.note : null)

  const otherFonts = listFontStrokeSummaries(letterId, script).filter((s) => !s.isActive)

  if (local) {
    return {
      source: hasCloud || hasOfficial ? 'draft-over-official' : 'local',
      data: local,
      savedAt: localMeta?.savedAt ?? null,
      officialAt: cloud?.taughtAt ?? official?.taughtAt ?? null,
      strokeCount: local.strokes.length,
      hasOfficial: hasCloud || hasOfficial,
      hasCloud,
      note: resolvedNote,
      fontFace: face,
      fontLabel: strokeFontLabel(script, face, localMeta ? loadUserStrokesFont(script, letterId, face).fontLabel : faceLabel),
      otherFonts,
    }
  }

  if (cloud) {
    return {
      source: 'cloud',
      data: { d: cloud.d, strokes: cloud.strokes },
      savedAt: cloud.taughtAt,
      officialAt: cloud.taughtAt,
      strokeCount: cloud.strokes.length,
      hasOfficial: true,
      hasCloud: true,
      note: resolvedNote,
      fontFace: face,
      fontLabel: strokeFontLabel(script, face, cloud.fontLabel),
      otherFonts,
    }
  }

  if (hasOfficial && official) {
    return {
      source: 'taught',
      data: { d: official.d, strokes: official.strokes },
      savedAt: official.taughtAt,
      officialAt: official.taughtAt,
      strokeCount: official.strokes.length,
      hasOfficial: true,
      hasCloud: false,
      note: resolvedNote,
      fontFace: face,
      fontLabel: strokeFontLabel(script, face, official.fontLabel),
      otherFonts,
    }
  }

  return {
    source: 'generated',
    data: null,
    savedAt: null,
    officialAt: null,
    strokeCount: 0,
    hasOfficial: false,
    hasCloud: false,
    note: null,
    fontFace: face,
    fontLabel: faceLabel,
    otherFonts,
  }
}

export function saveUserStrokes(
  script: StrokeScript,
  letterId: string,
  data: GlyphStrokeData,
  note?: string | null,
  font?: { fontFace?: string | null; fontLabel?: string | null } | null,
) {
  const store = readStore()
  if (!store[script]) store[script] = {}
  if (!store[script]![letterId]) store[script]![letterId] = {}
  const face = resolveStrokeFontFace(
    script,
    font?.fontFace ?? getScriptFontChoice(script),
  )
  const label = strokeFontLabel(script, face, font?.fontLabel)
  const trimmed = note?.trim()
  store[script]![letterId]![face] = {
    d: data.d,
    strokes: data.strokes,
    taughtAt: new Date().toISOString(),
    fontFace: face,
    fontLabel: label,
    ...(trimmed ? { note: trimmed } : {}),
  }
  writeStore(store)
}

export function clearUserStrokes(
  script: StrokeScript,
  letterId: string,
  fontFace?: string | null,
) {
  const store = readStore()
  const bucket = store[script]?.[letterId]
  if (!bucket) return
  if (fontFace != null && fontFace !== '') {
    const face = resolveStrokeFontFace(script, fontFace)
    delete bucket[face]
    if (Object.keys(bucket).length === 0) delete store[script]![letterId]
  } else {
    // When clearing after cloud publish, clear only the active font draft
    const face = activeFace(script)
    delete bucket[face]
    if (Object.keys(bucket).length === 0) delete store[script]![letterId]
  }
  writeStore(store)
}

/** Mother/teacher recorded theory only for the active (or given) font. */
export function getTaughtGlyphStrokes(
  letterId: string,
  script: StrokeScript,
  fontFace?: string | null,
): GlyphStrokeData | null {
  const face = activeFace(script, fontFace)
  return (
    getCloudTaughtStrokes(letterId, script, face) ??
    getTaughtStrokes(letterId, script, face) ??
    loadUserStrokes(script, letterId, face)
  )
}

export function getEffectiveGlyphStrokes(
  letterId: string,
  script: StrokeScript,
  fontFace?: string | null,
): GlyphStrokeData | null {
  return (
    getTaughtGlyphStrokes(letterId, script, fontFace) ??
    getGlyphStrokes(letterId, script)
  )
}

const r2 = (n: number) => Math.round(n * 100) / 100

function dist(a: [number, number], b: [number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

export function pointsToPathD(pts: [number, number][]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) {
    const [x, y] = pts[0]
    return `M${r2(x)} ${r2(y)}l0.4 0`
  }
  const d = [`M${r2(pts[0][0])} ${r2(pts[0][1])}`]
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d.push(
      `C${r2(c1[0])} ${r2(c1[1])} ${r2(c2[0])} ${r2(c2[1])} ${r2(p2[0])} ${r2(p2[1])}`,
    )
  }
  return d.join('')
}

export function simplifyPoints(
  pts: [number, number][],
  minDist = 2.2,
): [number, number][] {
  if (pts.length < 2) return pts
  const out: [number, number][] = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    if (dist(out[out.length - 1], pts[i]) >= minDist) out.push(pts[i])
  }
  const last = pts[pts.length - 1]
  if (dist(out[out.length - 1], last) > 0.5) out.push(last)
  return out.length >= 2 ? out : pts
}

export function recordedToGlyphStrokes(
  recorded: RecordedStroke[],
  labels: string[],
  outlineD: string,
  defaultWidth = 26,
): GlyphStrokeData {
  const strokes: GlyphStroke[] = recorded.map((r, i) => {
    const pts = simplifyPoints(r.points)
    return {
      d: pointsToPathD(pts),
      width: defaultWidth,
      label: labels[i] || `획 ${i + 1}`,
    }
  })
  return { d: outlineD, strokes }
}

export function exportForTeaching(
  script: StrokeScript,
  letterId: string,
  data: GlyphStrokeData,
  fontFace?: string | null,
): string {
  const face = activeFace(script, fontFace)
  return JSON.stringify(
    {
      script,
      letterId,
      fontFace: face,
      fontLabel: strokeFontLabel(script, face),
      d: data.d,
      strokes: data.strokes,
      taughtAt: new Date().toISOString(),
    },
    null,
    2,
  )
}

export function exportOverrideBundle(script: StrokeScript, letterId: string): string {
  const face = activeFace(script)
  const local = loadUserStrokes(script, letterId, face)
  if (local) return exportForTeaching(script, letterId, local, face)
  const taught = getTaughtStrokes(letterId, script, face)
  if (taught) return exportForTeaching(script, letterId, taught, face)
  return ''
}

export function importTeachingBundle(
  script: StrokeScript,
  letterId: string,
  json: string,
): { ok: true } | { ok: false; error: string } {
  try {
    const raw = JSON.parse(json) as {
      script?: string
      letterId?: string
      d?: string
      strokes?: GlyphStrokeData['strokes']
      fontFace?: string
      fontLabel?: string
      note?: string
    }
    if (raw.script && raw.script !== script) {
      return { ok: false, error: `스크립트 불일치 (${raw.script})` }
    }
    if (raw.letterId && raw.letterId !== letterId) {
      return { ok: false, error: `글자 불일치 (${raw.letterId})` }
    }
    if (!raw.d || !Array.isArray(raw.strokes) || raw.strokes.length === 0) {
      return { ok: false, error: 'd, strokes[] 가 필요합니다' }
    }
    saveUserStrokes(
      script,
      letterId,
      { d: raw.d, strokes: raw.strokes },
      raw.note,
      { fontFace: raw.fontFace, fontLabel: raw.fontLabel },
    )
    return { ok: true }
  } catch {
    return { ok: false, error: 'JSON 형식이 올바르지 않습니다' }
  }
}

export function clientToSvgPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): [number, number] {
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return [0, 0]
  const p = pt.matrixTransform(ctm.inverse())
  return [p.x, p.y]
}

export function defaultLabels(letterId: string, track: ScriptTrack): string[] {
  return getStrokeSteps(letterId, track)
}

export function avgStrokeWidth(data: GlyphStrokeData | null): number {
  if (!data?.strokes.length) return 26
  const sum = data.strokes.reduce((n, s) => n + (s.width || 26), 0)
  return sum / data.strokes.length
}
