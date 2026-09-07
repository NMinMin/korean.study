import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, LoaderCircle, ShieldAlert, X } from 'lucide-react'
import './app-dialog.css'

export type DialogVariant = 'success' | 'error' | 'warning' | 'info'

type DialogOptions = {
  title: string
  message: string
  variant?: DialogVariant
  confirmLabel?: string
  cancelLabel?: string
}

type DialogRequest = DialogOptions & {
  mode: 'alert' | 'confirm'
  resolve: (result: boolean) => void
}

type AppDialogContextValue = {
  alert: (options: DialogOptions) => Promise<void>
  confirm: (options: DialogOptions) => Promise<boolean>
}

const AppDialogContext = createContext<AppDialogContextValue | null>(null)

const icons = {
  success: CheckCircle2,
  error: ShieldAlert,
  warning: AlertTriangle,
  info: Info,
}

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null)

  const finish = useCallback((result: boolean) => {
    setRequest((current) => {
      current?.resolve(result)
      return null
    })
  }, [])

  useEffect(() => {
    if (!request) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [finish, request])

  const value = useMemo<AppDialogContextValue>(() => ({
    alert: (options) => new Promise<void>((resolve) => {
      setRequest({ ...options, mode: 'alert', resolve: () => resolve() })
    }),
    confirm: (options) => new Promise<boolean>((resolve) => {
      setRequest({ ...options, mode: 'confirm', resolve })
    }),
  }), [])

  const variant = request?.variant || 'info'
  const Icon = icons[variant]

  return <AppDialogContext.Provider value={value}>
    {children}
    {request && <div className="app-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) finish(false) }}>
      <section className={`app-dialog app-dialog-${variant}`} role="alertdialog" aria-modal="true" aria-labelledby="app-dialog-title" aria-describedby="app-dialog-message">
        <button type="button" className="app-dialog-close" aria-label="Đóng" onClick={() => finish(false)}><X size={18} /></button>
        <span className="app-dialog-icon"><Icon size={28} /></span>
        <div className="app-dialog-copy">
          <h2 id="app-dialog-title">{request.title}</h2>
          <p id="app-dialog-message">{request.message}</p>
        </div>
        <footer>
          {request.mode === 'confirm' && <button type="button" className="app-dialog-secondary" onClick={() => finish(false)}>{request.cancelLabel || 'Hủy'}</button>}
          <button type="button" className={`app-dialog-primary is-${variant}`} autoFocus onClick={() => finish(true)}>{request.confirmLabel || (request.mode === 'confirm' ? 'Xác nhận' : 'Đã hiểu')}</button>
        </footer>
      </section>
    </div>}
  </AppDialogContext.Provider>
}

export function useAppDialog() {
  const value = useContext(AppDialogContext)
  if (!value) throw new Error('useAppDialog phải được dùng bên trong AppDialogProvider')
  return value
}

export function BlockingLoader({ show, label = 'Đang xử lý…' }: { show: boolean; label?: string }) {
  if (!show) return null
  return <div className="app-busy-overlay" role="status" aria-live="assertive" aria-label={label}>
    <div className="app-busy-card"><LoaderCircle size={30} /><strong>{label}</strong><span>Vui lòng chờ trong giây lát</span></div>
  </div>
}
