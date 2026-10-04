import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { installPointerTracking } from './lib/state'
import './styles/global.css'

installPointerTracking()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
