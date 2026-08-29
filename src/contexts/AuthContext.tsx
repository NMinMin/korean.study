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

type SignUpInput = { displayName: string; email: string; password: string; remember?: boolean }

type AuthContextValue = {
  loading: boolean
  configured: boolean
  session: Session | null
  profile: AppProfile | null
  signIn: (email: string, password: string, remember?: boolean) => Promise<void>
  signUp: (input: SignUpInput) => Promise<{ needsEmailConfirmation: boolean }>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const SESSION_PREFERENCE_KEY = 'kstudy:session-preference'
const SESSION_EXPIRES_KEY = 'kstudy:session-expires-at'
const REMEMBER_SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000

function clearSupabaseAuthStorage() {
  for (const storage of [localStorage, sessionStorage]) {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index)
      if (key && (/^sb-.*-auth-token$/.test(key) || key === 'supabase.auth.token')) storage.removeItem(key)
    }
  }
}

function isRememberedSession() {
  return localStorage.getItem(SESSION_PREFERENCE_KEY) === 'persistent'
}

function setSessionPreference(persistent: boolean) {
  clearSessionExpiry()
  if (persistent) {
    sessionStorage.removeItem(SESSION_PREFERENCE_KEY)
    localStorage.setItem(SESSION_PREFERENCE_KEY, 'persistent')
    return
  }
  // Không để lại bất kỳ lựa chọn lưu phiên nào sau khi đóng trình duyệt.
  localStorage.removeItem(SESSION_PREFERENCE_KEY)
  // Dọn token từng được lưu lâu bởi phiên cũ trước khi tạo phiên chỉ dùng
  // trong tab hiện tại. Token mới sẽ được authStorage ghi vào sessionStorage.
  clearSupabaseAuthStorage()
  sessionStorage.setItem(SESSION_PREFERENCE_KEY, 'session-only')
}

function clearSessionPreference() {
  localStorage.removeItem(SESSION_PREFERENCE_KEY)
  sessionStorage.removeItem(SESSION_PREFERENCE_KEY)
  clearSupabaseAuthStorage()
  clearSessionExpiry()
}

function clearSessionExpiry() {
  localStorage.removeItem(SESSION_EXPIRES_KEY)
  sessionStorage.removeItem(SESSION_EXPIRES_KEY)
}

function getOrCreateRememberedSessionExpiry() {
  // Phiên không chọn "Lưu đăng nhập" nằm trong sessionStorage và tự mất khi
  // đóng trình duyệt, vì vậy không áp dụng thời hạn ghi nhớ 7 ngày cho nó.
  if (!isRememberedSession()) return Number.POSITIVE_INFINITY

  const saved = Number(localStorage.getItem(SESSION_EXPIRES_KEY))
  if (Number.isFinite(saved) && saved > 0) return saved
  const expiresAt = Date.now() + REMEMBER_SESSION_LIFETIME_MS
  clearSessionExpiry()
  localStorage.setItem(SESSION_EXPIRES_KEY, String(expiresAt))
  return expiresAt
}

function startRememberedSessionLifetime() {
  clearSessionExpiry()
  if (isRememberedSession()) {
    localStorage.setItem(SESSION_EXPIRES_KEY, String(Date.now() + REMEMBER_SESSION_LIFETIME_MS))
  }
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

function isAuthRestError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const value = error as { code?: string; message?: string; status?: number }
  const message = String(value.message || '').toLowerCase()
  return value.status === 401
    || value.status === 403
    || value.code === 'PGRST301'
    || message.includes('jwt')
    || message.includes('unauthorized')
    || message.includes('permission denied')
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
    clearSessionPreference()
    if (supabase) {
      window.setTimeout(() => {
        void supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
      }, 0)
    }
  }, [clearAuthState])

  const loadProfile = useCallback(async (nextSession: Session | null) => {
    const requestVersion = ++authLoadVersion.current
    if (nextSession && getOrCreateRememberedSessionExpiry() <= Date.now()) {
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
    if (isAuthRestError(profileError) || isAuthRestError(roleError)) {
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
      if (getOrCreateRememberedSessionExpiry() > Date.now()) return
      clearInvalidSession()
    }
    const timer = window.setInterval(() => void checkExpiry(), 30_000)
    const onVisibility = () => { if (document.visibilityState === 'visible') void checkExpiry() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility) }
  }, [clearInvalidSession, session])

  useEffect(() => {
    const handleExpiredSession = () => clearInvalidSession()
    window.addEventListener('kstudy:auth-expired', handleExpiredSession)
    return () => window.removeEventListener('kstudy:auth-expired', handleExpiredSession)
  }, [clearInvalidSession])

  const value = useMemo<AuthContextValue>(() => ({
    loading,
    configured: isSupabaseConfigured,
    session,
    profile,
    async signIn(email, password, remember = false) {
      if (!supabase) throw new Error('Supabase chưa được cấu hình.')
      setSessionPreference(remember)
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        clearAuthState()
        clearSessionPreference()
        throw error
      }
      startRememberedSessionLifetime()
    },
    async signUp({ displayName, email, password, remember = false }) {
      if (!supabase) throw new Error('Supabase chưa được cấu hình.')
      setSessionPreference(remember)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: import.meta.env.BASE_URL === '/'
            ? `${window.location.origin}/auth/callback`
            : `${window.location.origin}${import.meta.env.BASE_URL}#/auth/callback`,
        },
      })
      if (error) {
        clearSessionPreference()
        throw error
      }
      if (data.session) {
        startRememberedSessionLifetime()
      } else {
        clearSessionPreference()
      }
      return { needsEmailConfirmation: !data.session }
    },
    async requestPasswordReset(email) {
      if (!supabase) throw new Error('Supabase chưa được cấu hình.')
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: import.meta.env.BASE_URL === '/'
          ? `${window.location.origin}/auth/reset-password`
          : `${window.location.origin}${import.meta.env.BASE_URL}#/auth/reset-password`,
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
        clearSessionPreference()
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
