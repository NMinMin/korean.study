import type { Session, User } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { userStorageKey } from '../lib/storageKeys'

export type AppProfile = {
  id: string
  displayName: string
  email: string | null
  avatarUrl: string | null
  role: 'user' | 'admin'
}

type SignUpInput = { displayName: string; email: string; password: string }

type AuthContextValue = {
  loading: boolean
  configured: boolean
  session: Session | null
  profile: AppProfile | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: SignUpInput) => Promise<{ needsEmailConfirmation: boolean }>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const SESSION_EXPIRES_KEY = 'kstudy:session-expires-at'
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000

function sessionStore() {
  return localStorage.getItem('kstudy:session-preference') === 'persistent' ? localStorage : sessionStorage
}

function clearSessionExpiry() {
  localStorage.removeItem(SESSION_EXPIRES_KEY)
  sessionStorage.removeItem(SESSION_EXPIRES_KEY)
}

function getOrCreateSessionExpiry() {
  const store = sessionStore()
  const saved = Number(store.getItem(SESSION_EXPIRES_KEY))
  if (Number.isFinite(saved) && saved > 0) return saved
  const expiresAt = Date.now() + SESSION_LIFETIME_MS
  clearSessionExpiry()
  store.setItem(SESSION_EXPIRES_KEY, String(expiresAt))
  return expiresAt
}

function profileFromUser(user: User): AppProfile {
  return {
    id: user.id,
    displayName: String(user.user_metadata?.display_name || user.email?.split('@')[0] || 'Người học'),
    email: user.email ?? null,
    avatarUrl: typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : null,
    role: 'user',
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<AppProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const authLoadVersion = useRef(0)

  const clearAuthState = useCallback(() => {
    authLoadVersion.current += 1
    clearSessionExpiry()
    setSession(null)
    setProfile(null)
  }, [])

  const clearInvalidSession = useCallback(() => {
    clearAuthState()
    if (supabase) {
      window.setTimeout(() => {
        void supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
      }, 0)
    }
  }, [clearAuthState])

  const loadProfile = useCallback(async (nextSession: Session | null) => {
    const requestVersion = ++authLoadVersion.current
    if (nextSession && getOrCreateSessionExpiry() <= Date.now()) {
      clearInvalidSession()
      return
    }
    if (!nextSession?.user || !supabase) {
      clearAuthState()
      return
    }

    // getSession() chỉ đọc token trong storage và vẫn có thể trả về token đã bị
    // thu hồi. Xác minh với Auth server trước khi mount dashboard để tránh một
    // phiên hỏng tạo hàng loạt request REST 401/403.
    const { data: verifiedAuth, error: verifyError } = await supabase.auth.getUser()
    if (requestVersion !== authLoadVersion.current) return
    if (verifyError || !verifiedAuth.user || verifiedAuth.user.id !== nextSession.user.id) {
      clearInvalidSession()
      return
    }

    const verifiedUser = verifiedAuth.user
    const fallback = profileFromUser(verifiedUser)
    const [{ data, error: profileError }, { data: roleData, error: roleError }] = await Promise.all([
      supabase.from('profiles').select('id, display_name, avatar_url').eq('id', verifiedUser.id).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', verifiedUser.id).maybeSingle(),
    ])
    if (requestVersion !== authLoadVersion.current) return
    if (profileError?.code === 'PGRST301' || roleError?.code === 'PGRST301' || profileError?.message?.includes('JWT') || roleError?.message?.includes('JWT')) {
      clearInvalidSession()
      return
    }
    setSession(nextSession)
    setProfile(data ? {
      id: data.id,
      displayName: data.display_name,
      avatarUrl: data.avatar_url,
      email: verifiedUser.email ?? null,
      role: roleData?.role === 'admin' ? 'admin' : 'user',
    } : fallback)
  }, [clearAuthState, clearInvalidSession])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase.auth.getSession()
      .then(({ data, error }) => error ? clearInvalidSession() : loadProfile(data.session))
      .finally(() => setLoading(false))
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT') {
        clearAuthState()
        return
      }
      if (event === 'TOKEN_REFRESHED' && !nextSession) {
        clearInvalidSession()
        return
      }
      // Supabase khuyến nghị không gọi tiếp API auth ngay bên trong callback.
      window.setTimeout(() => void loadProfile(nextSession), 0)
    })
    return () => listener.subscription.unsubscribe()
  }, [clearAuthState, clearInvalidSession, loadProfile])

  useEffect(() => {
    if (!session || !supabase) return
    const checkExpiry = () => {
      if (getOrCreateSessionExpiry() > Date.now()) return
      clearInvalidSession()
    }
    const timer = window.setInterval(() => void checkExpiry(), 30_000)
    const onVisibility = () => { if (document.visibilityState === 'visible') void checkExpiry() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility) }
  }, [clearInvalidSession, session])

  const value = useMemo<AuthContextValue>(() => ({
    loading,
    configured: isSupabaseConfigured,
    session,
    profile,
    async signIn(email, password) {
      if (!supabase) throw new Error('Supabase chưa được cấu hình.')
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      clearSessionExpiry()
      sessionStore().setItem(SESSION_EXPIRES_KEY, String(Date.now() + SESSION_LIFETIME_MS))
    },
    async signUp({ displayName, email, password }) {
      if (!supabase) throw new Error('Supabase chưa được cấu hình.')
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}auth/callback`,
        },
      })
      if (error) throw error
      if (data.session) {
        clearSessionExpiry()
        sessionStore().setItem(SESSION_EXPIRES_KEY, String(Date.now() + SESSION_LIFETIME_MS))
      }
      return { needsEmailConfirmation: !data.session }
    },
    async requestPasswordReset(email) {
      if (!supabase) throw new Error('Supabase chưa được cấu hình.')
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}auth/reset-password`,
      })
      if (error) throw error
    },
    async updatePassword(password) {
      if (!supabase) throw new Error('Supabase chưa được cấu hình.')
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
    },
    async signOut() {
      if (!supabase) return
      const signingOutUserId = session?.user.id
      try {
        await supabase.auth.signOut()
      } finally {
        clearAuthState()
        if (signingOutUserId) localStorage.removeItem(`kstudy:${userStorageKey('user-profile', signingOutUserId)}`)
        localStorage.removeItem('kstudy:session-preference')
      }
    },
  }), [clearAuthState, loading, profile, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth phải được dùng bên trong AuthProvider')
  return value
}
