import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('duplicate Korean words keep bookmarks and notes on their own vocabulary IDs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kstudy-identity-'));
  let source;
  try {
    execFileSync(process.execPath, [fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url)),
      fileURLToPath(new URL('../src/lib/vocabularyProgress.ts', import.meta.url)),
      '--target', 'ES2022', '--module', 'ESNext', '--noCheck', '--outDir', dir], { cwd: dir, stdio: 'pipe' });
    source = await readFile(join(dir, 'vocabularyProgress.js'), 'utf8');
  } finally {
    for (const name of await readdir(dir)) await unlink(join(dir, name));
    await rmdir(dir);
  }
  const first = '11111111-1111-1111-1111-111111111111';
  const second = '22222222-2222-2222-2222-222222222222';
  const writes = [];
  globalThis.__vocabIdentityDb = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'learner' } } } }) },
    from: (table) => ({
      select() { return this; }, eq() { return this; },
      in: async () => ({ data: table === 'vocabulary_bookmarks' ? [{ vocabulary_id: first }]
        : table === 'vocabulary_notes' ? [{ vocabulary_id: first, note: 'Chỉ mục đầu' }] : [] }),
      upsert: async (row) => { writes.push({ table, row }); return {}; },
    }),
  };
  source = source.replace(/import \{ supabase \} from ['"]\.\/supabase['"];?/, 'const supabase = globalThis.__vocabIdentityDb;');
  const api = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const words = [first, second].map((id) => ({ id, word: '축하 인사를 하다', lessonId: 'lesson', textbookId: 'book' }));
  const state = await api.loadRemoteVocabularyStateForWords(words, 'learner', true);
  assert.deepEqual(state[first], { starred: true, note: 'Chỉ mục đầu' });
  assert.equal(state[second], undefined);
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent ??= class { constructor(type) { this.type = type; } };
  await api.saveRemoteVocabularyStateForWords(words, 'learner', { [second]: { starred: true } });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].row.vocabulary_id, second);
  delete globalThis.__vocabIdentityDb;
});
