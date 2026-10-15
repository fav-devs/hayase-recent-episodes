import test from 'node:test';
import assert from 'node:assert/strict';
import { periodWindow, apiWindow, selectReleases } from '../plugin/releases.mjs';

test('local periods cross ISO year boundaries and UTC windows cover them', () => {
  const window = periodWindow('2027-01-01', 'week');
  const date = new Date(window.start);
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 11);
  assert.equal(date.getDate(), 28);
  const query = apiWindow(window);
  const utcStart = Date.parse(`${query.start}T00:00:00Z`);
  assert.ok(utcStart <= window.start);
  assert.ok(utcStart + query.days * 86400000 >= window.end);
});

test('local-day boundaries survive daylight-saving changes', () => {
  const old = process.env.TZ;
  process.env.TZ = 'America/Edmonton';
  try {
    const spring = periodWindow('2026-03-08', 'day');
    const fall = periodWindow('2026-11-01', 'day');
    assert.equal((spring.end - spring.start) / 3600000, 23);
    assert.equal((fall.end - fall.start) / 3600000, 25);
    for (const window of [spring, fall]) {
      const api = apiWindow(window);
      assert.ok(Date.parse(`${api.start}T00:00:00Z`) + api.days * 86400000 >= window.end);
    }
  } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old; }
});

test('bad dates and periods are rejected', () => {
  assert.throws(() => periodWindow('2026-02-30', 'day'));
  assert.throws(() => periodWindow('2026-01-01', 'month'));
});

test('only past confirmed matching releases survive, with deduplication and newest first', () => {
  const row = { mediaId: 21, episode: 3, airType: 'dub', title: '<script>untrusted</script>', airingAt: 200, exact: true, estimated: false };
  const rows = [row, { ...row }, { ...row, episode: 4, airingAt: 250 },
    { ...row, episode: 5, airingAt: 301 }, { ...row, episode: 6, estimated: true },
    { ...row, episode: 7, exact: false }, { ...row, episode: 8, isBreak: true },
    { ...row, episode: 9, airType: 'raw' }, { ...row, episode: 10, note: { kind: 'delay' } },
    { ...row, mediaId: 'javascript:alert(1)' }, { ...row, episode: 11, airingAt: null },
    { ...row, episode: 12, airingAt: 100 }];
  const data = selectReleases(rows, 'dub', { start: 101000, end: 400000 }, 300000);
  assert.deepEqual(data.releases.map(row => row.episode), [4, 3]);
  assert.equal(data.estimated, 2);
  assert.equal(data.releases[0].href, '/#/app/anime/21');
  assert.throws(() => selectReleases({}, 'dub', { start: 0, end: 1 }));
});

test('estimated sub times are opt-in and are never treated as confirmed dubs', () => {
  const row = { mediaId: 21, episode: 3, airType: 'sub', title: 'One Piece', airingAt: 200, exact: false, estimated: true };
  const window = { start: 100000, end: 300000, includeEstimates: true };
  const data = selectReleases([row], 'sub', window, 300000);
  assert.equal(data.releases.length, 1);
  assert.equal(data.releases[0].estimated, true);
  assert.equal(selectReleases([{ ...row, airType: 'dub' }], 'dub', window, 300000).releases.length, 0);
});
