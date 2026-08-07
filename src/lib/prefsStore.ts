import type { BrushKind } from './freehandStroke'
import {
  PRESSURE_SENS_DEFAULT,
  PRESSURE_SENS_MAX,
  PRESSURE_SENS_MIN,
} from './freehandStroke'

export type GlyphSize = 'sm' | 'md' | 'lg'
export type ThemePref = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'
/** Color mood — independent of light/dark brightness. */
export type PalettePref = 'study' | 'sangha' | 'lotus' | 'indigo' | 'bodhi' | 'dusk'
export type { BrushKind }

const STORAGE_KEY = 'sambyakku-prefs-v1'
const SIZES: GlyphSize[] = ['sm', 'md', 'lg']

type Prefs = {
  glyphSize: GlyphSize
  theme: ThemePref
  palette: PalettePref
  brush: BrushKind
  /** Reject finger/palm on teach & write canvases (S Pen / mouse only). */
  penOnly: boolean
  /** 1 = current default pressure curve. */
  pressureSens: number
}

const DEFAULTS: Prefs = {
  glyphSize: 'md',
  theme: 'system',
  palette: 'study',
  brush: 'brush',
  penOnly: true,
  pressureSens: PRESSURE_SENS_DEFAULT,
}

let systemListener: ((e: MediaQueryListEvent) => void) | null = null

function isGlyphSize(value: unknown): value is GlyphSize {
  return value === 'sm' || value === 'md' || value === 'lg'
}

function isThemePref(value: unknown): value is ThemePref {
  return value === 'light' || value === 'dark' || value === 'system'
}

function isPalettePref(value: unknown): value is PalettePref {
  return (
    value === 'study' ||
    value === 'sangha' ||
    value === 'lotus' ||
    value === 'indigo' ||
    value === 'bodhi' ||
    value === 'dusk'
  )
}

function isBrushKind(value: unknown): value is BrushKind {
  return value === 'pen' || value === 'brush'
}

function clampPressureSens(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULTS.pressureSens
  return Math.min(PRESSURE_SENS_MAX, Math.max(PRESSURE_SENS_MIN, Math.round(value * 100) / 100))
}

function load(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<Prefs>
    return {
      glyphSize: isGlyphSize(parsed.glyphSize) ? parsed.glyphSize : DEFAULTS.glyphSize,
      theme: isThemePref(parsed.theme) ? parsed.theme : DEFAULTS.theme,
      palette: isPalettePref(parsed.palette) ? parsed.palette : DEFAULTS.palette,
      brush: isBrushKind(parsed.brush) ? parsed.brush : DEFAULTS.brush,
      penOnly: typeof parsed.penOnly === 'boolean' ? parsed.penOnly : DEFAULTS.penOnly,
      pressureSens: clampPressureSens(parsed.pressureSens),
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

export function applyPalette(palette: PalettePref) {
  document.documentElement.dataset.palette = palette
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

export function getPalettePref(): PalettePref {
  return load().palette
}

export function setPalettePref(palette: PalettePref): PalettePref {
  const next = isPalettePref(palette) ? palette : DEFAULTS.palette
  save({ ...load(), palette: next })
  applyPalette(next)
  return next
}

export function getBrushKind(): BrushKind {
  return load().brush
}

export function setBrushKind(brush: BrushKind): BrushKind {
  const next = isBrushKind(brush) ? brush : DEFAULTS.brush
  save({ ...load(), brush: next })
  return next
}

export function getPenOnly(): boolean {
  return load().penOnly
}

export function setPenOnly(penOnly: boolean): boolean {
  save({ ...load(), penOnly })
  return penOnly
}

export function getPressureSens(): number {
  return load().pressureSens
}

export function setPressureSens(value: number): number {
  const next = clampPressureSens(value)
  save({ ...load(), pressureSens: next })
  return next
}

export function initPrefs() {
  const prefs = load()
  applyGlyphSize(prefs.glyphSize)
  applyTheme(prefs.theme)
  applyPalette(prefs.palette)
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

export const PALETTE_OPTIONS: {
  id: PalettePref
  label: string
  hint: string
  /** Accent preview (light mode tone). */
  swatch: string
}[] = [
  { id: 'study', label: '공부실', hint: '청록', swatch: '#2c6b66' },
  { id: 'sangha', label: '산사', hint: '가사·사프란', swatch: '#9a5a24' },
  { id: 'lotus', label: '연꽃', hint: '분홍·연보', swatch: '#a85d78' },
  { id: 'indigo', label: '청금', hint: '쪽빛·남색', swatch: '#3d5a80' },
  { id: 'bodhi', label: '보리', hint: '잎·숲', swatch: '#4f6b3c' },
  { id: 'dusk', label: '묵향', hint: '먹·석회', swatch: '#5a6570' },
]

export function cycleGlyphSize(current: GlyphSize): GlyphSize {
  const i = SIZES.indexOf(current)
  return SIZES[(i + 1) % SIZES.length] ?? 'md'
}
