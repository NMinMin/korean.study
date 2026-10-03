import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PreferencesProvider } from './contexts/PreferencesContext'
import './styles/theme.css'
import { initStorageShim } from './services/storageShim'

// Progress keys are persisted by the shim in Supabase's user_progress_states
// table. Initialising it before React mounts prevents study views from trying
// to call an undefined window.storage object.
initStorageShim()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PreferencesProvider><App /></PreferencesProvider>
  </StrictMode>,
)
