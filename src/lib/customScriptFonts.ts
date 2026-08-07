/**
 * Per-device script font selection.
 * - Devanagari: Noto Sans Devanagari | user upload
 * - Siddham: Muktamsiddham | Noto Sans Siddham | user upload
 *
 * Siddham UI strings are Devanagari codepoints except when Noto Sans Siddham
 * is active (then Unicode Siddham U+11580+ is used). Stroke *order* always
 * comes from taught/generated path data — fonts only change the face.
 */

export type ScriptFontSlot = 'deva' | 'siddham'

export type DevaFontChoice = 'noto-deva' | 'user'
export type SiddhamFontChoice = 'muktam' | 'noto-siddham' | 'user'
export type ScriptFontChoice = DevaFontChoice | SiddhamFontChoice

export type ScriptFontMeta = {
  fileName: string
  byteLength: number
  appliedAt: number
}

export type ScriptFontErrorKind =
  | 'format'
  | 'size'
  | 'load'
  | 'glyphs'
  | 'storage'
  | 'unavailable'

export class ScriptFontError extends Error {
  readonly kind: ScriptFontErrorKind

  constructor(kind: ScriptFontErrorKind, message: string) {
    super(message)
    this.name = 'ScriptFontError'
    this.kind = kind
  }
}

export const SCRIPT_FONT_MAX_BYTES = 8 * 1024 * 1024
/** Devanagari-codepoint sample (Noto Deva, Muktam, user uploads). */
export const SCRIPT_FONT_SAMPLE = 'अ आ क'
/** Unicode Siddham sample for Noto Sans Siddham preview. */
export const SCRIPT_FONT_SAMPLE_UNICODE_SIDDHAM = '𑖀 𑖁 𑖎'

const DB_NAME = 'sambyakku-script-fonts-v1'
const DB_VERSION = 1
const STORE = 'fonts'
const META_KEY = 'sambyakku-script-font-meta-v1'
const CHOICE_KEY = 'sambyakku-script-font-choice-v1'

const USER_FAMILY: Record<ScriptFontSlot, string> = {
  deva: 'User Devanagari',
  siddham: 'User Siddham',
}

const CSS_VAR: Record<ScriptFontSlot, string> = {
  deva: '--deva',
  siddham: '--siddham',
}

type BundledOpt = {
  id: ScriptFontChoice
  family: string
  label: string
  stack: string
}

export const DEVA_FONT_OPTIONS: BundledOpt[] = [
  {
    id: 'noto-deva',
    family: 'Noto Sans Devanagari',
    label: 'Noto Sans Devanagari',
    stack: "'Noto Sans Devanagari', sans-serif",
  },
]

export const SIDDHAM_FONT_OPTIONS: BundledOpt[] = [
  {
    id: 'muktam',
    family: 'Muktamsiddham',
    label: 'Muktamsiddham',
    stack: "'Muktamsiddham', sans-serif",
  },
  {
    id: 'noto-siddham',
    family: 'Noto Sans Siddham',
    label: 'Noto Sans Siddham',
    stack: "'Noto Sans Siddham', sans-serif",
  },
]

const DEFAULT_CHOICE: Record<ScriptFontSlot, ScriptFontChoice> = {
  deva: 'noto-deva',
  siddham: 'muktam',
}

type StoredFont = {
  slot: ScriptFontSlot
  fileName: string
  mime: string
  buffer: ArrayBuffer
  appliedAt: number
}

type MetaMap = Partial<Record<ScriptFontSlot, ScriptFontMeta>>
type ChoiceMap = {
  deva: DevaFontChoice
  siddham: SiddhamFontChoice
}

const loadedFaces = new Map<ScriptFontSlot, FontFace>()
const listeners = new Set<() => void>()
let snapshotEpoch = 0

function notify() {
  snapshotEpoch += 1
  listeners.forEach((fn) => fn())
}

/** Subscribe to font choice / custom-font changes (for React re-render). */
export function subscribeScriptFonts(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  return () => {
    listeners.delete(onStoreChange)
  }
}

export function getScriptFontEpoch(): number {
  return snapshotEpoch
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'slot' })
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
  })
}

function readMeta(): MetaMap {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as MetaMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeMeta(map: MetaMap) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(map))
  } catch {
    /* quota */
  }
}

function setMeta(slot: ScriptFontSlot, meta: ScriptFontMeta | null) {
  const map = readMeta()
  if (meta) map[slot] = meta
  else delete map[slot]
  writeMeta(map)
}

export function getScriptFontMeta(slot: ScriptFontSlot): ScriptFontMeta | null {
  return readMeta()[slot] ?? null
}

function isDevaChoice(value: unknown): value is DevaFontChoice {
  return value === 'noto-deva' || value === 'user'
}

function isSiddhamChoice(value: unknown): value is SiddhamFontChoice {
  return value === 'muktam' || value === 'noto-siddham' || value === 'user'
}

function readChoices(): ChoiceMap {
  const defaults: ChoiceMap = {
    deva: DEFAULT_CHOICE.deva as DevaFontChoice,
    siddham: DEFAULT_CHOICE.siddham as SiddhamFontChoice,
  }
  try {
    const raw = localStorage.getItem(CHOICE_KEY)
    if (!raw) {
      // Migrate: old installs that only stored custom meta
      const meta = readMeta()
      return {
        deva: meta.deva ? 'user' : defaults.deva,
        siddham: meta.siddham ? 'user' : defaults.siddham,
      }
    }
    const parsed = JSON.parse(raw) as Partial<ChoiceMap>
    return {
      deva: isDevaChoice(parsed.deva) ? parsed.deva : defaults.deva,
      siddham: isSiddhamChoice(parsed.siddham) ? parsed.siddham : defaults.siddham,
    }
  } catch {
    return defaults
  }
}

function writeChoices(map: ChoiceMap) {
  try {
    localStorage.setItem(CHOICE_KEY, JSON.stringify(map))
  } catch {
    /* quota */
  }
}

export function getScriptFontChoice(slot: ScriptFontSlot): ScriptFontChoice {
  return readChoices()[slot]
}

export function getUserScriptFontFamily(slot: ScriptFontSlot): string {
  return USER_FAMILY[slot]
}

export function getBundledScriptFontFamily(slot: ScriptFontSlot): string {
  if (slot === 'deva') return 'Noto Sans Devanagari'
  const choice = getScriptFontChoice('siddham')
  if (choice === 'noto-siddham') return 'Noto Sans Siddham'
  return 'Muktamsiddham'
}

export function getDefaultScriptFontLabel(slot: ScriptFontSlot): string {
  return slot === 'deva' ? 'Noto Sans Devanagari' : 'Muktamsiddham'
}

export function getActiveScriptFontLabel(slot: ScriptFontSlot): string {
  const choice = getScriptFontChoice(slot)
  if (choice === 'user') {
    return getScriptFontMeta(slot)?.fileName ?? '사용자 폰트'
  }
  if (slot === 'deva') return 'Noto Sans Devanagari'
  if (choice === 'noto-siddham') return 'Noto Sans Siddham'
  return 'Muktamsiddham'
}

/** True when Siddham UI must render Unicode Siddham codepoints. */
export function usesUnicodeSiddham(): boolean {
  return getScriptFontChoice('siddham') === 'noto-siddham'
}

export function getScriptFontSample(slot: ScriptFontSlot, choice?: ScriptFontChoice): string {
  const c = choice ?? getScriptFontChoice(slot)
  if (slot === 'siddham' && c === 'noto-siddham') return SCRIPT_FONT_SAMPLE_UNICODE_SIDDHAM
  return SCRIPT_FONT_SAMPLE
}

function stackForChoice(slot: ScriptFontSlot, choice: ScriptFontChoice): string {
  if (choice === 'user') {
    const fallback =
      slot === 'deva'
        ? DEVA_FONT_OPTIONS[0]!.stack
        : SIDDHAM_FONT_OPTIONS[0]!.stack
    return `'${USER_FAMILY[slot]}', ${fallback}`
  }
  if (slot === 'deva') return DEVA_FONT_OPTIONS[0]!.stack
  const opt = SIDDHAM_FONT_OPTIONS.find((o) => o.id === choice)
  return opt?.stack ?? SIDDHAM_FONT_OPTIONS[0]!.stack
}

function applySlotCss(slot: ScriptFontSlot) {
  const choice = getScriptFontChoice(slot)
  document.documentElement.style.setProperty(CSS_VAR[slot], stackForChoice(slot, choice))
}

export function applyActiveScriptFonts() {
  applySlotCss('deva')
  applySlotCss('siddham')
}

async function unloadFace(slot: ScriptFontSlot) {
  const prev = loadedFaces.get(slot)
  if (!prev) return
  try {
    document.fonts.delete(prev)
  } catch {
    /* ignore */
  }
  loadedFaces.delete(slot)
}

async function loadFaceFromBuffer(
  slot: ScriptFontSlot,
  buffer: ArrayBuffer,
): Promise<FontFace> {
  await unloadFace(slot)
  const face = new FontFace(USER_FAMILY[slot], buffer.slice(0))
  await face.load()
  document.fonts.add(face)
  loadedFaces.set(slot, face)
  return face
}

function sampleGlyphsVisible(family: string, sample: string): boolean {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(size * 4, size * sample.length)
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000'
  ctx.textBaseline = 'middle'
  ctx.font = `${size * 0.72}px "${family}"`
  ctx.fillText(sample, 8, size / 2)

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  let inked = 0
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! > 16) inked += 1
  }
  return inked / (canvas.width * canvas.height) > 0.012
}

function extensionOf(fileName: string): string {
  const i = fileName.lastIndexOf('.')
  return i >= 0 ? fileName.slice(i + 1).toLowerCase() : ''
}

function mimeForExt(ext: string): string {
  if (ext === 'otf') return 'font/otf'
  if (ext === 'ttf') return 'font/ttf'
  return 'application/octet-stream'
}

function assertFileOk(file: File) {
  const ext = extensionOf(file.name)
  if (ext !== 'otf' && ext !== 'ttf') {
    throw new ScriptFontError('format', 'OTF 또는 TTF 파일만 올릴 수 있습니다.')
  }
  if (file.size <= 0) {
    throw new ScriptFontError('format', '빈 파일입니다.')
  }
  if (file.size > SCRIPT_FONT_MAX_BYTES) {
    throw new ScriptFontError(
      'size',
      `파일이 너무 큽니다. ${SCRIPT_FONT_MAX_BYTES / (1024 * 1024)}MB 이하로 올려 주세요.`,
    )
  }
}

async function putStored(record: StoredFont) {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB put failed'))
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB put aborted'))
      tx.objectStore(STORE).put(record)
    })
  } finally {
    db.close()
  }
}

async function getStored(slot: ScriptFontSlot): Promise<StoredFont | undefined> {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE, 'readonly')
    return await idbRequest(tx.objectStore(STORE).get(slot) as IDBRequest<StoredFont | undefined>)
  } finally {
    db.close()
  }
}

async function deleteStored(slot: ScriptFontSlot) {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'))
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB delete aborted'))
      tx.objectStore(STORE).delete(slot)
    })
  } finally {
    db.close()
  }
}

async function ensureUserFaceLoaded(slot: ScriptFontSlot): Promise<boolean> {
  if (loadedFaces.has(slot)) return true
  const meta = getScriptFontMeta(slot)
  if (!meta) return false
  try {
    const record = await getStored(slot)
    if (!record?.buffer) return false
    await loadFaceFromBuffer(slot, record.buffer)
    return true
  } catch {
    return false
  }
}

/** Select bundled or user face for a slot. */
export async function setScriptFontChoice(
  slot: ScriptFontSlot,
  choice: ScriptFontChoice,
): Promise<void> {
  if (slot === 'deva' && !isDevaChoice(choice)) return
  if (slot === 'siddham' && !isSiddhamChoice(choice)) return

  if (choice === 'user') {
    const ok = await ensureUserFaceLoaded(slot)
    if (!ok) {
      throw new ScriptFontError('unavailable', '먼저 사용자 폰트 파일을 올려 주세요.')
    }
  }

  const next = readChoices()
  if (slot === 'deva') next.deva = choice as DevaFontChoice
  else next.siddham = choice as SiddhamFontChoice
  writeChoices(next)
  applySlotCss(slot)
  notify()
}

export async function installScriptFont(
  slot: ScriptFontSlot,
  file: File,
): Promise<ScriptFontMeta> {
  assertFileOk(file)
  const ext = extensionOf(file.name)
  const buffer = await file.arrayBuffer()

  try {
    await loadFaceFromBuffer(slot, buffer)
  } catch {
    await unloadFace(slot)
    await ensureUserFaceLoaded(slot).catch(() => false)
    applySlotCss(slot)
    throw new ScriptFontError('load', '폰트를 불러오지 못했습니다. 다른 파일을 시도해 주세요.')
  }

  if (!sampleGlyphsVisible(USER_FAMILY[slot], SCRIPT_FONT_SAMPLE)) {
    await unloadFace(slot)
    await ensureUserFaceLoaded(slot).catch(() => false)
    applySlotCss(slot)
    throw new ScriptFontError(
      'glyphs',
      '샘플 글자(अ आ क)가 이 폰트에 없습니다. 데바나가리 글자를 담은 폰트를 올려 주세요.',
    )
  }

  const appliedAt = Date.now()
  const meta: ScriptFontMeta = {
    fileName: file.name,
    byteLength: buffer.byteLength,
    appliedAt,
  }

  try {
    await putStored({
      slot,
      fileName: file.name,
      mime: file.type || mimeForExt(ext),
      buffer,
      appliedAt,
    })
  } catch {
    await unloadFace(slot)
    applySlotCss(slot)
    throw new ScriptFontError('storage', '이 기기에 폰트를 저장하지 못했습니다.')
  }

  setMeta(slot, meta)
  const choices = readChoices()
  if (slot === 'deva') choices.deva = 'user'
  else choices.siddham = 'user'
  writeChoices(choices)
  applySlotCss(slot)
  notify()
  return meta
}

/** Remove uploaded font and fall back to the slot default bundled face. */
export async function resetScriptFont(slot: ScriptFontSlot): Promise<void> {
  try {
    await deleteStored(slot)
  } catch {
    /* ignore */
  }
  await unloadFace(slot)
  setMeta(slot, null)
  const choices = readChoices()
  if (slot === 'deva') choices.deva = 'noto-deva'
  else choices.siddham = 'muktam'
  writeChoices(choices)
  applySlotCss(slot)
  notify()
}

async function restoreScriptFontSlot(slot: ScriptFontSlot): Promise<void> {
  const choice = getScriptFontChoice(slot)
  if (getScriptFontMeta(slot)) {
    const ok = await ensureUserFaceLoaded(slot)
    if (!ok) {
      setMeta(slot, null)
      const choices = readChoices()
      if (choices[slot] === 'user') {
        if (slot === 'deva') choices.deva = 'noto-deva'
        else choices.siddham = 'muktam'
        writeChoices(choices)
      }
    } else if (choice === 'user') {
      applySlotCss(slot)
      return
    }
  }
  applySlotCss(slot)
}

/** Boot: load any saved user faces, then apply current choices. */
export async function restoreCustomScriptFonts(): Promise<void> {
  applyActiveScriptFonts()
  if (typeof indexedDB === 'undefined') {
    notify()
    return
  }
  await Promise.all([restoreScriptFontSlot('deva'), restoreScriptFontSlot('siddham')])
  notify()
}

export function scriptFontErrorMessage(err: unknown): string {
  if (err instanceof ScriptFontError) return err.message
  return '폰트를 적용하지 못했습니다.'
}
