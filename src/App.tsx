import { useEffect, type ComponentType } from 'react'
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import LegacyDashboard from './App.jsx'
import { AuthProvider, useAuth, type AppProfile } from './contexts/AuthContext'
import AuthPage from './pages/AuthPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import AdminPage from './pages/AdminPage'
import { userStorageKey } from './lib/storageKeys'
import { AppDialogProvider } from './components/common/AppDialog'

const Dashboard = LegacyDashboard as ComponentType<{
  authenticatedProfile: AppProfile
  onSignOut: () => Promise<void>
}>

function AppRoutes() {
  const auth = useAuth()

  useEffect(() => {
    if (!auth.profile) return
    localStorage.setItem(`kstudy:${userStorageKey('user-profile', auth.profile.id)}`, JSON.stringify({
      id: auth.profile.id,
      displayName: auth.profile.displayName,
      email: auth.profile.email,
      avatarUrl: auth.profile.avatarUrl,
      role: auth.profile.role,
      joinedAt: Date.now(),
    }))
  }, [auth.profile])

  if (auth.loading) return <div className="app-loading" role="status">Đang tải Korean Study…</div>

  // Một số cấu hình Supabase cũ trả token khôi phục về trang gốc. Sau khi
  // client đã nhận phiên ở trên, đưa người dùng vào đúng màn hình đổi mật khẩu.
  const recoveryHash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const recoveryQuery = new URLSearchParams(window.location.search)
  const isRecoveryRedirect = recoveryHash.get('type') === 'recovery' || recoveryQuery.get('type') === 'recovery'
  if (isRecoveryRedirect) return <Navigate to="/auth/reset-password" replace />

  return <Routes>
    <Route path="/auth" element={auth.profile ? <Navigate to={auth.profile.role === 'admin' ? '/admin' : '/'} replace /> : <AuthPage />} />
    <Route path="/auth/callback" element={<Navigate to={auth.profile?.role === 'admin' ? '/admin' : '/'} replace />} />
    <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
    <Route path="/admin" element={!auth.profile
      ? <Navigate to="/auth" replace />
      : auth.profile.role === 'admin'
        ? <AdminPage />
        : <Navigate to="/" replace />} />
    <Route path="/*" element={!auth.profile
      ? <Navigate to="/auth" replace />
      : auth.profile.role === 'admin'
        ? <Navigate to="/admin" replace />
        : <Dashboard authenticatedProfile={auth.profile} onSignOut={auth.signOut} />} />
  </Routes>
}

export default function App() {
  const isStaticSubpathDeploy = import.meta.env.BASE_URL !== '/'
  if (isStaticSubpathDeploy) {
    return <HashRouter><AppDialogProvider><AuthProvider><AppRoutes /></AuthProvider></AppDialogProvider></HashRouter>
  }
  return <BrowserRouter><AppDialogProvider><AuthProvider><AppRoutes /></AuthProvider></AppDialogProvider></BrowserRouter>
}
