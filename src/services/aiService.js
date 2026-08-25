import { supabase } from '../lib/supabase';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export function parseAIJson(value) {
  const clean = String(value || '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch (error) {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1));
    throw error;
  }
}

export async function requestAIJson(prompt) {
  if (!supabase) throw new Error('Supabase chưa được cấu hình.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.');
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${API_URL}/v1/ai/json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ text: prompt }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || `AI grader HTTP ${res.status}`);
    return { value: parseAIJson(data.result), model: data.model || 'AI grader' };
  } finally {
    window.clearTimeout(timer);
  }
}

export async function transcribeShadowRecording(blob) {
  if (!supabase) throw new Error('Supabase chưa được cấu hình.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.');
  const extension = blob.type.includes('mpeg') || blob.type.includes('mp3')
    ? 'mp3'
    : blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
  const form = new FormData();
  // The speech-to-text service expects multipart/form-data with field `file`,
  // matching its Postman contract. Keep the browser's real codec/MIME type;
  // MP3 uploads are named .mp3 while MediaRecorder output remains webm/m4a.
  form.append('file', blob, `shadowing-${Date.now()}.${extension}`);
  const response = await fetch(`${API_URL}/v1/shadowing/transcribe`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || 'Không thể nhận diện giọng nói lúc này.');
  return data.transcript || '';
}
