import type { Letter } from '../data/letters'

let current: HTMLAudioElement | null = null

/** Prefer file audio; fall back to speech synthesis using IAST. */
export async function playLetterAudio(
  audioSrc?: string,
  speakText?: string,
): Promise<boolean> {
  if (audioSrc) {
    try {
      if (current) {
        current.pause()
        current = null
      }
      const audio = new Audio(audioSrc)
      current = audio
      await audio.play()
      return true
    } catch {
      // fall through to TTS
    }
  }

  if (!speakText || typeof window === 'undefined' || !window.speechSynthesis) {
    return false
  }

  return speakIast(speakText)
}

export function speakIast(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'hi-IN'
      u.rate = 0.85
      u.onend = () => resolve(true)
      u.onerror = () => resolve(false)
      window.speechSynthesis.speak(u)
    } catch {
      resolve(false)
    }
  })
}

export async function playLetterPronunciation(letter: Letter): Promise<boolean> {
  return playLetterAudio(letter.audioSrc, letter.iast)
}
