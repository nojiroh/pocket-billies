// @ts-check
'use strict';
/* ================= THE SEA ALL ROUND (island track IS-3) =================
   The open sea past a scene's edges, out to the horizon: one skirt of rings round the scene's rectangle (walk/
   ground-mesh.js builds its mesh from this; the water shader draws it). The inner ring lies on the scene's edge,
   a vertex every half metre, the same corners as the water cells there, so the skirt and the scene's own water meet
   without a seam; its depth starts at the depth of the water beside it and deepens to the open sea's over SEA_RAMP
   metres. The swell rolls in toward seaCentre from every side; a cove (a zone of kind `cove`) is calm.
   Logic only: no DOM, no game data, runs in Node (tools/test/sea.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { islandPointIn } from './island.js';
/* eslint-disable no-func-assign */
expose({
  SEA_CORNER: [() => SEA_CORNER],
  SEA_POLY_BOX: [() => SEA_POLY_BOX],
  SEA_RAMP: [() => SEA_RAMP],
  SEA_RINGS: [() => SEA_RINGS],
  // @ts-expect-error -- replaced on purpose
  seaCalmAt: [() => seaCalmAt, v => (seaCalmAt = v)],
  // @ts-expect-error -- replaced on purpose
  seaCentre: [() => seaCentre, v => (seaCentre = v)],
  // @ts-expect-error -- replaced on purpose
  seaPolyBox: [() => seaPolyBox, v => (seaPolyBox = v)],
  // @ts-expect-error -- replaced on purpose
  seaPolyDist: [() => seaPolyDist, v => (seaPolyDist = v)],
  // @ts-expect-error -- replaced on purpose
  seaRamp: [() => seaRamp, v => (seaRamp = v)],
  // @ts-expect-error -- replaced on purpose
  seaSkirt: [() => seaSkirt, v => (seaSkirt = v)],
  seaSmooth: [() => seaSmooth],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** how far out each ring lies from the scene's edge, metres (the camera sees 420 m: the last ring is past the fog; close
   enough that the world's curve, worked out at each vertex, bends smoothly) */
export const SEA_RINGS = [
  0, 0.5, 1, 2, 3.5, 6, 10, 16, 25, 33, 42, 52, 64, 78, 95, 115, 140, 170, 205, 245, 290, 340, 400,
];
/** metres from the scene's edge over which the skirt deepens from the edge's water to the open sea's */
export const SEA_RAMP = 25;
/* points on each corner's quarter circle (the rings round off there) */
export const SEA_CORNER = 8;

export const seaSmooth = t => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/** the depth (0 shallow ... 1 deep) at `o` metres out from an edge whose water is `edge` deep */
export function seaRamp(edge, o) {
  const e = Math.min(1, Math.max(0, edge));
  return e + (1 - e) * seaSmooth(o / SEA_RAMP);
}

/** the point the swell rolls in toward: the island's middle, else the orbit's pivot, else the scene's middle */
export function seaCentre(sc) {
  const c = (sc.island && sc.island.c) || (sc.cam && sc.cam.orbit && sc.cam.orbit.c);
  return c ? [c[0], c[1]] : [sc.w / 2, sc.h / 2];
}

/* the distance from (x, z) to the polygon's outline */
export function seaPolyDist(poly, x, z) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j],
      [bx, bz] = poly[i],
      dx = bx - ax,
      dz = bz - az,
      L = dx * dx + dz * dz,
      t = L ? Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / L)) : 0;
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

export const SEA_POLY_BOX = new WeakMap();
/** a polygon's bounds [x0, z0, x1, z1], kept with it @param {number[][]} poly @returns {number[]} */
export function seaPolyBox(poly) {
  let b = SEA_POLY_BOX.get(poly);
  if (!b) {
    b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [px, pz] of poly) b = [Math.min(b[0], px), Math.min(b[1], pz), Math.max(b[2], px), Math.max(b[3], pz)];
    SEA_POLY_BOX.set(poly, b);
  }
  return b;
}

/** how calm the water is at (x, z): 1 inside a cove zone, easing to 0 over `soft` metres outside it, else 0 */
export function seaCalmAt(sc, x, z, soft = 6) {
  let k = 0;
  for (const zn of sc.zones || []) {
    if (!zn || zn.k !== 'cove' || !Array.isArray(zn.poly) || zn.poly.length < 3) continue;
    /* IS-5: asked for every water vertex of a scene: most are nowhere near the cove */
    const b = seaPolyBox(zn.poly);
    if (x < b[0] - soft || x > b[2] + soft || z < b[1] - soft || z > b[3] + soft) continue;
    if (islandPointIn(zn.poly, x, z)) return 1;
    k = Math.max(k, 1 - seaSmooth(seaPolyDist(zn.poly, x, z) / soft));
  }
  return k;
}

/**
 * The skirt round a w x h scene: ring after ring (SEA_RINGS) out from its edge.
 * edgeDep(x, z) gives the depth of the scene's water at a point on its edge (0 where land meets the edge).
 * Returns per vertex x, z, its distance out (o) and depth (dep), and the triangles (the same turn as the scene's
 * water quads), with n vertices to a ring.
 * @param {number} w
 * @param {number} h
 * @param {(x: number, z: number) => number} edgeDep
 * @param {number[]} [rings]
 */
export function seaSkirt(w, h, edgeDep, rings = SEA_RINGS) {
  /* the inner ring: each side from its starting corner (a fan of directions turning from the last side's outward
     normal to this one's), then a point every half metre along it */
  const sides = [
      { a: [0, 0], d: [1, 0], L: w, n: [0, -1] },
      { a: [w, 0], d: [0, 1], L: h, n: [1, 0] },
      { a: [w, h], d: [-1, 0], L: w, n: [0, 1] },
      { a: [0, h], d: [0, -1], L: h, n: [-1, 0] },
    ],
    base = [];
  for (let s = 0; s < 4; s++) {
    const S = sides[s],
      P = sides[(s + 3) % 4],
      a0 = Math.atan2(P.n[1], P.n[0]);
    let a1 = Math.atan2(S.n[1], S.n[0]);
    while (a1 < a0) a1 += 2 * Math.PI;
    for (let c = 0; c <= SEA_CORNER; c++) {
      const a = a0 + ((a1 - a0) * c) / SEA_CORNER;
      base.push([S.a[0], S.a[1], Math.cos(a), Math.sin(a)]);
    }
    const steps = Math.max(1, Math.round(S.L * 2));
    for (let k = 1; k < steps; k++) {
      const t = (S.L * k) / steps;
      base.push([S.a[0] + S.d[0] * t, S.a[1] + S.d[1] * t, S.n[0], S.n[1]]);
    }
  }
  const n = base.length,
    R = rings.length,
    x = new Float32Array(n * R),
    z = new Float32Array(n * R),
    o = new Float32Array(n * R),
    dep = new Float32Array(n * R),
    e0 = base.map(([bx, bz]) => edgeDep(bx, bz));
  for (let r = 0; r < R; r++)
    for (let i = 0; i < n; i++) {
      const [bx, bz, dx, dz] = base[i],
        q = r * n + i;
      x[q] = bx + dx * rings[r];
      z[q] = bz + dz * rings[r];
      o[q] = rings[r];
      dep[q] = seaRamp(e0[i], rings[r]);
    }
  const idx = new Uint32Array((R - 1) * n * 6);
  let m = 0;
  for (let r = 0; r + 1 < R; r++)
    for (let i = 0; i < n; i++) {
      const a = r * n + i,
        b = r * n + ((i + 1) % n),
        c = a + n,
        d = b + n;
      /* the same turn as the scene's water quads, (x0,z0) -> (x0,z1) -> (x1,z0) (the rings run anticlockwise in x, z) */
      idx[m++] = a;
      idx[m++] = b;
      idx[m++] = c;
      idx[m++] = b;
      idx[m++] = d;
      idx[m++] = c;
    }
  return { n, rings: R, x, z, o, dep, idx };
}
