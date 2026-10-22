// Island track IS-6a: the Studio's Hub island editor's logic (game/js/logic/hub-island.js): the orbit view's framing,
// sides and drag; the coast's and zones' points; the ground lock with logic/island.js's hash; which maps it lists and
// which it only shows.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT } from './setup-real.mjs';
import { FREE_CAM, freeCamLook } from '../../game/js/logic/free-camera.js';
import { islandGroundHash, islandProblems } from '../../game/js/logic/island.js';
import * as H from '../../game/js/logic/hub-island.js';

const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);
const testIsland = () => JSON.parse(readFileSync(join(ROOT, 'game/data/maps/test_island.json'), 'utf8'));
const square = () => [
  [10, 10],
  [30, 10],
  [30, 30],
  [10, 30],
];

test('the orbit view frames the whole island from the south, looking at its middle', () => {
  const sc = testIsland(),
    s = H.hubViewFrame(sc, 2);
  assert.deepEqual(H.hubIslandCentre(sc), sc.island.c);
  near(H.hubIslandRadius(sc), 52, 0.01);
  assert.deepEqual(s.tgt, [60, 2, 60]);
  const L = freeCamLook(s);
  assert.ok(L.eye[2] < 60, 'yaw 0: the camera stands south of the middle');
  /* the island's radius (plus the margin) fits in half the view's height at the middle's distance */
  const half = s.dist * Math.tan((FREE_CAM.fov * Math.PI) / 360);
  assert.ok(half >= 52 && half < 52 * 1.3, `half the view ${half} m holds the 52 m radius`);
  assert.ok(H.hubViewFrame(sc, 0, 50).dist <= 50, 'never past the free camera’s furthest');
});

test('a map with no island: the middle is the pivot, else the scene’s', () => {
  assert.deepEqual(H.hubIslandCentre({ w: 40, h: 20 }), [20, 10]);
  assert.deepEqual(H.hubIslandCentre({ w: 40, h: 20, cam: { orbit: { c: [5, 6] } } }), [5, 6]);
  near(H.hubIslandRadius({ w: 30, h: 40 }), 25);
});

test('sides: each snap names its own side, and a snap goes the short way round', () => {
  for (const [k, yaw] of Object.entries(H.HUB_SIDES)) {
    assert.equal(H.hubSideOf(yaw), k);
    assert.equal(H.hubSideOf(yaw + 4 * Math.PI), k, 'after two full turns');
  }
  const from = 3 * 2 * Math.PI + 0.1;
  near(H.hubYawNear(from, H.HUB_SIDES.S), 3 * 2 * Math.PI);
  assert.ok(Math.abs(H.hubYawNear(0.2, H.HUB_SIDES.N) - 0.2) <= Math.PI + 1e-9);
  /* the W side: the camera west of the middle */
  const s = { tgt: [0, 0, 0], yaw: H.HUB_SIDES.W, pitch: 40, dist: 10 };
  assert.ok(freeCamLook(s).eye[0] < 0);
});

test('a drag turns round the middle; Shift-drag tilts within the limits', () => {
  const s = { tgt: [0, 0, 0], yaw: 0, pitch: 40, dist: 10 };
  H.hubViewDrag(s, 100, 0, false, FREE_CAM);
  near(s.yaw, -100 * H.HUB_VIEW.turnPx);
  assert.equal(s.pitch, 40);
  H.hubViewDrag(s, 0, 1000, true, FREE_CAM);
  assert.equal(s.pitch, FREE_CAM.pitchMax);
  H.hubViewDrag(s, 0, -1000, true, FREE_CAM);
  assert.equal(s.pitch, FREE_CAM.pitchMin);
  assert.deepEqual(s.tgt, [0, 0, 0], 'the middle never moves');
});

test('points: the nearest, inserted on the nearest edge (the closing one too), moved on the scene, never under three', () => {
  const P = square(),
    sc = { w: 40, h: 40 };
  assert.equal(H.hubNearestPoint(P, 29, 29.5, 2), 2);
  assert.equal(H.hubNearestPoint(P, 20, 20, 2), -1);
  assert.equal(H.hubInsertPoint(P, 20, 10.5, 1), 1, 'on the first edge');
  assert.deepEqual(P[1], [20, 10.5]);
  assert.equal(H.hubInsertPoint(P, 9.6, 20, 1), 5, 'on the edge from the last point back to the first');
  assert.equal(H.hubInsertPoint(P, 20, 20, 1), -1, 'too far from every edge');
  assert.deepEqual(H.hubMovePoint(P, 0, -5, 41.234, sc), [0, 40]);
  const T = square().slice(0, 3);
  assert.equal(H.hubRemovePoint(T, 0), false);
  assert.equal(T.length, 3);
  assert.equal(H.hubRemovePoint(P, 1), true);
  assert.equal(P.length, 5);
});

test('a new zone is a square kept on the scene, and a sound polygon', () => {
  const sc = testIsland(),
    poly = H.hubZoneSquare(1, 119, 10, sc);
  assert.deepEqual(poly[0], [0, 110]);
  assert.deepEqual(poly[2], [10, 120]);
  sc.zones.push({ k: 'forest', poly });
  assert.deepEqual(islandProblems(sc), []);
});

test('the lock: locking stores the hash; a ground change then fails the data check; unlocking frees it', () => {
  const sc = testIsland();
  assert.equal(H.hubGroundLocked(sc), false);
  assert.equal(H.groundLockRefusal(sc), '');
  const h = H.hubLockGround(sc, islandGroundHash);
  assert.equal(sc.islandGen.hash, h);
  assert.equal(sc.islandGen.lock, true);
  assert.equal(sc.islandGen.seed, 'test', 'the seed and dials stay');
  assert.deepEqual(islandProblems(sc), []);
  assert.match(H.groundLockRefusal(sc), /locked/);
  sc.props.push({ k: 'bench', x: 50, z: 30 });
  assert.deepEqual(islandProblems(sc), [], 'props stay free');
  sc.heights[10][10] += 0.5;
  assert.equal(islandProblems(sc).length, 1);
  H.hubUnlockGround(sc);
  assert.equal(sc.islandGen.lock, undefined);
  assert.equal(sc.islandGen.hash, undefined);
  assert.deepEqual(islandProblems(sc), []);
  const bare = { w: 40, h: 40, tiles: [] };
  H.hubLockGround(bare, islandGroundHash);
  assert.deepEqual(Object.keys(bare.islandGen).sort(), ['hash', 'lock', 'seed', 'v'], 'an islandGen the schema takes');
});

test('the list: the hub first, then the islands; it opens on the first that can be edited', () => {
  const maps = { zeta: { island: { coast: [] } }, copperleaf: { w: 1 }, alpha: { island: { coast: [] } }, plain: {} };
  assert.deepEqual(H.hubIslandMaps(maps), ['copperleaf', 'alpha', 'zeta']);
  assert.match(H.hubViewOnlyReason(maps.copperleaf), /Not an island yet/);
  assert.equal(H.hubViewOnlyReason(maps.alpha), '');
  assert.equal(H.hubDefaultMap(maps), 'alpha');
  assert.equal(H.hubDefaultMap({ copperleaf: {} }), 'copperleaf');
  assert.equal(H.hubDefaultMap({}), null);
});
