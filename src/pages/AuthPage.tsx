import { useMemo, useState, type FormEvent } from 'react'
import { Mail, Moon, Sun } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import loginBackground from '../../UIUX/backgrounddangnhap.png'
import registerBackground from '../../UIUX/backgrounddangky.png'
import hidePasswordIcon from '../../UIUX/Hide.png'
import showPasswordIcon from '../../UIUX/Show.png'
import './auth.css'

type Mode = 'register' | 'login'

const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (/invalid login credentials/i.test(message)) return 'Email hoặc mật khẩu không đúng.'
  if (/email not confirmed/i.test(message)) return 'Bạn cần xác minh email trước khi đăng nhập.'
  if (/user already registered/i.test(message)) return 'Email này đã được đăng ký.'
  if (/rate limit/i.test(message)) return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.'
  return message || 'Đã có lỗi xảy ra. Vui lòng thử lại.'
}

export default function AuthPage() {
  const auth = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dark, setDark] = useState(() => localStorage.getItem('kstudy:theme') === 'dark')

  const title = mode === 'login' ? 'ĐĂNG NHẬP' : 'ĐĂNG KÝ'
  const passwordValid = useMemo(() => passwordRule.test(password), [password])

  const changeMode = (nextMode: Mode) => {
    setMode(nextMode)
    setError('')
    setNotice('')
  }

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    localStorage.setItem('kstudy:theme', next ? 'dark' : 'light')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setNotice('')
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail || !password) return setError('Vui lòng nhập đầy đủ email và mật khẩu.')
    if (mode === 'register') {
      if (displayName.trim().length < 2) return setError('Tên hiển thị cần ít nhất 2 ký tự.')
      if (!passwordValid) return setError('Mật khẩu cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.')
      if (password !== confirmPassword) return setError('Xác nhận mật khẩu không khớp.')
    }
    setBusy(true)
    try {
      if (mode === 'login') {
        await auth.signIn(cleanEmail, password, remember)
      } else {
        const result = await auth.signUp({ displayName: displayName.trim(), email: cleanEmail, password, remember })
        if (result.needsEmailConfirmation) {
          setNotice('Đăng ký thành công. Hãy mở email để xác minh tài khoản trước khi đăng nhập.')
          setMode('login')
          setPassword('')
          setConfirmPassword('')
        }
      }
    } catch (nextError) {
      setError(friendlyError(nextError))
    } finally {
      setBusy(false)
    }
  }

  const forgotPassword = async () => {
    setError('')
    setNotice('')
    if (!email.trim()) return setError('Nhập email để nhận liên kết đặt lại mật khẩu.')
    setBusy(true)
    try {
      await auth.requestPasswordReset(email.trim().toLowerCase())
      setNotice('Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi.')
    } catch (nextError) {
      setError(friendlyError(nextError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className={`auth-screen ${dark ? 'theme-dark' : 'theme-light'}`}>
      <button className="theme-button" type="button" onClick={toggleTheme} aria-label={dark ? 'Bật giao diện sáng' : 'Bật giao diện tối'}>
        {dark ? <Moon /> : <Sun />}
      </button>
      <section className={`auth-shell ${mode === 'register' ? 'register-mode' : 'login-mode'}`} aria-label={title}>
        <div className="auth-visual">
          <div className="brand"><span className="brand-mark">한</span><span>Korean <b>Study</b></span></div>
          <img
            key={mode}
            src={mode === 'login' ? loginBackground : registerBackground}
            alt={mode === 'login' ? 'Bạn học tiếng Hàn cùng thỏ Korean Study' : 'Chào mừng bạn tạo tài khoản Korean Study'}
          />
        </div>
        <div className="auth-panel">
          <div className="mobile-tabs" role="tablist" aria-label="Chọn đăng ký hoặc đăng nhập">
            <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => changeMode('register')}>Đăng ký</button>
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => changeMode('login')}>Đăng nhập</button>
          </div>
          <h1>{title}</h1>
          {!auth.configured && <p className="auth-message error">Chưa cấu hình Supabase. Hãy sao chép `.env.example` thành `.env` và điền các biến `VITE_SUPABASE_*`.</p>}
          {error && <p className="auth-message error" role="alert">{error}</p>}
          {notice && <p className="auth-message success" role="status">{notice}</p>}
          <form onSubmit={submit} noValidate>
            {mode === 'register' && (
              <label className="field"><span>Tên hiển thị *</span><input autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
            )}
            <label className="field with-icon"><span>Email *</span><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /><Mail aria-hidden="true" /></label>
            <label className="field password-field"><span>Mật khẩu *</span><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}><img src={showPassword ? showPasswordIcon : hidePasswordIcon} alt="" /></button></label>
            {mode === 'register' && (
              <><p className={`password-hint ${password && !passwordValid ? 'invalid' : ''}`}>Ít nhất 8 ký tự, có chữ hoa, chữ thường và số.</p><label className="field"><span>Xác nhận mật khẩu *</span><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></label></>
            )}
            <div className="auth-options">
              <label className="remember"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> <span>Lưu đăng nhập</span></label>
              {mode === 'login' && <button type="button" className="link-button" onClick={forgotPassword} disabled={busy}>Quên mật khẩu</button>}
            </div>
            <button className="submit-button" type="submit" disabled={busy || !auth.configured}>{busy ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</button>
          </form>
          <div className="auth-switch"><span>{mode === 'login' ? 'Bạn chưa có tài khoản?' : 'Bạn đã có tài khoản?'}</span><button type="button" onClick={() => changeMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Tạo tài khoản' : 'Đăng nhập'}</button></div>
        </div>
      </section>
    </main>
  )
}
