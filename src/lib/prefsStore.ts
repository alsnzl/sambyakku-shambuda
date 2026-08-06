export type GlyphSize = 'sm' | 'md' | 'lg'
export type ThemePref = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'sambyakku-prefs-v1'
const SIZES: GlyphSize[] = ['sm', 'md', 'lg']

type Prefs = {
  glyphSize: GlyphSize
  theme: ThemePref
}

const DEFAULTS: Prefs = {
  glyphSize: 'md',
  theme: 'system',
}

let systemListener: ((e: MediaQueryListEvent) => void) | null = null

function isGlyphSize(value: unknown): value is GlyphSize {
  return value === 'sm' || value === 'md' || value === 'lg'
}

function isThemePref(value: unknown): value is ThemePref {
  return value === 'light' || value === 'dark' || value === 'system'
}

function load(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<Prefs>
    return {
      glyphSize: isGlyphSize(parsed.glyphSize) ? parsed.glyphSize : DEFAULTS.glyphSize,
      theme: isThemePref(parsed.theme) ? parsed.theme : DEFAULTS.theme,
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

export function resolveTheme(pref: ThemePref): ResolvedTheme {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return pref
}

export function applyTheme(pref: ThemePref) {
  const resolved = resolveTheme(pref)
  document.documentElement.dataset.themePref = pref
  document.documentElement.dataset.theme = resolved
  document.documentElement.style.colorScheme = resolved
}

function bindSystemThemeListener(pref: ThemePref) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  if (systemListener) mq.removeEventListener('change', systemListener)
  systemListener = null
  if (pref !== 'system') return
  systemListener = () => applyTheme('system')
  mq.addEventListener('change', systemListener)
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

export function getThemePref(): ThemePref {
  return load().theme
}

export function setThemePref(theme: ThemePref): ThemePref {
  const next = isThemePref(theme) ? theme : DEFAULTS.theme
  save({ ...load(), theme: next })
  applyTheme(next)
  bindSystemThemeListener(next)
  return next
}

export function initPrefs() {
  const prefs = load()
  applyGlyphSize(prefs.glyphSize)
  applyTheme(prefs.theme)
  bindSystemThemeListener(prefs.theme)
}

export const GLYPH_SIZE_OPTIONS: { id: GlyphSize; label: string }[] = [
  { id: 'sm', label: '작게' },
  { id: 'md', label: '보통' },
  { id: 'lg', label: '크게' },
]

export const THEME_OPTIONS: { id: ThemePref; label: string; hint: string }[] = [
  { id: 'light', label: '밝게', hint: '낮 공부' },
  { id: 'dark', label: '어둡게', hint: '밤 공부' },
  { id: 'system', label: '시스템', hint: '기기 설정' },
]

export function cycleGlyphSize(current: GlyphSize): GlyphSize {
  const i = SIZES.indexOf(current)
  return SIZES[(i + 1) % SIZES.length] ?? 'md'
}
