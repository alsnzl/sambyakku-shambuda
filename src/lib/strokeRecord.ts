import type { GlyphStroke, GlyphStrokeData, StrokeScript } from '../data/glyphStrokes'
import { getGlyphStrokes } from '../data/glyphStrokes'
import { getTaughtStrokes, getTaughtEntry, isTaughtLetter } from '../data/taughtStrokes'
import { getStrokeSteps } from '../data/strokes'
import type { ScriptTrack } from '../types/track'
import {
  getCloudTaughtEntry,
  getCloudTaughtStrokes,
} from './strokeCloud'

const STORAGE_KEY = 'sambyakku-stroke-overrides'

export type StrokeSource = 'cloud' | 'taught' | 'local' | 'generated'

export type RecordedStroke = {
  /** raw points in 0–240 viewBox */
  points: [number, number][]
}

type StoredEntry = GlyphStrokeData & { savedAt: string }

type Store = Partial<Record<StrokeScript, Record<string, StoredEntry>>>

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Store) : {}
  } catch {
    return {}
  }
}

function writeStore(store: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function getStrokeSource(
  letterId: string,
  script: StrokeScript,
): StrokeSource {
  if (getCloudTaughtStrokes(letterId, script)) return 'cloud'
  if (isTaughtLetter(letterId, script)) return 'taught'
  if (readStore()[script]?.[letterId]) return 'local'
  return 'generated'
}

export function hasUserStrokes(script: StrokeScript, letterId: string): boolean {
  return getStrokeSource(letterId, script) !== 'generated'
}

export function loadUserStrokes(
  script: StrokeScript,
  letterId: string,
): GlyphStrokeData | null {
  const entry = readStore()[script]?.[letterId]
  if (!entry) return null
  const { savedAt: _, ...data } = entry
  void _
  return data
}

export function loadUserStrokesMeta(
  script: StrokeScript,
  letterId: string,
): { savedAt: string; strokeCount: number } | null {
  const entry = readStore()[script]?.[letterId]
  if (!entry) return null
  return { savedAt: entry.savedAt, strokeCount: entry.strokes.length }
}

export type TeachingInfo = {
  source: StrokeSource | 'draft-over-official'
  data: GlyphStrokeData | null
  savedAt: string | null
  officialAt: string | null
  strokeCount: number
  hasOfficial: boolean
  hasCloud: boolean
}

export function getTeachingInfo(
  letterId: string,
  script: StrokeScript,
): TeachingInfo {
  const cloud = getCloudTaughtEntry(letterId, script)
  const hasOfficial = isTaughtLetter(letterId, script)
  const official = getTaughtEntry(letterId, script)
  const local = loadUserStrokes(script, letterId)
  const localMeta = loadUserStrokesMeta(script, letterId)
  const hasCloud = Boolean(cloud)

  if (local) {
    return {
      source: hasCloud || hasOfficial ? 'draft-over-official' : 'local',
      data: local,
      savedAt: localMeta?.savedAt ?? null,
      officialAt: cloud?.taughtAt ?? official?.taughtAt ?? null,
      strokeCount: local.strokes.length,
      hasOfficial: hasCloud || hasOfficial,
      hasCloud,
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
  }
}

export function saveUserStrokes(
  script: StrokeScript,
  letterId: string,
  data: GlyphStrokeData,
) {
  const store = readStore()
  if (!store[script]) store[script] = {}
  store[script]![letterId] = { ...data, savedAt: new Date().toISOString() }
  writeStore(store)
}

export function clearUserStrokes(script: StrokeScript, letterId: string) {
  const store = readStore()
  if (!store[script]?.[letterId]) return
  delete store[script]![letterId]
  writeStore(store)
}

export function getEffectiveGlyphStrokes(
  letterId: string,
  script: StrokeScript,
): GlyphStrokeData | null {
  return (
    getCloudTaughtStrokes(letterId, script) ??
    getTaughtStrokes(letterId, script) ??
    loadUserStrokes(script, letterId) ??
    getGlyphStrokes(letterId, script)
  )
}

const r2 = (n: number) => Math.round(n * 100) / 100

function dist(a: [number, number], b: [number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

function polyLength(pts: [number, number][]) {
  let n = 0
  for (let i = 1; i < pts.length; i++) n += dist(pts[i - 1], pts[i])
  return n
}

/** Catmull-Rom → cubic bezier path (same family as the generator). */
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

/** Thin noisy pointer samples → smoother centreline. */
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
    const d = pointsToPathD(pts)
    const length = r2(Math.max(polyLength(pts), 1))
    return {
      d,
      width: defaultWidth,
      length,
      label: labels[i] ?? `획 ${i + 1}`,
    }
  })
  return { d: outlineD, strokes }
}

/** JSON for taught-strokes/inbox/ → npm run strokes:teach */
export function exportForTeaching(
  script: StrokeScript,
  letterId: string,
  data: GlyphStrokeData,
): string {
  return JSON.stringify(
    {
      script,
      letterId,
      d: data.d,
      strokes: data.strokes,
      taughtAt: new Date().toISOString(),
    },
    null,
    2,
  )
}

export function exportOverrideBundle(script: StrokeScript, letterId: string): string {
  const local = loadUserStrokes(script, letterId)
  if (local) return exportForTeaching(script, letterId, local)

  const taught = getTaughtStrokes(letterId, script)
  if (taught) return exportForTeaching(script, letterId, taught)

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
    saveUserStrokes(script, letterId, { d: raw.d, strokes: raw.strokes })
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
  const w = data.strokes.reduce((s, x) => s + x.width, 0) / data.strokes.length
  return r2(w)
}
