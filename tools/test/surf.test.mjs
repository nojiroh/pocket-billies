// Water track WA-6b: Surf on deep water and the Waterfall climb (game/js/logic/surf.js), and the riding rule
// (logic/rules.js riderOf: any standing Water Billie, the tallest, no height floor)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAME_DATA, fn, startedSave } from './setup-real.mjs';
import { wadeHere, wadeWalkable } from '../../game/js/logic/wading.js';
import {
  CLIMB_TOP,
  climbAt,
  climbState,
  climbText,
  fallFoot,
  fallTop,
  fallsClimbable,
  surfable,
  surfCan,
} from '../../game/js/logic/surf.js';

const SURF = GAME_DATA.fieldMoves.moves.surf,
  FALL = GAME_DATA.fieldMoves.waterfall;
/* 8 x 5 m, rows from the far edge: grass round a pond of shallows with a deep middle, and deep lava at the east */
const pond = () => ({
  w: 8,
  h: 5,
  edge: 'g',
  tiles: ['gggggggg', 'gwwwwgdd', 'gwdddgdd', 'gwwwwgdd', 'gggggggg'],
  waters: [{ x: 6, z: 1, w: 2, h: 3, k: 'lava' }],
});
const tile = (sc, x, z) => sc.tiles[sc.h - 1 - Math.floor(z)][Math.floor(x)];
const team = (/** @type {string[][]} */ ...types) => types.map((t, k) => ({ name: `B${k}`, types: t }));

test('surf: the Water Badge and a Water Billie standing, as the Surf obstacle', () => {
  assert.equal(surfCan(SURF, {}, team(['Water'])), false, 'no badge');
  assert.equal(surfCan(SURF, { water: 1 }, team(['Fire'])), false, 'the badge, no Water Billie');
  assert.equal(surfCan(SURF, { water: 1 }, []), false, 'the badge, nobody standing');
  assert.equal(surfCan(SURF, { water: 1 }, team(['Fire'], ['Water', 'Steel'])), true, 'the badge and a Water Billie');
  assert.equal(surfCan(SURF, { steel: 1 }, team(['Water'])), false, 'another badge');
  assert.equal(surfCan(undefined, { water: 1 }, team(['Water'])), false, 'no Surf move in the data');
});

test('surf: deep water surfed, shallows waded, lava, ice and terrain flags as their own', () => {
  const sc = pond(),
    s = (x, z, T = null, S = sc) => surfable(S, tile(S, x, z), T, x, z);
  assert.equal(s(2.5, 2.5), true, 'deep pond');
  assert.equal(s(1.5, 1.5), false, 'shallows: waded, not surfed');
  assert.equal(s(0.5, 0.5), false, 'grass');
  assert.equal(s(6.5, 2.5), false, 'deep lava');
  assert.equal(s(2.5, 2.5, null, Object.assign(pond(), { waterKind: 'ice', waters: [] })), false, 'ice');
  assert.equal(s(2.5, 2.5, { walk: 0 }), false, 'a terrain that says it is not walked');
  assert.equal(s(2.5, 2.5, { walk: 1 }), false, 'a terrain walked on: walkable already, not surfed');
  assert.equal(s(2.5, 2.5, null, Object.assign(pond(), { ride: 1 })), false, 'a riding scene: all walkable already');
});

test('surf: from the shore through the shallows onto deep water and back, mounting at the edge', () => {
  /* the walk grid's rule for the player: walkable by wading.js, or surfable while Surf is on (walk-view.js) */
  const sc = pond(),
    open = (/** @type {number} */ x, /** @type {number} */ z, /** @type {boolean} */ on) =>
      wadeWalkable(sc, tile(sc, x, z), null, x, z) || (on && surfable(sc, tile(sc, x, z), null, x, z));
  const line = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5].map(x => [x, 2.5]);
  /* without Surf: the shore and the shallows, then the deep water stops you */
  const dry = line.findIndex(([x, z]) => !open(x, z, false));
  assert.equal(dry, 2, 'deep water shuts you out without Surf');
  /* with it: across the deep middle to the far shore (the lava stays shut) */
  const on = line.map(([x, z]) => open(x, z, true));
  assert.deepEqual(on, [true, true, true, true, true, true, false]);
  /* you mount where you leave the shallows for the deep and get off where you reach shallows or shore */
  const state = line
    .slice(0, 6)
    .map(([x, z]) => (surfable(sc, tile(sc, x, z), null, x, z) ? 'surf' : wadeHere(sc, x, z) ? 'wade' : 'walk'));
  assert.deepEqual(state, ['walk', 'wade', 'surf', 'surf', 'surf', 'walk']);
});

test('riding: the tallest standing Water Billie, no height floor (the owner, WA-6b)', () => {
  const s = startedSave('bezos0', 10),
    riderOf = fn('riderOf'),
    mk = (/** @type {string} */ sp) => fn('makeBilly')(sp, 10);
  assert.equal(GAME_DATA.rules.ride.minHeight, undefined, 'rules.json ride has no minHeight');
  assert.equal(riderOf(), s.team[0], 'a 0.7 m Cartotter carries you');
  const big = mk('bezos2');
  s.team.push(mk('musk0'), big);
  assert.equal(riderOf(), big, 'the tallest Water Billie rides');
  big.hp = 0;
  assert.equal(riderOf(), s.team[0], 'a fainted one does not');
  s.team[0].hp = 0;
  assert.equal(riderOf(), null, 'nobody standing of the type');
});

/* a hand-made fall (lane G places real ones in WA-2b): a 4 m fall off a ledge at z 6, falling south into a pool */
const fixture = (/** @type {any} */ o = {}) => ({
  w: 10,
  h: 12,
  tiles: [],
  falls: [
    Object.assign({ x: 5, z: 6, dir: [0, -1], w: 2, h: 4, pool: 1.5, climb: 1 }, o),
    { x: 2, z: 6, dir: [0, -1], w: 1, h: 4 },
  ],
});

test('waterfall: its foot and its top, and only a climb: 1 fall is climbed', () => {
  const sc = fixture(),
    [F] = sc.falls;
  assert.equal(fallsClimbable(sc).length, 1, 'the fall without climb is not');
  assert.deepEqual(fallsClimbable({}), [], 'a scene without falls');
  const [fx, fz] = fallFoot(F);
  assert.equal(fx, 5);
  assert.ok(fz < 6 && fz > 4.4, `the foot is in the pool below the lip (${fz})`);
  assert.deepEqual(fallTop(F), [5, 6 + CLIMB_TOP], 'the top: back from the lip, against the way it falls');
  /* a fall with no dir falls south; a dir that isn't unit is made unit */
  assert.deepEqual(fallTop({ x: 1, z: 1 }), [1, 1 + CLIMB_TOP]);
  const E = fixture({ dir: [3, 0] }).falls[0];
  assert.deepEqual(fallTop(E), [5 - CLIMB_TOP, 6]);
});

test('waterfall: climbed from its foot pushing up it, not across, not from the side or the top', () => {
  const sc = fixture(),
    [F] = sc.falls;
  assert.equal(climbAt(sc, 5, 5.2, 0, 1), F, 'at the foot, pushing north (up the fall)');
  assert.equal(climbAt(sc, 5, 5.97, 0, 1), F, 'against its wall, where the wall stops you');
  assert.equal(climbAt(sc, 5.8, 5.2, 0.3, 1), F, 'near its edge, pushing mostly up it');
  assert.equal(climbAt(sc, 5, 5.2, 1, 0), null, 'pushing along the cliff');
  assert.equal(climbAt(sc, 5, 5.2, 0, -1), null, 'pushing away from it');
  assert.equal(climbAt(sc, 5, 5.2, 0, 0), null, 'not pushing');
  assert.equal(climbAt(sc, 6.6, 5.2, 0, 1), null, 'beside it');
  assert.equal(climbAt(sc, 5, 3.5, 0, 1), null, 'too far out in the pool');
  assert.equal(climbAt(sc, 5, 6.5, 0, 1), null, 'on top of it');
  assert.equal(climbAt(sc, 2, 5.2, 0, 1), null, 'the fall without climb');
});

test('waterfall: the Water and Steel Badges and a Water Billie (the owner, WA-6b), and its lines', () => {
  assert.deepEqual(FALL.badges, ['Water', 'Steel']);
  assert.equal(climbState(FALL, {}, team(['Water'])).state, 'needBadge');
  assert.equal(climbState(FALL, { water: 1 }, team(['Water'])).state, 'needBadge', 'Surf alone is not enough');
  assert.equal(climbState(FALL, { steel: 1 }, team(['Water'])).state, 'needBadge');
  assert.equal(climbState(FALL, { water: 1, steel: 1 }, team(['Steel'])).state, 'needType');
  assert.deepEqual(climbState(FALL, { water: 1, steel: 1 }, team(['Fire'], ['Water', 'Steel'])), {
    state: 'ask',
    billie: 'B1',
  });
  assert.match(climbText(FALL, 'needBadge'), /the Water Badge and the Steel Badge/);
  assert.equal(climbText(FALL, 'used', 'Everyotter'), 'Everyotter used Waterfall!');
  assert.doesNotMatch(climbText(FALL, 'ask'), /[{}]/);
});
