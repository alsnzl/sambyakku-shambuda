import { useSyncExternalStore } from 'react'
import { getScriptFontEpoch, subscribeScriptFonts } from './customScriptFonts'

/** Bumps when script font choice or upload changes — remount guide glyphs. */
export function useScriptFontEpoch(): number {
  return useSyncExternalStore(subscribeScriptFonts, getScriptFontEpoch, getScriptFontEpoch)
}
