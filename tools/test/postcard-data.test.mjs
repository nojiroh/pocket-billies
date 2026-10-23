// alpha 0.4: every town has its postcard picture (tools/build-postcards.py), which the first visit brings. (TC-3: the
// file half of the full check's postcard step, tools/check-quick.py; its "a solarpunk touch in every town" half went:
// it skipped Copperleaf, the only town, so it checked nothing. The full check's postcards step still walks in.)
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { readGameData } from '../data-files.mjs';
import { ROOT } from './load-logic.mjs';

test('every town has its postcard picture', () => {
  const towns = readGameData().locations.filter(l => l.kind === 'town');
  assert.ok(towns.length > 0, 'no town');
  const none = towns.filter(t => {
    const f = join(ROOT, 'game/art/postcards', `${t.mapId}.webp`);
    return !existsSync(f) || statSync(f).size < 4000;
  });
  assert.deepEqual(
    none.map(t => t.id),
    []
  );
});
