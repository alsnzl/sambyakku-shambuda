type Props = {
  onHome: () => void
}

/** Global jump-to-home control (hidden on the home screen itself). */
export function HomeFab({ onHome }: Props) {
  return (
    <button
      type="button"
      className="app-home-fab motion-press"
      onClick={onHome}
      aria-label="홈으로"
      title="홈으로"
    >
      <span className="app-home-fab__icon" aria-hidden="true">
        ⌂
      </span>
    </button>
  )
}
