export type PathBBox = { x: number; y: number; w: number; h: number }

type StrokeLike = { d: string; width?: number }

function measurePathBBox(d: string): PathBBox | null {
  if (typeof document === 'undefined' || !d) return null
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', '0')
  svg.setAttribute('height', '0')
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden'
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', d)
  svg.appendChild(path)
  document.body.appendChild(svg)
  try {
    const b = path.getBBox()
    if (!(b.width > 0) || !(b.height > 0)) return null
    return { x: b.x, y: b.y, w: b.width, h: b.height }
  } catch {
    return null
  } finally {
    svg.remove()
  }
}

function unionBBox(boxes: PathBBox[]): PathBBox | null {
  if (!boxes.length) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const b of boxes) {
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.w)
    maxY = Math.max(maxY, b.y + b.h)
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) return null
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

function inflate(b: PathBBox, pad: number): PathBBox {
  if (!(pad > 0)) return b
  return { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 }
}

function strokesVisualBBox(strokes: StrokeLike[]): PathBBox | null {
  const boxes: PathBBox[] = []
  let maxHalf = 0
  for (const s of strokes) {
    const box = measurePathBBox(s.d)
    if (box) boxes.push(box)
    const w = s.width ?? 0
    if (w > 0) maxHalf = Math.max(maxHalf, w / 2)
  }
  const union = unionBBox(boxes)
  return union ? inflate(union, maxHalf) : null
}

/**
 * Uniform scale + center so coverage outline `d` matches taught stroke ink bounds.
 * Returns null when measurement fails (caller should render `d` untransformed).
 */
export function fitOutlineToStrokesTransform(
  outlineD: string,
  strokes: StrokeLike[],
): string | null {
  if (!outlineD || !strokes.length) return null
  const from = measurePathBBox(outlineD)
  const to = strokesVisualBBox(strokes)
  if (!from || !to) return null

  const scale = Math.min(to.w / from.w, to.h / from.h)
  if (!(scale > 0) || !Number.isFinite(scale)) return null

  const fromCx = from.x + from.w / 2
  const fromCy = from.y + from.h / 2
  const toCx = to.x + to.w / 2
  const toCy = to.y + to.h / 2
  const r = (n: number) => Math.round(n * 1000) / 1000
  return `translate(${r(toCx)} ${r(toCy)}) scale(${r(scale)}) translate(${r(-fromCx)} ${r(-fromCy)})`
}
