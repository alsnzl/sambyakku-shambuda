type Props = {
  open: boolean
  className?: string
}

/** Shared fold/expand control: ▶ closed, rotates to ▼ when open. */
export function FoldChevron({ open, className = '' }: Props) {
  return (
    <span
      className={`fold-chevron ${open ? 'is-open' : ''}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    >
      ▶
    </span>
  )
}
