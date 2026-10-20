// Studio track ST-6: the species rigs as a part kit for Part mode, and the setters the skeleton builder and Part mode
// share (logic/rig-joints.js), on every species of art/next/rigs-next.js. The skeleton tests: a pivot moved keeps
// every picture and every child where it was drawn (and gives the same rig as the builder's own drag did before it
// used rigSetPivot), a box moved keeps the pivot on its sheet pixel, a socket moved puts the child there.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import './robot-rig-node.mjs';
import {
  rigBox,
  rigKit,
  rigSetBox,
  rigSetPivot,
  rigSetSocket,
  rigSetZ,
  rigSplitPicture,
  rigZ,
} from '../../game/js/logic/rig-joints.js';

globalThis.requestAnimationFrame ??= () => 0;
const { rigMatrices, rigPose } = await import('../../game/js/skeleton-rig.js');
const { animFor } = await import('../../game/js/body-plan-animation.js');

const src = readFileSync(new URL('../../game/art/next/rigs-next.js', import.meta.url), 'utf8');
const RIGS = JSON.parse(src.slice(src.indexOf('RIGS_NEXT=') + 10).replace(/;\s*$/, ''));
const SPECIES = Object.keys(RIGS);
const fresh = () => JSON.parse(JSON.stringify(RIGS));
const VIEWS = ['front', 'back'];

/* a rig as rigFor makes it, with pictures that are only their sizes */
function rigOf(M) {
  const imgs = M.imgs.map(e => {
    const [, , w, h] = rigBox(e);
    return { ox: e.ox, oy: e.oy, c: { width: w, height: h } };
  });
  return {
    ...M,
    bones: M.bones.map(b => ({ ...b, img: b.i >= 0 ? imgs[b.i] : null })),
    anim: animFor(M.plan, M.q || {}),
  };
}
/* the skeleton builder's neutral pose (skeleton.js neutralPose) */
function neutralPose() {
  return Object.assign(rigPose(null, 0, 0, 0), {
    sy: 1,
    sx: 1,
    head: 0,
    hdy: 0,
    hdx: 0,
    aL: 0,
    aR: 0,
    tail: 0,
    face: 'idle',
    hov: { dx: 0, dy: 0, r: 0 },
  });
}
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const inv2 = m => {
  const d = m[0] * m[3] - m[1] * m[2];
  return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d];
};
const lin2 = (a, x, y) => [a[0] * x + a[2] * y, a[1] * x + a[3] * y];
/* where each bone and each picture's corners are drawn in a view's neutral pose */
function drawn(M, view) {
  const { W, list } = rigMatrices(rigOf(M), neutralPose(), view),
    out = {};
  for (const [n, m] of Object.entries(W)) out[n] = apply(m, 0, 0);
  for (const [, m, img, , , b] of list)
    out[b.n + ':pic'] = [apply(m, img.ox, img.oy), apply(m, img.ox + img.c.width, img.oy + img.c.height)].flat();
  return out;
}
const near = (a, b, eps, what) => {
  for (const k of Object.keys(a)) {
    const p = [a[k]].flat(),
      q = [b[k]].flat();
    p.forEach((v, i) => assert.ok(Math.abs(v - q[i]) <= eps, `${what} ${k}[${i}]: ${v} vs ${q[i]}`));
  }
};
/* the bone's turn and stretch in its parent, in the neutral pose, as the builder works it out */
function linIn(M, view, name) {
  const b = M.bones.find(o => o.n === name),
    { W } = rigMatrices(rigOf(M), neutralPose(), view),
    pm = W[b.par || 'root'] || W.root,
    m = W[b.n],
    P = inv2(pm);
  return [P[0] * m[0] + P[2] * m[1], P[1] * m[0] + P[3] * m[1], P[0] * m[2] + P[2] * m[3], P[1] * m[2] + P[3] * m[3]];
}
/* the builder's own pivot drag before ST-6 (skeleton.js bindSkeletonCanvas, mode 'pivot'), for one screen move */
function builderPivotDrag(M, view, name, wdx, wdy) {
  const b = M.bones.find(o => o.n === name),
    k = M.k,
    { W } = rigMatrices(rigOf(M), neutralPose(), view),
    pm = W[b.par || 'root'] || W.root,
    [pdx, pdy] = lin2(inv2(pm), wdx, wdy),
    [ldx, ldy] = lin2(inv2(W[b.n]), wdx, wdy);
  b.at = [+(b.at[0] + pdx / k).toFixed(3), +(b.at[1] + pdy / k).toFixed(3)];
  const im = M.imgs[b.i];
  if (im) {
    im.ox = Math.round((im.ox - ldx) * 100) / 100;
    im.oy = Math.round((im.oy - ldy) * 100) / 100;
  }
  M.bones
    .filter(ch => ch.par === b.n)
    .forEach(ch => {
      ch.at = [+(ch.at[0] - ldx / k).toFixed(3), +(ch.at[1] - ldy / k).toFixed(3)];
    });
  return [ldx, ldy];
}

test('rigKit: every species, a part per bone with a picture; pivot, sockets and z as the rig has them', () => {
  let n = 0;
  for (const sp of SPECIES) {
    const K = rigKit(RIGS[sp]);
    for (const view of VIEWS) {
      const M = RIGS[sp][view];
      if (!M) continue;
      for (const b of M.bones) {
        const V = K.parts[b.n]?.views[view];
        if (b.i < 0) {
          assert.ok(!V, `${sp} ${view} ${b.n} has no picture`);
          continue;
        }
        const P = M.imgs[b.i],
          [, , w, h] = rigBox(P);
        assert.equal(V.file, M.sheet);
        assert.deepEqual([V.w, V.h], [w, h]);
        assert.ok(Math.abs(V.pivot[0] * w + P.ox) < 0.5 && Math.abs(V.pivot[1] * h + P.oy) < 0.5, `${sp} ${b.n} pivot`);
        for (const c of M.bones.filter(o => o.par === b.n)) {
          const s = V.sockets[c.n];
          assert.ok(Math.abs(s[0] * w - (-P.ox + c.at[0] * M.k)) < 0.5, `${sp} ${view} ${b.n} socket ${c.n}`);
          assert.ok(Math.abs(s[1] * h - (-P.oy + c.at[1] * M.k)) < 0.5, `${sp} ${view} ${b.n} socket ${c.n}`);
        }
        assert.equal(K.parts[b.n].z[view], rigZ(b, view));
        assert.equal(K.parts[b.n].rig[view].i, b.i);
        n++;
      }
    }
    assert.ok(Object.keys(K.parts).length > 0, sp);
  }
  assert.ok(n > 1500, `${n} pictures`);
});

test('rigKit makes a kit without touching the rig', () => {
  const R = fresh();
  for (const sp of SPECIES) rigKit(R[sp]);
  assert.deepEqual(R, RIGS);
});

test('rigSetPivot keeps every species drawn where it was (neutral pose, front and back)', () => {
  const R = fresh();
  let n = 0;
  for (const sp of SPECIES)
    for (const view of VIEWS) {
      const M = R[sp][view];
      if (!M) continue;
      for (const b of M.bones) {
        if (b.i < 0) continue;
        const before = drawn(M, view);
        assert.ok(rigSetPivot(M, b.n, 2.5, -1.5, linIn(M, view, b.n)));
        /* the bone's own point is its pivot, which moved */
        delete before[b.n];
        near(before, drawn(M, view), 0.02, `${sp} ${view} ${b.n}`);
        n++;
      }
    }
  assert.ok(n > 1500);
});

test('rigSetPivot gives the rig the builder’s own pivot drag gave', () => {
  for (const sp of SPECIES)
    for (const view of VIEWS) {
      const A = fresh()[sp][view],
        B = fresh()[sp][view];
      if (!A) continue;
      for (const b of A.bones) {
        if (b.i < 0) continue;
        const [ldx, ldy] = builderPivotDrag(A, view, b.n, 3, -2);
        rigSetPivot(B, b.n, ldx, ldy, linIn(B, view, b.n));
        /* as saved (JSON has no -0) */
        assert.equal(JSON.stringify(B), JSON.stringify(A), `${sp} ${view} ${b.n}`);
      }
    }
});

test('rigSetPivot with no turn given uses the bone’s rest turn', () => {
  const M = { k: 1, sheet: 's.png', imgs: [{ ox: -4, oy: -2, f: { main: [0, 0, 8, 4] } }], bones: [] };
  M.bones = [
    { n: 'arm', par: 'root', at: [10, 0], z: 1, i: 0, rr: Math.PI / 2 },
    { n: 'hand', par: 'arm', at: [3, 1], z: 2, i: -1 },
  ];
  rigSetPivot(M, 'arm', 1, 0);
  assert.deepEqual(M.bones[0].at, [10, 1]);
  assert.deepEqual([M.imgs[0].ox, M.imgs[0].oy], [-5, -2]);
  assert.deepEqual(M.bones[1].at, [2, 1]);
  assert.equal(rigSetPivot(M, 'nope', 1, 1), false);
});

test('a shared picture is split before its pivot moves', () => {
  const M = { k: 1, sheet: 's.png', imgs: [{ ox: -2, oy: -2, f: { main: [0, 0, 4, 4] } }], bones: [] };
  M.bones = [
    { n: 'legL', par: 'root', at: [-3, 0], z: 1, i: 0 },
    { n: 'legR', par: 'root', at: [3, 0], z: 1, i: 0 },
  ];
  rigSetPivot(M, 'legR', 1, 0);
  assert.equal(M.bones[0].i, 0);
  assert.equal(M.bones[1].i, 1);
  assert.deepEqual([M.imgs[0].ox, M.imgs[1].ox], [-2, -3]);
  assert.equal(rigSplitPicture(M, M.bones[1]), M.imgs[1]);
  assert.equal(M.imgs.length, 2);
});

test('rigSetBox: the pivot stays on its sheet pixel, every frame moves its edges by as much', () => {
  for (const sp of SPECIES.slice(0, 20)) {
    const M = fresh()[sp].front;
    for (const [i, P] of M.imgs.entries()) {
      const [x, y, w, h] = rigBox(P),
        at = [x - P.ox, y - P.oy],
        frames = JSON.parse(JSON.stringify(P.f));
      assert.ok(rigSetBox(M, i, [x - 1, y + 1, w + 2, h - 1]));
      const [x2, y2, w2, h2] = rigBox(P);
      assert.deepEqual([x2, y2, w2, h2], [x - 1, y + 1, w + 2, h - 1]);
      assert.deepEqual([x2 - P.ox, y2 - P.oy], at);
      for (const [n, f] of Object.entries(frames))
        assert.deepEqual(P.f[n], [f[0] - 1, f[1] + 1, f[2] + 2, f[3] - 1], `${sp} ${i} ${n}`);
      assert.equal(rigSetBox(M, i, [x2, y2, w2, h2]), false);
    }
  }
});

test('rigSetBox: one frame alone, kept on the sheet', () => {
  const M = {
    k: 1,
    sheet: 's.png',
    size: [64, 32],
    imgs: [{ ox: -3, oy: -3, f: { idle: [10, 10, 6, 6], blink: [20, 10, 6, 6] } }],
    bones: [],
  };
  assert.ok(rigSetBox(M, 0, [21, 11, 6, 6], 'blink'));
  assert.deepEqual(M.imgs[0].f, { idle: [10, 10, 6, 6], blink: [21, 11, 6, 6] });
  assert.deepEqual([M.imgs[0].ox, M.imgs[0].oy], [-3, -3]);
  rigSetBox(M, 0, [60, -4, 10, 6]);
  assert.deepEqual(M.imgs[0].f.idle, [60, 0, 4, 6]);
  assert.equal(rigSetBox(M, 3, [0, 0, 1, 1]), false);
  assert.equal(rigSetBox(M, 0, [0, 0, 1, 1], 'happy'), false);
});

test('rigSetSocket puts the child’s joint on that pixel of its parent’s picture', () => {
  const R = fresh();
  for (const sp of SPECIES.slice(0, 30))
    for (const view of VIEWS) {
      const M = R[sp][view];
      if (!M) continue;
      for (const c of M.bones) {
        const p = M.bones.find(o => o.n === c.par);
        if (!p || p.i < 0) continue;
        assert.ok(rigSetSocket(M, c.n, 3, 4));
        const { W, list } = rigMatrices(rigOf(M), neutralPose(), view),
          pm = list.find(l => l[5].n === p.n)[1],
          img = M.imgs[p.i],
          want = apply(pm, img.ox + 3, img.oy + 4),
          got = apply(W[c.n], 0, 0);
        /* the pose may move the child on its joint (its role's offset); with none it sits on the pixel */
        const a = rigOf(M).anim(neutralPose(), view === 'back')[c.a || c.n] || {};
        if (!a.dx && !a.dy && !a.hide)
          assert.ok(Math.hypot(want[0] - got[0], want[1] - got[1]) < 0.01, `${sp} ${view} ${c.n}`);
      }
    }
  assert.equal(rigSetSocket({ k: 1, imgs: [], bones: [] }, 'x', 0, 0), false);
});

test('rigSetZ: the front’s z, the back’s zb', () => {
  const M = fresh().musk0;
  rigSetZ(M.front, 'head', 'front', 3);
  rigSetZ(M.back, 'head', 'back', 4);
  assert.equal(M.front.bones.find(b => b.n === 'head').z, 3);
  assert.equal(M.back.bones.find(b => b.n === 'head').zb, 4);
  assert.equal(M.back.bones.find(b => b.n === 'head').z, RIGS.musk0.back.bones.find(b => b.n === 'head').z);
  assert.equal(rigKit(M).parts.head.z.back, 4);
});
