// @ts-check
'use strict';
/* ================= THE PASTURE (island track IS-8) =================
   The fenced pasture by Copperleaf's barn. The map's `pasture` zone is the field; its fence follows the zone's outline,
   lightly smoothed (HB-6: it bends as the zone does; IS-8 made it a few straight sides) and set a little inside it. The build tool
   (tools/build-pasture.mjs) lays the fence along that line, and the game lets up to rules.ranch.pasture of the ranch's
   Billies wander a little inside it: the same line from the same zone, so the two always agree.
   Who wanders: Billies at home and not on the team (storage, saveData.box), the trainees first, then the highest
   levels; never your buddy. Where: a point inside the wander line that a straight walk reaches without crossing the
   line or bumping into the trough or the hay.
   Logic only: no DOM, runs in Node (tools/test/pasture.test.mjs). */
/** @import { Billy, SaveData } from '../../types/save-data' */
/** @typedef {[number, number]} Pt */
/** @typedef {[number, number, number]} Round  x, z and a radius: something a Billie walks round */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  PASTURE_FENCE_IN: [() => PASTURE_FENCE_IN],
  PASTURE_ROAM_IN: [() => PASTURE_ROAM_IN],
  PASTURE_SMOOTH: [() => PASTURE_SMOOTH],
  // @ts-expect-error -- replaced on purpose
  pastureArea2: [() => pastureArea2, v => (pastureArea2 = v)],
  // @ts-expect-error -- replaced on purpose
  pastureBillies: [() => pastureBillies, v => (pastureBillies = v)],
  // @ts-expect-error -- replaced on purpose
  pastureClear: [() => pastureClear, v => (pastureClear = v)],
  pastureFenceLine: [() => pastureFenceLine],
  // @ts-expect-error -- replaced on purpose
  pastureIn: [() => pastureIn, v => (pastureIn = v)],
  // @ts-expect-error -- replaced on purpose
  pastureInset: [() => pastureInset, v => (pastureInset = v)],
  // @ts-expect-error -- replaced on purpose
  pastureResample: [() => pastureResample, v => (pastureResample = v)],
  pastureRoamLine: [() => pastureRoamLine],
  // @ts-expect-error -- replaced on purpose
  pastureSegDist: [() => pastureSegDist, v => (pastureSegDist = v)],
  // @ts-expect-error -- replaced on purpose
  pastureSmooth: [() => pastureSmooth, v => (pastureSmooth = v)],
  // @ts-expect-error -- replaced on purpose
  pastureSpot: [() => pastureSpot, v => (pastureSpot = v)],
  // @ts-expect-error -- replaced on purpose
  pastureWander: [() => pastureWander, v => (pastureWander = v)],
  // @ts-expect-error -- replaced on purpose
  pastureZone: [() => pastureZone, v => (pastureZone = v)],
  round2: [() => round2],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** how far inside the zone's outline the fence runs, and how far inside the fence a Billie keeps (m) */
export const PASTURE_FENCE_IN = 1.2,
  PASTURE_ROAM_IN = 1.1,
  /** HB-6: how far along the zone's outline its smoothing reaches (m): a light smoothing, its bends kept */
  PASTURE_SMOOTH = 4;

/** the map's pasture zone's outline, or null
 * @param {any} sc @returns {Pt[] | null} */
export function pastureZone(sc) {
  const Z = sc && Array.isArray(sc.zones) ? sc.zones.find(/** @param {any} z */ z => z && z.k === 'pasture') : null;
  return Z && Array.isArray(Z.poly) && Z.poly.length >= 3 ? Z.poly : null;
}

/** twice the signed area: above 0 when the points go round anticlockwise (x right, z up)
 * @param {Pt[]} poly */
export function pastureArea2(poly) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  return a;
}

/** is (x, z) inside the outline? (even-odd)
 * @param {Pt[]} poly @param {number} x @param {number} z */
export function pastureIn(poly, x, z) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[i],
      [bx, bz] = poly[j];
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) c = !c;
  }
  return c;
}

/** how far (x, z) is from the segment a-b
 * @param {Pt} a @param {Pt} b @param {number} x @param {number} z */
export function pastureSegDist(a, b, x, z) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    L2 = dx * dx + dz * dz || 1,
    t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
  return Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z);
}

/** the outline walked round at even steps of about `step` m (closed: the last point is followed by the first)
 * @param {Pt[]} poly @param {number} step @returns {Pt[]} */
export function pastureResample(poly, step) {
  const n = poly.length,
    /** @type {[Pt, Pt, number, number][]} each side: its ends, its length and how far round it starts */
    sides = [];
  let P = 0;
  for (let i = 0; i < n; i++) {
    const a = poly[i],
      b = poly[(i + 1) % n],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    sides.push([a, b, L, P]);
    P += L;
  }
  const m = Math.max(8, Math.round(P / step)),
    /** @type {Pt[]} */
    out = [];
  for (let k = 0, j = 0; k < m; k++) {
    const d = (k * P) / m;
    while (j < n - 1 && sides[j][3] + sides[j][2] < d) j++;
    const [a, b, L, s] = sides[j],
      f = L ? (d - s) / L : 0;
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
}

/** the outline made smooth, lightly: walked round every metre, then each point moved to the middle of the points
 * within `reach` metres along it, twice. The zone's bends stay (gentle ones), its kinks and sharp corners go.
 * @param {Pt[]} poly @param {number} [reach] @returns {Pt[]} */
export function pastureSmooth(poly, reach = PASTURE_SMOOTH) {
  let p = pastureResample(poly, 1);
  const w = Math.max(1, Math.round(reach / 2));
  for (let q = 0; q < 2; q++) {
    const n = p.length,
      prev = p;
    p = prev.map((_, i) => {
      let x = 0,
        z = 0;
      for (let k = -w; k <= w; k++) {
        const r = prev[(i + k + n) % n];
        x += r[0];
        z += r[1];
      }
      return /** @type {Pt} */ ([x / (2 * w + 1), z / (2 * w + 1)]);
    });
  }
  return p;
}

/** the outline moved `d` metres inward, each side kept parallel (a corner sharper than about 30 degrees is cut short)
 * @param {Pt[]} poly @param {number} d @returns {Pt[]} */
export function pastureInset(poly, d) {
  const n = poly.length,
    sgn = pastureArea2(poly) > 0 ? 1 : -1,
    /** the inward normal of the side from i to i + 1 */
    nrm = /** @param {number} i @returns {Pt} */ i => {
      const a = poly[i],
        b = poly[(i + 1) % n],
        l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [(-(b[1] - a[1]) / l) * sgn, ((b[0] - a[0]) / l) * sgn];
    };
  return poly.map((p, i) => {
    const n1 = nrm((i - 1 + n) % n),
      n2 = nrm(i),
      k = Math.max(0.25, 1 + n1[0] * n2[0] + n1[1] * n2[1]);
    return /** @type {Pt} */ ([round2(p[0] + (d * (n1[0] + n2[0])) / k), round2(p[1] + (d * (n1[1] + n2[1])) / k)]);
  });
}
/** @param {number} v */
export const round2 = v => Math.round(v * 100) / 100;

/** the fence's line round a pasture zone: lightly smoothed (it bends as the zone does), a little inside it
 * @param {Pt[]} zone @returns {Pt[]} */
export const pastureFenceLine = zone => pastureInset(pastureSmooth(zone), PASTURE_FENCE_IN);
/** where the Billies wander: a little inside the fence
 * @param {Pt[]} zone @returns {Pt[]} */
export const pastureRoamLine = zone => pastureInset(pastureFenceLine(zone), PASTURE_ROAM_IN);

/** may a Billie walk straight from a to b? Both inside the line, the walk never crossing it, clear of every round
 * @param {Pt[]} line @param {Round[]} rounds @param {Pt} a @param {Pt} b */
export function pastureClear(line, rounds, a, b) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = Math.max(1, Math.ceil(L / 0.4));
  for (let i = 0; i <= n; i++) {
    const x = a[0] + ((b[0] - a[0]) * i) / n,
      z = a[1] + ((b[1] - a[1]) * i) / n;
    if (!pastureIn(line, x, z)) return false;
    /* the start may be close to something (it was pushed there); only walking further in is refused */
    for (const r of rounds) if (Math.hypot(x - r[0], z - r[1]) < r[2] && i > 0) return false;
  }
  return true;
}

/** somewhere new to wander to from `at`: a point inside the line, 1.5 to `reach` m away, walked to in a straight line
 * clear of the rounds; null when `tries` picks all failed (stay put a while)
 * @param {Pt[]} line @param {Round[]} rounds @param {Pt} at @param {() => number} rnd @param {number} [reach]
 * @param {number} [tries] @returns {Pt | null} */
export function pastureWander(line, rounds, at, rnd, reach = 6, tries = 12) {
  for (let k = 0; k < tries; k++) {
    const a = rnd() * Math.PI * 2,
      r = 1.5 + rnd() * (reach - 1.5),
      /** @type {Pt} */
      b = [round2(at[0] + Math.cos(a) * r), round2(at[1] + Math.sin(a) * r)];
    if (pastureClear(line, rounds, at, b)) return b;
  }
  return null;
}

/** a starting spot inside the line, clear of the rounds by a margin; null if none was found
 * @param {Pt[]} line @param {Round[]} rounds @param {() => number} rnd @returns {Pt | null} */
export function pastureSpot(line, rounds, rnd) {
  const xs = line.map(p => p[0]),
    zs = line.map(p => p[1]),
    x0 = Math.min(...xs),
    z0 = Math.min(...zs),
    w = Math.max(...xs) - x0,
    h = Math.max(...zs) - z0;
  for (let k = 0; k < 60; k++) {
    const x = round2(x0 + rnd() * w),
      z = round2(z0 + rnd() * h);
    if (pastureIn(line, x, z) && rounds.every(r => Math.hypot(x - r[0], z - r[1]) >= r[2] + 0.3)) return [x, z];
  }
  return null;
}

/** the Billies that wander in the pasture: at home in storage, the trainees first (in their order), then the highest
 * levels (the oldest first among equals); never the buddy; at most `most`
 * @param {SaveData} s @param {number} most @returns {Billy[]} */
export function pastureBillies(s, most) {
  const box = Array.isArray(s.box) ? s.box : [],
    skip = s.buddy || '',
    trainees = ((s.ranch && s.ranch.trainees) || [])
      .map(t => box.find(m => m.uid === t.uid))
      .filter(m => m && m.uid !== skip),
    rest = box
      .map((m, i) => ({ m, i }))
      .filter(o => o.m.uid !== skip && !trainees.includes(o.m))
      .sort((a, b) => (b.m.lvl || 0) - (a.m.lvl || 0) || a.i - b.i)
      .map(o => o.m);
  return /** @type {Billy[]} */ ([...trainees, ...rest].slice(0, Math.max(0, most | 0)));
}
