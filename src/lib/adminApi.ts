import { supabase } from './supabase'

const apiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:3001'

export async function adminApi<T>(path: string, init?: RequestInit): Promise<T> {
  if (!supabase) throw new Error('Supabase chưa được cấu hình.')
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Phiên đăng nhập đã hết hạn.')
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token}`)
  if (init?.body != null && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(`${apiUrl}/v1/admin${path}`, {
    ...init,
    headers,
  })
  const payload = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      window.dispatchEvent(new CustomEvent('kstudy:auth-expired'))
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
    }
    if (response.status === 404) throw new Error('Backend đang chạy bản cũ hoặc sai địa chỉ API. Hãy build và khởi động lại backend.')
    throw new Error(payload?.message || 'Thao tác quản trị thất bại.')
  }
  return payload?.data as T
}
