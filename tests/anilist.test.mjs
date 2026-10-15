import test from 'node:test';
import assert from 'node:assert/strict';
import { airingRows, enrichRows } from '../plugin/anilist.mjs';

test('AniList schedule follows every page, preserving metadata and excluding adult entries', async () => {
  const requests = [];
  globalThis.fetch = async (url, options) => {
    const { variables } = JSON.parse(options.body); requests.push(variables);
    return { ok: true, json: async () => ({ data: { Page: {
      pageInfo: { hasNextPage: variables.page === 1 },
      airingSchedules: [
        { episode: variables.page, airingAt: 200, media: { id: 21, title: { english: 'One Piece' }, coverImage: { large: 'https://example.com/cover.jpg' }, isAdult: false } },
        { episode: 1, airingAt: 200, media: { id: 99, title: {}, isAdult: true } }
      ]
    } } }) };
  };
  const rows = await airingRows({ start: 100000, end: 300000 });
  assert.deepEqual(requests.map(request => request.page), [1, 2]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].airType, 'aired');
  assert.ok(rows[0].media.coverImage.large);
  assert.equal(requests[0].start, 99); // Include episodes exactly on the local start boundary.
});

test('metadata is batched by unique AniList IDs and handles multiple batches', async () => {
  const batches = [];
  globalThis.fetch = async (url, options) => {
    const { variables } = JSON.parse(options.body); batches.push(variables.ids);
    return { ok: true, json: async () => ({ data: { Page: { media: variables.ids.map(id => ({ id, title: { english: `Anime ${id}` } })) } } }) };
  };
  const rows = Array.from({ length: 51 }, (_, index) => ({ mediaId: index + 1 }));
  rows.push({ mediaId: 1 });
  const result = await enrichRows(rows);
  assert.deepEqual(batches.map(batch => batch.length), [50, 1]);
  assert.equal(result[51].media.id, 1);
});

test('GraphQL errors fail explicitly instead of becoming an empty episode list', async () => {
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ errors: [{ message: 'Rate limit' }] }) });
  await assert.rejects(airingRows({ start: 0, end: 1 }), /could not return/);
});
