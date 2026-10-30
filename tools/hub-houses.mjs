// Buildings track BD-7 (with BD-4b's placing): the house kit on Copperleaf's house plots. Used by
// tools/build-copperleaf.mjs; plain functions so tools/test/hub-houses.test.mjs can run them on small cases.
//   growPlots   each house plot made as big as the ground lets it, up to the kit's largest house (its front stays on
//               its street: it grows back and sideways), so more of the kit fits
//   pickHouses  a kit look for every house plot: it fits its plot, no two houses share a look, and no two neighbours
//               (plots within NEAR metres) share a body or a roof; the two showpieces go nearest the square
import { hashString } from '../game/js/logic/rng.js';

export const GROW_TO = [4.8, 3.6];
export const NEAR = 20;
const RAD = Math.PI / 180,
  r2 = v => Math.round(v * 100) / 100;

/** is a point inside a plot's rectangle grown by m? (a plot: x, z its middle, a the angle its front faces, w across,
 * d deep) */
export function inPlot(L, x, z, m = 0) {
  const a = L.a * RAD,
    dx = x - L.x,
    dz = z - L.z,
    u = dx * Math.cos(a) + dz * Math.sin(a),
    v = -dx * Math.sin(a) + dz * Math.cos(a);
  return Math.abs(u) <= L.d / 2 + m && Math.abs(v) <= L.w / 2 + m;
}

/** the plot moved and resized: its front line kept, `side` metres across (along its width) */
function resized(L, w, d, side) {
  const a = L.a * RAD,
    back = (d - L.d) / 2;
  return { ...L, x: r2(L.x - back * Math.cos(a) - side * Math.sin(a)), z: r2(L.z - back * Math.sin(a) + side * Math.cos(a)), w, d };
}

/** does a plot rectangle stand clear: every point a little inside its edge off `bad` ground and off the other plots?
 * @param {(x: number, z: number) => boolean} bad @param {object[]} others */
function clearPlot(L, bad, others) {
  const a = L.a * RAD,
    c = Math.cos(a),
    s = Math.sin(a),
    inset = 0.15,
    nu = Math.ceil(L.d * 4),
    nv = Math.ceil(L.w * 4);
  for (let i = 0; i <= nu; i++)
    for (let j = 0; j <= nv; j++) {
      const u = -L.d / 2 + inset + (i * (L.d - 2 * inset)) / nu,
        v = -L.w / 2 + inset + (j * (L.w - 2 * inset)) / nv,
        x = L.x + u * c - v * s,
        z = L.z + u * s + v * c;
      if (bad(x, z) || others.some(P => inPlot(P, x, z, 0.3))) return false;
    }
  return true;
}

/** the house plots grown where the ground lets them; other plots as they were. Rerunnable: a grown plot grows no more
 * @param {object[]} plots @param {(x: number, z: number) => boolean} bad ground no plot may cover (streets, water,
 * the station) @returns {object[]} */
export function growPlots(plots, bad, isHouse = L => L.k === 'house' || L.k === 'farmhouse') {
  const out = plots.map(L => ({ ...L }));
  out.forEach((L, i) => {
    if (!isHouse(L)) return;
    const others = out.filter((_, j) => j !== i);
    let best = null;
    for (let w = GROW_TO[0]; w >= L.w - 1e-6; w = r2(w - 0.1))
      for (let d = GROW_TO[1]; d >= L.d - 1e-6; d = r2(d - 0.1)) {
        if (best && w * d <= best.w * best.d) break;
        const side = [0, -0.2, 0.2, -0.4, 0.4].find(sd => clearPlot(resized(L, w, d, sd), bad, others));
        if (side !== undefined) {
          best = resized(L, w, d, side);
          break;
        }
      }
    /* never smaller, never moved for nothing; a plot bigger than the kit's largest (the farmhouse's) stays */
    if (best && best.w * best.d > L.w * L.d + 1e-6 && L.w <= GROW_TO[0] && L.d <= GROW_TO[1]) out[i] = best;
  });
  return out;
}

/** the kit's houses as the picker reads them: their kind, box, body, roof, palette and whether a showpiece (the
 * catalogue's group house_kit, one kind a house: tools/build-house-kit.py) @param {Record<string, any>} C the catalogue
 * @returns {{ k: string, box: number[], body: string, roof: string, palette: string, show: boolean }[]} */
export function kitLooks(C) {
  return Object.entries(C)
    .filter(([, R]) => R.group === 'house_kit' && R.kit)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, R]) => ({ k, box: R.box, body: R.kit.body, roof: R.kit.roof, palette: R.kit.palette, show: !!R.kit.show }));
}

/** a kit look for every plot, in the order given (nearest the square first): it fits (box within the plot), no look
 * twice, neighbours (within NEAR m) never share a body or a roof and, where the kit allows, not a palette either; the
 * showpieces first while any is left. Seeded by the plots' places: the same plots pick the same houses
 * @param {{ x: number, z: number, w: number, d: number }[]} plots @param {ReturnType<typeof kitLooks>} looks
 * @returns {string[]} each plot's kind */
export function pickHouses(plots, looks, seed = 'copperleaf houses') {
  const pick = new Array(plots.length).fill(null),
    used = new Set(),
    near = (i, j) => Math.hypot(plots[i].x - plots[j].x, plots[i].z - plots[j].z) < NEAR,
    fits = (P, A) => A.box[0] <= P.w + 1e-6 && A.box[1] <= P.d + 1e-6;
  const order = (i, strict) =>
    looks
      .filter(A => !used.has(A.k) && fits(plots[i], A))
      .filter(A =>
        pick.every((k, j) => {
          if (!k || j === i || !near(i, j)) return true;
          const B = looks.find(L => L.k === k);
          return B.body !== A.body && B.roof !== A.roof && (!strict || B.palette !== A.palette);
        })
      )
      .sort(
        (A, B) =>
          +B.show - +A.show ||
          (hashString(`${seed} ${i} ${A.k}`) % 997) - (hashString(`${seed} ${i} ${B.k}`) % 997)
      );
  const go = (i, strict) => {
    if (i === plots.length) return true;
    for (const A of order(i, strict)) {
      pick[i] = A.k;
      used.add(A.k);
      if (go(i + 1, strict)) return true;
      used.delete(A.k);
      pick[i] = null;
    }
    return false;
  };
  if (!go(0, true) && !go(0, false)) throw new Error('the house kit has no look for every plot under the neighbour rule');
  return pick;
}
