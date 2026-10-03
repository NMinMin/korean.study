import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { normalizePreferences, translate, PREFERENCES_KEY } from '../lib/interfacePreferences'
type Theme = 'light' | 'dark' | 'system'
type Language = 'vi' | 'en' | 'ko'
type Preferences = { theme: Theme; language: Language }
function readPreferences(): Preferences {
  try { return normalizePreferences(JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}')) as Preferences }
  catch { return { theme: 'light', language: 'vi' } }
}
function applyPreferences(value: Preferences) {
  document.documentElement.dataset.theme = value.theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : value.theme
  document.documentElement.lang = value.language
}
applyPreferences(readPreferences())
const Context = createContext<(Preferences & { setTheme: (theme: Theme) => void; setLanguage: (language: Language) => void; t: (text: string) => string }) | null>(null)
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(readPreferences)
  useEffect(() => {
    applyPreferences(preferences)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => applyPreferences(preferences)
    media.addEventListener('change', apply)
    try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)) } catch { /* Use in-memory preferences if storage is unavailable. */ }
    return () => media.removeEventListener('change', apply)
  }, [preferences])
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === PREFERENCES_KEY) setPreferences(readPreferences()) }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  return <Context.Provider value={{ ...preferences, setTheme: (theme) => setPreferences((current) => ({ ...current, theme })), setLanguage: (language) => setPreferences((current) => ({ ...current, language })), t: (text) => translate(text, preferences.language) }}>{children}</Context.Provider>
}
export function usePreferences() {
  const value = useContext(Context)
  if (!value) throw new Error('PreferencesProvider is missing')
  return value
}
