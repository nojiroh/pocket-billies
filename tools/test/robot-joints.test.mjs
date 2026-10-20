// Studio track ST-5: robot joints. robotRig places every robot as it did before sockets could be stored (all 972
// builds, with their pictures and as stand-ins, front and back), and stored joints move the pictures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { robotArt, setPictures, robotBuilds, rigHash } from './robot-rig-node.mjs';

const BEFORE = JSON.parse(readFileSync(new URL('./robot-rig-before.json', import.meta.url), 'utf8'));
const clone = o => JSON.parse(JSON.stringify(o));
const bare = D => {
  const out = clone(D);
  for (const p of Object.values(out.parts)) for (const k of ['img', 'imgB', 'head', 'headB']) delete p.art[k];
  for (const g of Object.values(out.gems)) delete g.img;
  return out;
};
/* the builds whose rig differs from before, in a view */
function changed(D, sizes, want, k) {
  setPictures(sizes);
  return robotBuilds(D).filter(sp => rigHash(robotArt.robotRig(sp, D, k)) !== want[sp]);
}

test('robotRig with nothing stored places every build as before, with pictures and as stand-ins, front and back', () => {
  assert.equal(robotBuilds(BEFORE.data).length, 972);
  for (const k of [1, 2]) {
    assert.deepEqual(changed(BEFORE.data, BEFORE.sizes, BEFORE.pictures, k), []);
    assert.deepEqual(changed(bare(BEFORE.data), {}, BEFORE.standIns, k), []);
  }
});

const RJ = await import('../../game/js/logic/robot-joints.js');
const PJ = await import('../../game/js/logic/part-joints.js');
const both = (f, b = f) => ({ front: f, back: b });

test('computed joints: a torso’s sockets by the socket standard, each piece’s pivot and draw order', () => {
  const T = RJ.robotJointComputed('torso', 29, 27);
  assert.deepEqual(T.pivot, [14, 27]);
  assert.deepEqual(T.sockets, {
    neck: [14, 3],
    shoulderL: [0, 10],
    shoulderR: [28, 10],
    hipL: [7, 25],
    hipR: [21, 25],
    hip: [14, 25],
    gem: [14, 13],
  });
  assert.deepEqual(RJ.robotJointComputed('head', 21, 20).pivot, [10, 18]);
  assert.deepEqual(RJ.robotJointComputed('arm', 14, 29).pivot, [7, 0]);
  assert.deepEqual(RJ.robotJointComputed('gem', 7, 7).pivot, [3, 3]);
  assert.equal(RJ.robotJointComputed('arm', 14, 29, 'back').z, 2);
  for (const n of Object.keys(T.sockets)) assert.ok(RJ.ROBOT_SOCKET_SLOTS[n], n);
});

test('a back socket not stored keeps the front’s offset from the pivot; a stored one wins; stand-ins ignore stored', () => {
  const size = { front: [29, 27], back: [30, 27] },
    own = both(true),
    B = RJ.robotJoint('torso', undefined, 'back', size, own);
  assert.deepEqual(B.pivot, [15, 27]);
  assert.deepEqual(B.sockets.shoulderL, [1, 10]);
  const stored = { front: { sockets: { shoulderL: [0.1, 0.5] } }, back: { pivot: [0.5, 0.9] } };
  const F = RJ.robotJoint('torso', stored, 'front', size, own);
  assert.deepEqual(F.sockets.shoulderL, [3, 14]);
  const B2 = RJ.robotJoint('torso', stored, 'back', size, own);
  assert.deepEqual(B2.pivot, [15, 24]);
  assert.deepEqual(B2.sockets.shoulderL, [15 + 3 - 14, 24 + 14 - 27]);
  assert.deepEqual(RJ.robotJoint('torso', stored, 'front', size, both(false)), RJ.robotJointComputed('torso', 29, 27));
  /* a back with no picture of its own draws the front picture, so it joins as the front does */
  assert.deepEqual(RJ.robotJoint('torso', stored, 'back', size, { front: true, back: false }), F);
});

test('fractions round-trip to the same pixels; robotJointSet sets and clears one point', () => {
  for (let w = 1; w <= 64; w++)
    for (let x = -w; x <= 2 * w; x++) assert.deepEqual(RJ.robotPx(RJ.robotFrac([x, x], w, w), w, w), [x, x]);
  let J = RJ.robotJointSet(undefined, 'front', 'shoulderL', [0.1, 0.2]);
  J = RJ.robotJointSet(J, 'back', 'pivot', [0.5, 1]);
  J = RJ.robotJointSet(J, 'back', 'z', 3);
  assert.deepEqual(J, { front: { sockets: { shoulderL: [0.1, 0.2] } }, back: { pivot: [0.5, 1], z: 3 } });
  J = RJ.robotJointSet(J, 'front', 'shoulderL', null);
  J = RJ.robotJointSet(J, 'back', 'pivot', null);
  assert.deepEqual(J, { back: { z: 3 } });
  assert.equal(RJ.robotJointSet(J, 'back', 'z', null), undefined);
});

test('robotKit: robots.json as a part kit that partFit fits as the rig joins it (arms not mirrored on the right)', () => {
  const size = p => BEFORE.sizes[p] || null,
    K = RJ.robotKit(BEFORE.data, size);
  assert.ok(K.parts['bulwark:head'] && K.parts['gem:ember'] && K.parts.piston_r?.hidden);
  assert.deepEqual(PJ.partSocketsFor(K, 'bulwark', 'piston', 'front'), ['shoulderL', 'shoulderR']);
  assert.deepEqual(PJ.partSocketsFor(K, 'bulwark', 'treads', 'front'), ['hipL', 'hipR', 'hip']);
  assert.deepEqual(PJ.partSocketsFor(K, 'bulwark', 'bulwark:head', 'back'), ['neck']);
  for (const socket of ['shoulderL', 'shoulderR']) {
    const fit = PJ.partFit(K, 'bulwark', socket, 'piston', 'front');
    assert.equal(fit.flip, false);
    const arm = fit.draws.find(d => !d.body);
    /* the torso's top left is 0, 0: the arm's top middle (7, 0) sits on the shoulder */
    const T = RJ.robotJointComputed('torso', 29, 27).sockets[socket];
    assert.deepEqual([Math.round(arm.x - arm.px[0]), Math.round(arm.y - arm.px[1])], [T[0] - 7, T[1]]);
  }
  /* a stand-in (no picture) is not in the kit */
  assert.equal(RJ.robotKit(bare(BEFORE.data), () => null).parts.bulwark, undefined);
});

/* every point computed, written in as stored joints (what Part mode would write if every point were set by hand) */
function storeComputed(D, sizes) {
  const out = clone(D),
    store = (piece, front, back) => {
      const s = { front: sizes[front], back: sizes[back] || sizes[front] },
        own = { front: !!sizes[front], back: !!sizes[back] },
        J = {};
      for (const [view, file] of [
        ['front', front],
        ['back', back],
      ]) {
        if (!file) continue;
        const j = RJ.robotJoint(piece, undefined, view, s, own),
          sockets = {};
        for (const [n, p] of Object.entries(j.sockets)) sockets[n] = RJ.robotFrac(p, ...s[view]);
        J[view] = { pivot: RJ.robotFrac(j.pivot, ...s[view]), z: j.z, ...(piece === 'torso' ? { sockets } : {}) };
      }
      return J;
    };
  for (const P of Object.values(out.parts)) {
    P.art.joints = store(P.slot, P.art.img, P.art.imgB);
    if (P.slot === 'torso') P.art.headJoints = store('head', P.art.head, P.art.headB);
  }
  return out;
}

test('every point computed and stored gives the same rigs; stored joints are ignored by stand-ins', () => {
  const D = storeComputed(BEFORE.data, BEFORE.sizes);
  assert.ok(D.parts.bulwark.art.joints.back.sockets.shoulderL);
  for (const k of [1, 2]) {
    assert.deepEqual(changed(D, BEFORE.sizes, BEFORE.pictures, k), []);
    assert.deepEqual(changed(bare(D), {}, BEFORE.standIns, k), []);
  }
});

test('a stored socket, pivot or draw order moves the picture in its view only', () => {
  setPictures(BEFORE.sizes);
  const sp = 'bot:ember.bulwark.piston.auger.striders',
    bone = (D, k, n) => robotArt.robotRig(sp, D, k).bones.find(b => b.n === n),
    D = clone(BEFORE.data);
  D.parts.bulwark.art.joints = { front: { sockets: { shoulderL: [0.1, 0.5] } } };
  D.parts.piston.art.joints = { back: { pivot: [0.5, 0.25], z: 7 } };
  /* bulwark front is 29 x 27, pivot (14, 27): the shoulder at (3, 14) is (-11, -13) from it */
  assert.deepEqual(bone(D, 1, 'armL').at, [-11, -13]);
  assert.deepEqual(bone(BEFORE.data, 1, 'armR').at, bone(D, 1, 'armR').at);
  /* the back keeps the front's offset (the back socket was not stored) */
  assert.deepEqual(bone(D, 2, 'armL').at, [-11, -13]);
  const arm = bone(D, 2, 'armL');
  assert.deepEqual([arm.imgB.ox, arm.imgB.oy, arm.zb], [-7, -7, 7]);
  assert.deepEqual([arm.img.ox, arm.img.oy, arm.z], [-7, 0, 8]);
});
