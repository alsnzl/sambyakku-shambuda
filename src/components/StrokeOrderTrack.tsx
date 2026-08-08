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
}

/**
 * Number-only stroke order: 1 → 2 → 3 …
 * Emphasizes sequence with connectors and current/done badges.
 */
export function StrokeOrderTrack({
  steps,
  label = '획 순서',
  className = '',
}: Props) {
  if (steps.length === 0) return null

  return (
    <ol
      className={['stroke-order', className].filter(Boolean).join(' ')}
      aria-label={label}
    >
      {steps.map((step, i) => {
        const state = step.done ? 'is-done' : step.current ? 'is-current' : 'is-todo'
        return (
          <li key={`order-${i}`} className={`stroke-order__item ${state}`}>
            {i > 0 ? <span className="stroke-order__rail" aria-hidden="true" /> : null}
            <span className="stroke-order__badge" aria-hidden="true">
              {step.done ? '✓' : i + 1}
            </span>
            <span className="visually-hidden">
              {i + 1}번 획
              {step.done ? ' 완료' : step.current ? ' 진행 중' : ' 대기'}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
