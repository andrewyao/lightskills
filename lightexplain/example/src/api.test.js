import { test, mock } from 'node:test';
import assert from 'node:assert';
import { getUser } from './api.js';

test('concurrent getUser calls share one request', async () => {
  const f = mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ id: 1 }) }));
  await Promise.all([getUser(1), getUser(1)]);
  assert.strictEqual(f.mock.callCount(), 1);
});
