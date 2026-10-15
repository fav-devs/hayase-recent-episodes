import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../plugin/history.js', import.meta.url), 'utf8');
function fixture(values, response = { ok: false }) {
  const messages = [];
  const context = vm.createContext({
    localStorage: { getItem: key => values[key] ? JSON.stringify(values[key]) : null },
    chrome: { runtime: { async sendMessage(message) { messages.push(message); return response; } } }
  });
  vm.runInContext(source, context);
  return { context, messages };
}

test('history badges require actual viewing, and exclude unplayed entries', async () => {
  const { context } = fixture({ watchProgress: {
    21: { episode: 2, currentTime: 60 }, 22: { episode: 0, currentTime: 0 }, 23: { episode: 1, currentTime: 0 }
  } });
  const result = await context.hayaseHistoryFor([{ mediaId: 21 }, { mediaId: 22 }, { mediaId: 23 }]);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { 21: true });
});

test('public linked-list progress is merged without forwarding the account token', async () => {
  const { context, messages } = fixture({ ALViewer: { viewer: { id: 123 }, token: 'test-private-token' } }, {
    ok: true, entries: [{ mediaId: 21, progress: 2 }, { mediaId: 22, progress: 0, status: 'PLANNING' }, { mediaId: 99, progress: 9 }]
  });
  const result = await context.hayaseHistoryFor([{ mediaId: 21 }, { mediaId: 22 }]);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { 21: true });
  assert.equal(messages[0].userId, 123);
  assert.equal(JSON.stringify(messages).includes('test-private-token'), false);
  assert.deepEqual(Object.keys(messages[0]).sort(), ['ids', 'type', 'userId']);
});

test('local history remains usable when the public list cannot be read', async () => {
  const { context } = fixture({ ALViewer: { viewer: { id: 123 } }, watchProgress: { 21: { episode: 2, currentTime: 30 } } });
  const result = await context.hayaseHistoryFor([{ mediaId: 21 }]);
  assert.equal(result[21], true);
});
