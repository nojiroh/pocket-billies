// Phase 13: saves checked against the game's own data, in plain Node (moved here from the browser steps v38 and
// alpha 0.1 of tools/check-quick.py).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { data, fn, startedSave } from './setup-real.mjs';

const { RULES, SPECIES } = data;

test('a species the game no longer has is dropped from a save with its Guide marks; the rest loads as it was', () => {
  assert.equal(SPECIES.ghost0, undefined, 'the test needs a species the data does not have');
  assert.ok(SPECIES.swift0, 'the test needs swift0');
  const s = fn('migrate')({
    started: true,
    team: [
      { uid: 'g1', sp: 'ghost0', lvl: 7, moves: [] },
      { uid: 'g2', sp: 'swift0', lvl: 6, moves: [] },
    ],
    box: [],
    seen: { ghost0: 1, swift1: 1 },
    caught: { ghost0: 1 },
    queue: [{ id: 'q', sp: 'ghost0', lvl: 5 }],
  });
  assert.deepEqual(
    s.team.map(m => m.sp),
    ['swift0']
  );
  assert.ok(s.team[0].moves.length > 0, 'the Billie that stayed has no moves');
  assert.deepEqual(Object.keys(s.seen), ['swift1']);
  assert.deepEqual(Object.keys(s.caught), []);
  assert.equal(s.queue.length, 0);
});

test('preferences survive loading: 90 frames a second is kept, the picture setting is Sharpest by default', () => {
  const s = startedSave(Object.keys(SPECIES).find(k => SPECIES[k].line === RULES.start.starters[0]));
  s.preferences.fps = 90;
  const m = fn('migrate')(JSON.parse(JSON.stringify(s)));
  assert.equal(m.preferences.fps, 90);
  assert.equal(m.preferences.aim, 'sharp');
});
