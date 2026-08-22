import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

const authStorage = {
  getItem(key: string) {
    const persistent = localStorage.getItem('kstudy:session-preference') === 'persistent'
    return persistent ? localStorage.getItem(key) : sessionStorage.getItem(key)
  },
  setItem(key: string, value: string) {
    if (localStorage.getItem('kstudy:session-preference') !== 'persistent') {
      localStorage.removeItem(key)
      sessionStorage.setItem(key, value)
    } else {
      sessionStorage.removeItem(key)
      localStorage.setItem(key, value)
    }
  },
  removeItem(key: string) {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  },
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: authStorage },
    })
  : null
