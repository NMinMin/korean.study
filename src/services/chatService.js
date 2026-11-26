import { supabase } from '../lib/supabase';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export const CHAT_MODEL_OPTIONS = [
  {
    key: 'fast',
    label: 'Nhanh',
    model: 'gemini-3.5-flash-lite',
    subtitle: 'Gemini 3.5 Flash-Lite · Hỏi đáp nhanh, tiết kiệm lượt',
  },
  {
    key: 'deep',
    label: 'Chuyên sâu',
    model: 'gemini-4-hydrogen',
    subtitle: 'Gemini 4 Hydrogen · Phân tích sâu ngữ pháp & bài thi',
  },
];

function parseSseBlock(block) {
  const lines = block.split(/\r?\n/);
  let eventName = 'message';
  const dataLines = [];

  for (const line of lines) {
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (!dataLines.length) return null;
  const rawData = dataLines.join('\n');
  try {
    return { event: eventName, data: JSON.parse(rawData) };
  } catch {
    return { event: eventName, data: { text: rawData } };
  }
}

export async function streamStudyChat({
  message,
  modelKey = 'fast',
  previousInteractionId,
  context,
  history,
  signal,
  onMeta,
  onReset,
  onDelta,
  onDone,
}) {
  if (!supabase) throw new Error('Supabase chưa được cấu hình.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.');

  const response = await fetch(`${API_URL}/v1/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      message,
      modelKey,
      previousInteractionId: previousInteractionId || undefined,
      context,
      history,
    }),
    signal,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const err = new Error(data?.message || data?.error?.message || `Không thể kết nối trợ lý AI (HTTP ${response.status}).`);
    err.code = data?.code;
    throw err;
  }

  if (!response.body) {
    throw new Error('Trình duyệt không hỗ trợ đọc phản hồi streaming.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let donePayload = null;

  const dispatchBlock = (rawBlock) => {
    const parsed = parseSseBlock(rawBlock);
    if (!parsed) return;
    if (parsed.event === 'meta') {
      onMeta?.(parsed.data);
    } else if (parsed.event === 'reset') {
      onReset?.(parsed.data);
    } else if (parsed.event === 'delta') {
      if (parsed.data?.text) onDelta?.(parsed.data.text);
    } else if (parsed.event === 'done') {
      donePayload = parsed.data;
      onDone?.(parsed.data);
    } else if (parsed.event === 'error') {
      throw new Error(parsed.data?.message || 'Trợ lý AI gặp sự cố khi trả lời.');
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = parts.pop() || '';
    for (const part of parts) {
      dispatchBlock(part);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    dispatchBlock(buffer);
  }

  return donePayload;
}

async function authHeaders(includeJsonContentType = false) {
  if (!supabase) throw new Error('Supabase chưa được cấu hình.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.');
  return {
    ...(includeJsonContentType ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${session.access_token}`,
  };
}

export async function getMyGeminiKeyStatus() {
  const headers = await authHeaders(false);
  const response = await fetch(`${API_URL}/v1/me/ai-key`, {
    method: 'GET',
    headers,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Không thể kiểm tra trạng thái API key.');
  }
  return payload?.data || { hasKey: false, hasServerKey: false, maskedKey: null, updatedAt: null };
}

export async function saveMyGeminiKey(apiKey) {
  const headers = await authHeaders(true);
  const response = await fetch(`${API_URL}/v1/me/ai-key`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ apiKey: String(apiKey || '').trim() }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Không thể lưu API key.');
  }
  return payload?.data;
}

export async function deleteMyGeminiKey() {
  const headers = await authHeaders(false);
  const response = await fetch(`${API_URL}/v1/me/ai-key`, {
    method: 'DELETE',
    headers,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Không thể xóa API key.');
  }
  return payload?.data || { hasKey: false, hasServerKey: false, maskedKey: null, updatedAt: null };
}
