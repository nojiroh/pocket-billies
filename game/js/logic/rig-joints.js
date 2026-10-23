// @ts-check
'use strict';
/* ================= RIG JOINTS (studio track ST-6) =================
   The species rigs (art/next/rigs-next.js, one per view): each picture is a box on the species' sheet (one per frame:
   main, squash, stretch; idle, blink, happy, hurt) with the point it turns around (ox, oy: the picture's top left
   from the pivot), and each bone hangs from its parent at `at` (in the parent's turned frame, times k) with a draw
   order per view (z; the back view draws by zb). rigKit shows one species to the workbench's Part mode as a part kit
   (partKits.json's shape): a part per bone with a picture, its pivot, its children's joints as sockets, its draw
   order. The setters change the rig so the figure is drawn where it was: a pivot moved keeps the picture and the
   children in place, a box moved keeps the pivot on the same sheet pixel. The skeleton builder and Part mode both
   use them.
   Logic only: no DOM, runs in Node. */
/** @import { PartKits, KitPart } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  RIG_NEUTRAL_POSE: [() => RIG_NEUTRAL_POSE],
  rigAffineMove: [() => rigAffineMove],
  rigAffineMul: [() => rigAffineMul],
  rigAffineScale: [() => rigAffineScale],
  rigAffineTurn: [() => rigAffineTurn],
  // @ts-expect-error -- replaced on purpose
  rigBox: [() => rigBox, v => (rigBox = v)],
  rigFrameName: [() => rigFrameName],
  // @ts-expect-error -- replaced on purpose
  rigGeo: [() => rigGeo, v => (rigGeo = v)],
  // @ts-expect-error -- replaced on purpose
  rigKit: [() => rigKit, v => (rigKit = v)],
  rigRound2: [() => rigRound2],
  rigRound3: [() => rigRound3],
  // @ts-expect-error -- replaced on purpose
  rigSetBox: [() => rigSetBox, v => (rigSetBox = v)],
  // @ts-expect-error -- replaced on purpose
  rigSetPivot: [() => rigSetPivot, v => (rigSetPivot = v)],
  // @ts-expect-error -- replaced on purpose
  rigSetSocket: [() => rigSetSocket, v => (rigSetSocket = v)],
  // @ts-expect-error -- replaced on purpose
  rigSetZ: [() => rigSetZ, v => (rigSetZ = v)],
  // @ts-expect-error -- replaced on purpose
  rigSplitPicture: [() => rigSplitPicture, v => (rigSplitPicture = v)],
  rigZ: [() => rigZ],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/**
 * @typedef {[number, number, number, number]} RigRect a box on the sheet: x, y, w, h
 * @typedef {{ ox: number, oy: number, f: Record<string, RigRect> }} RigPicture
 * @typedef {{ n: string, par?: string, at: [number, number], z: number, zb?: number, i: number, rr?: number,
 *   a?: string } & Record<string, any>} RigBone
 * @typedef {{ k: number, sheet: string, size?: [number, number], imgs: RigPicture[], bones: RigBone[] }
 *   & Record<string, any>} RigView
 * @typedef {[number, number, number, number]} Linear2 a 2x2 matrix as [a, b, c, d]: x' = a x + c y, y' = b x + d y
 */
/** the frame a picture shows when nothing picks one (the Studio's and the game's: idle, else the first)
 * @param {RigPicture} P */
export const rigFrameName = P => ('idle' in P.f ? 'idle' : Object.keys(P.f)[0]);
/** the box of a picture's frame (its shown frame when none is named) @param {RigPicture} P @param {string} [frame] */
export function rigBox(P, frame) {
  return P.f[frame && frame in P.f ? frame : rigFrameName(P)];
}
/** a bone's draw order as its view draws it: the front by z, the back by zb (else z)
 * @param {RigBone} b @param {string} view */
export const rigZ = (b, view) => (view === 'back' && b.zb != null ? b.zb : b.z);
export const rigRound2 = (/** @type {number} */ v) => Math.round(v * 100) / 100;
export const rigRound3 = (/** @type {number} */ v) => +v.toFixed(3);

/**
 * One species as a part kit for Part mode: a part per bone with a picture (named by the bone), each view's picture
 * the shown frame's box on the sheet, its pivot (-ox, -oy) and its children's joints as sockets (by the child's
 * name), as fractions of the box; z per view as drawn. A view where the bone has no picture is left out.
 * @param {Record<string, RigView | undefined>} rig a species' rig (front, back)
 * @returns {PartKits & { species: true }}
 */
export function rigKit(rig) {
  const parts = /** @type {Record<string, KitPart & { rig: Record<string, any> }>} */ ({}),
    order = /** @type {string[]} */ ([]);
  for (const view of /** @type {const} */ (['front', 'back'])) {
    const M = rig?.[view];
    if (!M) continue;
    for (const b of M.bones) {
      const P = M.imgs[b.i];
      if (b.i < 0 || !P) continue;
      const [x, y, w, h] = rigBox(P),
        px = -P.ox,
        py = -P.oy,
        sockets = /** @type {Record<string, [number, number]>} */ ({});
      for (const c of M.bones)
        if (c.par === b.n) sockets[c.n] = [rigRound3((px + c.at[0] * M.k) / w), rigRound3((py + c.at[1] * M.k) / h)];
      if (!parts[b.n]) {
        order.push(b.n);
        parts[b.n] = /** @type {any} */ ({
          kit: 'species',
          animal: 'species',
          kind: b.a || b.n,
          slot: !b.par || b.par === 'root' ? 'body' : 'part',
          pivot: [rigRound3(px / w), rigRound3(py / h)],
          size: 'M',
          views: {},
          z: {},
          rig: {},
        });
      }
      const K = parts[b.n];
      K.views[view] = { file: M.sheet, w, h, pivot: [rigRound3(px / w), rigRound3(py / h)], sockets };
      /** @type {any} */ (K.z)[view] = rigZ(b, view);
      K.rig[view] = { i: b.i, box: [x, y, w, h], par: b.par || 'root', frames: Object.keys(P.f) };
    }
  }
  return { species: true, parts: Object.fromEntries(order.map(n => [n, parts[n]])) };
}

/**
 * Makes a bone's picture its own when other bones share it (they keep the old one), so moving its pivot moves only
 * this bone's. Returns the bone's picture.
 * @param {RigView} M @param {RigBone} b
 */
export function rigSplitPicture(M, b) {
  if (b.i < 0) return null;
  if (M.bones.some(o => o !== b && o.i === b.i)) {
    M.imgs.push(JSON.parse(JSON.stringify(M.imgs[b.i])));
    b.i = M.imgs.length - 1;
  }
  return M.imgs[b.i];
}

/**
 * Moves a bone's pivot by (dx, dy) in its picture's pixels, keeping the figure where it was: the picture shifts back
 * by as much, the bone's joint moves by it (turned into the parent's frame by `lin`, the bone's turn and stretch in
 * its parent: the skeleton builder passes the pose's, else the bone's rest turn rr) and its children's joints move back.
 * A picture other bones share is split first. Rounded as the builder always rounded (at 3 decimals, ox and oy 2).
 * @param {RigView} M @param {string} name @param {number} dx @param {number} dy @param {Linear2} [lin]
 * @returns {boolean} false when there is no such bone
 */
export function rigSetPivot(M, name, dx, dy, lin) {
  const b = M.bones.find(o => o.n === name);
  if (!b) return false;
  const k = M.k,
    r = b.rr || 0,
    L = lin || [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r)],
    pdx = L[0] * dx + L[2] * dy,
    pdy = L[1] * dx + L[3] * dy;
  b.at = [rigRound3(b.at[0] + pdx / k), rigRound3(b.at[1] + pdy / k)];
  const P = rigSplitPicture(M, b);
  if (P) {
    P.ox = rigRound2(P.ox - dx);
    P.oy = rigRound2(P.oy - dy);
  }
  for (const c of M.bones) if (c.par === b.n) c.at = [rigRound3(c.at[0] - dx / k), rigRound3(c.at[1] - dy / k)];
  return true;
}

/**
 * Puts a child bone's joint on its parent's picture at (x, y), in the parent's picture pixels from its top left (Part
 * mode's sockets). The child and what hangs on it move with it.
 * @param {RigView} M @param {string} child @param {number} x @param {number} y
 * @returns {boolean} false when the child or its parent's picture is missing
 */
export function rigSetSocket(M, child, x, y) {
  const c = M.bones.find(o => o.n === child),
    p = c && M.bones.find(o => o.n === c.par),
    P = p && M.imgs[p.i];
  if (!c || !p || !P) return false;
  c.at = [rigRound3((x + P.ox) / M.k), rigRound3((y + P.oy) / M.k)];
  return true;
}

/**
 * Sets a picture's box on the sheet. The pivot stays on the same sheet pixel (ox, oy follow the box's top left), so
 * growing or trimming an edge leaves the art where it was. With no frame named every frame moves its edges by as
 * much (squash and stretch, blink, happy and hurt sit beside the shown one); with one, only that frame changes and the
 * pivot stays (it belongs to every frame); a frame the picture does not have changes nothing. The box is kept on the
 * sheet when its size is given.
 * @param {RigView} M @param {number} i the picture @param {RigRect} box @param {string} [frame]
 * @returns {boolean} false when nothing changed
 */
export function rigSetBox(M, i, box, frame) {
  const P = M.imgs[i];
  if (!P) return false;
  const [SW, SH] = M.size || [Infinity, Infinity],
    nb = /** @type {RigRect} */ (box.map(Math.round));
  nb[2] = Math.max(1, nb[2]);
  nb[3] = Math.max(1, nb[3]);
  nb[0] = Math.max(0, Math.min(SW - 1, nb[0]));
  nb[1] = Math.max(0, Math.min(SH - 1, nb[1]));
  nb[2] = Math.min(nb[2], SW - nb[0]);
  nb[3] = Math.min(nb[3], SH - nb[1]);
  if (frame && !(frame in P.f)) return false;
  if (frame) {
    if (P.f[frame].every((v, k) => v === nb[k])) return false;
    P.f[frame] = nb;
    return true;
  }
  const old = rigBox(P),
    d = nb.map((v, k) => v - old[k]);
  if (d.every(v => !v)) return false;
  for (const [n, f] of Object.entries(P.f))
    P.f[n] = /** @type {RigRect} */ ([f[0] + d[0], f[1] + d[1], Math.max(1, f[2] + d[2]), Math.max(1, f[3] + d[3])]);
  P.ox = rigRound2(P.ox + d[0]);
  P.oy = rigRound2(P.oy + d[1]);
  return true;
}

/** sets a bone's draw order in a view (the back view's zb) @param {RigView} M @param {string} name
 * @param {string} view @param {number} z */
export function rigSetZ(M, name, view, z) {
  const b = M.bones.find(o => o.n === name);
  if (!b) return false;
  if (view === 'back') b.zb = z;
  else b.z = z;
  return true;
}

/** the skeleton builder's neutral pose (studio/js/skeleton.js neutralPose: skeleton-rig.js rigPose at rest, nothing
 * turned, open eyes), the pose geo is framed at */
export const RIG_NEUTRAL_POSE = Object.freeze({
  act: null,
  tau: 0,
  t: 0,
  seed: 0,
  x: 0,
  y: 0,
  r: 0,
  sx: 1,
  sy: 1,
  body: 0,
  bdy: 0,
  head: 0,
  hdx: 0,
  hdy: 0,
  aL: 0,
  aR: 0,
  lL: 0,
  lR: 0,
  tail: 0,
  flap: 1,
  open: 0,
  face: 'idle',
  hov: Object.freeze({ dx: 0, dy: 0, r: 0 }),
  k: 0,
});
/* ---------- geo: how big the figure stands (Studio plan Phase 5, T5.2; was the skeleton builder's skeletonFraming) */
/** @typedef {[number, number, number, number, number, number]} Affine x' = a x + c y + e, y' = b x + d y + f */
/** @param {Affine} m @param {Affine} n @returns {Affine} */
export const rigAffineMul = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
/** @returns {Affine} */
export const rigAffineMove = (/** @type {number} */ x, /** @type {number} */ y) => [1, 0, 0, 1, x, y];
/** @returns {Affine} */
export const rigAffineTurn = (/** @type {number} */ a) => {
  const c = Math.cos(a),
    s = Math.sin(a);
  return [c, s, -s, c, 0, 0];
};
/** @returns {Affine} */
export const rigAffineScale = (/** @type {number} */ x, /** @type {number} */ y) => [x, 0, 0, y, 0, 0];
/**
 * A view's `geo` (what the world sprite's size, shadow and ring read): the box round every picture drawn at the
 * pose `P` with its animation `A` (the body plan's for that pose, as skeleton-rig.js animFor gives it), each picture's
 * shown frame, the same matrices as skeleton-rig.js rigMatrices (no build, no lag). The skeleton builder passes the
 * neutral pose. null when nothing is drawn.
 * @param {RigView} M @param {string} view
 * @param {Record<string, { dx?: number, dy?: number, r?: number, sx?: number, sy?: number, hide?: boolean }>} A
 * @param {{ x?: number, y?: number, r?: number, sx?: number, sy?: number }} P
 */
export function rigGeo(M, view, A, P) {
  const back = view === 'back',
    k = M.k,
    root = A.root || {};
  let m0 = rigAffineMove(M.cx, M.base);
  if (back) m0 = rigAffineMul(m0, rigAffineScale(-1, 1));
  m0 = rigAffineMul(m0, rigAffineMove(((P.x || 0) + (root.dx || 0)) * k, ((P.y || 0) + (root.dy || 0)) * k));
  if (P.r || root.r) {
    const pv = M.tipX || 0;
    m0 = rigAffineMul(m0, rigAffineMove(pv * k, 0));
    m0 = rigAffineMul(m0, rigAffineTurn((P.r || 0) + (root.r || 0)));
    m0 = rigAffineMul(m0, rigAffineMove(-pv * k, 0));
  }
  m0 = rigAffineMul(m0, rigAffineScale((P.sx || 1) * (root.sx || 1), (P.sy || 1) * (root.sy || 1)));
  /** @type {Record<string, Affine>} */
  const W = { root: m0 };
  let x0 = 1e9,
    x1 = -1e9,
    y0 = 1e9,
    y1 = -1e9;
  for (const b of M.bones) {
    const pm = W[b.par || 'root'] || m0,
      a = A[b.a || b.n] || {};
    if (a.hide) {
      W[b.n] = pm;
      continue;
    }
    let m = rigAffineMul(pm, rigAffineMove(b.at[0] * k * 1, b.at[1] * k * 1));
    if (a.dx || a.dy) m = rigAffineMul(m, rigAffineMove((a.dx || 0) * k, (a.dy || 0) * k));
    const r = (b.rr || 0) + (a.r || 0);
    if (r) m = rigAffineMul(m, rigAffineTurn(r));
    if (a.sx || a.sy) m = rigAffineMul(m, rigAffineScale(a.sx || 1, a.sy || 1));
    W[b.n] = m;
    const P0 = b.i >= 0 ? M.imgs[b.i] : null;
    if (!P0 || (back && b.hideB)) continue;
    const [, , bw, bh] = rigBox(P0),
      w = Math.max(1, bw),
      h = Math.max(1, bh);
    for (const [px, py] of [
      [P0.ox, P0.oy],
      [P0.ox + w, P0.oy],
      [P0.ox, P0.oy + h],
      [P0.ox + w, P0.oy + h],
    ]) {
      const X = m[0] * px + m[2] * py + m[4],
        Y = m[1] * px + m[3] * py + m[5];
      x0 = Math.min(x0, X);
      x1 = Math.max(x1, X);
      y0 = Math.min(y0, Y);
      y1 = Math.max(y1, Y);
    }
  }
  if (x0 > x1) return null;
  const lift = ((M.q && M.q.lift) || 0) * M.k;
  return {
    cx: M.cx,
    base: M.base,
    k: M.k,
    top: +y0.toFixed(2),
    mid: +((y0 + y1) / 2).toFixed(2),
    hw: +((x1 - x0) / 2).toFixed(2),
    lift: +lift.toFixed(2),
    cy: +((y0 + y1) / 2).toFixed(2),
  };
}
