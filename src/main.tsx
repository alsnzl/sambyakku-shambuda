import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './uiFonts'
import './loadFonts'
import './index.css'
import './styles/motion.css'
import './styles/landscape.css'
import { initPrefs } from './lib/prefsStore'
import App from './App.tsx'

initPrefs()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
