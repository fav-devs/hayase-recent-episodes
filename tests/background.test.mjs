import test from 'node:test';
import assert from 'node:assert/strict';

const cache = {};
globalThis.chrome = {
  storage: { local: {
    async get(key) { return key === null ? { ...cache } : { [key]: cache[key] }; },
    async set(values) { Object.assign(cache, values); },
    async remove(keys) { for (const key of keys) delete cache[key]; }
  } },
  runtime: { onMessage: { addListener() {} } }
};
const { loadReleases } = await import('../plugin/background.js');
const request = { airType: 'dub', start: Date.parse('2026-10-07T00:00:00Z'), end: Date.parse('2026-10-08T00:00:00Z') };
const row = { mediaId: 21, episode: 3, airType: 'dub', title: 'One Piece', airingAt: request.start / 1000 + 100, exact: true, estimated: false };

test('background deduplicates requests, reuses cache, and returns stale data offline', async () => {
  let calls = 0;
  globalThis.fetch = async url => { calls++; await new Promise(resolve => setTimeout(resolve, 10)); return { ok: true, json: async () => String(url).includes('graphql.anilist.co') ? { data: { Page: { media: [{ id: 21, coverImage: { large: 'https://example.com/cover.jpg' } }] } } } : { ok: true, episodes: [row] } }; };
  const [a, b] = await Promise.all([loadReleases(request), loadReleases(request)]);
  assert.equal(calls, 2); // One shared schedule request and one shared metadata batch.
  assert.equal(a.releases.length, 1);
  assert.ok(a.releases[0].media.coverImage.large);
  assert.deepEqual(a, b);
  await loadReleases(request);
  assert.equal(calls, 2);
  Object.values(cache)[0].saved = 1;
  globalThis.fetch = async () => { throw new TypeError('offline'); };
  assert.equal((await loadReleases(request)).stale, true);
});

test('background rejects invalid input and reports throttling without retries', async () => {
  await assert.rejects(loadReleases({ ...request, airType: 'raw' }), /Invalid/);
  for (const key of Object.keys(cache)) delete cache[key];
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: false, status: 429 }; };
  await assert.rejects(loadReleases(request), /busy/);
  assert.equal(calls, 1);
});
