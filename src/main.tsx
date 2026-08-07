import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './uiFonts'
import './loadFonts'
import './index.css'
import './styles/motion.css'
import { initPrefs } from './lib/prefsStore'
import { installHardwareBackListener } from './lib/hardwareBack'
import App from './App.tsx'
/* After App so landscape overrides win over component CSS in the bundle. */
import './styles/landscape.css'

initPrefs()
installHardwareBackListener()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
