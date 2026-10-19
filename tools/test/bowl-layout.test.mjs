// Phase 10: the places on the bowl world map (locations.json "bowl", game/js/logic/bowl.js). The layout must keep
// how the walkable maps join: on the bowl each map's north faces the centre and its east runs counter-clockwise, and
// every seam has to leave and arrive the way its exits face. Roads must not cross and places must not crowd.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PB_DATA } from '../data-files.mjs';
import { GAME_DATA } from './setup-real.mjs';
import {
  BOWL_FLOOR,
  BOWL_RIM_HEIGHT,
  bowlCompass,
  bowlHeight,
  bowlRoad,
  bowlSeamTurn,
  bowlSpotOf,
  bowlXY,
} from '../../game/js/logic/bowl.js';

const { locations } = GAME_DATA;
const byId = id => locations.find(l => l.id === id);
const links = GAME_DATA.roads.map(l => PB_DATA.road(GAME_DATA, l)),
  seams = links.filter(r => r.kind === 'seam'),
  lifts = links.filter(r => r.kind === 'lift');
const xy = l => {
  const s = bowlSpotOf(l, byId);
  return bowlXY(s.a, s.r);
};
const own = locations.filter(l => !('under' in l.bowl));
// how far a seam may turn from its exits, in degrees; the chosen layout (1, spiral) keeps every seam within 21
const MAX_TURN = 30;
const MIN_GAP = 0.08;

test('the bowl: a flat floor, walls rising to 45 degrees at the rim', () => {
  assert.equal(bowlHeight(0), 0);
  assert.equal(bowlHeight(BOWL_FLOOR), 0);
  assert.ok(Math.abs(bowlHeight(1) - BOWL_RIM_HEIGHT) < 1e-12);
  const slope = (bowlHeight(1) - bowlHeight(1 - 1e-6)) / 1e-6;
  assert.ok(Math.abs(slope - 1) < 1e-3, `slope at the rim ${slope}`);
  const { north, east } = bowlCompass(0, 0.5);
  assert.deepEqual(north, [-0, -1], 'a map at the top of the bowl has its north facing the centre');
  assert.deepEqual(east, [-1, 0], 'and its east running counter-clockwise');
});

test('every place has a spot on the bowl or hangs under one reached by lift', () => {
  for (const l of locations) {
    assert.ok(l.bowl, `${l.id} has no bowl spot`);
    if ('under' in l.bowl) {
      const p = byId(l.bowl.under);
      assert.ok(p && !('under' in p.bowl), `${l.id} hangs under ${l.bowl.under}, which has no spot`);
      assert.ok(
        lifts.some(
          r =>
            [r.a, r.b]
              .map(i => locations[i].id)
              .sort()
              .join() === [l.id, p.id].sort().join()
        ),
        `${l.id} hangs under ${p.id} but no lift joins them`
      );
    } else {
      assert.ok(l.bowl.a >= 0 && l.bowl.a < 360, `${l.id}: a ${l.bowl.a}`);
      assert.ok(l.bowl.r >= 0 && l.bowl.r <= 1, `${l.id}: r ${l.bowl.r}`);
    }
  }
});

test('Copperleaf, the start, is at the centre of the floor', () => {
  assert.ok(byId('copperleaf').bowl.r < 0.02);
});

test(`every seam leaves and arrives the way its exits face (within ${MAX_TURN} degrees)`, () => {
  const off = seams
    .map(r => ({ r, turn: bowlSeamTurn(xy(locations[r.a]), xy(locations[r.b]), r.exitA, r.exitB) }))
    .filter(o => o.turn > MAX_TURN)
    .map(o => `${o.r.id} (${o.r.exitA} -> ${o.r.exitB}) turns ${o.turn.toFixed(0)} degrees`);
  assert.deepEqual(off, []);
});

test('no two roads cross on the bowl', () => {
  const side = (p, q, s) => Math.sign((q[0] - p[0]) * (s[1] - p[1]) - (q[1] - p[1]) * (s[0] - p[0]));
  const segs = seams.map(r => [r.id, r.a, r.b]),
    crossings = [];
  for (let i = 0; i < segs.length; i++)
    for (let j = i + 1; j < segs.length; j++) {
      const [ia, a1, a2] = segs[i],
        [ib, b1, b2] = segs[j];
      if (new Set([a1, a2, b1, b2]).size < 4) continue;
      const [p1, p2, p3, p4] = [a1, a2, b1, b2].map(k => xy(locations[k]));
      if (side(p1, p2, p3) !== side(p1, p2, p4) && side(p3, p4, p1) !== side(p3, p4, p2))
        crossings.push(`${ia} x ${ib}`);
    }
  assert.deepEqual(crossings, []);
});

test(`places keep at least ${MIN_GAP} of the bowl's radius apart`, () => {
  const near = [];
  for (let i = 0; i < own.length; i++)
    for (let j = i + 1; j < own.length; j++) {
      const p = xy(own[i]),
        q = xy(own[j]),
        d = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (d < MIN_GAP) near.push(`${own[i].id} and ${own[j].id}: ${d.toFixed(3)}`);
    }
  assert.deepEqual(near, []);
});

test('a road on the ground follows the bowl and is at least as long as seen from above', () => {
  for (const r of seams) {
    const A = xy(locations[r.a]),
      B = xy(locations[r.b]),
      { pts, length } = bowlRoad(A, B);
    assert.equal(pts.length, 25);
    for (const p of pts) assert.ok(Math.abs(p[2] - bowlHeight(Math.hypot(p[0], p[1]))) < 1e-12);
    assert.ok(length >= Math.hypot(B[0] - A[0], B[1] - A[1]) - 1e-9, `${r.id} is shorter over the ground`);
  }
});
