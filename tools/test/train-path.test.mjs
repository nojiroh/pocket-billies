// HB-8, cutscenes track A: logic/train-path.js, the sky train's ride from Skyline Station in the station's own frame:
// points in its metres, the glide in along the track, rising straight up on its engines, turning to the portal and
// shooting into it; the way home out of the portal, round and down; the train's placement (in front of the track's
// line by half its width, turned, lifted, its nose up on a climb).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const {
  TRAIN_RIDE,
  TRAIN_DEPART,
  TRAIN_HOME,
  trainFrame,
  trainAt,
  trainHover,
  trainDepartAt,
  trainHomeAt,
  trainPlace,
  TRAIN_PLATFORM,
  trainBoardPath,
  trainWalkAt,
} = modules['train-path'];
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} is not ${b}`);
const sum = B => Object.values(B).reduce((a, b) => a + b, 0);

test("train path: the station's frame turns with it (u along its front, w back from it)", () => {
  const F = trainFrame({ x: 10, z: 20, rot: 90 }, 1);
  const [x, z] = trainAt(F, 2, 3);
  near(x, 10 - 3);
  near(z, 20 + 2);
  const G = trainFrame({ x: 0, z: 0 }, 0);
  assert.deepEqual(trainAt(G, 2, 3), [2, 3]);
});

test("train path: on Copperleaf's track the departure glides in, rises straight up, turns and ends in the portal", () => {
  const C = GAME_DATA.maps.copperleaf,
    st = C.props.find(p => p.act === 'station'),
    { rail, portal } = C.landmarks,
    y0 = rail[0][2] - TRAIN_RIDE.railTop,
    F = trainFrame(st, y0),
    H = trainHover(F, portal);
  const at = t => trainDepartAt(F, portal, t);
  const g0 = at(0),
    g1 = at(TRAIN_DEPART.glide - 1);
  assert.equal(g0.beat, 'glide');
  assert.ok(g0.at.h > y0 + 10 && g0.at.pitch < -10, 'it comes down out of the sky');
  near(g1.at.h, y0 + TRAIN_RIDE.railTop, 0.01);
  const lift0 = TRAIN_DEPART.glide + TRAIN_DEPART.board;
  assert.equal(at(lift0 - 1).beat, 'board');
  const up = at(lift0 + TRAIN_DEPART.lift / 2);
  assert.equal(up.beat, 'lift');
  near(up.at.x, H.x);
  near(up.at.z, H.z);
  assert.ok(up.at.h > y0 + 2 && up.at.h < H.h, 'halfway up, straight over where it stood');
  const turned = at(lift0 + TRAIN_DEPART.lift + TRAIN_DEPART.turn - 1);
  near(Math.atan2(turned.at.dz, turned.at.dx), H.aim, 0.01);
  assert.ok(turned.at.pitch > 5, 'its nose up at the portal');
  const last = at(sum(TRAIN_DEPART) - 1);
  assert.equal(last.beat, 'dash');
  assert.ok(Math.hypot(last.at.x - portal[0], last.at.z - portal[1]) < 1, 'into the portal');
  assert.ok(last.s < 0.2, 'shrinking into it');
  assert.equal(at(sum(TRAIN_DEPART) + 1).beat, 'gone');
});

test('train path: the way home comes out of the portal to the hover, turns back along the track and sets down', () => {
  const C = GAME_DATA.maps.copperleaf,
    st = C.props.find(p => p.act === 'station'),
    { rail, portal } = C.landmarks,
    y0 = rail[0][2] - TRAIN_RIDE.railTop,
    F = trainFrame(st, y0),
    H = trainHover(F, portal),
    at = t => trainHomeAt(F, portal, t);
  assert.ok(at(10).s < 0.05, 'not out yet');
  const out = at(TRAIN_HOME.open + TRAIN_HOME.out - 1);
  near(out.at.x, H.x, 0.05);
  near(out.at.h, H.h, 0.05);
  const down = at(TRAIN_HOME.open + TRAIN_HOME.out + TRAIN_HOME.turn + TRAIN_HOME.down - 1);
  near(down.at.h, y0 + TRAIN_RIDE.railTop, 0.01);
  near(Math.atan2(down.at.dz, down.at.dx), Math.atan2(F.ax[1], F.ax[0]), 0.01);
  const end = at(Infinity);
  assert.equal(end.beat, 'gone');
  near(end.at.x, H.x);
});

test('train path: the placement stands in front of the track, turned to the way it goes, lifted and tilted', () => {
  const y0 = 0.91;
  const east = trainPlace({ x: 10, z: 20, h: 1.04, dx: 1, dz: 0, pitch: 0 }, y0);
  near(east.x, 10);
  near(east.z, 20 - TRAIN_RIDE.half);
  near(east.rot, 0);
  near(east.lift, 0);
  const west = trainPlace({ x: 10, z: 20, h: 6.04, dx: -1, dz: 0, pitch: -20 }, y0);
  near(west.z, 20 + TRAIN_RIDE.half);
  near(Math.abs(west.rot), 180);
  near(west.lift, 5);
  assert.deepEqual(west.tilt, [20, 0]);
});

test("boarding (the owner, 2026-10-28): from where you stand, up the steps, across between the benches, on the platform's top, never through the station", () => {
  const F = trainFrame({ x: 50, z: 40, rot: 90 }, 1.5),
    P = TRAIN_PLATFORM,
    /* a point in the station's metres */
    own = (x, z) => [(x - F.x) * F.ax[0] + (z - F.z) * F.ax[1], (x - F.x) * F.bw[0] + (z - F.z) * F.bw[1]],
    /* standing 3 m in front of the steps, a little to the side */
    from = trainAt(F, 1.5, -4),
    path = trainBoardPath(F, from);
  assert.deepEqual(path[0].slice(0, 2), from, 'it starts where you stand');
  /* from far away (or behind the station) it starts at the steps' foot */
  assert.ok(Math.abs(own(...trainBoardPath(F, trainAt(F, 30, -30))[0])[1] - P.foot) < 1e-9);
  assert.ok(Math.abs(own(...trainBoardPath(F, trainAt(F, 0, 9))[0])[1] - P.foot) < 1e-9);
  for (let k = 0; k <= 1.0001; k += 0.01) {
    const [x, z, h] = trainWalkAt(path, k),
      [u, w] = own(x, z);
    /* on the platform (behind its front edge): on its top, in the benches' gap */
    if (w > P.steps[1] + 1e-6) {
      near(h, P.top);
      assert.ok(Math.abs(u - P.gap) < 0.45, `crossing the platform at u ${u}`);
    }
    /* on the steps: rising with them, never under the ground */
    if (w > P.steps[0] && w <= P.steps[1]) assert.ok(h >= 0 && h <= P.top + 1e-9);
    /* before the steps: on the ground */
    if (w < P.steps[0] - 1e-6) near(h, 0);
    /* never past the platform's edge (the train stands beyond it) */
    assert.ok(w <= P.edge + 1e-6);
  }
  const end = trainWalkAt(path, 1);
  near(own(end[0], end[1])[1], P.edge);
  /* at a walk: the board beat is long enough for the way at 3.6 m a second or less */
  let len = 0;
  for (let i = 1; i < path.length; i++) len += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  assert.ok(len / ((TRAIN_DEPART.board * 0.85) / 1000) < 3.6, `${len} m in ${TRAIN_DEPART.board} ms`);
});
