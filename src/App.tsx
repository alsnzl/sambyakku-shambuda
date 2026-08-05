import { useEffect, useState } from 'react'
import { Home, type OpenMode } from './pages/Home'
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
import { MotionPage } from './components/MotionPage'
import type { Letter } from './data/letters'
import type { ScriptTrack } from './types/track'
import { refreshCloudStore } from './lib/strokeCloud'
import './App.css'

type Screen =
  | 'home'
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

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [track, setTrack] = useState<ScriptTrack>('sanskrit')
  const [openLetterId, setOpenLetterId] = useState<string | null>(null)

  useEffect(() => {
    void refreshCloudStore({ force: true }).catch(() => {
      // offline ok
    })
  }, [])

  function open(nextTrack: ScriptTrack, mode: OpenMode) {
    setTrack(nextTrack)
    setOpenLetterId(null)
    setScreen(mode)
  }

  function openGlobal(mode: Extract<OpenMode, 'convert' | 'mantras' | 'about'>) {
    setOpenLetterId(null)
    setScreen(mode)
  }

  function goHome() {
    setOpenLetterId(null)
    setScreen('home')
  }

  function openLetterFromTools(letter: Letter) {
    setOpenLetterId(letter.id)
    setScreen('learn')
  }

  const pageKey =
    screen === 'home' || screen === 'about' || screen === 'convert' || screen === 'mantras'
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
            onOpen={open}
            onAbout={() => openGlobal('about')}
            onOpenGlobal={(mode) => openGlobal(mode)}
          />
        ) : null}
        {screen === 'about' ? <About onBack={goHome} /> : null}
        {screen === 'learn' || screen === 'chart' ? (
          <Learn
            key={`${track}-${screen}-${openLetterId ?? 'none'}`}
            track={track}
            startInChart={screen === 'chart'}
            initialLetterId={openLetterId}
            onBack={goHome}
          />
        ) : null}
        {screen === 'practice' ? (
          <Practice track={track} onBack={goHome} />
        ) : null}
        {screen === 'daily' ? (
          <DailyPage
            track={track}
            onBack={goHome}
            onOpenLetter={openLetterFromTools}
          />
        ) : null}
        {screen === 'review' ? (
          <ReviewPage track={track} onBack={goHome} />
        ) : null}
        {screen === 'progress' ? (
          <ProgressPage
            track={track}
            onBack={goHome}
            onOpenLetter={openLetterFromTools}
          />
        ) : null}
        {screen === 'favorites' ? (
          <FavoritesPage
            track={track}
            onBack={goHome}
            onOpenLetter={openLetterFromTools}
          />
        ) : null}
        {screen === 'convert' ? <ConvertPage onBack={goHome} /> : null}
        {screen === 'mantras' ? <MantrasPage onBack={goHome} /> : null}
        {screen === 'similar' ? (
          <SimilarPage track={track} onBack={goHome} />
        ) : null}
      </MotionPage>
    </div>
  )
}

export default App
