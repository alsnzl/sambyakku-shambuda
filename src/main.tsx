import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './uiFonts'
import './loadFonts'
import './index.css'
import './styles/motion.css'
import { initPrefs } from './lib/prefsStore'
import { restoreCustomScriptFonts } from './lib/customScriptFonts'
import { installHardwareBackListener } from './lib/hardwareBack'
import App from './App.tsx'
/* After App so landscape overrides win over component CSS in the bundle. */
import './styles/landscape.css'
/* Liquid Glass — after landscape so glass tokens/surfaces apply app-wide. */
import './styles/liquid-glass.css'
/* After landscape/glass so press shadows win over fold-toggle box-shadow: none. */
import './styles/press.css'

initPrefs()
installHardwareBackListener()

void restoreCustomScriptFonts()
  .catch(() => {
    /* font restore must never block the web app */
  })
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
