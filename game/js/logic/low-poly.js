'use strict';
/* ================= LOW-POLY MODELS FROM RECIPES (fluid track FL-4b: moved from prop-models.js as they were) =========
   A prop's recipe (its shapes) as a low-poly mesh in plain numbers, with no graphics card: the page uploads it
   (prop-models.js propModelMesh), and the model-mesh helper thread (prop-model-worker.js) can make it off the page. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import {
  earClip,
  glowCode,
  layerTurn,
  profileArea,
  profileNormals,
  profilePoints,
  warpFrame,
  warpNormal,
  warpOn,
  warpPoint,
} from './model-shapes.js';
/* eslint-disable no-func-assign */
expose({
  LOW_POLY_TEXTURE_CELLS: [() => LOW_POLY_TEXTURE_CELLS],
  limbPoints: [() => limbPoints, v => (limbPoints = v)],
  lowPolyFromRecipe: [() => lowPolyFromRecipe, v => (lowPolyFromRecipe = v)],
  recipeRgb: [() => recipeRgb],
  voxelHash: [() => voxelHash, v => (voxelHash = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* art.js hexToRgb as it is (logic/ can't import art.js): '#rrggbb' or [r, g, b] to [r, g, b] */
export const recipeRgb = h => {
  if (Array.isArray(h)) return h;
  const n = parseInt(h.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export function voxelHash(a, b, c) {
  let h = (a * 374761393 + b * 668265263 + c * 1013904223) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/* phase 09 batch 1: a limb's points as [x, y, z, radius] in metres (x across, y depth, z up): its own list (pts, for a
   bent trunk or branch), else from (x, y, z) with radius r to (x2, y2, z2) with radius r1. A point may sit a little
   under the ground (a root going in). */
export function limbPoints(L) {
  if (Array.isArray(L.pts) && L.pts.length >= 2)
    return L.pts.map(q => [+q[0] || 0, +q[1] || 0, Math.max(-0.3, +q[2] || 0), Math.max(0.002, +q[3] || 0.05)]);
  const r0 = Math.max(L.r || 0.1, 0.002);
  return [
    [L.x || 0, L.y || 0, Math.max(-0.3, L.z || 0), r0],
    [L.x2 ?? (L.x || 0), L.y2 ?? (L.y || 0), Math.max(-0.3, L.z2 ?? (L.z || 0) + 1), Math.max(L.r1 ?? r0 * 0.7, 0.002)],
  ];
}
/* alpha 0.4: a voxel recipe's shapes as a low-poly model instead (Engine > World > "Props as low-poly"), painted with
   the buildings' 32 px textures like the airship and the houses: a box is a box, a cylinder, cone or barrel is turned
   with a few sides, a sphere is a small globe. Each recipe texture has its cell on the building sheet: wood is planks
   (along a board, up a post or a stave), stone is stone blocks (rough plaster on round stones), metal is metal seams,
   cloth is cloth, hay is thatch, leaves are moss, rust is rivets, stripes are stripes, rings are a cut log's rings
   (on the top), bark is bark (fissures along a trunk or branch), rock is rough rock. Recipes with imported voxels stay
   voxels. Phase 09 batch 1: a limb is a tapered branch from one point to another (x, y, z to x2, y2, z2; r at the
   start, r1 at the end), a dome is the top half of a sphere (a mossy roof); any round shape can take sides (how many
   faces round it), rings (a sphere's or dome's bands), lump (how uneven it is, as a leafy globe is) and facet (flat
   faces, for rocks). */
export const LOW_POLY_TEXTURE_CELLS = {
  plain: 15,
  wood: 14,
  grain: 0,
  stone: 3,
  metal: 12,
  cloth: 18,
  hay: 11,
  leaves: 16,
  rust: 19,
  stripes: 20,
  rings: 15,
  bark: 22,
  rock: 23,
  /* phase 09: the building sheet's own materials by name (buildings.js BUILDING_TEXTURE_NAMES) */
  plaster: 0,
  siding: 1,
  brick: 2,
  battens: 4,
  panels: 5,
  corrugated: 6,
  tilewall: 7,
  rooftiles: 8,
  shingles: 9,
  slate: 10,
  solar: 17,
  /* Buildings track BD-2a: the sheet's fourth row (tools/build-surfaces.py) */
  fishscale: 24,
  standingseam: 25,
  barreltile: 26,
  cob: 27,
  halftimber: 28,
  riveted: 29,
  glassblock: 30,
  mosaic: 31,
};
export function lowPolyFromRecipe(rec) {
  const V = [],
    I = [];
  let nv = 0;
  const T = (t, round) => (t === 'stone' && round ? 0 : (LOW_POLY_TEXTURE_CELLS[t || 'plain'] ?? 15));
  /* a window's glass (a layer's glass number, 1-31): its vertices carry the number, and each window its bounds */
  let gw = 0,
    /* BD-1: a glowing layer's code (logic/model-shapes.js glowCode): its flag and its colour's two bytes */
    gc = null;
  const GB = {};
  const vert = (p, n, uv, tex, c) => {
      V.push(p, n, uv, tex, c, gw, gc);
      return nv++;
    },
    poly = (P, N, UV, tex, c) => {
      const k = P.map((p, j) => vert(p, Array.isArray(N[0]) ? N[j] : N, UV[j], tex, c));
      for (let j = 1; j < k.length - 1; j++) I.push(k[0], k[j], k[j + 1]);
    };
  /* BD-1: a face's texture coordinates in world metres by which way it looks (as a box's: a side across and up, a top
     across and depth; wood up a tall post runs up) */
  const planarUV = (p, n, up) => {
    const ax = Math.abs(n[0]),
      ay = Math.abs(n[1]),
      az = Math.abs(n[2]),
      uv = ay >= ax && ay >= az ? [p[0], p[2]] : ax >= az ? [p[2], p[1]] : [p[0], p[1]];
    return up && ay < Math.max(ax, az) ? [uv[1], uv[0]] : uv;
  };
  /* a flat face's normal from its corners (by its diagonals), turned to face away from a point inside */
  const faceNormal = (Q, mid) => {
    const e1 = [Q[2][0] - Q[0][0], Q[2][1] - Q[0][1], Q[2][2] - Q[0][2]],
      e2 = [Q[3 % Q.length][0] - Q[1][0], Q[3 % Q.length][1] - Q[1][1], Q[3 % Q.length][2] - Q[1][2]],
      n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]],
      m = [0, 1, 2].map(k => Q.reduce((a, q) => a + q[k], 0) / Q.length - mid[k]);
    return n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0 ? [-n[0], -n[1], -n[2]] : n;
  };
  /* BD-1: a box as rings bottom to top: its outline at each height (narrowed toward taper, moved toward lean, its
     corners cut by bevel), flat sides between them, a flat top (and a bottom when it stands off the ground) */
  const boxRings = (L, ya, yb, tx, up, c) => {
    const w = L.w,
      d = L.d,
      h = yb - ya,
      tp = Array.isArray(L.taper) ? L.taper : null,
      tw = tp ? Math.max(0, +tp[0] || 0) : w,
      td = tp ? Math.max(0, +tp[1] || 0) : d,
      ln = Array.isArray(L.lean) ? [+L.lean[0] || 0, +L.lean[1] || 0] : [0, 0],
      b = Math.max(
        0,
        Math.min(+L.bevel || 0, 0.45 * Math.min(w, d, h), tp ? 0.45 * Math.max(Math.min(tw, td), 0) : 1e9)
      ),
      cx = L.x || 0,
      cz = L.y || 0,
      ring = (k, inset, y) => {
        const hx = Math.max(0, (w + (tw - w) * k) / 2 - inset),
          hz = Math.max(0, (d + (td - d) * k) / 2 - inset),
          ox = cx + ln[0] * k,
          oz = cz + ln[1] * k,
          e = Math.min(b, hx, hz);
        return (
          e > 0
            ? [
                [ox - hx + e, oz - hz],
                [ox + hx - e, oz - hz],
                [ox + hx, oz - hz + e],
                [ox + hx, oz + hz - e],
                [ox + hx - e, oz + hz],
                [ox - hx + e, oz + hz],
                [ox - hx, oz + hz - e],
                [ox - hx, oz - hz + e],
              ]
            : [
                [ox - hx, oz - hz],
                [ox + hx, oz - hz],
                [ox + hx, oz + hz],
                [ox - hx, oz + hz],
              ]
        ).map(q => [q[0], y, q[1]]);
      },
      RS = b > 0 ? [ring(0, 0, ya), ring((h - b) / h, 0, yb - b), ring(1, b, yb)] : [ring(0, 0, ya), ring(1, 0, yb)];
    for (let r = 0; r < RS.length - 1; r++) {
      const A = RS[r],
        B = RS[r + 1],
        n = A.length,
        k = (r + 0.5) / (RS.length - 1),
        mid = [cx + ln[0] * k, (A[0][1] + B[0][1]) / 2, cz + ln[1] * k];
      for (let j = 0; j < n; j++) {
        const Q = [A[j], A[(j + 1) % n], B[(j + 1) % n], B[j]],
          N = faceNormal(Q, mid);
        if (Math.hypot(N[0], N[1], N[2]) < 1e-12) continue;
        poly(
          Q,
          N,
          Q.map(q => planarUV(q, N, up)),
          tx,
          c
        );
      }
    }
    const top = RS[RS.length - 1];
    poly(
      top.slice().reverse(),
      [0, 1, 0],
      top
        .slice()
        .reverse()
        .map(q => [q[0], q[2]]),
      tx,
      c
    );
    if (ya > 0.01)
      poly(
        RS[0],
        [0, -1, 0],
        RS[0].map(q => [q[0], q[2]]),
        tx,
        c
      );
  };
  /* BD-1: a prism: a 2D profile (pts [[across, up], ...] from the layer's x and z, in the front plane) drawn out d
     deep about the layer's y; bend lifts its two ends by that many metres (a swoop along its length; segs steps).
     Sides shade flat at corners and round where the profile turns gently (under 25 degrees; smooth: every joint) */
  const prismShape = (L, x0, y0, z0, tx, c) => {
    let P = profilePoints(L.pts, true);
    if (P.length < 3) return;
    if (profileArea(P) < 0) P = P.reverse();
    const d = Math.max(0.01, +L.d || 1),
      bend = +L.bend || 0,
      segs = bend ? Math.max(1, Math.min(16, L.segs | 0 || 6)) : 1,
      lift = t => bend * ((2 * t) / d) ** 2,
      slope = t => (bend * 8 * t) / (d * d),
      NE = profileNormals(P, true, (25 * Math.PI) / 180, !!L.smooth),
      at = (q, t) => [x0 + q[0], z0 + q[1] + lift(t), y0 + t],
      nAt = (m, t) => [m[0], m[1], -slope(t) * m[1]],
      n = P.length;
    let len = 0;
    for (let i = 0; i < n; i++) {
      const a = P[i],
        b = P[(i + 1) % n],
        el = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let s = 0; s < segs; s++) {
        const t0 = -d / 2 + (d * s) / segs,
          t1 = -d / 2 + (d * (s + 1)) / segs;
        poly(
          [at(a, t0), at(b, t0), at(b, t1), at(a, t1)],
          [nAt(NE[i][0], t0), nAt(NE[i][1], t0), nAt(NE[i][1], t1), nAt(NE[i][0], t1)],
          [
            [t0, len],
            [t0, len + el],
            [t1, len + el],
            [t1, len],
          ],
          tx,
          c
        );
      }
      len += el;
    }
    for (const [t, nz] of [
      [-d / 2, -1],
      [d / 2, 1],
    ])
      for (const tri of earClip(P)) {
        const Q = (nz < 0 ? tri : tri.slice().reverse()).map(k => at(P[k], t));
        poly(
          Q,
          [0, 0, nz],
          Q.map(q => [q[0], q[1]]),
          tx,
          c
        );
      }
  };
  /* BD-1: a lathe: a profile (pts [[radius, up], ...] from the layer's z, listed from the bottom up along its
     outside) turned round the upright through x, y: sides round it, ry its depth over its width (an oval), rot its
     turn. Round around; along the profile soft under 35 degrees (smooth: every joint), else a sharp rim. A flat cap
     where an end has a radius (the bottom only off the ground) */
  const latheShape = (L, x0, y0, z0, tx, stave, c) => {
    let P = profilePoints(L.pts, false).map(q => [Math.max(0, q[0]), q[1]]);
    /* a profile that ends where it starts is a loop (a ring, a tyre): turned all round, no caps */
    const loop = P.length > 3 && Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) < 1e-6;
    if (loop) P.pop();
    if (P.length < 2) return;
    if ((loop ? profileArea(P) : profileArea([[0, P[0][1]], ...P, [0, P[P.length - 1][1]]])) < 0) P = P.reverse();
    const rmax = Math.max(0.01, ...P.map(q => q[0])),
      ryk = Math.max(0.05, +L.ry || 1),
      n = L.sides
        ? Math.max(3, Math.min(32, L.sides | 0))
        : Math.max(6, Math.min(20, Math.round((2 * Math.PI * rmax * Math.max(1, ryk) * 32) / 5))),
      rot = +L.rot || 0,
      arc = (2 * Math.PI * rmax) / n,
      NE = profileNormals(P, loop, (35 * Math.PI) / 180, !!L.smooth),
      an = j => (2 * Math.PI * (j % n)) / n + rot,
      at = (q, j) => [x0 + Math.cos(an(j)) * q[0], z0 + q[1], y0 + Math.sin(an(j)) * q[0] * ryk],
      nAt = (m, j) => [Math.cos(an(j)) * m[0], m[1], (Math.sin(an(j)) * m[0]) / ryk],
      uv = (j, v) => (stave ? [v, j * arc] : [j * arc, v]);
    let len = 0;
    for (let i = 0; i < P.length - (loop ? 0 : 1); i++) {
      const a = P[i],
        b = P[(i + 1) % P.length],
        el = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (a[0] < 1e-4 && b[0] < 1e-4) {
        len += el;
        continue;
      }
      for (let j = 0; j < n; j++)
        poly(
          [at(a, j), at(b, j), at(b, j + 1), at(a, j + 1)],
          [nAt(NE[i][0], j), nAt(NE[i][1], j), nAt(NE[i][1], j + 1), nAt(NE[i][0], j + 1)],
          [uv(j, len), uv(j, len + el), uv(j + 1, len + el), uv(j + 1, len)],
          tx,
          c
        );
      len += el;
    }
    const cap = (q, ny) => {
      const ct = [x0, z0 + q[1], y0];
      for (let j = 0; j < n; j++) {
        const A = at(q, j),
          B = at(q, j + 1),
          Q = ny > 0 ? [ct, B, A] : [ct, A, B];
        poly(
          Q,
          [0, ny, 0],
          Q.map(p => [p[0] - x0 + 1, p[2] - y0 + 1]),
          tx,
          c
        );
      }
    };
    const top = P[P.length - 1],
      bot = P[0];
    if (loop) return;
    if (top[0] > 0.02) cap(top, 1);
    if (bot[0] > 0.02 && z0 + bot[1] > 0.01) cap(bot, -1);
  };
  let li3 = 0;
  /* one layer's shape into V and I (BD-1: a function now, so each layer can be turned after it is made) */
  const layerShape = L => {
    const c = recipeRgb(L.col || '#888888'),
      t = L.tex || 'plain',
      x0 = L.x || 0,
      y0 = L.y || 0,
      z0 = Math.max(0, L.z || 0);
    if (L.k === 'box') {
      const xa = x0 - L.w / 2,
        xb = x0 + L.w / 2,
        ya = z0,
        yb = (L.z || 0) + L.h,
        za = y0 - L.d / 2,
        zb = y0 + L.d / 2,
        tx = T(t),
        up = (t === 'wood' || t === 'grain') && L.h >= Math.max(L.w, L.d),
        sw = (u, v) => (up ? [v, u] : [u, v]);
      if (yb <= ya) return;
      /* BD-1: a box tapered (taper: [top width, top depth]), leaned (lean: its top moved [across, depth]) or bevelled
         (bevel: its upright and top edges cut by that many metres) is made as rings, bottom to top */
      if (L.taper || L.lean || L.bevel) {
        boxRings(L, ya, yb, tx, up, c);
        return;
      }
      poly(
        [
          [xa, ya, zb],
          [xa, ya, za],
          [xa, yb, za],
          [xa, yb, zb],
        ],
        [-1, 0, 0],
        [sw(zb, ya), sw(za, ya), sw(za, yb), sw(zb, yb)],
        tx,
        c
      );
      poly(
        [
          [xb, ya, za],
          [xb, ya, zb],
          [xb, yb, zb],
          [xb, yb, za],
        ],
        [1, 0, 0],
        [sw(za, ya), sw(zb, ya), sw(zb, yb), sw(za, yb)],
        tx,
        c
      );
      poly(
        [
          [xa, yb, za],
          [xa, yb, zb],
          [xb, yb, zb],
          [xb, yb, za],
        ],
        [0, 1, 0],
        [
          [xa, za],
          [xa, zb],
          [xb, zb],
          [xb, za],
        ],
        tx,
        c
      );
      if (ya > 0.01)
        poly(
          [
            [xa, ya, za],
            [xb, ya, za],
            [xb, ya, zb],
            [xa, ya, zb],
          ],
          [0, -1, 0],
          [
            [xa, za],
            [xb, za],
            [xb, zb],
            [xa, zb],
          ],
          tx,
          c
        );
      poly(
        [
          [xa, ya, za],
          [xa, yb, za],
          [xb, yb, za],
          [xb, ya, za],
        ],
        [0, 0, -1],
        [sw(xa, ya), sw(xa, yb), sw(xb, yb), sw(xb, ya)],
        tx,
        c
      );
      poly(
        [
          [xb, ya, zb],
          [xb, yb, zb],
          [xa, yb, zb],
          [xa, ya, zb],
        ],
        [0, 0, 1],
        [sw(xb, ya), sw(xb, yb), sw(xa, yb), sw(xa, ya)],
        tx,
        c
      );
      return;
    }
    /* phase 09 batch 1: a limb, a tapered branch along a few points (up is the model's y here), with a few sides */
    if (L.k === 'limb') {
      const P = limbPoints(L).map(q => [q[0], q[2], q[1], q[3]]);
      if (P.length < 2) return;
      const cr = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]],
        nz = v => {
          const l = Math.hypot(v[0], v[1], v[2]) || 1;
          return [v[0] / l, v[1] / l, v[2] / l];
        },
        sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]],
        r0 = Math.max(P[0][3], 0.01),
        n = L.sides
          ? Math.max(3, Math.min(24, L.sides | 0))
          : Math.max(5, Math.min(10, Math.round((2 * Math.PI * r0 * 32) / 6))),
        tx = T(t, 1),
        arc = (2 * Math.PI * r0) / n;
      /* the direction at each point (along the bend), and a frame carried along it so the sides don't twist */
      const D = P.map((q, i) => nz(sub(P[Math.min(P.length - 1, i + 1)], P[Math.max(0, i - 1)]))),
        a0 = D[0];
      let u = nz(cr(a0, Math.abs(a0[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
      const G = [];
      let len = 0;
      for (let i = 0; i < P.length; i++) {
        const a = D[i];
        if (i) {
          len += Math.hypot(...sub(P[i], P[i - 1]));
          const k = u[0] * a[0] + u[1] * a[1] + u[2] * a[2];
          u = nz([u[0] - a[0] * k, u[1] - a[1] * k, u[2] - a[2] * k]);
        }
        const v = cr(a, u),
          rr = Math.max(P[i][3], 0.004),
          row = [];
        for (let j = 0; j <= n; j++) {
          const an = (2 * Math.PI * (j % n)) / n,
            c0 = Math.cos(an),
            sn = Math.sin(an),
            nr = [u[0] * c0 + v[0] * sn, u[1] * c0 + v[1] * sn, u[2] * c0 + v[2] * sn];
          row.push([[P[i][0] + nr[0] * rr, P[i][1] + nr[1] * rr, P[i][2] + nr[2] * rr], nr, len]);
        }
        G.push(row);
      }
      for (let i = 0; i < G.length - 1; i++)
        for (let j = 0; j < n; j++)
          poly(
            [G[i][j][0], G[i + 1][j][0], G[i + 1][j + 1][0], G[i][j + 1][0]],
            [G[i][j][1], G[i + 1][j][1], G[i + 1][j + 1][1], G[i][j + 1][1]],
            [
              [j * arc, G[i][j][2]],
              [j * arc, G[i + 1][j][2]],
              [(j + 1) * arc, G[i + 1][j][2]],
              [(j + 1) * arc, G[i][j][2]],
            ],
            tx,
            c
          );
      /* the end cap (the cut end of a branch shows rings when the texture is bark) */
      const E = P[P.length - 1],
        GE = G[G.length - 1],
        r1 = Math.max(E[3], 0.004);
      for (let j = 0; j < n; j++)
        poly(
          [E.slice(0, 3), GE[j + 1][0], GE[j][0]],
          D[D.length - 1],
          [
            [1, 1],
            [1 + Math.cos((2 * Math.PI * (j + 1)) / n) * r1, 1 + Math.sin((2 * Math.PI * (j + 1)) / n) * r1],
            [1 + Math.cos((2 * Math.PI * j) / n) * r1, 1 + Math.sin((2 * Math.PI * j) / n) * r1],
          ],
          tx,
          c
        );
      return;
    }
    if (L.k === 'prism') {
      prismShape(L, x0, y0, z0, T(t), c);
      return;
    }
    if (L.k === 'lathe') {
      latheShape(L, x0, y0, z0, T(t, 1), t === 'wood' || t === 'grain', c);
      return;
    }
    /* round shapes: rings up the shape, each its radius across (r) and in depth (ry) */
    const r = Math.max(L.r || 0.1, 0.01),
      ry = Math.max(L.ry || r, 0.01),
      h = L.h != null ? L.h : 2 * r,
      bu = L.bulge ?? 0.15,
      R = []; /* [height 0-1, radius 0-1] up the shape */
    if (L.k === 'cyl') R.push([0, 1], [1, 1]);
    else if (L.k === 'cone') R.push([0, 1], [1, (L.r1 || 0) / r]);
    else if (L.k === 'barrel')
      for (let i = 0; i <= 6; i++) {
        const k = i / 6;
        R.push([k, 1 - bu + bu * Math.sin(k * Math.PI) * 2 - bu]);
      }
    else if (L.k === 'dome') {
      const nb = Math.max(2, Math.min(12, L.rings || 5));
      for (let i = 0; i <= nb; i++) {
        const an = ((Math.PI / 2) * i) / nb;
        R.push([Math.sin(an), Math.cos(an)]);
      }
    } else {
      const nb = Math.max(2, Math.min(16, L.rings || 8));
      for (let i = 0; i <= nb; i++) {
        const k = (1 - Math.cos((Math.PI * i) / nb)) / 2;
        R.push([k, Math.sqrt(Math.max(0, 1 - (2 * k - 1) * (2 * k - 1)))]);
      }
    }
    const la = L.lump != null ? +L.lump : t === 'leaves' && L.k === 'sphere' ? 0.22 : 0,
      lumpy = la > 0,
      n = L.sides
        ? Math.max(3, Math.min(32, L.sides | 0))
        : Math.max(6, Math.min(lumpy ? 16 : 20, Math.round((2 * Math.PI * Math.max(r, ry) * 32) / 5))),
      tx = T(t, 1),
      stave = t === 'wood' || t === 'grain',
      NR = R.length;
    /* the grid of points: ring i, step j round it; leafy globes (bushes in their pots) get lumps, so they read as leaves, not balls */
    const G = [];
    for (let i = 0; i < NR; i++) {
      const [k, f] = R[i],
        y = Math.max(0, (L.z || 0) + k * h),
        row = [];
      for (let j = 0; j <= n; j++) {
        const a = (2 * Math.PI * (j % n)) / n + (+L.rot || 0),
          lu =
            lumpy && i > 0 && i < NR - 1
              ? 1 + la * (voxelHash(i * 7 + li3, j % n, 13) - 0.5) + la * 0.545 * Math.sin(a * 3 + i)
              : 1;
        /* phase 09: a cone may narrow differently in depth (ry1: its depth radius at the top), so a 4-sided cone
           turned by rot (pi/4) is a hip roof with a ridge */
        const fy = L.k === 'cone' && L.ry1 != null ? 1 - k + (k * L.ry1) / ry : f;
        row.push([x0 + Math.cos(a) * r * f * lu, y, y0 + Math.sin(a) * ry * fy * lu]);
      }
      G.push(row);
    }
    /* normals: the faces round each point, facing out from the shape's axis */
    const NM = G.map(row => row.map(() => [0, 0, 0])),
      addN = (i, j, v) => {
        const q = NM[i][j];
        q[0] += v[0];
        q[1] += v[1];
        q[2] += v[2];
      };
    for (let i = 0; i < NR - 1; i++)
      for (let j = 0; j < n; j++) {
        const a = G[i][j],
          b = G[i + 1][j],
          c = G[i + 1][j + 1],
          d = G[i][j + 1],
          u = [c[0] - a[0], c[1] - a[1], c[2] - a[2]],
          v = [d[0] - b[0], d[1] - b[1], d[2] - b[2]];
        let w = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const mx = (a[0] + c[0]) / 2 - x0,
          mz = (a[2] + c[2]) / 2 - y0,
          my = (a[1] + c[1]) / 2 - (G[i][0][1] + G[i + 1][0][1]) / 2;
        if (w[0] * mx + w[2] * mz + w[1] * my * 0.3 < 0) w = [-w[0], -w[1], -w[2]];
        addN(i, j, w);
        addN(i + 1, j, w);
        addN(i + 1, j + 1, w);
        addN(i, j + 1, w);
      }
    for (let i = 0; i < NR; i++) {
      const s0 = NM[i][0],
        s1 = NM[i][n];
      for (let q = 0; q < 3; q++) {
        s0[q] += s1[q];
        s1[q] = s0[q];
      }
    }
    for (let i = 0; i < NR; i++)
      for (let j = 0; j <= n; j++) {
        const q = NM[i][j];
        if (Math.hypot(q[0], q[1], q[2]) < 1e-9) {
          const p = G[i][j];
          q[0] = p[0] - x0;
          q[2] = p[2] - y0;
          q[1] = i === 0 ? -1 : i === NR - 1 ? 1 : 0;
        }
      }
    const arc = (2 * Math.PI * Math.max(r, ry)) / n;
    for (let i = 0; i < NR - 1; i++) {
      if (G[i + 1][0][1] <= 0) continue;
      const y0r = G[i][0][1],
        y1r = G[i + 1][0][1];
      for (let j = 0; j < n; j++) {
        const uv = (jj, yy) =>
          stave
            ? [yy, jj * arc]
            : [jj * arc, yy]; /* round by the angle: stripes run out from the middle, staves stay straight */
        const Q = [G[i][j], G[i + 1][j], G[i + 1][j + 1], G[i][j + 1]];
        let FN = null;
        if (L.facet) {
          /* flat faces (rocks): each quad lit by its own normal, pointing away from the shape's middle */
          const e1 = [Q[2][0] - Q[0][0], Q[2][1] - Q[0][1], Q[2][2] - Q[0][2]],
            e2 = [Q[3][0] - Q[1][0], Q[3][1] - Q[1][1], Q[3][2] - Q[1][2]];
          FN = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
          const mx = (Q[0][0] + Q[2][0]) / 2 - x0,
            my = (Q[0][1] + Q[2][1]) / 2 - ((L.z || 0) + h / 2),
            mz = (Q[0][2] + Q[2][2]) / 2 - y0;
          if (FN[0] * mx + FN[1] * my + FN[2] * mz < 0) FN = [-FN[0], -FN[1], -FN[2]];
        }
        poly(
          Q,
          FN || [NM[i][j], NM[i + 1][j], NM[i + 1][j + 1], NM[i][j + 1]],
          [uv(j, y0r), uv(j, y1r), uv(j + 1, y1r), uv(j + 1, y0r)],
          tx,
          c
        );
      }
    }
    const top = NR - 1,
      ft = R[top][1];
    if (ft > 0.02) {
      const ct = [x0, G[top][0][1], y0],
        tt = t === 'rings' ? 21 : tx;
      for (let j = 0; j < n; j++) {
        const a = G[top][j],
          b = G[top][j + 1];
        poly(
          [ct, b, a],
          [0, 1, 0],
          [
            [1, 1],
            [b[0] - x0 + 1, b[2] - y0 + 1],
            [a[0] - x0 + 1, a[2] - y0 + 1],
          ],
          tt,
          c
        );
      }
    }
    if (G[0][0][1] > 0.01 && R[0][1] > 0.02) {
      const cb = [x0, G[0][0][1], y0];
      for (let j = 0; j < n; j++) {
        const a = G[0][j],
          b = G[0][j + 1];
        poly(
          [cb, a, b],
          [0, -1, 0],
          [
            [1, 1],
            [a[0] - x0 + 1, a[2] - y0 + 1],
            [b[0] - x0 + 1, b[2] - y0 + 1],
          ],
          tx,
          c
        );
      }
    }
  };
  /* the still parts' bounds (the warp is measured against them, logic/model-shapes.js warpFrame) */
  const SB = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
  for (const L of rec.layers || []) {
    li3 += 31;
    if (L.k === 'img' || L.hide || L.k === 'raw') continue;
    gw = L.glass > 0 ? Math.min(31, L.glass | 0) : 0;
    gc = gw ? null : glowCode(L);
    const s0 = nv;
    layerShape(L);
    /* BD-1: the part turned (rot: a box, a limb or a prism; a round shape or a lathe turns itself) and leaned (tilt,
       every solid), about its base point; its normals with it */
    const R = layerTurn(L.k === 'box' || L.k === 'limb' || L.k === 'prism' ? L.rot : 0, L.tilt, [
      L.x || 0,
      L.k === 'limb' ? L.z || 0 : Math.max(0, L.z || 0),
      L.y || 0,
    ]);
    for (let i = s0; i < nv; i++) {
      if (R) {
        V[i * 7] = R(V[i * 7], false);
        V[i * 7 + 1] = R(V[i * 7 + 1], true);
      }
      if (!L.spin) {
        const p = V[i * 7];
        for (let q = 0; q < 3; q++) {
          SB[q] = Math.min(SB[q], p[q]);
          SB[q + 3] = Math.max(SB[q + 3], p[q]);
        }
      }
    }
  }
  if (!nv) return null;
  /* BD-1: the recipe's warp (the storybook wonk), baked into every point and normal by height; a turning part's
     pivot is moved, not bent (propModelMesh: rec.move), so its mesh moves with it */
  const WP = warpOn(rec.warp) ? rec.warp : null,
    WF = WP ? rec.warpFrame || warpFrame(SB[0] < 1e9 ? SB : [0, 0, 0, 0, 1, 0]) : null;
  if (WP)
    for (let i = 0; i < nv; i++) {
      const p = V[i * 7];
      V[i * 7 + 1] = warpNormal(WP, WF, p, V[i * 7 + 1]);
      V[i * 7] = warpPoint(WP, WF, p);
    }
  const MV = Array.isArray(rec.move) ? rec.move : null;
  if (MV) for (let i = 0; i < nv; i++) V[i * 7] = [V[i * 7][0] + MV[0], V[i * 7][1] + MV[1], V[i * 7][2] + MV[2]];
  /* a window's glass bounds, where its points ended up */
  for (let i = 0; i < nv; i++) {
    const g = V[i * 7 + 5],
      p = V[i * 7];
    if (!g) continue;
    const b = GB[g] || (GB[g] = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]);
    for (let q = 0; q < 3; q++) {
      b[q] = Math.min(b[q], p[q]);
      b[q + 3] = Math.max(b[q + 3], p[q]);
    }
  }
  /* packed as the models are (24 bytes a vertex) */
  const vb = new ArrayBuffer(nv * 24),
    i16 = new Int16Array(vb),
    i8 = new Int8Array(vb),
    u8 = new Uint8Array(vb);
  let x0 = 1e9,
    y0 = 1e9,
    z0 = 1e9,
    x1 = -1e9,
    y1 = -1e9,
    z1 = -1e9;
  for (let i = 0; i < nv; i++) {
    const p = V[i * 7],
      nn = V[i * 7 + 1],
      uv = V[i * 7 + 2],
      tx = V[i * 7 + 3],
      c = V[i * 7 + 4],
      g = V[i * 7 + 5],
      gl = V[i * 7 + 6],
      o = i * 24,
      l = Math.hypot(nn[0], nn[1], nn[2]) || 1;
    i16[o / 2] = Math.round(p[0] * 256);
    i16[o / 2 + 1] = Math.round(p[1] * 256);
    i16[o / 2 + 2] = Math.round(p[2] * 256);
    x0 = Math.min(x0, p[0]);
    x1 = Math.max(x1, p[0]);
    y0 = Math.min(y0, p[1]);
    y1 = Math.max(y1, p[1]);
    z0 = Math.min(z0, p[2]);
    z1 = Math.max(z1, p[2]);
    i8[o + 8] = Math.round((nn[0] / l) * 127);
    i8[o + 9] = Math.round((nn[1] / l) * 127);
    i8[o + 10] = Math.round((nn[2] / l) * 127);
    i16[o / 2 + 6] = Math.round(uv[0] * 64);
    i16[o / 2 + 7] = Math.round(uv[1] * 64);
    u8[o + 16] = tx % 8;
    u8[o + 17] = (tx / 8) | 0;
    /* 0 the building ramp, 1 its flat colour (a building's own mesh), 2-32 window glass 1-31; BD-1: 33 a glow at
       night, 34 a glow by day too, its colour (5-6-5 bits) in the two spare bytes (19, and the colour's alpha) */
    u8[o + 18] = g ? g + 1 : gl ? gl.flag : 0;
    u8[o + 19] = gl ? gl.hi : 0;
    u8[o + 20] = c[0];
    u8[o + 21] = c[1];
    u8[o + 22] = c[2];
    u8[o + 23] = gl ? gl.lo : 255;
  }
  /* each window: its number, its middle and which way it looks out (x, up, depth: along its thin side, away from the
     model's middle) */
  const mx = (x0 + x1) / 2,
    mz = (z0 + z1) / 2,
    wins = Object.entries(GB).map(([id, b]) => {
      const c = [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2],
        side = b[3] - b[0] < b[5] - b[2];
      return {
        id: +id,
        p: c,
        n: side ? [Math.sign(c[0] - mx) || 1, 0, 0] : [0, 0, Math.sign(c[2] - mz) || -1],
      };
    });
  return {
    vb,
    ib: nv > 65535 ? new Uint32Array(I) : new Uint16Array(I),
    n: I.length,
    tris: I.length / 3,
    box: [x0, y0, z0, x1, y1, z1],
    wins,
    /* BD-1: the warp's frame (a turning part is moved by it) and whether any layer glows */
    warpFrame: WF,
    glow: V.some((v, i) => i % 7 === 6 && !!v),
  };
}
