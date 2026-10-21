// @ts-check
'use strict';
/* ================= PART JOINTS (studio track ST-4) =================
   How a phase 16 kit part joins a body (game/data/partKits.json): its turning point per view, its sockets, its draw
   order per view, how far it may turn, which slots may attach at each socket, its S and L sizes (hand-painted, or M
   scaled about the pivot), and its mirrored copy for the other side. Points are fractions of the picture, x right and
   y down. A socket ending in L is on the viewer's left (x small), R on the right; a kind's art is drawn for one side
   (`sides`) and mirrored on the other, unless the part has a copy made by Mirror to other side (`<id>_r`).
   Logic only: no DOM, runs in Node. The Studio's Part mode and the tests fit parts the same way. */
/** @import { PartKits, KitPart } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  PART_ATTACH: [() => PART_ATTACH],
  PART_SIZE_SCALE: [() => PART_SIZE_SCALE],
  PART_TURN_FREE: [() => PART_TURN_FREE],
  mirrorPoint: [() => mirrorPoint],
  mirrorSockets: [() => mirrorSockets],
  mirrorTurn: [() => mirrorTurn],
  // @ts-expect-error -- replaced on purpose
  partAccepts: [() => partAccepts, v => (partAccepts = v)],
  // @ts-expect-error -- replaced on purpose
  partClampTurn: [() => partClampTurn, v => (partClampTurn = v)],
  // @ts-expect-error -- replaced on purpose
  partDrawBounds: [() => partDrawBounds, v => (partDrawBounds = v)],
  // @ts-expect-error -- replaced on purpose
  partDrawnSide: [() => partDrawnSide, v => (partDrawnSide = v)],
  // @ts-expect-error -- replaced on purpose
  partFit: [() => partFit, v => (partFit = v)],
  // @ts-expect-error -- replaced on purpose
  partForSide: [() => partForSide, v => (partForSide = v)],
  // @ts-expect-error -- replaced on purpose
  partJoint: [() => partJoint, v => (partJoint = v)],
  // @ts-expect-error -- replaced on purpose
  partMirror: [() => partMirror, v => (partMirror = v)],
  // @ts-expect-error -- replaced on purpose
  partMirrorId: [() => partMirrorId, v => (partMirrorId = v)],
  partOtherSide: [() => partOtherSide],
  // @ts-expect-error -- replaced on purpose
  partScaledPixels: [() => partScaledPixels, v => (partScaledPixels = v)],
  // @ts-expect-error -- replaced on purpose
  partSizeScale: [() => partSizeScale, v => (partSizeScale = v)],
  partSocketSide: [() => partSocketSide],
  // @ts-expect-error -- replaced on purpose
  partSocketsFor: [() => partSocketsFor, v => (partSocketsFor = v)],
  // @ts-expect-error -- replaced on purpose
  partTurn: [() => partTurn, v => (partTurn = v)],
  // @ts-expect-error -- replaced on purpose
  partTwin: [() => partTwin, v => (partTwin = v)],
  // @ts-expect-error -- replaced on purpose
  partZ: [() => partZ, v => (partZ = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** S and L as M scaled about the pivot, when rules.json parts.sizes is not at hand (phase 16: 85% and 120%) */
export const PART_SIZE_SCALE = /** @type {Record<string, number>} */ ({ S: 0.85, M: 1, L: 1.2 });
/** the sockets a part joins by when its view has no pivot of its own: a limb its joint, a head its chin, a tail its
 * base (as tools/build-kit-billies.py joins them); else the part's pivot */
export const PART_ATTACH = ['joint', 'chin', 'base'];
/** turn limits of a kind with none given */
export const PART_TURN_FREE = /** @type {[number, number]} */ ([-180, 180]);

/** how much a size scales the M picture @param {string} size @param {any} [rules] rules.json */
export function partSizeScale(size, rules) {
  return rules?.parts?.sizes?.[size]?.scale ?? PART_SIZE_SCALE[size] ?? 1;
}
/** the side a socket is on: 'L', 'R' or '' (neck, tail) @param {string} socket */
export const partSocketSide = socket => (/L$/.test(socket) ? 'L' : /R$/.test(socket) ? 'R' : '');
/** a socket's name on the other side: shoulderL <-> shoulderR; others stay @param {string} name */
export const partOtherSide = name =>
  /L$/.test(name) ? name.slice(0, -1) + 'R' : /R$/.test(name) ? name.slice(0, -1) + 'L' : name;

/** a part's draw order in a view: its own, else its kind's, else 0
 * @param {PartKits} K @param {string} id @param {string} view */
export function partZ(K, id, view) {
  const P = K.parts[id];
  if (!P) return 0;
  const own = P.z?.[/** @type {'front'|'back'} */ (view)];
  return own ?? K.z?.[P.kind]?.[/** @type {'front'|'back'} */ (view)] ?? 0;
}
/** how far a part may turn about its pivot, [least, most] degrees: its own, else its kind's, else free
 * @param {PartKits} K @param {string} id @returns {[number, number]} */
export function partTurn(K, id) {
  const P = K.parts[id];
  return /** @type {[number, number]} */ ((P && (P.turn || K.turns?.[P.kind])) || PART_TURN_FREE);
}
/** an angle kept inside a part's turn limits @param {PartKits} K @param {string} id @param {number} angle */
export function partClampTurn(K, id, angle) {
  const [a, b] = partTurn(K, id);
  return Math.min(b, Math.max(a, angle));
}
/** the slots that may attach at a part's socket: the part's own rule, else socketRules by name, else none
 * @param {PartKits} K @param {string} id @param {string} socket @returns {string[]} */
export function partAccepts(K, id, socket) {
  return K.parts[id]?.accepts?.[socket] ?? K.socketRules?.[socket] ?? [];
}
/** the side a part's art is drawn for: its kind's (sides, L when not given); a mirrored copy is drawn for the other
 * @param {PartKits} K @param {string} id @returns {'L'|'R'} */
export function partDrawnSide(K, id) {
  const P = K.parts[id];
  if (P?.mirrorOf && K.parts[P.mirrorOf]) return partDrawnSide(K, P.mirrorOf) === 'L' ? 'R' : 'L';
  return (P && K.sides?.[P.kind]) || 'L';
}
/** the part's copy for the other side, if there is one (made by Mirror to other side)
 * @param {PartKits} K @param {string} id */
export function partTwin(K, id) {
  const P = K.parts[id];
  if (P?.mirrorOf && K.parts[P.mirrorOf]) return P.mirrorOf;
  return K.parts[id + '_r'] ? id + '_r' : '';
}
/** what to draw on a side of the body: the part as it is, its copy for that side, or the part mirrored
 * @param {PartKits} K @param {string} id @param {string} side 'L', 'R' or '' @returns {{ id: string, flip: boolean }} */
export function partForSide(K, id, side) {
  if (!side || side === partDrawnSide(K, id)) return { id, flip: false };
  const twin = partTwin(K, id);
  return twin ? { id: twin, flip: false } : { id, flip: true };
}

/**
 * @typedef {{ id: string, view: string, size: string, kind: string, slot: string, file: string, w: number, h: number,
 *   scale: number, painted: boolean, pivot: [number, number], px: [number, number], sockets: Record<string, [number, number]>,
 *   z: number, turn: [number, number] }} PartJoint
 * w and h are the picture's size as drawn; scale is how much the file's pixels are scaled to get there (1 for M and
 * for a hand-painted S or L); px is the pivot in drawn pixels: the view's own, else its joint, chin or base socket,
 * else the part's.
 */
/** a part's joint in one view at one size, or null when it has no picture in that view
 * @param {PartKits} K @param {string} id @param {string} view @param {string} [size] @param {any} [rules]
 * @returns {PartJoint | null} */
export function partJoint(K, id, view, size = 'M', rules) {
  const P = K.parts[id],
    V = P?.views[/** @type {'front'|'back'} */ (view)];
  if (!P || !V) return null;
  const S = size === 'M' ? null : V.sizes?.[/** @type {'S'|'L'} */ (size)],
    sc = size === 'M' || S ? 1 : partSizeScale(size, rules),
    file = S ? S.file : V.file,
    w = S ? S.w : Math.max(1, Math.round(V.w * sc)),
    h = S ? S.h : Math.max(1, Math.round(V.h * sc)),
    sockets = (S && S.sockets) || V.sockets || {},
    by = PART_ATTACH.find(n => sockets[n]),
    pivot = /** @type {[number, number]} */ ((S && S.pivot) || V.pivot || (by && sockets[by]) || P.pivot);
  return {
    id,
    view,
    size,
    kind: P.kind,
    slot: P.slot,
    file,
    w,
    h,
    scale: S ? 1 : w / V.w,
    painted: !!S,
    pivot,
    px: [pivot[0] * w, pivot[1] * h],
    sockets,
    z: partZ(K, id, view),
    turn: partTurn(K, id),
  };
}
/** the body's sockets in a view where the part's slot may attach, in the body's order
 * @param {PartKits} K @param {string} bodyId @param {string} partId @param {string} view */
export function partSocketsFor(K, bodyId, partId, view) {
  const B = K.parts[bodyId]?.views[/** @type {'front'|'back'} */ (view)],
    slot = K.parts[partId]?.slot;
  if (!B || !slot) return [];
  return Object.keys(B.sockets || {}).filter(s => partAccepts(K, bodyId, s).includes(slot));
}

/**
 * @typedef {{ id: string, file: string, w: number, h: number, x: number, y: number, px: [number, number],
 *   flip: boolean, rot: number, z: number, body: boolean }} PartDraw
 * Draw it as: move to (x, y), turn by rot degrees (clockwise), move by -px, mirror across its width if flip, then the
 * picture at w x h.
 */
/** a part fitted onto a body's socket in one view: the body (its top left at 0, 0, at M) and the part with its pivot
 * on the socket, turned by `angle` kept inside its limits, in draw order. null when either has no picture there.
 * @param {PartKits} K @param {string} bodyId @param {string} socket @param {string} partId @param {string} view
 * @param {{ angle?: number, size?: string, rules?: any }} [o]
 * @returns {{ draws: PartDraw[], angle: number, side: string, flip: boolean, id: string } | null} */
export function partFit(K, bodyId, socket, partId, view, o = {}) {
  const body = partJoint(K, bodyId, view, 'M', o.rules),
    side = partSocketSide(socket),
    use = partForSide(K, partId, side),
    j = partJoint(K, use.id, view, o.size || 'M', o.rules),
    at = body?.sockets[socket];
  if (!body || !j || !at) return null;
  const angle = partClampTurn(K, use.id, o.angle || 0),
    bodyDraw = /** @type {PartDraw} */ ({
      id: bodyId,
      file: body.file,
      w: body.w,
      h: body.h,
      x: body.px[0],
      y: body.px[1],
      px: body.px,
      flip: false,
      rot: 0,
      z: body.z,
      body: true,
    }),
    partDraw = /** @type {PartDraw} */ ({
      id: use.id,
      file: j.file,
      w: j.w,
      h: j.h,
      x: at[0] * body.w,
      y: at[1] * body.h,
      px: [use.flip ? j.w - j.px[0] : j.px[0], j.px[1]],
      flip: use.flip,
      rot: use.flip ? -angle : angle,
      z: j.z,
      body: false,
    });
  /* the same order on both: by z, the body first when they tie */
  const draws = [bodyDraw, partDraw].sort((a, b) => a.z - b.z);
  return { draws, angle, side, flip: use.flip, id: use.id };
}
/** the box that holds every draw, turned: { x, y, w, h } @param {PartDraw[]} draws */
export function partDrawBounds(draws) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const d of draws) {
    const r = (d.rot * Math.PI) / 180,
      c = Math.cos(r),
      s = Math.sin(r);
    for (const [u, v] of [
      [0, 0],
      [d.w, 0],
      [0, d.h],
      [d.w, d.h],
    ]) {
      const a = u - d.px[0],
        b = v - d.px[1],
        X = d.x + a * c - b * s,
        Y = d.y + a * s + b * c;
      x0 = Math.min(x0, X);
      y0 = Math.min(y0, Y);
      x1 = Math.max(x1, X);
      y1 = Math.max(y1, Y);
    }
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** @param {[number, number]} p @returns {[number, number]} */
export const mirrorPoint = p => [Math.round((1 - p[0]) * 1000) / 1000, p[1]];
/** @param {Record<string, [number, number]> | undefined} S */
export const mirrorSockets = S =>
  S && Object.fromEntries(Object.entries(S).map(([n, p]) => [partOtherSide(n), mirrorPoint(p)]));
/** @param {[number, number]} t @returns {[number, number]} */
export const mirrorTurn = t => [-t[1], -t[0]];
/** the id of a part's copy for the other side: <id>_r, or back to the part a copy was made from
 * @param {PartKits} K @param {string} id */
export function partMirrorId(K, id) {
  return K.parts[id]?.mirrorOf || id + '_r';
}
/** the entry of a part's copy for the other side: pictures in the same folders under the copy's id, pivots and sockets
 * mirrored (shoulderL <-> shoulderR), turn limits mirrored, draw order kept. Its hand-given sockets (partKits
 * `sockets`) mirrored too. Mirroring the copy gives the part back.
 * @param {PartKits} K @param {string} id
 * @returns {{ id: string, entry: KitPart, sockets?: { front?: Record<string, [number, number]>, back?: Record<string, [number, number]> } } | null} */
export function partMirror(K, id) {
  const P = K.parts[id];
  if (!P) return null;
  const to = partMirrorId(K, id),
    /** @type {any} */ e = JSON.parse(JSON.stringify(P));
  e.pivot = mirrorPoint(P.pivot);
  for (const [view, V] of Object.entries(e.views)) {
    V.file = `next/parts/${view}/${to}.png`;
    if (V.pivot) V.pivot = mirrorPoint(V.pivot);
    if (V.sockets) V.sockets = mirrorSockets(V.sockets);
    for (const [size, S] of Object.entries(V.sizes || {})) {
      S.file = `next/parts/${view}/${to}_${size.toLowerCase()}.png`;
      if (S.pivot) S.pivot = mirrorPoint(S.pivot);
      if (S.sockets) S.sockets = mirrorSockets(S.sockets);
    }
  }
  const kindTurn = K.turns?.[P.kind];
  if (P.turn) e.turn = mirrorTurn(P.turn);
  else if (kindTurn && kindTurn[0] !== -kindTurn[1]) e.turn = mirrorTurn(kindTurn);
  if (P.accepts) e.accepts = Object.fromEntries(Object.entries(P.accepts).map(([n, s]) => [partOtherSide(n), s]));
  if (P.mirrorOf) delete e.mirrorOf;
  else e.mirrorOf = id;
  const hand = K.sockets?.[id],
    sockets = hand && {
      ...(hand.front ? { front: mirrorSockets(hand.front) } : {}),
      ...(hand.back ? { back: mirrorSockets(hand.back) } : {}),
    };
  return { id: to, entry: e, ...(sockets ? { sockets } : {}) };
}

/** a picture scaled by nearest neighbour to round(w * scale) x round(h * scale): where S and L painting starts
 * @param {{ width: number, height: number, data: ArrayLike<number> }} img @param {number} scale */
export function partScaledPixels(img, scale) {
  const w = Math.max(1, Math.round(img.width * scale)),
    h = Math.max(1, Math.round(img.height * scale)),
    data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(img.height - 1, Math.floor(((y + 0.5) * img.height) / h));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(img.width - 1, Math.floor(((x + 0.5) * img.width) / w)),
        i = (y * w + x) * 4,
        j = (sy * img.width + sx) * 4;
      data[i] = img.data[j];
      data[i + 1] = img.data[j + 1];
      data[i + 2] = img.data[j + 2];
      data[i + 3] = img.data[j + 3];
    }
  }
  return { width: w, height: h, data };
}
