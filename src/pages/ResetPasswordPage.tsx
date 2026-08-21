import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './auth.css'

export default function ResetPasswordPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  if (!auth.configured) return <Navigate to="/auth" replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) return setMessage('Mật khẩu chưa đáp ứng yêu cầu bảo mật.')
    if (password !== confirmPassword) return setMessage('Xác nhận mật khẩu không khớp.')
    setBusy(true)
    try {
      await auth.updatePassword(password)
      navigate('/', { replace: true })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể cập nhật mật khẩu.')
    } finally { setBusy(false) }
  }

  return <main className="auth-screen theme-light"><section className="reset-card"><div className="brand"><span className="brand-mark">한</span><span>Korean <b>Study</b></span></div><h1>Đặt lại mật khẩu</h1>{message && <p className="auth-message error">{message}</p>}<form onSubmit={submit}><label className="field"><span>Mật khẩu mới</span><input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label><label className="field"><span>Xác nhận mật khẩu</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></label><button className="submit-button" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu mật khẩu mới'}</button></form></section></main>
}
