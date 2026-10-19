import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../plugin/recent-feed.js', import.meta.url), 'utf8');
function create(request, now = () => +new Date('2026-10-18T12:00:00')) {
  const context = vm.createContext({ Date, Map, Array, Error }); vm.runInContext(source, context);
  return context.hayaseRecentFeed(request, now);
}
const row = (mediaId, episode, time) => ({ mediaId, episode, time });
test('older windows are contiguous local weeks, deduplicated and newest first', async () => {
  const requests = [];
  const newest = row(21, 3, 300), older = row(21, 2, 200);
  const feed = create(async request => { requests.push(request); return { ok: true, releases: requests.length === 1 ? [newest] : [older, newest] }; });
  await feed.older(); await feed.older();
  assert.equal(requests[1].end, requests[0].start);
  assert.equal(new Date(requests[0].end).getHours(), 0);
  assert.equal(new Date(requests[0].end).getDate(), 19);
  assert.deepEqual(Array.from(feed.releases, row => row.episode), [3, 2]);
});
test('simultaneous end-of-row events share one request and failure retries the same window', async () => {
  let resolve; const requests = [];
  const feed = create(request => { requests.push(request); return new Promise(done => { resolve = done; }); });
  const a = feed.older(), b = feed.older();
  assert.equal(a, b); assert.equal(requests.length, 1);
  resolve({ ok: false, error: 'Offline' });
  await assert.rejects(a, /Offline/);
  const retry = feed.older();
  assert.equal(requests[0].start, requests[1].start);
  resolve({ ok: true, releases: [row(21, 2, 200)] }); await retry;
  assert.equal(feed.busy, false);
});
test('empty history scans are bounded and can be resumed', async () => {
  const requests = [];
  const feed = create(async request => { requests.push(request); return { ok: true, releases: [] }; });
  await feed.older(); assert.equal(requests.length, 4);
  await feed.older(); assert.equal(requests.length, 8);
  assert.equal(requests[4].end, requests[3].start);
});
test('refresh adds new releases without discarding older pages or moving the history cursor', async () => {
  const requests = [];
  const feed = create(async request => { requests.push(request); return { ok: true, releases: [row(21, request.refresh ? 4 : requests.length === 1 ? 3 : 2, request.refresh ? 400 : requests.length === 1 ? 300 : 200)] }; });
  await feed.older(); await feed.refresh(); await feed.older();
  assert.equal(requests[2].end, requests[0].start);
  assert.deepEqual(Array.from(feed.releases, row => row.episode), [4, 3, 2]);
});
test('late responses do not mutate an unmounted feed', async () => {
  let resolve;
  const feed = create(() => new Promise(done => { resolve = done; }));
  const pending = feed.older(); feed.destroy(); resolve({ ok: true, releases: [row(21, 3, 300)] });
  await pending; assert.equal(feed.releases.length, 0);
});

test('history windows use calendar days across the daylight-saving transition', async () => {
  const { execFileSync } = await import('node:child_process');
  const result = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import { readFileSync } from 'node:fs';
    import vm from 'node:vm';
    const context = vm.createContext({ Date, Map, Array, Error });
    vm.runInContext(readFileSync('plugin/recent-feed.js', 'utf8'), context);
    const feed = context.hayaseRecentFeed(async request => {
      console.log(JSON.stringify({ hours: (request.end-request.start)/3600000, startHour: new Date(request.start).getHours(), endHour: new Date(request.end).getHours() }));
      return { ok: true, releases: [{mediaId:21,episode:1,time:1}] };
    }, () => +new Date('2026-11-02T12:00:00'));
    await feed.older();
  `], { env: { ...process.env, TZ: 'America/Edmonton' }, encoding: 'utf8' });
  assert.deepEqual(JSON.parse(result), { hours: 169, startHour: 0, endHour: 0 });
});
