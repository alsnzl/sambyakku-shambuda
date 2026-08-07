import { useEffect, useRef } from 'react'

/**
 * While `active`, block page scroll/overscroll from touch (mobile WebView).
 * React pointer events alone often don't cancel native scroll.
 */
export function useLockScrollWhileDrawing(active: boolean) {
  const activeRef = useRef(active)
  activeRef.current = active

  useEffect(() => {
    const blockTouchMove = (e: TouchEvent) => {
      if (!activeRef.current) return
      e.preventDefault()
    }

    document.addEventListener('touchmove', blockTouchMove, { passive: false })
    return () => {
      document.removeEventListener('touchmove', blockTouchMove)
    }
  }, [])

  useEffect(() => {
    if (!active) return
    const html = document.documentElement
    const body = document.body
    html.classList.add('is-drawing-lock')
    body.classList.add('is-drawing-lock')
    return () => {
      html.classList.remove('is-drawing-lock')
      body.classList.remove('is-drawing-lock')
    }
  }, [active])
}
