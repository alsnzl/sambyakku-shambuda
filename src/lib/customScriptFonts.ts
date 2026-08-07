/**
 * Per-device custom Devanagari / Siddham UI fonts (OTF/TTF).
 * Siddham slot still uses Devanagari codepoints (same contract as Muktamsiddham).
 */

export type ScriptFontSlot = 'deva' | 'siddham'

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
export const SCRIPT_FONT_SAMPLE = 'अ आ क'

const DB_NAME = 'sambyakku-script-fonts-v1'
const DB_VERSION = 1
const STORE = 'fonts'
const META_KEY = 'sambyakku-script-font-meta-v1'

const FAMILY: Record<ScriptFontSlot, string> = {
  deva: 'User Devanagari',
  siddham: 'User Siddham',
}

const CSS_VAR: Record<ScriptFontSlot, string> = {
  deva: '--deva',
  siddham: '--siddham',
}

const DEFAULT_STACK: Record<ScriptFontSlot, string> = {
  deva: "'Noto Sans Devanagari', sans-serif",
  siddham: "'Muktamsiddham', sans-serif",
}

const DEFAULT_LABEL: Record<ScriptFontSlot, string> = {
  deva: 'Noto Sans Devanagari',
  siddham: 'Muktamsiddham',
}

type StoredFont = {
  slot: ScriptFontSlot
  fileName: string
  mime: string
  buffer: ArrayBuffer
  appliedAt: number
}

type MetaMap = Partial<Record<ScriptFontSlot, ScriptFontMeta>>

const loadedFaces = new Map<ScriptFontSlot, FontFace>()

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
    /* quota / private mode */
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

export function getDefaultScriptFontLabel(slot: ScriptFontSlot): string {
  return DEFAULT_LABEL[slot]
}

/** Bundled face name for side-by-side preview (ignores CSS vars). */
export function getBundledScriptFontFamily(slot: ScriptFontSlot): string {
  return slot === 'deva' ? 'Noto Sans Devanagari' : 'Muktamsiddham'
}

/** Custom face name registered via FontFace. */
export function getUserScriptFontFamily(slot: ScriptFontSlot): string {
  return FAMILY[slot]
}

export function getActiveScriptFontLabel(slot: ScriptFontSlot): string {
  return getScriptFontMeta(slot)?.fileName ?? DEFAULT_LABEL[slot]
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

function applyCssVar(slot: ScriptFontSlot, custom: boolean) {
  const value = custom
    ? `'${FAMILY[slot]}', ${DEFAULT_STACK[slot]}`
    : DEFAULT_STACK[slot]
  document.documentElement.style.setProperty(CSS_VAR[slot], value)
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
  // Pass a copy so callers can keep the original buffer (FontFace may transfer it).
  const face = new FontFace(FAMILY[slot], buffer.slice(0))
  await face.load()
  document.fonts.add(face)
  loadedFaces.set(slot, face)
  return face
}

/** Rough check: sample glyphs should ink a non-trivial share of pixels. */
function sampleGlyphsVisible(family: string, sample: string): boolean {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size * sample.length
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
  const ratio = inked / (canvas.width * canvas.height)
  // Empty / tofu / missing glyphs stay near 0; real Devanagari ink is higher.
  return ratio > 0.012
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

/**
 * Validate, persist, and apply a user font for one script slot.
 */
export async function installScriptFont(slot: ScriptFontSlot, file: File): Promise<ScriptFontMeta> {
  assertFileOk(file)
  const ext = extensionOf(file.name)
  // FontFace may detach/transfer the buffer — keep a copy for IndexedDB.
  const buffer = await file.arrayBuffer()

  try {
    await loadFaceFromBuffer(slot, buffer)
  } catch {
    await unloadFace(slot)
    try {
      await restoreScriptFontSlot(slot)
    } catch {
      applyCssVar(slot, false)
    }
    throw new ScriptFontError('load', '폰트를 불러오지 못했습니다. 다른 파일을 시도해 주세요.')
  }

  if (!sampleGlyphsVisible(FAMILY[slot], SCRIPT_FONT_SAMPLE)) {
    await unloadFace(slot)
    try {
      await restoreScriptFontSlot(slot)
    } catch {
      applyCssVar(slot, false)
    }
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
    try {
      await restoreScriptFontSlot(slot)
    } catch {
      applyCssVar(slot, false)
    }
    throw new ScriptFontError('storage', '이 기기에 폰트를 저장하지 못했습니다.')
  }

  setMeta(slot, meta)
  applyCssVar(slot, true)
  return meta
}

/** Remove custom font and return to the bundled default. */
export async function resetScriptFont(slot: ScriptFontSlot): Promise<void> {
  try {
    await deleteStored(slot)
  } catch {
    /* still clear CSS / meta */
  }
  await unloadFace(slot)
  setMeta(slot, null)
  applyCssVar(slot, false)
}

async function restoreScriptFontSlot(slot: ScriptFontSlot): Promise<boolean> {
  const meta = getScriptFontMeta(slot)
  if (!meta) {
    applyCssVar(slot, false)
    return false
  }

  let record: StoredFont | undefined
  try {
    record = await getStored(slot)
  } catch {
    setMeta(slot, null)
    applyCssVar(slot, false)
    return false
  }

  if (!record?.buffer) {
    setMeta(slot, null)
    applyCssVar(slot, false)
    return false
  }

  try {
    await loadFaceFromBuffer(slot, record.buffer)
    applyCssVar(slot, true)
    return true
  } catch {
    setMeta(slot, null)
    try {
      await deleteStored(slot)
    } catch {
      /* ignore */
    }
    await unloadFace(slot)
    applyCssVar(slot, false)
    return false
  }
}

/** Call once at app boot after bundled @font-face styles are injected. */
export async function restoreCustomScriptFonts(): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  await Promise.all([restoreScriptFontSlot('deva'), restoreScriptFontSlot('siddham')])
}

export function scriptFontErrorMessage(err: unknown): string {
  if (err instanceof ScriptFontError) return err.message
  return '폰트를 적용하지 못했습니다.'
}
