type BackHandler = () => boolean

const handlers: BackHandler[] = []
let installed = false
let lastDispatchAt = 0

/** Register a back handler. Later registrations run first (nested UI). */
export function registerHardwareBack(handler: BackHandler): () => void {
  handlers.push(handler)
  return () => {
    const idx = handlers.lastIndexOf(handler)
    if (idx !== -1) handlers.splice(idx, 1)
  }
}

/** @returns true if a handler consumed the event */
export function dispatchHardwareBack(): boolean {
  const now = Date.now()
  // Cap backButton + popstate can fire together — only one step per gesture.
  if (now - lastDispatchAt < 280) return true
  for (let i = handlers.length - 1; i >= 0; i -= 1) {
    if (handlers[i]()) {
      lastDispatchAt = now
      return true
    }
  }
  return false
}

function armHistoryTrap(): void {
  window.history.pushState({ appNav: true }, '')
}

/**
 * Wire Android system back + browser/WebView history back to in-app navigation.
 */
export function installHardwareBackListener(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  // Trap browser / WebView back so each press maps to one in-app step.
  armHistoryTrap()
  window.addEventListener('popstate', () => {
    if (dispatchHardwareBack()) {
      armHistoryTrap()
      return
    }
    // Root screen — allow leaving; do not re-arm the trap.
    void import('@capacitor/core')
      .then(({ Capacitor }) => {
        if (!Capacitor.isNativePlatform()) return
        return import('@capacitor/app').then(({ App }) => App.exitApp())
      })
      .catch(() => {
        // ignore
      })
  })

  void Promise.all([import('@capacitor/core'), import('@capacitor/app')])
    .then(([{ Capacitor }, { App }]) => {
      void App.addListener('backButton', () => {
        // Prefer history.back → popstate so browser + native share one path.
        if (handlers.length > 0) {
          window.history.back()
          return
        }
        if (Capacitor.isNativePlatform()) {
          void App.exitApp()
        }
      })
    })
    .catch(() => {
      // plugin unavailable in some previews
    })
}
