// @ts-check
'use strict';
/* ================= SHAFT PICK (smart light shafts) =================
   Where the cheap light shafts go (walk/effects.js, Engine > Air "Smart light shafts"), as plain numbers
   (tools/test/shaft-pick.test.mjs). Each shaft is one additive quad, so the cost is its pixels: a few well placed
   beams instead of one at every other tree.
   - Candidates (made by the caller from the frame's items): tree crowns, the gaps between two crowns, the sunny
     corners of buildings' roofs, and a place's own `shafts` list.
   - A beam reads only against shade behind it, so the ground round its foot should lie in the shadow of the crowns
     and roofs near it (worked out here from their circles, no shadow map read back). Beams are strongest looking
     into the light (forward scattering: a Henyey-Greenstein weight on the view and the sun), near where the camera
     looks (counted from you: the walk camera stands 35-60 m back), not right at the camera, and never over you.
   - Picked greedily by score, apart in the world and on screen, up to a count and a share of the screen they may
     cover; a beam already showing keeps its place unless another scores clearly better, so nothing pops. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  SHAFT_HOLD: [() => SHAFT_HOLD],
  SHAFT_KIND_WEIGHT: [() => SHAFT_KIND_WEIGHT],
  // @ts-expect-error -- replaced on purpose
  crownGaps: [() => crownGaps, v => (crownGaps = v)],
  // @ts-expect-error -- replaced on purpose
  footShade: [() => footShade, v => (footShade = v)],
  // @ts-expect-error -- replaced on purpose
  forwardScatter: [() => forwardScatter, v => (forwardScatter = v)],
  // @ts-expect-error -- replaced on purpose
  inShade: [() => inShade, v => (inShade = v)],
  // @ts-expect-error -- replaced on purpose
  pickShafts: [() => pickShafts, v => (pickShafts = v)],
  // @ts-expect-error -- replaced on purpose
  projectNdc: [() => projectNdc, v => (projectNdc = v)],
  // @ts-expect-error -- replaced on purpose
  screenLineGap: [() => screenLineGap, v => (screenLineGap = v)],
  // @ts-expect-error -- replaced on purpose
  shaftStep: [() => shaftStep, v => (shaftStep = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @typedef {{ key: string, x: number, z: number, top: number, w: number, kind: 'crown' | 'gap' | 'roof' | 'list', k?: number }} ShaftCand */
/** @typedef {{ x: number, z: number, y: number, r: number }} ShaftBlocker */
/** @typedef {{ key: string, x: number, z: number, top: number, w: number, len: number, score: number, kind: string, cover: number, sx: number }} ShaftPick */

/* how much each kind of beam starts with (a place's own list is the designer's word) */
export const SHAFT_KIND_WEIGHT = { crown: 0.8, gap: 1, roof: 0.85, list: 1.25 };
/* a shaft already showing stays unless a new one scores this much more */
export const SHAFT_HOLD = 1.3;

/* the forward-scattering weight: 1 looking across the light, more looking into it, less with it behind you */
export function forwardScatter(cos, g = 0.5) {
  const hg = c => (1 - g * g) / Math.pow(1 + g * g - 2 * g * c, 1.5);
  return Math.min(2.5, Math.max(0.35, hg(cos) / hg(0)));
}
/* a point through a column-major view-projection matrix: [x, y] in -1..1 on screen, or null behind the camera */
export function projectNdc(m, x, y, z) {
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (w <= 0.01) return null;
  return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w];
}
/* is the ground point (x, ground y, z) shaded by one of the blockers? Seen from the point toward the sun (sun: unit
   vector to it), the line passes each blocker's middle height; inside its circle there means shade */
export function inShade(x, y, z, sun, blockers) {
  if (sun[1] <= 0.02) return true;
  for (const b of blockers) {
    const t = (b.y - y) / sun[1];
    if (t <= 0) continue;
    if (Math.hypot(x + sun[0] * t - b.x, z + sun[2] * t - b.z) < b.r) return true;
  }
  return false;
}
/* the share (0-1) of four ground points round a beam's foot that lie in shade: how dark its backdrop is */
export function footShade(x, y, z, w, sun, blockers) {
  const r = Math.max(1.2, w * 1.2);
  let n = 0;
  for (const [dx, dz] of [
    [r, 0],
    [-r, 0],
    [0, r],
    [0, -r],
  ])
    if (inShade(x + dx, y, z + dz, sun, blockers)) n++;
  return n / 4;
}
/* the gaps between crowns: between two crowns whose edges stand 0.5-4.5 m apart, about as wide as half that space; the
   caller adds them to the candidates */
export function crownGaps(crowns, max = 40) {
  /** @type {ShaftCand[]} */
  const out = [];
  for (let i = 0; i < crowns.length && out.length < max; i++)
    for (let j = i + 1; j < crowns.length && out.length < max; j++) {
      const a = crowns[i],
        b = crowns[j],
        gap = Math.hypot(a.x - b.x, a.z - b.z) - a.r - b.r;
      if (gap < 0.5 || gap > 4.5) continue;
      out.push({
        key: `g:${a.key}|${b.key}`,
        x: (a.x * b.r + b.x * a.r) / (a.r + b.r),
        z: (a.z * b.r + b.z * a.r) / (a.r + b.r),
        top: Math.min(a.top, b.top) - Math.min(a.r, b.r) * 0.5,
        w: Math.min(2.4, Math.max(0.8, gap * 0.6)),
        kind: 'gap',
      });
    }
  return out;
}
/**
 * the shafts to draw this moment, best first.
 * @param {ShaftCand[]} cands
 * @param {{ eye: number[], vp: ArrayLike<number>, sun: number[], player?: number[] | null, focus?: number[] | null,
 *   ground: (x: number, z: number) => number, blockers: ShaftBlocker[], keep?: Set<string>, max?: number, cover?: number,
 *   range?: number }} o
 *   sun: the unit vector toward the sun; focus: where the camera looks (you; the walk camera stands 35-60 m back), the
 *   range is counted from it; ground(x, z): the ground's height; keep: the keys showing now
 * @returns {ShaftPick[]}
 */
export function pickShafts(cands, o) {
  const { eye, vp, sun, blockers } = o,
    max = o.max ?? 5,
    coverMax = o.cover ?? 0.25,
    range = o.range ?? 30,
    keep = o.keep || new Set(),
    fc = o.focus || o.player || eye,
    up = sun[1],
    pl = o.player ? projectNdc(vp, o.player[0], o.player[1] + 0.9, o.player[2]) : null;
  if (up <= 0.03 || max <= 0) return [];
  /** @type {ShaftPick[]} */
  const scored = [];
  for (const c of cands) {
    const g = o.ground(c.x, c.z),
      top = Math.max(1.5, c.top - g),
      len = Math.min(14, top / Math.max(0.25, up)),
      /* the beam runs from the top down the light: travel = -sun */
      fx = c.x - sun[0] * len,
      fz = c.z - sun[2] * len,
      mx = c.x - sun[0] * len * 0.5,
      my = g + top - up * len * 0.5,
      mz = c.z - sun[2] * len * 0.5,
      vx = mx - eye[0],
      vy = my - eye[1],
      vz = mz - eye[2],
      dc = Math.hypot(vx, vy, vz),
      df = Math.hypot(mx - fc[0], mz - fc[2]);
    if (dc < 4 || df > range) continue;
    const s = projectNdc(vp, mx, my, mz);
    if (!s || Math.abs(s[0]) > 1.05 || Math.abs(s[1]) > 1.05) continue;
    /* its size on screen: from its top to its foot, and across */
    const a = projectNdc(vp, c.x, g + top, c.z),
      b = projectNdc(vp, fx, o.ground(fx, fz), fz);
    if (!a || !b) continue;
    const lenN = Math.hypot(a[0] - b[0], a[1] - b[1]),
      widN = (c.w / dc) * 2.4,
      cover = (lenN * widN) / 4;
    let k =
      (SHAFT_KIND_WEIGHT[c.kind] ?? 1) *
      (c.k ?? 1) *
      (0.3 + 0.7 * footShade(fx, o.ground(fx, fz), fz, c.w, sun, blockers)) *
      forwardScatter((vx * sun[0] + vy * sun[1] + vz * sun[2]) / dc) *
      shaftStep(4, 8, dc) *
      (1 - shaftStep(range * 0.6, range, df));
    /* never across you: a beam whose line on screen passes close to you counts for little */
    if (pl && screenLineGap(pl, a, b) < 0.12) k *= 0.15;
    if (keep.has(c.key)) k *= SHAFT_HOLD;
    if (k > 0.05)
      scored.push({ key: c.key, x: c.x, z: c.z, top, w: c.w, len, score: k, kind: c.kind, cover, sx: s[0] });
  }
  scored.sort((p, q) => q.score - p.score || (p.key < q.key ? -1 : 1));
  /** @type {ShaftPick[]} */
  const out = [];
  let covered = 0;
  for (const p of scored) {
    if (out.length >= max) break;
    if (covered + p.cover > coverMax) continue;
    if (out.some(q => Math.hypot(q.x - p.x, q.z - p.z) < 3 || Math.abs(q.sx - p.sx) < 0.24)) continue;
    covered += p.cover;
    out.push(p);
  }
  return out;
}
export function shaftStep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
/* the distance on screen from the point p to the segment a-b */
export function screenLineGap(p, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    l = dx * dx + dy * dy,
    t = l > 0 ? Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0;
  return Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1]);
}
