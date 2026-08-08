import type { ReactNode } from 'react'

/** Toggle markdown `**…**` around the current textarea selection. */
export function wrapTheoryTipBold(
  text: string,
  start: number,
  end: number,
): { text: string; selectionStart: number; selectionEnd: number } {
  const from = Math.max(0, Math.min(start, end, text.length))
  const to = Math.max(0, Math.max(start, end, from))
  const selected = text.slice(from, to)

  const before = text.slice(0, from)
  const after = text.slice(to)
  const wrappedAlready =
    selected.length >= 4 && selected.startsWith('**') && selected.endsWith('**')
  const flankedAlready = before.endsWith('**') && after.startsWith('**')

  if (wrappedAlready) {
    const inner = selected.slice(2, -2)
    return {
      text: `${before}${inner}${after}`,
      selectionStart: from,
      selectionEnd: from + inner.length,
    }
  }

  if (flankedAlready && selected.length > 0) {
    return {
      text: `${before.slice(0, -2)}${selected}${after.slice(2)}`,
      selectionStart: from - 2,
      selectionEnd: to - 2,
    }
  }

  if (selected.length === 0) {
    const insert = '****'
    return {
      text: `${before}${insert}${after}`,
      selectionStart: from + 2,
      selectionEnd: from + 2,
    }
  }

  const insert = `**${selected}**`
  return {
    text: `${before}${insert}${after}`,
    selectionStart: from,
    selectionEnd: from + insert.length,
  }
}

/**
 * Render tip text with `**bold**` segments as <strong>.
 * Escapes HTML; only markdown bold is interpreted.
 */
export function renderTheoryTipText(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const re = /\*\*(.+?)\*\*/g
  let last = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index))
    }
    parts.push(<strong key={`b-${key++}`}>{match[1]}</strong>)
    last = match.index + match[0].length
  }

  if (last < text.length) {
    parts.push(text.slice(last))
  }

  return parts.length > 0 ? parts : [text]
}
