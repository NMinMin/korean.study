import { supabase } from './supabase'

const apiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:3001'

export async function adminApi<T>(path: string, init?: RequestInit): Promise<T> {
  if (!supabase) throw new Error('Supabase chưa được cấu hình.')
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Phiên đăng nhập đã hết hạn.')
  const response = await fetch(`${apiUrl}/v1/admin${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init?.headers },
  })
  const payload = response.status === 204 ? null : await response.json()
  if (!response.ok) {
    if (response.status === 404) throw new Error('Backend đang chạy bản cũ hoặc sai địa chỉ API. Hãy build và khởi động lại backend.')
    throw new Error(payload?.message || 'Thao tác quản trị thất bại.')
  }
  return payload?.data as T
}
