import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './uiFonts'
import './loadFonts'
import './index.css'
import './styles/motion.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
