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
  /**
   * track — horizontal connected pills (write scrub)
   * timeline — vertical spine + captions
   * segments — dense equal cells for narrow guide columns
   */
  variant?: 'track' | 'timeline' | 'segments'
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
  variant = 'track',
}: Props) {
  if (steps.length === 0) return null

  const selectable = typeof onSelect === 'function'
  const timeline = variant === 'timeline'
  const segments = variant === 'segments'

  return (
    <ol
      className={[
        'stroke-order',
        timeline ? 'stroke-order--timeline' : '',
        segments ? 'stroke-order--segments' : '',
        selectable ? 'stroke-order--selectable' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={label}
    >
      {steps.map((step, i) => {
        const state = step.done ? 'is-done' : step.current ? 'is-current' : 'is-todo'
        const badgeContent = step.done && !segments ? '✓' : i + 1
        const caption = step.done ? '완료' : step.current ? '그리는 중' : `${i + 1}번째`
        return (
          <li key={`order-${i}`} className={`stroke-order__item ${state}`}>
            {i > 0 && !segments ? (
              <span className="stroke-order__rail" aria-hidden="true" />
            ) : null}
            <div className="stroke-order__node">
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
                <span className="stroke-order__badge" aria-hidden="true">
                  {badgeContent}
                </span>
              )}
              {timeline ? (
                <span className="stroke-order__caption" aria-hidden={selectable ? undefined : true}>
                  {caption}
                </span>
              ) : null}
              {!timeline && !selectable ? (
                <span className="visually-hidden">
                  {i + 1}번 획
                  {step.done ? ' 완료' : step.current ? ' 진행 중' : ' 대기'}
                </span>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
