import { supabase } from '../lib/supabase';

export function initStorageShim() {
  if (typeof window !== 'undefined' && !window.storage) {
    const PREFIX = 'kstudy:';
    const SHARED_PREFIX = 'kstudy-shared:';
    try {
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const localKey = localStorage.key(index) || '';
        if (localKey.startsWith(`${PREFIX}progress:`) || localKey.startsWith(`${SHARED_PREFIX}progress:`)) {
          localStorage.removeItem(localKey);
        }
      }
    } catch (error) { }

    window.storage = {
      async get(key, shared = false) {
        try {
          if (key.startsWith('progress:')) {
            if (!supabase) return null;
            const { data: auth } = await supabase.auth.getSession();
            const sessionUser = auth.session?.user;
            if (!sessionUser) return null;
            const { data, error } = await supabase
              .from('user_progress_states')
              .select('state_value')
              .eq('user_id', sessionUser.id)
              .eq('state_key', key)
              .maybeSingle();
            if (error || !data) return null;
            return { key, value: data.state_value, shared: true };
          }
          const k = (shared ? SHARED_PREFIX : PREFIX) + key;
          const v = localStorage.getItem(k);
          return v === null ? null : { key, value: v, shared };
        } catch (e) {
          return null;
        }
      },
      async set(key, value, shared = false) {
        try {
          if (key.startsWith('progress:')) {
            if (!supabase) return null;
            const { data: auth } = await supabase.auth.getSession();
            const sessionUser = auth.session?.user;
            if (!sessionUser) return null;
            const normalizedValue = typeof value === 'string' ? value : JSON.stringify(value);
            const { error } = await supabase.from('user_progress_states').upsert(
              {
                user_id: sessionUser.id,
                state_key: key,
                state_value: normalizedValue,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id,state_key' }
            );
            if (error) return null;
            localStorage.removeItem(PREFIX + key);
            localStorage.removeItem(SHARED_PREFIX + key);
            return { key, value: normalizedValue, shared: true };
          }
          const k = (shared ? SHARED_PREFIX : PREFIX) + key;
          localStorage.setItem(k, typeof value === 'string' ? value : JSON.stringify(value));
          return { key, value, shared };
        } catch (e) {
          return null;
        }
      },
      async delete(key, shared = false) {
        try {
          if (key.startsWith('progress:')) {
            if (!supabase) return null;
            const { data: auth } = await supabase.auth.getSession();
            const sessionUser = auth.session?.user;
            if (!sessionUser) return null;
            await supabase.from('user_progress_states').delete().eq('user_id', sessionUser.id).eq('state_key', key);
            localStorage.removeItem(PREFIX + key);
            localStorage.removeItem(SHARED_PREFIX + key);
            return { key, deleted: true, shared: true };
          }
          const k = (shared ? SHARED_PREFIX : PREFIX) + key;
          localStorage.removeItem(k);
          return { key, deleted: true, shared };
        } catch (e) {
          return null;
        }
      },
      async list(prefix = '', shared = false) {
        try {
          const base = shared ? SHARED_PREFIX : PREFIX;
          const full = base + prefix;
          const keys = [];
          for (let i = 0; i < localStorage.length; i++) {
            const rawKey = localStorage.key(i);
            if (rawKey && rawKey.startsWith(full)) {
              keys.push(rawKey.slice(base.length));
            }
          }
          return { keys, prefix, shared };
        } catch (e) {
          return { keys: [], prefix, shared };
        }
      },
    };
  }
}


export const userStorageKey = (prefix, userId) => (userId ? `${prefix}:${userId}` : prefix);
export const lessonProgressKey = (prefix, lesson, userId) =>
  userStorageKey(
    `progress:${lesson?.textbookId || '2-1'}:${lesson?.id || lesson?.no || '1'}:${prefix}`,
    userId
  );
export const legacyLessonProgressKey = (prefix, lessonNo) =>
  `progress:${prefix}:lesson-${lessonNo || '1'}`;
export const legacyTextbookProgressKey = (textbookId, key) =>
  `progress:${textbookId || '2-1'}:${key}`;

export const vocabProgressKey = (lesson, userId) => lessonProgressKey('vocabulary', lesson, userId);
export const legacyVocabProgressKey = (lesson) => legacyLessonProgressKey('vocab-progress', lesson?.no || lesson);
export const vocabNotebookKey = (userId) => userStorageKey('vocab-notebook', userId);
export const legacyVocabNotebookKey = 'vocab-notebook';

export const shadowProgressKey = (lesson, userId) => lessonProgressKey('shadowing', lesson, userId);
export const legacyShadowProgressKey = (lesson) => legacyLessonProgressKey('shadow-progress', lesson?.no || lesson);

export const dictationProgressKey = (lesson, userId) => lessonProgressKey('dictation', lesson, userId);
export const legacyDictationProgressKey = (lesson) => legacyLessonProgressKey('dictation-progress', lesson?.no || lesson);

export const reviewHistoryKey = (lesson, userId) => lessonProgressKey('review-history', lesson, userId);

export async function readScopedProgress(key, legacyKey, userId) {
  if (typeof window === 'undefined' || !window.storage) return null;
  const current = await window.storage.get(key);
  if (current?.value || !legacyKey) return current;
  const legacy = await window.storage.get(legacyKey);
  if (!legacy?.value) return null;
  if (userId) {
    const ownerKey = `${legacyKey}:migrated-owner`;
    const owner = await window.storage.get(ownerKey);
    if (owner?.value && owner.value !== userId) return null;
    if (!owner?.value) await window.storage.set(ownerKey, userId);
  }
  await window.storage.set(key, legacy.value);
  return { ...legacy, key, migratedFrom: legacyKey };
}

export async function saveScopedProgress(key, value) {
  if (typeof window === 'undefined' || !window.storage) return null;
  return window.storage.set(key, value);
}
