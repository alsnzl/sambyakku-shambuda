/** Keep --app-height in sync with the live visual viewport (orientation / chrome). */
export function installViewportSync() {
  const root = document.documentElement

  const sync = () => {
    const h = Math.round(window.visualViewport?.height ?? window.innerHeight)
    const w = Math.round(window.visualViewport?.width ?? window.innerWidth)
    if (h > 0) root.style.setProperty('--app-height', `${h}px`)
    if (w > 0) root.style.setProperty('--app-width', `${w}px`)
  }

  sync()
  window.addEventListener('resize', sync)
  window.addEventListener('orientationchange', () => {
    requestAnimationFrame(sync)
    // WebViews often settle metrics one frame later.
    setTimeout(sync, 120)
  })
  window.visualViewport?.addEventListener('resize', sync)
  window.visualViewport?.addEventListener('scroll', sync)
}
