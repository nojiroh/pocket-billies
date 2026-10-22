// @ts-check
'use strict';
/* ================= ISLAND CONTRACT (island track IS-0) =================
   The map fields the island sessions share (docs/phases/island-track.md, "The contract"), all optional:
     cam.orbit  { c: [x, z], dead, lag, turn }  the orbit camera's pivot; inside `dead` metres of it the yaw holds;
                `lag` seconds for the yaw to follow; `turn` degrees the player may still turn it (IS-1)
     island     { c: [x, z], coast: [[x, z], ...] }  the coastline, a closed polygon (the last point joins the first)
     zones      [{ k, poly, lock }]  k one of ISLAND_ZONE_KINDS; a locked zone's ground and props are never touched
                when the island is made again (IS-2, IS-6)
     islandGen  { v, seed, dials }  the generator's version, seed and dials, so the ground can be made again (IS-2)
   map.schema.json checks the shapes; islandProblems the rest (inside the scene, closed, no crossing, a sea round an
   island). Logic only: no DOM, no game data of its own, runs in Node (tools/check-data.mjs, tools/test). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  ISLAND_WATER: [() => ISLAND_WATER],
  ISLAND_ZONE_KINDS: [() => ISLAND_ZONE_KINDS],
  // @ts-expect-error -- replaced on purpose
  islandCrosses: [() => islandCrosses, v => (islandCrosses = v)],
  // @ts-expect-error -- replaced on purpose
  islandPointIn: [() => islandPointIn, v => (islandPointIn = v)],
  // @ts-expect-error -- replaced on purpose
  islandPolyProblems: [() => islandPolyProblems, v => (islandPolyProblems = v)],
  // @ts-expect-error -- replaced on purpose
  islandProblems: [() => islandProblems, v => (islandProblems = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const ISLAND_ZONE_KINDS = ['town', 'barn', 'pasture', 'forest', 'mountain', 'cove', 'beach', 'path'];
/* the ground letters that are water (walk-view.js navGrid, mapgen MAPGEN_WET) */
export const ISLAND_WATER = 'wd';

/** is the point (x, z) inside the closed polygon? (even-odd rule) */
export function islandPointIn(poly, x, z) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i],
      [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/* do segments a-b and c-d cross (touching ends of neighbours aside)? */
export function islandCrosses(a, b, c, d) {
  const side = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

/* what is wrong with a closed polygon: too few points, a point off the scene, a repeated first point, a crossing */
export function islandPolyProblems(sc, poly, what) {
  const out = [],
    pt = p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);
  if (!Array.isArray(poly) || poly.length < 3 || !poly.every(pt)) return [`${what} is not 3 or more [x, z] points`];
  const off = poly.find(p => p[0] < 0 || p[1] < 0 || p[0] > sc.w || p[1] > sc.h);
  if (off) out.push(`${what} has a point off the scene (${off[0]}, ${off[1]})`);
  const a = poly[0],
    z = poly[poly.length - 1];
  if (a[0] === z[0] && a[1] === z[1])
    out.push(`${what} repeats its first point at the end (the last point joins the first by itself)`);
  const n = poly.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (islandCrosses(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) {
        out.push(`${what} crosses itself (sides ${i} and ${j})`);
        return out;
      }
    }
  return out;
}

/** what is wrong with a map's island fields (cam.orbit, island, zones, islandGen), in words; [] when all is well */
export function islandProblems(sc) {
  const out = [],
    on = p => Array.isArray(p) && p[0] >= 0 && p[1] >= 0 && p[0] <= sc.w && p[1] <= sc.h,
    xz = p => (Array.isArray(p) ? `(${p[0]}, ${p[1]})` : JSON.stringify(p)),
    O = sc.cam && sc.cam.orbit;
  if (O && typeof O === 'object') {
    if (!on(O.c)) out.push(`cam.orbit.c ${xz(O.c)} is off the scene`);
    if (!(O.dead >= 0 && O.dead < Math.min(sc.w, sc.h) / 2))
      out.push(`cam.orbit.dead ${O.dead} m is not from 0 to under half the scene's shorter side`);
    if (!(O.lag > 0 && O.lag <= 10)) out.push(`cam.orbit.lag ${O.lag} s is not above 0 and at most 10`);
    if (!(O.turn >= 0 && O.turn <= 180)) out.push(`cam.orbit.turn ${O.turn} degrees is not from 0 to 180`);
  }
  const I = sc.island;
  if (I && typeof I === 'object') {
    const bad = islandPolyProblems(sc, I.coast, 'island.coast');
    out.push(...bad);
    if (!on(I.c)) out.push(`island.c ${xz(I.c)} is off the scene`);
    else if (!bad.length && !islandPointIn(I.coast, I.c[0], I.c[1]))
      out.push(`island.c ${xz(I.c)} is not inside the coast`);
    if (!ISLAND_WATER.includes(sc.edge)) out.push(`an island's edge is ${JSON.stringify(sc.edge)}, not water (w or d)`);
  }
  (Array.isArray(sc.zones) ? sc.zones : []).forEach((Z, i) => {
    if (!Z || typeof Z !== 'object') return void out.push(`zones[${i}] is not a zone`);
    const what = `zones[${i}] (${Z.k})`;
    if (!ISLAND_ZONE_KINDS.includes(Z.k)) out.push(`${what}: no such zone kind (${ISLAND_ZONE_KINDS.join(', ')})`);
    out.push(...islandPolyProblems(sc, Z.poly, what));
  });
  return out;
}
