export type GlyphSize = 'sm' | 'md' | 'lg'

const STORAGE_KEY = 'sambyakku-prefs-v1'
const SIZES: GlyphSize[] = ['sm', 'md', 'lg']

type Prefs = {
  glyphSize: GlyphSize
}

const DEFAULTS: Prefs = {
  glyphSize: 'md',
}

function isGlyphSize(value: unknown): value is GlyphSize {
  return value === 'sm' || value === 'md' || value === 'lg'
}

function load(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<Prefs>
    return {
      glyphSize: isGlyphSize(parsed.glyphSize) ? parsed.glyphSize : DEFAULTS.glyphSize,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

function save(prefs: Prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    /* ignore quota / private mode */
  }
}

export function applyGlyphSize(size: GlyphSize) {
  document.documentElement.dataset.glyphSize = size
}

export function getGlyphSize(): GlyphSize {
  return load().glyphSize
}

export function setGlyphSize(size: GlyphSize): GlyphSize {
  const next = isGlyphSize(size) ? size : DEFAULTS.glyphSize
  save({ ...load(), glyphSize: next })
  applyGlyphSize(next)
  return next
}

export function initPrefs() {
  applyGlyphSize(load().glyphSize)
}

export const GLYPH_SIZE_OPTIONS: { id: GlyphSize; label: string }[] = [
  { id: 'sm', label: '작게' },
  { id: 'md', label: '보통' },
  { id: 'lg', label: '크게' },
]

export function cycleGlyphSize(current: GlyphSize): GlyphSize {
  const i = SIZES.indexOf(current)
  return SIZES[(i + 1) % SIZES.length] ?? 'md'
}
