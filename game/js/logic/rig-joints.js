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
  // @ts-expect-error -- replaced on purpose
  rigBox: [() => rigBox, v => (rigBox = v)],
  rigFrameName: [() => rigFrameName],
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
 * pivot stays (it belongs to every frame). The box is kept on the sheet when its size is given.
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
  if (frame && frame in P.f) {
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
