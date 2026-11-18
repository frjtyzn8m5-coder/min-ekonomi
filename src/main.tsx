import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initSyncQueue } from './lib/syncQueue'

// Starta offline-synk vid app-start
initSyncQueue();

// Demo/preview mode marker (used by static screenshots to force the final,
// animated-in state so nothing is hidden behind an intro animation).
if (new URLSearchParams(window.location.search).has('demo')) {
  document.documentElement.setAttribute('data-demo', '');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
// Sat May 30 19:08:49     2026
