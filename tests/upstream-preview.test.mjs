import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

test('vendored preview, images, controls and trailer retain their pinned upstream source', () => {
  const base = new URL('../src/native-preview/', import.meta.url);
  const provenance = JSON.parse(readFileSync(new URL('upstream.json', base), 'utf8'));
  for (const [file, hash] of Object.entries(provenance.unchangedFiles)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(`vendor/${file}`, base))).digest('hex'), hash, `${file} diverged from the pinned Hayase source`);
  }
});
