import { useEffect, useRef } from 'react'
import { registerHardwareBack } from './hardwareBack'

/**
 * When active, system back runs `onBack`.
 * Return true if handled; false to fall through (e.g. exit on home).
 */
export function useHardwareBack(onBack: () => boolean, active = true): void {
  const onBackRef = useRef(onBack)
  onBackRef.current = onBack

  useEffect(() => {
    if (!active) return
    return registerHardwareBack(() => onBackRef.current())
  }, [active])
}
