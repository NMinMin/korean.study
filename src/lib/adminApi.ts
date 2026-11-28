import { supabase } from './supabase'

const apiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:3001'
const DEFAULT_CACHE_TTL_MS = 3 * 60 * 1000

type AdminApiInit = RequestInit & {
  bypassCache?: boolean
  cacheTtlMs?: number
}

const responseCache = new Map<string, { data: unknown; expiresAt: number }>()
const inFlightRequests = new Map<string, Promise<unknown>>()
let cachedUserId: string | null = null

export function clearAdminApiCache(prefix?: string) {
  if (!prefix) {
    responseCache.clear()
    inFlightRequests.clear()
    return
  }
  for (const key of responseCache.keys()) {
    if (key.startsWith(prefix)) responseCache.delete(key)
  }
  for (const key of inFlightRequests.keys()) {
    if (key.startsWith(prefix)) inFlightRequests.delete(key)
  }
}

export function hasAdminApiCache(path: string): boolean {
  const entry = responseCache.get(path)
  if (!entry) return false
  if (entry.expiresAt <= Date.now()) {
    responseCache.delete(path)
    return false
  }
  return true
}

function stripRefreshParam(path: string): string {
  return path.replace(/([?&])refresh=true(&|$)/, (_, sep, trailing) => (trailing ? sep : ''))
}

export async function adminApi<T>(path: string, init?: AdminApiInit): Promise<T> {
  if (!supabase) throw new Error('Supabase chưa được cấu hình.')
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const userId = data.session?.user?.id ?? null
  if (!token) {
    clearAdminApiCache()
    throw new Error('Phiên đăng nhập đã hết hạn.')
  }
  if (cachedUserId && cachedUserId !== userId) {
    clearAdminApiCache()
  }
  cachedUserId = userId

  const { bypassCache = false, cacheTtlMs = DEFAULT_CACHE_TTL_MS, ...fetchInit } = init ?? {}
  const method = (fetchInit.method || 'GET').toUpperCase()
  const isGet = method === 'GET'
  const isExplicitRefresh = /(?:[?&])refresh=true(?:&|$)/.test(path)

  if (isGet && !bypassCache && !isExplicitRefresh) {
    const cached = responseCache.get(path)
    if (cached) {
      if (cached.expiresAt > Date.now()) return cached.data as T
      responseCache.delete(path)
    }
    const existing = inFlightRequests.get(path)
    if (existing) return existing as Promise<T>
  }

  const execute = async (): Promise<T> => {
    const headers = new Headers(fetchInit.headers)
    headers.set('Authorization', `Bearer ${token}`)
    if (fetchInit.body != null && !(fetchInit.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    const response = await fetch(`${apiUrl}/v1/admin${path}`, {
      ...fetchInit,
      headers,
    })
    const payload = response.status === 204 ? null : await response.json().catch(() => null)
    if (!response.ok) {
      if (response.status === 401 || payload?.code === 'ACCOUNT_LOCKED') {
        clearAdminApiCache()
        window.dispatchEvent(new CustomEvent('kstudy:auth-expired'))
        throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
      }
      if (response.status === 403) throw new Error(payload?.message || 'Bạn không có quyền thực hiện thao tác này.')
      if (response.status === 404) throw new Error((payload?.code !== 'NOT_FOUND' && payload?.message) || 'Backend đang chạy bản cũ hoặc sai địa chỉ API. Hãy build và khởi động lại backend.')
      throw new Error(payload?.message || 'Thao tác quản trị thất bại.')
    }
    const result = payload?.data as T
    if (isGet) {
      const expiresAt = Date.now() + cacheTtlMs
      responseCache.set(path, { data: result, expiresAt })
      if (isExplicitRefresh) {
        responseCache.set(stripRefreshParam(path), { data: result, expiresAt })
      }
    } else {
      clearAdminApiCache()
    }
    return result
  }

  if (!isGet) return execute()

  const requestPromise = execute().finally(() => {
    if (inFlightRequests.get(path) === requestPromise) {
      inFlightRequests.delete(path)
    }
  })
  inFlightRequests.set(path, requestPromise)
  return requestPromise
}
