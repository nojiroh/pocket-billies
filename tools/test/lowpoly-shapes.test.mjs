// Buildings track BD-1: the new recipe shapes of the low-poly models (game/js/prop-models.js lowPolyFromRecipe, the
// maths in game/js/logic/model-shapes.js): rot and tilt on every solid kind, the prism, the lathe, a box's taper, lean
// and bevel, the recipe's warp, glowing layers, and the world map's simpler copy (world-bowl.js
// worldBowlModelShape). Each: its bounds, its normals facing out, its triangle count and a stable vertex hash (a
// changed hash means every model made of that shape looks different: check the pictures, then update it here).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

await import('./walk-renderer.mjs');
const { lowPolyFromRecipe, propModelState } = await import('../../game/js/prop-models.js');
/* the world map's module reads the game data when it loads (game-data.js), put together as the Node tools do */
globalThis.GAMEDATA ??= (await import('../data-files.mjs')).readGameData();
globalThis.PB_VERSION ??= 'test';
await import('../../game/js/world-bowl.js');
const { earClip, glowCode, profileNormals, warpFrame, warpNormal, warpPoint } =
  await import('../../game/js/logic/model-shapes.js');
/* not exported: the test globals */
const { worldBowlModelShape } = /** @type {any} */ (globalThis);

/* a mesh's vertices unpacked: position (up is y), unit normal, the flag byte and the glow bytes */
function verts(M) {
  const i16 = new Int16Array(M.vb),
    i8 = new Int8Array(M.vb),
    u8 = new Uint8Array(M.vb),
    out = [];
  for (let o = 0; o < M.vb.byteLength; o += 24)
    out.push({
      p: [i16[o / 2] / 256, i16[o / 2 + 1] / 256, i16[o / 2 + 2] / 256],
      n: [i8[o + 8] / 127, i8[o + 9] / 127, i8[o + 10] / 127],
      flag: u8[o + 18],
      hi: u8[o + 19],
      lo: u8[o + 23],
      col: [u8[o + 20], u8[o + 21], u8[o + 22]],
    });
  return out;
}
const hash = M =>
  createHash('sha1')
    .update(new Uint8Array(M.vb))
    .update(new Uint8Array(M.ib.buffer, M.ib.byteOffset, M.ib.byteLength))
    .digest('hex')
    .slice(0, 12);
const near = (a, b, e = 0.01) => a.every((v, i) => Math.abs(v - b[i]) <= e);
const r2 = b => b.map(v => Math.round(v * 100) / 100);
/* every triangle's normals face away from a point inside a convex shape (by the triangle's middle) */
function facesOut(M, mid) {
  const V = verts(M),
    bad = [];
  for (let t = 0; t < M.ib.length; t += 3) {
    const T = [0, 1, 2].map(k => V[M.ib[t + k]]),
      c = [0, 1, 2].map(q => T.reduce((a, v) => a + v.p[q], 0) / 3),
      n = [0, 1, 2].map(q => T.reduce((a, v) => a + v.n[q], 0));
    if ((c[0] - mid[0]) * n[0] + (c[1] - mid[1]) * n[1] + (c[2] - mid[2]) * n[2] < -1e-3) bad.push(t / 3);
  }
  return bad;
}

const BOX = { k: 'box', x: 0, y: 0, z: 0, w: 2, d: 1, h: 1, col: '#c08040', tex: 'plaster' };

test('a plain box is made as before: rot 0 and no tilt change nothing', () => {
  const a = lowPolyFromRecipe({ layers: [BOX] }),
    b = lowPolyFromRecipe({ layers: [{ ...BOX, rot: 0, tilt: [0, 0] }] });
  assert.equal(a.tris, 10);
  assert.equal(hash(a), hash(b));
  assert.deepEqual(r2(a.box), [-1, 0, -0.5, 1, 1, 0.5]);
});

test('rot turns a box about its upright (across toward depth), its texture with its faces', () => {
  const M = lowPolyFromRecipe({ layers: [{ ...BOX, rot: Math.PI / 2 }] }),
    P = lowPolyFromRecipe({ layers: [BOX] });
  assert.equal(M.tris, 10);
  assert.deepEqual(r2(M.box), [-0.5, 0, -1, 0.5, 1, 1]);
  assert.deepEqual(facesOut(M, [0, 0.5, 0]), []);
  /* the same texture coordinates in the same order: they were made before the turn */
  const uv = m => {
    const i16 = new Int16Array(m.vb);
    return Array.from({ length: m.vb.byteLength / 24 }, (_, i) => [i16[i * 12 + 6], i16[i * 12 + 7]]);
  };
  assert.deepEqual(uv(M), uv(P));
});

test('tilt leans any solid about its base: a cylinder laid on its side, a box leaned back', () => {
  const C = lowPolyFromRecipe({ layers: [{ k: 'cyl', r: 0.2, h: 2, z: 0.2, tilt: [0, Math.PI / 2], sides: 8 }] });
  /* tilt[1] leans its top toward the right: two metres along x from its base */
  assert.ok(near([C.box[0], C.box[3]], [0, 2], 0.02), `${r2(C.box)}`);
  assert.ok(C.box[4] - C.box[1] < 0.45);
  const B = lowPolyFromRecipe({ layers: [{ ...BOX, tilt: [0.2, 0] }] });
  /* tilt[0] leans its top toward the back */
  assert.ok(B.box[5] > 0.5 + Math.sin(0.2) * 0.9, `${r2(B.box)}`);
  assert.deepEqual(facesOut(B, [0, 0.5, Math.sin(0.2) * 0.5]), []);
  for (const k of ['sphere', 'cone', 'barrel', 'dome', 'limb']) {
    const L = { k, r: 0.1, h: 1, x2: 0, y2: 0, z2: 1, tilt: [0.3, 0] },
      a = lowPolyFromRecipe({ layers: [{ ...L, tilt: undefined }] }),
      b = lowPolyFromRecipe({ layers: [L] });
    assert.equal(a.tris, b.tris, k);
    assert.ok(b.box[5] > a.box[5] + 0.05, `${k} leans back`);
  }
});

test('a box tapered, leaned and bevelled is made as rings', () => {
  const T = lowPolyFromRecipe({ layers: [{ ...BOX, w: 2, d: 2, h: 2, taper: [1, 1] }] });
  assert.equal(T.tris, 10);
  assert.deepEqual(r2(T.box), [-1, 0, -1, 1, 2, 1]);
  assert.deepEqual(facesOut(T, [0, 1, 0]), []);
  const top = verts(T).filter(v => v.p[1] > 1.99);
  assert.ok(top.every(v => Math.abs(v.p[0]) <= 0.501 && Math.abs(v.p[2]) <= 0.501));
  const L = lowPolyFromRecipe({ layers: [{ ...BOX, h: 2, lean: [0.5, 0] }] });
  assert.deepEqual(r2(L.box), [-1, 0, -0.5, 1.5, 2, 0.5]);
  assert.deepEqual(facesOut(L, [0.25, 1, 0]), []);
  const V = lowPolyFromRecipe({ layers: [{ ...BOX, w: 2, d: 2, h: 2, bevel: 0.2, z: 0.5 }] });
  /* an octagon's sides, its chamfer, its top (6) and its bottom (6) */
  assert.equal(V.tris, 8 * 2 * 2 + 6 + 6);
  assert.deepEqual(r2(V.box), [-1, 0.5, -1, 1, 2.5, 1]);
  assert.deepEqual(facesOut(V, [0, 1.5, 0]), []);
  /* the bevel can't eat the box */
  const big = lowPolyFromRecipe({ layers: [{ ...BOX, bevel: 9 }] });
  assert.ok(big.tris > 10 && near(r2(big.box), [-1, 0, -0.5, 1, 1, 0.5]));
  assert.equal(hash(V), '13623a82ee59');
});

const GABLE = [
  [-1, 0],
  [1, 0],
  [1, 1],
  [0, 1.6],
  [-1, 1],
];
test('a prism draws a profile out deep: a gable', () => {
  const M = lowPolyFromRecipe({ layers: [{ k: 'prism', pts: GABLE, d: 2, col: '#ffffff' }] });
  /* five sides and two caps of three triangles */
  assert.equal(M.tris, 5 * 2 + 2 * 3);
  assert.deepEqual(r2(M.box), [-1, 0, -1, 1, 1.6, 1]);
  assert.deepEqual(facesOut(M, [0, 0.7, 0]), []);
  /* listed the other way round, the same shape */
  const R = lowPolyFromRecipe({ layers: [{ k: 'prism', pts: GABLE.slice().reverse(), d: 2 }] });
  assert.deepEqual(r2(R.box), r2(M.box));
  assert.deepEqual(facesOut(R, [0, 0.7, 0]), []);
  /* turned a quarter: its ridge runs across */
  const Q = lowPolyFromRecipe({ layers: [{ k: 'prism', pts: GABLE, d: 4, rot: Math.PI / 2 }] });
  assert.deepEqual(r2(Q.box), [-2, 0, -1, 2, 1.6, 1]);
  assert.equal(hash(M), '740050a1924e');
});

test('a prism with a concave profile (an arch) and a bent one (a swoop)', () => {
  const arc = Array.from({ length: 7 }, (_, i) => {
      /* up the opening's left side, over the top, down its right side */
      const a = Math.PI - (Math.PI * i) / 6;
      return [0.6 * Math.cos(a), 0.8 + 0.6 * Math.sin(a)];
    }),
    /* round the outside anticlockwise, then back over the opening's arc */
    pts = [[-1, 0], [-0.6, 0], ...arc, [0.6, 0], [1, 0], [1, 1.6], [-1, 1.6]],
    M = lowPolyFromRecipe({ layers: [{ k: 'prism', pts, d: 0.5 }] });
  assert.deepEqual(r2(M.box), [-1, 0, -0.25, 1, 1.6, 0.25]);
  /* no cap triangle over the opening: each cap's area is the outline's less the arch */
  const V = verts(M);
  let area = 0;
  for (let t = 0; t < M.ib.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map(k => V[M.ib[t + k]]);
    if (Math.abs(a.n[2]) < 0.9 || a.p[2] > 0) continue;
    area += Math.abs((b.p[0] - a.p[0]) * (c.p[1] - a.p[1]) - (b.p[1] - a.p[1]) * (c.p[0] - a.p[0])) / 2;
  }
  const hole = 1.2 * 0.8 + 0.5 * 6 * 0.6 * 0.6 * Math.sin(Math.PI / 6);
  assert.ok(Math.abs(area - (2 * 1.6 - hole)) < 0.02, `cap ${area.toFixed(3)}`);
  /* the arch's soffit faces into the opening (down at its crown) */
  const crown = V.filter(v => Math.abs(v.p[0]) < 0.05 && Math.abs(v.p[1] - 1.4) < 0.02 && Math.abs(v.n[2]) < 0.5);
  assert.ok(crown.length && crown.every(v => v.n[1] < -0.9), JSON.stringify(crown.map(v => v.n)));
  const B = lowPolyFromRecipe({
    layers: [
      {
        k: 'prism',
        pts: [
          [-1, 0],
          [1, 0],
          [0, 0.5],
        ],
        d: 3,
        bend: 0.4,
        segs: 4,
      },
    ],
  });
  assert.equal(B.tris, 3 * 4 * 2 + 2);
  /* its ends raised 0.4, its middle not */
  assert.ok(near([B.box[1], B.box[4]], [0, 0.9]));
  const mid = verts(B).filter(v => Math.abs(v.p[2]) < 0.01);
  assert.ok(mid.length && Math.min(...mid.map(v => v.p[1])) < 0.01);
  /* the ends' sloped faces lean their normals out toward the ends */
  const end = verts(B).filter(v => v.p[2] > 1.49 && v.n[1] > 0.3);
  assert.ok(end.length && end.every(v => v.n[2] < -0.1), JSON.stringify(end.map(v => v.n)));
});

const ONION = [
  [0.5, 0],
  [0.6, 0.5],
  [0.3, 1],
  [0.05, 1.4],
  [0, 1.5],
];
test('a lathe turns a profile round: an onion dome, an oval, a flared chimney with a sharp rim', () => {
  const M = lowPolyFromRecipe({ layers: [{ k: 'lathe', pts: ONION, sides: 12 }] });
  assert.equal(M.tris, 4 * 12 * 2);
  assert.deepEqual(r2(M.box), [-0.6, 0, -0.6, 0.6, 1.5, 0.6]);
  assert.deepEqual(facesOut(M, [0, 0.6, 0]), []);
  /* listed top down, the same */
  const R = lowPolyFromRecipe({ layers: [{ k: 'lathe', pts: ONION.slice().reverse(), sides: 12 }] });
  assert.deepEqual(facesOut(R, [0, 0.6, 0]), []);
  const O = lowPolyFromRecipe({ layers: [{ k: 'lathe', pts: ONION, sides: 12, ry: 0.5, x: 1, y: 2, z: 3 }] });
  assert.deepEqual(r2(O.box), [0.4, 3, 1.7, 1.6, 4.5, 2.3]);
  assert.deepEqual(facesOut(O, [1, 3.6, 2]), []);
  /* a chimney pot: a straight stack, a flared rim (a sharp joint), a flat top; off the ground, so a bottom too */
  const C = lowPolyFromRecipe({
    layers: [
      {
        k: 'lathe',
        z: 2,
        sides: 8,
        pts: [
          [0.2, 0],
          [0.2, 1],
          [0.3, 1.1],
        ],
      },
    ],
  });
  assert.equal(C.tris, 2 * 8 * 2 + 8 + 8);
  const rim = verts(C).filter(v => Math.abs(v.p[1] - 3) < 0.01 && Math.abs(v.n[1]) < 0.99);
  /* at the joint the stack's normals stay level and the flare's tip up: two normals, not one between */
  assert.ok(rim.some(v => Math.abs(v.n[1]) < 0.05) && rim.some(v => v.n[1] < -0.5));
  assert.equal(hash(M), '02f9478f70ac');
});

test('the profile maths: ear clipping and soft or sharp joints', () => {
  const U = [
    [0, 0],
    [3, 0],
    [3, 2],
    [2, 2],
    [2, 1],
    [1, 1],
    [1, 2],
    [0, 2],
  ];
  const T = earClip(U);
  assert.equal(T.length, U.length - 2);
  let a = 0;
  for (const [i, j, k] of T)
    a += ((U[j][0] - U[i][0]) * (U[k][1] - U[i][1]) - (U[j][1] - U[i][1]) * (U[k][0] - U[i][0])) / 2;
  assert.ok(Math.abs(a - 5) < 1e-9);
  const N = profileNormals(
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    false,
    0.4,
    false
  );
  assert.deepEqual(N[0][1], [0, -1]);
  assert.deepEqual(N[1][0], [1, -0]);
  const S = profileNormals(
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    false,
    0.4,
    true
  );
  assert.ok(near(S[0][1], [Math.SQRT1_2, -Math.SQRT1_2]));
});

test('the warp: the ground stays, the top leans, sags and twists; normals and glass follow', () => {
  const W = { lean: [0.3, 0.1], sag: 0.2, bulge: 0.1, twist: 0.15 },
    layers = [
      { ...BOX, w: 2, d: 2, h: 3 },
      { k: 'box', x: 0, y: -1.02, z: 1, w: 0.6, d: 0.04, h: 0.8, glass: 1 },
    ],
    A = lowPolyFromRecipe({ layers }),
    M = lowPolyFromRecipe({ layers, warp: W }),
    VA = verts(A),
    VM = verts(M);
  assert.equal(A.tris, M.tris);
  /* the ground's points don't move */
  for (let i = 0; i < VA.length; i++) if (VA[i].p[1] === 0) assert.ok(near(VA[i].p, VM[i].p, 0.005));
  /* the top's middle moved by the lean and sank by the sag */
  const F = warpFrame(A.box),
    top = warpPoint(W, F, [0, 3, 0]);
  assert.ok(near(top, [0.3, 2.8, 0.1], 0.01), `${top}`);
  /* the window moved up the wall with the bulge and the lean, and still looks out the front */
  assert.equal(M.wins.length, 1);
  assert.ok(M.wins[0].p[0] > A.wins[0].p[0] + 0.05);
  assert.deepEqual(M.wins[0].n, [0, 0, -1]);
  /* normals stay unit and roughly as they were (the wonk is gentle) */
  for (let i = 0; i < VA.length; i++) {
    const a = VA[i].n,
      b = VM[i].n;
    assert.ok(Math.abs(Math.hypot(...b) - 1) < 0.02);
    assert.ok(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] > 0.85);
  }
  /* a pure lean shears a side wall: its normal tilts against the lean */
  const n = warpNormal({ lean: [1, 0] }, { H: 1, cx: 0, cz: 0, hw: 1 }, [1, 0.5, 0], [1, 0, 0]);
  assert.ok(near(n, [Math.SQRT1_2, -Math.SQRT1_2, 0], 0.001), `${n}`);
  /* no warp, no change */
  assert.equal(hash(lowPolyFromRecipe({ layers, warp: { lean: [0, 0] } })), hash(A));
  assert.equal(hash(M), 'e8b011e10b93');
});

test('a glowing layer: its flag and colour in the spare bytes; glass wins over glow', () => {
  assert.deepEqual(glowCode({ glow: '#ff0000' }), { flag: 33, hi: 0xf8, lo: 0 });
  assert.deepEqual(glowCode({ glow: { col: '#0000ff', day: 1 } }), { flag: 34, hi: 0, lo: 0x1f });
  assert.deepEqual(glowCode({ glow: true, col: '#00ff00', glowDay: 1 }), { flag: 34, hi: 0x07, lo: 0xe0 });
  assert.equal(glowCode({ col: '#ffffff' }), null);
  const M = lowPolyFromRecipe({
      layers: [
        { ...BOX, col: '#808080' },
        { k: 'cyl', r: 0.05, h: 1, z: 1, col: '#ffffff', glow: '#ff3399' },
        { k: 'box', w: 0.5, d: 0.04, h: 0.5, z: 0.2, y: -0.52, glass: 2, glow: '#00ff00' },
      ],
    }),
    V = verts(M);
  assert.equal(M.glow, true);
  const lit = V.filter(v => v.flag === 33),
    plain = V.filter(v => v.flag === 0),
    glass = V.filter(v => v.flag === 3);
  assert.ok(lit.length && plain.length && glass.length);
  const c = (lit[0].hi << 8) | lit[0].lo;
  assert.deepEqual([c >> 11, (c >> 5) & 63, c & 31], [0xff >> 3, 0x33 >> 2, 0x99 >> 3]);
  assert.ok(plain.every(v => v.hi === 0 && v.lo === 255));
  assert.ok(glass.every(v => v.hi === 0 && v.lo === 255));
  assert.equal(lowPolyFromRecipe({ layers: [BOX] }).glow, false);
});

test('the world map keeps prisms and lathes (fewer steps), drops bevels and bakes the warp', () => {
  const rec = {
    warp: { lean: [0.4, 0] },
    layers: [
      { ...BOX, w: 3, d: 3, h: 3, bevel: 0.2 },
      { k: 'prism', pts: GABLE, d: 3, z: 3, bend: 0.3, segs: 6 },
      { k: 'lathe', pts: ONION, z: 4.6, sides: 16 },
      { k: 'lathe', pts: ONION.map(([r, z]) => [r / 10, z / 10]), z: 6 },
    ],
  };
  propModelState.recipes.set('test:bd1', rec);
  const F = worldBowlModelShape('test:bd1'),
    tris = F.length / 27;
  /* the box as plain (10), the gable with 3 steps (5 sides x 3 x 2 + 2 caps of 3), the onion with 6 sides (4 x 6
     x 2, and its bottom: it stands on the roof); the tiny finial left out */
  assert.equal(tris, 10 + (5 * 3 * 2 + 6) + (4 * 6 * 2 + 6));
  let top = -1e9,
    tx = 0;
  for (let i = 0; i < F.length; i += 9)
    if (F[i + 1] > top) {
      top = F[i + 1];
      tx = F[i];
    }
  /* the onion's tip leaned with the whole model's warp (measured on the whole model, finial and all) */
  const H = 6 + 0.15;
  assert.ok(Math.abs(tx - (0.4 * (4.6 + 1.5)) / H) < 0.02, `tip at ${tx}, top ${top}`);
  propModelState.recipes.delete('test:bd1');
});
