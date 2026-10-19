// Studio track ST-4: how a kit part joins a body (game/js/logic/part-joints.js): the kind's defaults and a part's own
// values, the sockets a part may attach at, fitting it on a torso in both views, its turn limits, the side its art is
// drawn for, the copy for the other side, and S and L sizes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const J = modules['part-joints'];
const real = () => JSON.parse(JSON.stringify(GAME_DATA.partKits));

test("a part takes its kind's draw order and turn limits unless it has its own", () => {
  const K = real();
  assert.equal(J.partZ(K, 'cat_arm', 'front'), 8);
  assert.equal(J.partZ(K, 'cat_arm', 'back'), 2);
  assert.equal(J.partZ(K, 'cat_tail', 'back'), 8);
  assert.deepEqual(J.partTurn(K, 'cat_arm'), [-60, 60]);
  K.parts.cat_arm.z = { back: 9 };
  K.parts.cat_arm.turn = [-10, 80];
  assert.equal(J.partZ(K, 'cat_arm', 'front'), 8, "a view the part leaves out is still its kind's");
  assert.equal(J.partZ(K, 'cat_arm', 'back'), 9);
  assert.deepEqual(J.partTurn(K, 'cat_arm'), [-10, 80]);
  assert.equal(J.partClampTurn(K, 'cat_arm', 120), 80);
  assert.equal(J.partClampTurn(K, 'cat_arm', -50), -10);
  delete K.turns.arm;
  delete K.parts.cat_arm.turn;
  assert.deepEqual(J.partTurn(K, 'cat_arm'), J.PART_TURN_FREE);
  assert.equal(J.partZ(K, 'no_such_part', 'front'), 0);
});

test('every kind has a draw order and turn limits, and every rule names a slot', () => {
  const K = real(),
    slots = new Set(Object.values(K.slots));
  for (const k of Object.keys(K.slots)) {
    assert.ok(K.z[k], `z for ${k}`);
    assert.ok(K.turns[k][0] <= K.turns[k][1], `turns for ${k}`);
  }
  for (const [s, list] of Object.entries(K.socketRules))
    for (const slot of list) assert.ok(slots.has(slot), `${s}: ${slot}`);
});

test('a torso takes a head at its neck, front limbs at its shoulders, back limbs at its hips', () => {
  const K = real();
  assert.deepEqual(J.partSocketsFor(K, 'cat_torso', 'cat_head', 'front'), ['neck']);
  assert.deepEqual(J.partSocketsFor(K, 'cat_torso', 'cat_arm', 'front'), ['shoulderL', 'shoulderR']);
  assert.deepEqual(J.partSocketsFor(K, 'cat_torso', 'cat_leg', 'back'), ['hipL', 'hipR']);
  assert.deepEqual(J.partSocketsFor(K, 'cat_torso', 'fox_tail', 'front'), ['tail']);
  assert.deepEqual(J.partSocketsFor(K, 'cat_torso', 'cat_ear', 'front'), [], 'no top socket on a torso');
  K.parts.cat_torso.accepts = { neck: ['head', 'head-extra'] };
  assert.deepEqual(J.partSocketsFor(K, 'cat_torso', 'cat_ear', 'front'), ['neck'], "a part's own rule wins");
  assert.deepEqual(J.partAccepts(K, 'cat_torso', 'hipL'), ['back']);
});

test('a leg fitted on a hip: its pivot lands on the socket, and draw order follows the view', () => {
  const K = real(),
    T = K.parts.cat_torso.views.front,
    L = K.parts.cat_leg.views.front,
    f = J.partFit(K, 'cat_torso', 'hipL', 'cat_leg', 'front');
  assert.equal(f.flip, false, 'legs are drawn for the left');
  const leg = f.draws.find(d => !d.body);
  assert.equal(leg.x, T.sockets.hipL[0] * T.w);
  assert.equal(leg.y, T.sockets.hipL[1] * T.h);
  assert.deepEqual(leg.px, [K.parts.cat_leg.pivot[0] * L.w, K.parts.cat_leg.pivot[1] * L.h]);
  assert.deepEqual(
    f.draws.map(d => d.body),
    [true, false],
    'the torso (5) under the leg (7)'
  );
  const back = J.partFit(K, 'cat_torso', 'shoulderR', 'cat_arm', 'back');
  assert.deepEqual(
    back.draws.map(d => d.body),
    [false, true],
    'from behind the arm (2) is under the torso (5)'
  );
  assert.equal(J.partFit(K, 'cat_torso', 'nowhere', 'cat_leg', 'front'), null);
});

test('the other side mirrors the part, or uses its copy; the angle stays inside the limits', () => {
  const K = real(),
    R = J.partFit(K, 'cat_torso', 'hipR', 'cat_leg', 'front', { angle: 90 }),
    leg = R.draws.find(d => !d.body),
    L = K.parts.cat_leg.views.front;
  assert.equal(R.flip, true);
  assert.equal(R.angle, 35, 'legs turn at most 35 degrees');
  assert.equal(leg.rot, -35, 'mirrored, the turn goes the other way on screen');
  assert.ok(Math.abs(leg.px[0] - (1 - K.parts.cat_leg.pivot[0]) * L.w) < 1e-9);
  /* arms are drawn for the right: the left shoulder mirrors them */
  assert.equal(J.partFit(K, 'cat_torso', 'shoulderL', 'cat_arm', 'front').flip, true);
  assert.equal(J.partFit(K, 'cat_torso', 'shoulderR', 'cat_arm', 'front').flip, false);
  /* with a copy for the other side, that copy is drawn as it is */
  const m = J.partMirror(K, 'cat_leg');
  K.parts[m.id] = m.entry;
  const C = J.partFit(K, 'cat_torso', 'hipR', 'cat_leg', 'front');
  assert.equal(C.flip, false);
  assert.equal(C.id, 'cat_leg_r');
  assert.equal(J.partDrawnSide(K, 'cat_leg_r'), 'R');
  assert.deepEqual(J.partForSide(K, 'cat_leg_r', 'L'), { id: 'cat_leg', flip: false });
  assert.deepEqual(J.partForSide(K, 'cat_leg', 'L'), { id: 'cat_leg', flip: false });
});

test('the copy for the other side: pictures under its id, points and socket names mirrored, and back again', () => {
  const K = real();
  K.parts.cat_torso.turn = [-5, 20];
  K.parts.cat_torso.views.front.pivot = [0.4, 0.5];
  K.sockets.cat_torso = { front: { shoulderL: [0.2, 0.25] } };
  const m = J.partMirror(K, 'cat_torso'),
    F = m.entry.views.front,
    O = K.parts.cat_torso.views.front;
  assert.equal(m.id, 'cat_torso_r');
  assert.equal(m.entry.mirrorOf, 'cat_torso');
  assert.equal(F.file, 'next/parts/front/cat_torso_r.png');
  assert.equal(m.entry.views.back.file, 'next/parts/back/cat_torso_r.png');
  assert.deepEqual(F.pivot, [0.6, 0.5]);
  assert.deepEqual(F.sockets.shoulderR, [
    Math.round((1 - O.sockets.shoulderL[0]) * 1000) / 1000,
    O.sockets.shoulderL[1],
  ]);
  assert.deepEqual(F.sockets.neck[1], O.sockets.neck[1]);
  assert.deepEqual(m.entry.turn, [-20, 5]);
  assert.deepEqual(m.sockets, { front: { shoulderR: [0.8, 0.25] } });
  K.parts[m.id] = m.entry;
  K.sockets[m.id] = m.sockets;
  assert.equal(J.partMirrorId(K, m.id), 'cat_torso');
  const back = J.partMirror(K, m.id);
  assert.equal(back.id, 'cat_torso');
  assert.deepEqual(back.entry, K.parts.cat_torso, 'mirrored twice is the part again');
  assert.deepEqual(back.sockets, K.sockets.cat_torso);
  /* a kind with turn limits that are not even keeps them right way round on the copy */
  K.turns.leg = [-10, 40];
  assert.deepEqual(J.partMirror(K, 'cat_leg').entry.turn, [-40, 10]);
  assert.equal(J.partMirror(K, 'nope'), null);
});

test('S and L: M scaled about the pivot, or the hand-painted picture', () => {
  const K = real(),
    V = K.parts.cat_leg.views.front,
    rules = { parts: { sizes: { S: { scale: 0.5 }, L: { scale: 1.2 } } } },
    s = J.partJoint(K, 'cat_leg', 'front', 'S', rules),
    l = J.partJoint(K, 'cat_leg', 'front', 'L');
  assert.equal(s.w, Math.round(V.w * 0.5));
  assert.equal(s.file, V.file);
  assert.equal(s.painted, false);
  assert.deepEqual(s.pivot, K.parts.cat_leg.pivot, 'the pivot stays at the same place in the picture');
  assert.equal(l.h, Math.round(V.h * 1.2));
  V.sizes = { L: { file: 'next/parts/front/cat_leg_l.png', w: 40, h: 60, pivot: [0.5, 0.1] } };
  const p = J.partJoint(K, 'cat_leg', 'front', 'L');
  assert.equal(p.painted, true);
  assert.equal(p.scale, 1);
  assert.deepEqual([p.w, p.h, p.file], [40, 60, 'next/parts/front/cat_leg_l.png']);
  assert.deepEqual(p.sockets, V.sockets, "without sockets of its own it takes M's");
  assert.equal(J.partJoint(K, 'cat_leg', 'side', 'M'), null);
});

test('scaling a picture by nearest neighbour keeps its colours', () => {
  const img = {
      width: 2,
      height: 2,
      data: new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 0, 0, 0, 0]),
    },
    big = J.partScaledPixels(img, 2);
  assert.deepEqual([big.width, big.height], [4, 4]);
  assert.deepEqual([...big.data.slice(0, 4)], [1, 2, 3, 255]);
  assert.deepEqual([...big.data.slice(12, 16)], [4, 5, 6, 255]);
  assert.deepEqual([...big.data.slice(60, 64)], [0, 0, 0, 0]);
  const small = J.partScaledPixels(img, 0.5);
  assert.deepEqual([small.width, small.height], [1, 1]);
});

test('the box around a fitted part holds both pictures', () => {
  const K = real(),
    f = J.partFit(K, 'cat_torso', 'hipL', 'cat_leg', 'front'),
    b = J.partDrawBounds(f.draws),
    T = K.parts.cat_torso.views.front;
  assert.ok(b.x <= 0 && b.y <= 0);
  assert.ok(b.x + b.w >= T.w && b.y + b.h > T.h, 'the leg hangs below the torso');
});
