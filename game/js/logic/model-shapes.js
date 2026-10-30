// @ts-check
'use strict';
/* ================= MODEL SHAPES (buildings track BD-1) =================
   The maths behind the low-poly models' new recipe shapes (logic/low-poly.js lowPolyFromRecipe): a 2D profile's
   corners cut into triangles (a prism's caps), a profile's normals with soft and sharp joints (prisms and lathes),
   a part turned and leaned (rot, tilt), and the recipe's warp (the storybook wonk: lean, bulge, sag, twist) with its
   normals. Points here are the mesh's: [across, up, depth] in metres (a recipe's x, z, y). Plain numbers, no
   graphics. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  earClip: [() => earClip, v => (earClip = v)],
  // @ts-expect-error -- replaced on purpose
  glowCode: [() => glowCode, v => (glowCode = v)],
  // @ts-expect-error -- replaced on purpose
  layerTurn: [() => layerTurn, v => (layerTurn = v)],
  // @ts-expect-error -- replaced on purpose
  profileArea: [() => profileArea, v => (profileArea = v)],
  // @ts-expect-error -- replaced on purpose
  profileNormals: [() => profileNormals, v => (profileNormals = v)],
  // @ts-expect-error -- replaced on purpose
  profilePoints: [() => profilePoints, v => (profilePoints = v)],
  // @ts-expect-error -- replaced on purpose
  warpFrame: [() => warpFrame, v => (warpFrame = v)],
  // @ts-expect-error -- replaced on purpose
  warpNormal: [() => warpNormal, v => (warpNormal = v)],
  // @ts-expect-error -- replaced on purpose
  warpOn: [() => warpOn, v => (warpOn = v)],
  // @ts-expect-error -- replaced on purpose
  warpPoint: [() => warpPoint, v => (warpPoint = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* a profile's signed area (x right, second number up): positive when it runs anticlockwise */
export function profileArea(P) {
  let a = 0;
  for (let i = 0; i < P.length; i++) {
    const p = P[i],
      q = P[(i + 1) % P.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}
/* a recipe's profile as clean points: numbers, no repeats in a row, the closing repeat dropped */
export function profilePoints(pts, closed) {
  const P = [];
  for (const q of Array.isArray(pts) ? pts : []) {
    if (!Array.isArray(q)) continue;
    const p = [+q[0] || 0, +q[1] || 0],
      l = P[P.length - 1];
    if (!l || Math.hypot(p[0] - l[0], p[1] - l[1]) > 1e-6) P.push(p);
  }
  if (closed && P.length > 2 && Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) < 1e-6) P.pop();
  return P;
}
/* an anticlockwise polygon cut into triangles by its ears (a concave profile too: an arch, a gambrel), as index
   triples; what is left when no ear can be cut (points in a line) is fanned */
export function earClip(P) {
  const idx = P.map((_, i) => i),
    T = [],
    cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    inside = (p, a, b, c) => cross(a, b, p) >= -1e-12 && cross(b, c, p) >= -1e-12 && cross(c, a, p) >= -1e-12;
  while (idx.length > 3) {
    let cut = false;
    for (let k = 0; k < idx.length; k++) {
      const i0 = idx[(k + idx.length - 1) % idx.length],
        i1 = idx[k],
        i2 = idx[(k + 1) % idx.length],
        a = P[i0],
        b = P[i1],
        c = P[i2];
      if (cross(a, b, c) <= 1e-12) continue;
      if (idx.some(j => j !== i0 && j !== i1 && j !== i2 && inside(P[j], a, b, c))) continue;
      T.push([i0, i1, i2]);
      idx.splice(k, 1);
      cut = true;
      break;
    }
    if (!cut) break;
  }
  for (let k = 1; k < idx.length - 1; k++) T.push([idx[0], idx[k], idx[k + 1]]);
  return T;
}
/* a profile's normals, edge by edge: each edge's outward normal (right of its direction: an anticlockwise outline's
   outside, a lathe's profile listed from the bottom up), softened at a joint gentler than soft radians (or every
   joint when smooth) so a curve given in steps shades round and a corner stays sharp. Returns [start, end] for each
   edge; a closed profile's last edge runs back to its first point */
export function profileNormals(P, closed, soft, smooth) {
  const n = P.length,
    ne = closed ? n : n - 1,
    E = [];
  for (let i = 0; i < ne; i++) {
    const a = P[i],
      b = P[(i + 1) % n],
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy) || 1;
    E.push([dy / l, -dx / l]);
  }
  const cs = Math.cos(soft),
    joint = (e0, e1) => {
      if (!e0 || !e1) return null;
      if (!smooth && e0[0] * e1[0] + e0[1] * e1[1] < cs) return null;
      const x = e0[0] + e1[0],
        y = e0[1] + e1[1],
        l = Math.hypot(x, y);
      return l < 1e-9 ? null : [x / l, y / l];
    };
  return E.map((e, i) => {
    const prev = i ? E[i - 1] : closed ? E[ne - 1] : null,
      next = i < ne - 1 ? E[i + 1] : closed ? E[0] : null;
    return [joint(prev, e) || e, joint(e, next) || e];
  });
}
/* a part's own turn: rot (yaw, radians; positive turns across toward depth, as a round shape's rot), then tilt
   [about across, about depth] (radians: the first leans its top toward the back, the second toward the right), about
   its pivot [across, up, depth]. Returns a function of a point (or of a normal, with no pivot) */
export function layerTurn(rot, tilt, pivot) {
  const yaw = +rot || 0,
    ta = Array.isArray(tilt) ? +tilt[0] || 0 : 0,
    tb = Array.isArray(tilt) ? +tilt[1] || 0 : 0;
  if (!yaw && !ta && !tb) return null;
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw),
    ca = Math.cos(ta),
    sa = Math.sin(ta),
    cb = Math.cos(tb),
    sb = Math.sin(tb);
  return (v, normal) => {
    const o = normal ? [0, 0, 0] : pivot;
    let x = v[0] - o[0],
      y = v[1] - o[1],
      z = v[2] - o[2],
      t;
    t = x * cy - z * sy;
    z = x * sy + z * cy;
    x = t;
    t = y * ca - z * sa;
    z = z * ca + y * sa;
    y = t;
    t = x * cb + y * sb;
    y = y * cb - x * sb;
    x = t;
    return [x + o[0], y + o[1], z + o[2]];
  };
}
/* the recipe's warp is measured against the model's still parts: their bounds [x0, y0, z0, x1, y1, z1] (up is y) give
   its height (from the ground) and its middle */
export function warpFrame(box) {
  return {
    H: Math.max(0.01, box[4]),
    cx: (box[0] + box[3]) / 2,
    cz: (box[2] + box[5]) / 2,
    hw: Math.max(0.01, (box[3] - box[0]) / 2),
  };
}
/* whether a recipe's warp moves anything */
export function warpOn(W) {
  return (
    !!W &&
    typeof W === 'object' &&
    !!((Array.isArray(W.lean) && (+W.lean[0] || +W.lean[1])) || +W.bulge || +W.sag || +W.twist)
  );
}
/* a point warped by its height t (0 at the ground, 1 at the model's top): bulge swells the middle height out from the
   middle line (a fraction: 0.06 is 6% at half height), twist turns the top (radians), sag sinks the top's middle
   across (metres at the top, none at its ends: a ridge that sags), lean moves the top [across, depth] (metres) */
export function warpPoint(W, F, p) {
  const t = Math.min(1, Math.max(0, p[1] / F.H));
  let x = p[0],
    y = p[1],
    z = p[2];
  const bu = +W.bulge || 0,
    tw = +W.twist || 0,
    sg = +W.sag || 0,
    ln = Array.isArray(W.lean) ? W.lean : null;
  if (bu) {
    const s = 1 + bu * Math.sin(Math.PI * t);
    x = F.cx + (x - F.cx) * s;
    z = F.cz + (z - F.cz) * s;
  }
  if (tw) {
    const a = tw * t,
      c = Math.cos(a),
      s = Math.sin(a),
      dx = x - F.cx,
      dz = z - F.cz;
    x = F.cx + dx * c - dz * s;
    z = F.cz + dx * s + dz * c;
  }
  if (sg) {
    const u = Math.min(1, Math.max(-1, (p[0] - F.cx) / F.hw));
    y -= sg * t * t * (1 - u * u);
  }
  if (ln) {
    x += (+ln[0] || 0) * t;
    z += (+ln[1] || 0) * t;
  }
  return [x, y, z];
}
/* a normal at p carried through the warp: the warp's local stretch (by small steps either side) applied as normals
   take it (the cofactors: n.x (b x c) + n.y (c x a) + n.z (a x b), for the stretch's columns a, b, c) */
export function warpNormal(W, F, p, n) {
  const e = 1e-3,
    col = k => {
      const a = p.slice(),
        b = p.slice();
      a[k] += e;
      b[k] -= e;
      const A = warpPoint(W, F, a),
        B = warpPoint(W, F, b);
      return [(A[0] - B[0]) / (2 * e), (A[1] - B[1]) / (2 * e), (A[2] - B[2]) / (2 * e)];
    },
    cr = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]],
    a = col(0),
    b = col(1),
    c = col(2),
    bc = cr(b, c),
    ca = cr(c, a),
    ab = cr(a, b),
    r = [0, 1, 2].map(k => n[0] * bc[k] + n[1] * ca[k] + n[2] * ab[k]),
    l = Math.hypot(r[0], r[1], r[2]) || 1;
  return [r[0] / l, r[1] / l, r[2] / l];
}
/* a glowing layer (glow: a colour, true for the layer's own colour, or {col, day}; glowDay or day: it glows by day
   too): its vertex flag (33 at night, 34 by day too; prop-models.js packs it after window glass 2-32) and its colour
   in 16 bits (5 red, 6 green, 5 blue) as two bytes. Null for no glow */
export function glowCode(L) {
  const g = L && L.glow;
  if (!g) return null;
  const o = typeof g === 'object' ? g : { col: typeof g === 'string' ? g : null },
    hex = typeof o.col === 'string' ? o.col : typeof L.col === 'string' ? L.col : '#ffcc66',
    v = parseInt(hex.slice(1, 7), 16);
  if (!Number.isFinite(v)) return null;
  const r = (v >> 16) & 255,
    gg = (v >> 8) & 255,
    b = v & 255,
    c = ((r >> 3) << 11) | ((gg >> 2) << 5) | (b >> 3);
  return { flag: o.day || L.glowDay ? 34 : 33, hi: c >> 8, lo: c & 255 };
}
