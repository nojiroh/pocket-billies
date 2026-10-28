// VFX track VFX-16: the battle's flow moments (game/js/logic/battle-flow.js, battleAnims.json `events`)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readGameData } from '../data-files.mjs';
import {
  FLOW_CELL_MS,
  lvlSlot,
  pyramidRamp,
  riseShare,
  vsPortraitScale,
  vsSplashFor,
} from '../../game/js/logic/battle-flow.js';
import { dataBattleAnims } from '../../game/js/logic/data-checks.js';

const D = readGameData(),
  E = D.battleAnims.events;

test('level-up: the slot whose snapshot has the uid (the engine sends uid, not si)', () => {
  const ev = { s: [{ uid: 'a' }, { uid: 'f' }, { uid: 'b' }, null] };
  assert.equal(lvlSlot({ uid: 'b' }, ev), 2, 'the second of yours in a double is slot 2, not 0');
  assert.equal(lvlSlot({ uid: 'a' }, ev), 0);
  assert.equal(lvlSlot({ uid: 'bench' }, ev), -1, 'a Billie on the bench shows nothing');
  assert.equal(lvlSlot({ si: 1 }, ev), 1, 'an si is taken as given');
  assert.equal(lvlSlot({}, ev), -1);
  assert.equal(lvlSlot({ uid: 'a' }, null), -1);
});

test('VS splash: leaders, the rival and bosses; nobody else', () => {
  /* the game gives each its key as id (game-data.js) */
  const T = Object.fromEntries(Object.entries(D.trainers).map(([id, t]) => [id, { ...t, id }]));
  assert.deepEqual(vsSplashFor(T.crude, E.vs), { role: 'miniboss', type: 'Ground' });
  assert.equal(vsSplashFor(T.blake, E.vs).role, 'rival');
  assert.equal(vsSplashFor(T.blake0, E.vs).role, 'rival');
  assert.equal(vsSplashFor({ runFoe: 'boss', alpha: true, type: 'Fire' }, E.vs).role, 'boss');
  assert.equal(vsSplashFor({ runFoe: 'rival', from: 'blake' }, E.vs).role, 'rival');
  assert.equal(vsSplashFor({ id: 'x', boss: 'voltron' }, E.vs).role, 'boss');
  assert.equal(vsSplashFor({ runFoe: 'ghost' }, E.vs), null, "a friend's ghost gets none");
  const plain = Object.values(T).find(t => !t.miniboss && !t.boss && !t.alpha && !E.vs.rivals.includes(t.id));
  assert.equal(vsSplashFor(plain, E.vs), null, 'a route trainer gets none');
  assert.equal(vsSplashFor(T.crude, { ...E.vs, foes: ['boss'] }), null, 'only the roles the data names');
});

test('VS splash: it fits inside trainerIn (1150 ms) with the banner going in (240) and out (180)', () => {
  assert.ok(240 + E.vs.hold + 180 <= 1150);
});

test('the dither in and out: stepped on 12 fps cells, from none to all', () => {
  const ms = E.sendOut.riseMs,
    seen = new Set();
  for (let t = -10; t <= ms + 10; t += 4) seen.add(riseShare(t, ms));
  const n = Math.round(ms / FLOW_CELL_MS);
  assert.equal(seen.size, n + 1, 'n + 1 held steps');
  assert.equal(riseShare(0, ms), 0);
  assert.equal(riseShare(ms, ms), 1);
  assert.equal(riseShare(ms, ms, true), 0);
  assert.equal(riseShare(0, ms, true), 1);
  for (let t = 0; t < ms; t += 10) assert.ok(riseShare(t + 10, ms) >= riseShare(t, ms), 'never goes back');
});

test('pyramid kinds take their own ramps; an unknown kind the everyday one', () => {
  for (const k of Object.keys(D.pyramids)) assert.ok(D.battleAnims.ramps[pyramidRamp(E.sendOut, k)], k);
  assert.notEqual(pyramidRamp(E.sendOut, 'gold_pyramid'), pyramidRamp(E.sendOut, 'capstone'));
  assert.equal(pyramidRamp(E.sendOut, 'nope'), pyramidRamp(E.sendOut, 'pyramid'));
  assert.equal(pyramidRamp(undefined, 'pyramid'), 'None');
});

test('the portraits: whole-number scales, at most the data, never under 1', () => {
  assert.equal(vsPortraitScale(400, 62, 2), 2);
  assert.equal(vsPortraitScale(150, 62, 2), 1);
  assert.equal(vsPortraitScale(1000, 62, 2), 2);
  assert.equal(vsPortraitScale(300, 0, 2), 1);
  for (const w of [120, 240, 360, 480]) assert.ok(Number.isInteger(vsPortraitScale(w, 62, E.vs.scale)));
});

test('the data check: a pyramid without a ramp, a missing ramp and an unknown rival are problems', () => {
  const bad = structuredClone(D);
  delete bad.battleAnims.events.sendOut.kinds.capstone;
  bad.battleAnims.events.levelUp.ramp = 'nope';
  bad.battleAnims.events.vs.rivals.push('nobody');
  const got = dataBattleAnims(bad).map(p => p[1]);
  assert.ok(
    got.some(w => /capstone" has no ramp/.test(w)),
    got.join('; ')
  );
  assert.ok(got.some(w => /levelUp\.ramp: no ramp "nope"/.test(w)));
  assert.ok(got.some(w => /no trainer "nobody"/.test(w)));
  assert.deepEqual(dataBattleAnims(D), [], 'the game data is fine');
});
