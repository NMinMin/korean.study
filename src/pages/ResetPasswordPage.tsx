import { useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, Check, Eye, EyeOff, LockKeyhole, ShieldCheck, Moon, Sun } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { BlockingLoader, useAppDialog } from '../components/common/AppDialog'
import loginBackground from '../../UIUX/backgrounddangnhap.png'
import './auth.css'
import './reset-password.css'

const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

export default function ResetPasswordPage() {
  const auth = useAuth()
  const dialog = useAppDialog()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('kstudy:theme') === 'dark')
  const [busy, setBusy] = useState(false)
  const checks = useMemo(() => [
    { label: 'Ít nhất 8 ký tự', valid: password.length >= 8 },
    { label: 'Có chữ hoa và chữ thường', valid: /[A-Z]/.test(password) && /[a-z]/.test(password) },
    { label: 'Có ít nhất một chữ số', valid: /\d/.test(password) },
  ], [password])

  if (!auth.configured) return <Navigate to="/auth" replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!passwordRule.test(password)) {
      await dialog.alert({ title: 'Mật khẩu chưa an toàn', message: 'Hãy hoàn thành đủ các yêu cầu bảo mật bên dưới.', variant: 'warning' })
      return
    }
    if (password !== confirmPassword) {
      await dialog.alert({ title: 'Mật khẩu không khớp', message: 'Phần xác nhận chưa trùng với mật khẩu mới.', variant: 'warning' })
      return
    }
    setBusy(true)
    try {
      await auth.updatePassword(password)
      setBusy(false)
      await dialog.alert({ title: 'Đổi mật khẩu thành công', message: 'Mật khẩu mới đã được cập nhật. Bạn có thể tiếp tục sử dụng Korean Study.', variant: 'success', confirmLabel: 'Tiếp tục' })
      navigate('/', { replace: true })
    } catch (error) {
      setBusy(false)
      await dialog.alert({
        title: 'Liên kết không còn hiệu lực',
        message: error instanceof Error ? error.message : 'Không thể cập nhật mật khẩu. Vui lòng yêu cầu một liên kết mới.',
        variant: 'error',
        confirmLabel: 'Đã hiểu',
      })
    } finally {
      setBusy(false)
    }
  }

  return <main className={`auth-screen reset-password-screen ${dark ? 'theme-dark' : 'theme-light'}`}>
    <BlockingLoader show={busy} label="Đang cập nhật mật khẩu…" />
    <button className="theme-button" type="button" aria-label={dark ? 'Bật giao diện sáng' : 'Bật giao diện tối'} onClick={() => {
      setDark(!dark)
      localStorage.setItem('kstudy:theme', dark ? 'light' : 'dark')
    }}>{dark ? <Sun /> : <Moon />}</button>
    <section className="auth-shell reset-password-shell" aria-labelledby="reset-password-title">
      <aside className="reset-password-visual">
        <div className="brand"><span className="brand-mark">한</span><span>Korean <b>Study</b></span></div>
        <img src={loginBackground} alt="" />
        <div className="reset-password-visual-copy"><ShieldCheck size={28} /><strong>Tài khoản của bạn được bảo vệ</strong><span>Chỉ còn một bước để quay lại hành trình học tiếng Hàn.</span></div>
      </aside>
      <div className="reset-password-panel">
        <button type="button" className="reset-back-button" onClick={() => navigate('/auth', { replace: true })}><ArrowLeft size={17} /> Quay lại đăng nhập</button>
        <span className="reset-lock-icon"><LockKeyhole size={27} /></span>
        <h1 id="reset-password-title">Tạo mật khẩu mới</h1>
        <p>Chọn một mật khẩu mạnh và khác với mật khẩu bạn đã dùng trước đây.</p>
        <form onSubmit={submit} noValidate>
          <label className="reset-field"><span>Mật khẩu mới</span><div><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" aria-describedby="reset-password-rules" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nhập mật khẩu mới" required autoFocus /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></label>
          <div id="reset-password-rules" className="reset-password-rules" aria-label="Yêu cầu mật khẩu">{checks.map((check) => <span className={check.valid ? 'is-valid' : ''} key={check.label}><Check size={13} aria-hidden="true" /><span className="reset-rule-status">{check.valid ? 'Đã đạt: ' : 'Cần: '}</span>{check.label}</span>)}</div>
          <label className="reset-field"><span>Xác nhận mật khẩu</span><div><input type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" aria-describedby={confirmPassword ? 'reset-password-match' : undefined} aria-invalid={Boolean(confirmPassword && confirmPassword !== password)} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Nhập lại mật khẩu mới" required /><button type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'} aria-pressed={showConfirmPassword}>{showConfirmPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></label>
          {confirmPassword && <p id="reset-password-match" className={`reset-match ${confirmPassword === password ? 'is-valid' : ''}`} aria-live="polite">{confirmPassword === password ? 'Mật khẩu xác nhận đã khớp.' : 'Mật khẩu xác nhận chưa khớp.'}</p>}
          <button className="reset-submit-button" disabled={busy} type="submit">{busy ? 'Đang cập nhật…' : 'Cập nhật mật khẩu'}</button>
        </form>
      </div>
    </section>
  </main>
}
