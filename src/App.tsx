import { useEffect, type ComponentType } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LegacyDashboard from './App.jsx'
import { AuthProvider, useAuth, type AppProfile } from './contexts/AuthContext'
import AuthPage from './pages/AuthPage'
import ResetPasswordPage from './pages/ResetPasswordPage'

const Dashboard = LegacyDashboard as ComponentType<{
  authenticatedProfile: AppProfile
  onSignOut: () => Promise<void>
}>

function AppRoutes() {
  const auth = useAuth()

  useEffect(() => {
    if (!auth.profile) return
    localStorage.setItem('kstudy:user-profile:2-1', JSON.stringify({
      id: auth.profile.id,
      displayName: auth.profile.displayName,
      email: auth.profile.email,
      avatarUrl: auth.profile.avatarUrl,
      joinedAt: Date.now(),
    }))
  }, [auth.profile])

  if (auth.loading) return <div className="app-loading" role="status">Đang tải Korean Study…</div>

  return <Routes>
    <Route path="/auth" element={auth.profile ? <Navigate to="/" replace /> : <AuthPage />} />
    <Route path="/auth/callback" element={<Navigate to="/" replace />} />
    <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
    <Route path="/*" element={auth.profile ? <Dashboard authenticatedProfile={auth.profile} onSignOut={auth.signOut} /> : <Navigate to="/auth" replace />} />
  </Routes>
}

export default function App() {
  return <BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>
}
