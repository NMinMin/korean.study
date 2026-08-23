import { supabase } from '../lib/supabase';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export async function uploadCloudinaryAsset(file, kind = 'lesson') {
  if (!supabase) throw new Error('Supabase chưa được cấu hình nên không thể xác thực tải tệp.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Bạn cần đăng nhập lại trước khi tải tệp.');

  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const cacheKey = `kstudy:cloudinary-assets:${session.user.id}`;
  let assetCache = {};
  try { assetCache = JSON.parse(localStorage.getItem(cacheKey) || '{}'); } catch (error) { assetCache = {}; }
  if (assetCache[fingerprint]?.url) return assetCache[fingerprint];

  const signatureResponse = await fetch(`${API_URL}/v1/uploads/cloudinary/signature`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ kind }),
  });
  const signed = await signatureResponse.json().catch(() => ({}));
  if (!signatureResponse.ok) throw new Error(signed.message || 'Không thể chuẩn bị tải tệp lên Cloudinary.');
  if (file.size > signed.maxBytes) throw new Error('Tệp vượt quá giới hạn 20 MB.');

  const body = new FormData();
  body.append('file', file);
  body.append('api_key', signed.apiKey);
  body.append('timestamp', String(signed.timestamp));
  body.append('folder', signed.folder);
  body.append('signature', signed.signature);
  const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/auto/upload`, { method: 'POST', body });
  const uploaded = await uploadResponse.json().catch(() => ({}));
  if (!uploadResponse.ok) throw new Error(uploaded.error?.message || 'Cloudinary không nhận được tệp.');
  const asset = {
    url: uploaded.secure_url,
    publicId: uploaded.public_id,
    resourceType: uploaded.resource_type,
    format: uploaded.format,
    bytes: uploaded.bytes,
    name: file.name,
  };
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ ...assetCache, [fingerprint]: asset }));
  } catch (error) { }
  return asset;
}
