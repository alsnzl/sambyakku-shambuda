import './StrokeHistoryRail.css'

type Props = {
  undoDisabled: boolean
  redoDisabled: boolean
  onUndo: () => void
  onRedo: () => void
}

export function StrokeHistoryRail({ undoDisabled, redoDisabled, onUndo, onRedo }: Props) {
  return (
    <div className="stroke-history" role="group" aria-label="획 취소·되돌리기">
      <button
        type="button"
        className="stroke-history__btn motion-press"
        disabled={undoDisabled}
        onClick={onUndo}
        title="취소"
        aria-label="이전 획 취소"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12.5 8c-2.65 0-5.05 1.02-6.85 2.68L3 8v8h8l-2.62-2.62C9.7 11.7 11.5 10.8 12.5 10.8c2.76 0 5.05 1.86 5.74 4.4l1.95-.65C19.16 10.96 16.1 8 12.5 8z"
          />
        </svg>
      </button>
      <button
        type="button"
        className="stroke-history__btn motion-press"
        disabled={redoDisabled}
        onClick={onRedo}
        title="되돌리기"
        aria-label="취소한 획 다시"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            fill="currentColor"
            d="M18.35 10.68C16.55 9.02 14.15 8 11.5 8 7.9 8 4.84 10.96 3.81 14.55l1.95.65c.69-2.54 2.98-4.4 5.74-4.4 1 0 2.8.9 4.12 2.38L13 16h8V8l-2.65 2.68z"
          />
        </svg>
      </button>
    </div>
  )
}
