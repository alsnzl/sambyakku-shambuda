import './StrokeOrderTrack.css'

export type StrokeOrderStep = {
  done: boolean
  current: boolean
}

type Props = {
  steps: StrokeOrderStep[]
  /** Accessible name for the order list */
  label?: string
  className?: string
  /** When set, badges become buttons that seek to that stroke index */
  onSelect?: (index: number) => void
}

/**
 * Number-only stroke order: 1 → 2 → 3 …
 * Emphasizes sequence with connectors and current/done badges.
 */
export function StrokeOrderTrack({
  steps,
  label = '획 순서',
  className = '',
  onSelect,
}: Props) {
  if (steps.length === 0) return null

  const selectable = typeof onSelect === 'function'

  return (
    <ol
      className={['stroke-order', selectable ? 'stroke-order--selectable' : '', className]
        .filter(Boolean)
        .join(' ')}
      aria-label={label}
    >
      {steps.map((step, i) => {
        const state = step.done ? 'is-done' : step.current ? 'is-current' : 'is-todo'
        const badgeContent = step.done ? '✓' : i + 1
        return (
          <li key={`order-${i}`} className={`stroke-order__item ${state}`}>
            {i > 0 ? <span className="stroke-order__rail" aria-hidden="true" /> : null}
            {selectable ? (
              <button
                type="button"
                className="stroke-order__badge"
                aria-label={`${i + 1}번 획`}
                aria-current={step.current ? 'step' : undefined}
                onClick={() => onSelect(i)}
              >
                {badgeContent}
              </button>
            ) : (
              <>
                <span className="stroke-order__badge" aria-hidden="true">
                  {badgeContent}
                </span>
                <span className="visually-hidden">
                  {i + 1}번 획
                  {step.done ? ' 완료' : step.current ? ' 진행 중' : ' 대기'}
                </span>
              </>
            )}
          </li>
        )
      })}
    </ol>
  )
}
