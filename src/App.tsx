import { useEffect, type ComponentType } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LegacyDashboard from './App.jsx'
import { AuthProvider, useAuth, type AppProfile } from './contexts/AuthContext'
import AuthPage from './pages/AuthPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import AdminPage from './pages/AdminPage'
import { userStorageKey } from './lib/storageKeys'

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
  return <BrowserRouter basename={import.meta.env.BASE_URL}><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>
}
