import { useEffect, useState } from 'react'
import { Home, type OpenMode } from './pages/Home'
import { TracksPage } from './pages/TracksPage'
import { Learn } from './pages/Learn'
import { Practice } from './pages/Practice'
import { About } from './pages/About'
import { DailyPage } from './pages/DailyPage'
import { ReviewPage } from './pages/ReviewPage'
import { ProgressPage } from './pages/ProgressPage'
import { FavoritesPage } from './pages/FavoritesPage'
import { ConvertPage } from './pages/ConvertPage'
import { MantrasPage } from './pages/MantrasPage'
import { SimilarPage } from './pages/SimilarPage'
import { PathPage } from './pages/PathPage'
import { SettingsPage } from './pages/SettingsPage'
import { CorrespondencePage } from './pages/CorrespondencePage'
import { ConjunctsPage } from './pages/ConjunctsPage'
import { TeachPage } from './pages/TeachPage'
import { MotionPage } from './components/MotionPage'
import type { Letter } from './data/letters'
import type { ScriptTrack } from './types/track'
import { refreshCloudStore } from './lib/strokeCloud'
import { useHardwareBack } from './lib/useHardwareBack'
import './App.css'

type Screen =
  | 'home'
  | 'tracks'
  | 'learn'
  | 'practice'
  | 'chart'
  | 'about'
  | 'daily'
  | 'review'
  | 'progress'
  | 'favorites'
  | 'convert'
  | 'mantras'
  | 'similar'
  | 'path'
  | 'settings'
  | 'correspondence'
  | 'conjuncts'
  | 'teach'

type BackTo = 'home' | 'tracks'

type GlobalMode = Extract<
  OpenMode,
  | 'convert'
  | 'mantras'
  | 'about'
  | 'path'
  | 'tracks'
  | 'settings'
  | 'correspondence'
  | 'conjuncts'
  | 'teach'
>

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [track, setTrack] = useState<ScriptTrack>('sanskrit')
  const [openLetterId, setOpenLetterId] = useState<string | null>(null)
  const [backTo, setBackTo] = useState<BackTo>('tracks')

  useEffect(() => {
    void refreshCloudStore({ force: true }).catch(() => {
      // offline ok
    })
  }, [])

  useHardwareBack(() => {
    if (screen === 'home') return false
    if (
      screen === 'tracks' ||
      screen === 'about' ||
      screen === 'path' ||
      screen === 'settings' ||
      screen === 'teach'
    ) {
      goHome()
      return true
    }
    goBack()
    return true
  }, screen !== 'home')

  function open(nextTrack: ScriptTrack, mode: OpenMode) {
    setTrack(nextTrack)
    setOpenLetterId(null)
    setScreen(mode === 'tracks' ? 'tracks' : (mode as Screen))
  }

  function openGlobal(mode: GlobalMode) {
    setOpenLetterId(null)
    setScreen(mode)
  }

  function goHome() {
    setOpenLetterId(null)
    setScreen('home')
  }

  function goTracks() {
    setOpenLetterId(null)
    setScreen('tracks')
  }

  function goBack() {
    if (backTo === 'home') goHome()
    else goTracks()
  }

  function openLetterFromTools(letter: Letter, nextTrack: ScriptTrack = track) {
    setTrack(nextTrack)
    setOpenLetterId(letter.id)
    setScreen('learn')
  }

  const backLabel = backTo === 'home' ? '← 홈' : '← 학습'

  const pageKey =
    screen === 'home' ||
    screen === 'about' ||
    screen === 'convert' ||
    screen === 'mantras' ||
    screen === 'path' ||
    screen === 'tracks' ||
    screen === 'settings' ||
    screen === 'correspondence' ||
    screen === 'conjuncts' ||
    screen === 'teach'
      ? screen
      : `${screen}-${track}${openLetterId ? `-${openLetterId}` : ''}`

  return (
    <div className="app-shell">
      <MotionPage
        motionKey={pageKey}
        variant={screen === 'home' ? 'fade-up' : 'pop'}
      >
        {screen === 'home' ? (
          <Home
            onOpen={(nextTrack, mode) => {
              setBackTo('home')
              open(nextTrack, mode)
            }}
            onAbout={() => {
              setBackTo('home')
              openGlobal('about')
            }}
            onOpenGlobal={(mode) => {
              setBackTo('home')
              openGlobal(mode)
            }}
            onOpenLetter={(nextTrack, letterId) => {
              setBackTo('home')
              setTrack(nextTrack)
              setOpenLetterId(letterId)
              setScreen('learn')
            }}
          />
        ) : null}
        {screen === 'tracks' ? (
          <TracksPage
            onBack={goHome}
            onOpen={(nextTrack, mode) => {
              setBackTo('tracks')
              open(nextTrack, mode)
            }}
            onOpenGlobal={(mode) => {
              setBackTo('tracks')
              openGlobal(mode)
            }}
          />
        ) : null}
        {screen === 'about' ? <About onBack={goHome} /> : null}
        {screen === 'path' ? <PathPage onBack={goHome} /> : null}
        {screen === 'settings' ? <SettingsPage onBack={goHome} /> : null}
        {screen === 'teach' ? <TeachPage onBack={goHome} /> : null}
        {screen === 'correspondence' ? (
          <CorrespondencePage
            onBack={goBack}
            backLabel={backLabel}
            onOpenLetter={(letter, nextTrack) => {
              setBackTo(backTo)
              openLetterFromTools(letter, nextTrack)
            }}
          />
        ) : null}
        {screen === 'conjuncts' ? (
          <ConjunctsPage
            onBack={goBack}
            backLabel={backLabel}
            onOpenLetter={(letter) => openLetterFromTools(letter, 'sanskrit')}
          />
        ) : null}
        {screen === 'learn' || screen === 'chart' ? (
          <Learn
            key={`${track}-${screen}-${openLetterId ?? 'none'}`}
            track={track}
            startInChart={screen === 'chart'}
            initialLetterId={openLetterId}
            onBack={goBack}
            backLabel={backLabel}
          />
        ) : null}
        {screen === 'practice' ? (
          <Practice track={track} onBack={goBack} backLabel={backLabel} />
        ) : null}
        {screen === 'daily' ? (
          <DailyPage
            track={track}
            onBack={goBack}
            backLabel={backLabel}
            onOpenLetter={openLetterFromTools}
          />
        ) : null}
        {screen === 'review' ? (
          <ReviewPage
            track={track}
            onBack={goBack}
            backLabel={backLabel}
          />
        ) : null}
        {screen === 'progress' ? (
          <ProgressPage
            track={track}
            onBack={goBack}
            backLabel={backLabel}
            onOpenLetter={openLetterFromTools}
            onOpenPath={() => openGlobal('path')}
          />
        ) : null}
        {screen === 'favorites' ? (
          <FavoritesPage
            track={track}
            onBack={goBack}
            backLabel={backLabel}
            onOpenLetter={openLetterFromTools}
          />
        ) : null}
        {screen === 'convert' ? (
          <ConvertPage onBack={goBack} backLabel={backLabel} />
        ) : null}
        {screen === 'mantras' ? (
          <MantrasPage
            onBack={goBack}
            backLabel={backLabel}
            onOpenLetter={(letter) => openLetterFromTools(letter, 'sanskrit')}
          />
        ) : null}
        {screen === 'similar' ? (
          <SimilarPage track={track} onBack={goBack} backLabel={backLabel} />
        ) : null}
      </MotionPage>
    </div>
  )
}

export default App
