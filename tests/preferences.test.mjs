import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePreferences, translate, translations } from '../src/lib/interfacePreferences.js';
test('validates saved values and falls back for malformed settings', () => {
  assert.deepEqual(normalizePreferences(null), { theme: 'light', language: 'vi' });
  assert.deepEqual(normalizePreferences({ theme: 'invalid', language: 'invalid' }), { theme: 'light', language: 'vi' });
  assert.deepEqual(normalizePreferences({ theme: 'system', language: 'ko' }), { theme: 'system', language: 'ko' });
});
test('all translated controls have English and Korean labels', () => {
  for (const [source, values] of Object.entries(translations)) {
    assert.ok(values[0] && values[1], source);
    assert.equal(translate(source, 'vi'), source);
    assert.equal(translate(source, 'en'), values[0]);
    assert.equal(translate(source, 'ko'), values[1]);
  }
  assert.equal(translate('Tên giáo trình riêng', 'ko'), 'Tên giáo trình riêng');
});
