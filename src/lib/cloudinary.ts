import { supabase } from './supabase'

const apiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:3001'

type UploadedAsset = { url: string; publicId?: string; resourceType?: string; format?: string; bytes?: number; name?: string }

export async function uploadCloudinaryAsset(file: File, assetType: 'image' | 'audio' | 'file' = 'file'): Promise<UploadedAsset> {
  if (!supabase) throw new Error('Supabase chưa được cấu hình.')
  const { data } = await supabase.auth.getSession()
  if (!data.session?.access_token) throw new Error('Phiên đăng nhập đã hết hạn.')

  const localLimit = assetType === 'image' ? 10 * 1024 * 1024 : assetType === 'audio' ? 100 * 1024 * 1024 : 20 * 1024 * 1024
  if (file.size > localLimit) throw new Error(assetType === 'image' ? 'Hình ảnh không được vượt quá 10 MB.' : assetType === 'audio' ? 'File âm thanh không được vượt quá 100 MB.' : 'Tệp không được vượt quá 20 MB.')

  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  const cacheKey = `kstudy:cloudinary-assets:${data.session.user.id}`
  let cache: Record<string, UploadedAsset> = {}
  try { cache = JSON.parse(localStorage.getItem(cacheKey) || '{}') as Record<string, UploadedAsset> } catch { cache = {} }
  if (cache[fingerprint]?.url) return cache[fingerprint]

  const signatureResponse = await fetch(`${apiUrl}/v1/uploads/cloudinary/signature`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify({ kind: 'lesson', assetType }),
  })
  const signed = await signatureResponse.json()
  if (!signatureResponse.ok) throw new Error(signed.message || 'Không thể chuẩn bị tải tệp.')
  if (file.size > signed.maxBytes) throw new Error(assetType === 'image' ? 'Hình ảnh không được vượt quá 10 MB.' : assetType === 'audio' ? 'File âm thanh không được vượt quá 100 MB.' : 'Tệp vượt quá dung lượng cho phép.')

  const body = new FormData()
  body.append('file', file)
  body.append('api_key', signed.apiKey)
  body.append('timestamp', String(signed.timestamp))
  body.append('folder', signed.folder)
  body.append('signature', signed.signature)
  const response = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/auto/upload`, { method: 'POST', body })
  const uploaded = await response.json()
  if (!response.ok) throw new Error(uploaded.error?.message || 'Cloudinary không nhận được tệp.')
  const asset = { url: uploaded.secure_url, publicId: uploaded.public_id, resourceType: uploaded.resource_type, format: uploaded.format, bytes: uploaded.bytes, name: file.name }
  try { localStorage.setItem(cacheKey, JSON.stringify({ ...cache, [fingerprint]: asset })) } catch { /* Upload vẫn hợp lệ khi storage bị chặn. */ }
  return asset
}
