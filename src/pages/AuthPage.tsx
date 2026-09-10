import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Mail, Moon, Sun } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import loginBackground from '../../UIUX/backgrounddangnhap.png'
import registerBackground from '../../UIUX/backgrounddangky.png'
import hidePasswordIcon from '../../UIUX/Hide.png'
import showPasswordIcon from '../../UIUX/Show.png'
import { BlockingLoader, useAppDialog } from '../components/common/AppDialog'
import './auth.css'

type Mode = 'register' | 'login'

const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (/invalid login credentials/i.test(message)) return 'Email hoặc mật khẩu không đúng.'
  if (/email not confirmed/i.test(message)) return 'Bạn cần xác minh email trước khi đăng nhập.'
  if (/user already registered/i.test(message)) return 'Email này đã được đăng ký.'
  if (/rate limit/i.test(message)) return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.'
  if (/error sending confirmation email|unexpected_failure/i.test(message)) return 'Không thể gửi email xác nhận. Vui lòng kiểm tra cấu hình SMTP trong Supabase Auth hoặc thử lại sau.'
  return message || 'Đã có lỗi xảy ra. Vui lòng thử lại.'
}

export default function AuthPage() {
  const auth = useAuth()
  const dialog = useAppDialog()
  const [mode, setMode] = useState<Mode>('login')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [busy, setBusy] = useState(false)
  const [busyLabel, setBusyLabel] = useState('Đang xử lý…')
  const [dark, setDark] = useState(() => localStorage.getItem('kstudy:theme') === 'dark')

  const title = mode === 'login' ? 'ĐĂNG NHẬP' : 'ĐĂNG KÝ'
  const passwordValid = useMemo(() => passwordRule.test(password), [password])

  const changeMode = (nextMode: Mode) => {
    setMode(nextMode)
  }

  useEffect(() => {
    if (auth.configured) return
    void dialog.alert({
      title: 'Chưa thể kết nối',
      message: 'Hệ thống đăng nhập chưa được cấu hình. Vui lòng liên hệ quản trị viên.',
      variant: 'error',
    })
  }, [auth.configured, dialog])

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    localStorage.setItem('kstudy:theme', next ? 'dark' : 'light')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail || !password) {
      await dialog.alert({ title: 'Thiếu thông tin', message: 'Vui lòng nhập đầy đủ email và mật khẩu.', variant: 'warning' })
      return
    }
    if (mode === 'register') {
      if (displayName.trim().length < 2) {
        await dialog.alert({ title: 'Tên chưa hợp lệ', message: 'Tên hiển thị cần ít nhất 2 ký tự.', variant: 'warning' })
        return
      }
      if (!passwordValid) {
        await dialog.alert({ title: 'Mật khẩu chưa an toàn', message: 'Mật khẩu cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.', variant: 'warning' })
        return
      }
      if (password !== confirmPassword) {
        await dialog.alert({ title: 'Mật khẩu không khớp', message: 'Vui lòng nhập lại phần xác nhận mật khẩu.', variant: 'warning' })
        return
      }
    }
    setBusy(true)
    setBusyLabel(mode === 'login' ? 'Đang đăng nhập…' : 'Đang tạo tài khoản…')
    try {
      if (mode === 'login') {
        await auth.signIn(cleanEmail, password, remember)
      } else {
        const result = await auth.signUp({ displayName: displayName.trim(), email: cleanEmail, password, remember })
        if (result.emailAlreadyRegistered) {
          setBusy(false)
          await dialog.alert({
            title: 'Email đã được đăng ký',
            message: 'Email này đã có tài khoản. Vui lòng đăng nhập hoặc dùng “Quên mật khẩu” nếu bạn không nhớ mật khẩu.',
            variant: 'warning',
            confirmLabel: 'Đăng nhập',
          })
          setMode('login')
          setPassword('')
          setConfirmPassword('')
          return
        }
        if (result.needsEmailConfirmation) {
          setBusy(false)
          await dialog.alert({ title: 'Hãy kiểm tra email', message: 'Tài khoản đã được tạo. Mở email chúng tôi vừa gửi để xác minh tài khoản trước khi đăng nhập.', variant: 'success', confirmLabel: 'Đã hiểu' })
          setMode('login')
          setPassword('')
          setConfirmPassword('')
        }
      }
    } catch (nextError) {
      setBusy(false)
      await dialog.alert({ title: mode === 'login' ? 'Đăng nhập chưa thành công' : 'Đăng ký chưa thành công', message: friendlyError(nextError), variant: 'error', confirmLabel: 'Thử lại' })
    } finally {
      setBusy(false)
    }
  }

  const forgotPassword = async () => {
    if (!email.trim()) {
      await dialog.alert({ title: 'Nhập email của bạn', message: 'Điền email đã đăng ký, sau đó bấm “Quên mật khẩu” lần nữa để nhận liên kết đặt lại.', variant: 'info' })
      return
    }
    setBusy(true)
    setBusyLabel('Đang gửi email khôi phục…')
    try {
      await auth.requestPasswordReset(email.trim().toLowerCase())
      setBusy(false)
      await dialog.alert({ title: 'Hãy kiểm tra email', message: 'Nếu email đã được đăng ký, bạn sẽ nhận được liên kết đặt lại mật khẩu trong ít phút. Hãy kiểm tra cả thư mục Spam.', variant: 'success', confirmLabel: 'Đã hiểu' })
    } catch (nextError) {
      setBusy(false)
      await dialog.alert({ title: 'Chưa thể gửi email', message: friendlyError(nextError), variant: 'error', confirmLabel: 'Thử lại' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className={`auth-screen ${dark ? 'theme-dark' : 'theme-light'}`}>
      <BlockingLoader show={busy} label={busyLabel} />
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
