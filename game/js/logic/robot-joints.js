// @ts-check
'use strict';
/* ================= ROBOT JOINTS (studio track ST-5) =================
   Where a robot part's picture joins the others (game/data/robots.json, a part's art.joints and a torso's
   art.headJoints): per view, the point it hangs from and turns around (pivot), a torso's sockets by the socket
   standard (neck, shoulderL, shoulderR, hipL, hipR, hip for treads and hover, gem) and its draw order. Stored points
   are fractions of the picture, x right and y down, and belong to the part's own picture: a stand-in drawn from its
   colour and shape always uses the computed points. What is not stored is computed as robot-art.js always placed it
   (a front point from the picture's size; a back socket at the front's offset from the pivot, since the front and
   back pictures differ by a pixel or two). robotKit shows robots.json to the workbench as a part kit, so Part mode's
   overlay and part-joints.js partFit work on robots unchanged.
   Logic only: no DOM, runs in Node. The game's rig, the Studio and the tests place robots the same way. */
/** @import { RobotData, RobotPart, RobotJoint, RobotJoints, PartKits, KitPart } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  ROBOT_SOCKET_SLOTS: [() => ROBOT_SOCKET_SLOTS],
  ROBOT_Z: [() => ROBOT_Z],
  robotFrac: [() => robotFrac],
  robotGemId: [() => robotGemId],
  robotHeadId: [() => robotHeadId],
  // @ts-expect-error -- replaced on purpose
  robotJoint: [() => robotJoint, v => (robotJoint = v)],
  // @ts-expect-error -- replaced on purpose
  robotJointComputed: [() => robotJointComputed, v => (robotJointComputed = v)],
  // @ts-expect-error -- replaced on purpose
  robotJointSet: [() => robotJointSet, v => (robotJointSet = v)],
  // @ts-expect-error -- replaced on purpose
  robotKit: [() => robotKit, v => (robotKit = v)],
  // @ts-expect-error -- replaced on purpose
  robotKitPart: [() => robotKitPart, v => (robotKitPart = v)],
  robotPx: [() => robotPx],
  robotSingleLegs: [() => robotSingleLegs],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the socket standard: socket -> the slot that attaches there */
export const ROBOT_SOCKET_SLOTS = /** @type {const} */ ({
  neck: 'head',
  shoulderL: 'arm',
  shoulderR: 'arm',
  hipL: 'legs',
  hipR: 'legs',
  hip: 'legs',
  gem: 'gem',
});
/** @typedef {'torso' | 'head' | 'arm' | 'legs' | 'gem'} RobotPiece */
/** each piece's draw order per view (as robot-art.js always drew them) */
export const ROBOT_Z = /** @type {Record<RobotPiece, { front: number, back: number }>} */ ({
  torso: { front: 5, back: 5 },
  head: { front: 9, back: 9 },
  arm: { front: 8, back: 2 },
  legs: { front: 4, back: 4 },
  gem: { front: 6, back: 6 },
});
/** treads and hover are one undercarriage on the middle hip; legs are one leg drawn at each side */
export const robotSingleLegs = (/** @type {RobotPart} */ L) => L.art.shape === 'treads' || L.art.shape === 'hover';

/**
 * @typedef {{ pivot: [number, number], sockets: Record<string, [number, number]>, z: number }} RobotJointPx
 * A joint in picture pixels (whole numbers): pivot and sockets measured from the picture's top left.
 */
/** a piece's joint worked out from its picture's size, as robot-art.js always placed it
 * @param {RobotPiece} piece @param {number} w @param {number} h @param {'front'|'back'} [view] @returns {RobotJointPx} */
export function robotJointComputed(piece, w, h, view = 'front') {
  const cx = Math.floor(w / 2),
    z = ROBOT_Z[piece][view];
  if (piece === 'torso') {
    const sh = h - Math.round(h * 0.62),
      hip = h - 2;
    return {
      pivot: [cx, h],
      sockets: {
        neck: [cx, 3],
        shoulderL: [cx - Math.round(w / 2) + 1, sh],
        shoulderR: [cx + Math.round(w / 2) - 1, sh],
        hipL: [cx - Math.round(w / 4), hip],
        hipR: [cx + Math.round(w / 4), hip],
        hip: [cx, hip],
        gem: [cx, h - Math.round(h * 0.5)],
      },
      z,
    };
  }
  if (piece === 'head') return { pivot: [cx, h - 2], sockets: {}, z };
  if (piece === 'gem') return { pivot: [cx, Math.floor(h / 2)], sockets: {}, z };
  return { pivot: [cx, 0], sockets: {}, z };
}
/** a fraction of a picture's size as a whole pixel @param {[number, number]} f @param {number} w @param {number} h
 * @returns {[number, number]} */
export const robotPx = (f, w, h) => [Math.round(f[0] * w), Math.round(f[1] * h)];
/** a pixel as a fraction of the picture (3 decimals: exact back to the pixel for pictures up to 500 px)
 * @param {[number, number]} p @param {number} w @param {number} h @returns {[number, number]} */
export const robotFrac = (p, w, h) => [Math.round((p[0] / w) * 1000) / 1000, Math.round((p[1] / h) * 1000) / 1000];

/**
 * A piece's joint in one view, in that view's picture pixels: stored points where it has them (on its own picture),
 * else computed. A back socket not stored keeps the front's offset from the pivot.
 * @param {RobotPiece} piece
 * @param {RobotJoints | undefined} stored the part's art.joints (art.headJoints for a head)
 * @param {'front'|'back'} view
 * @param {{ front: [number, number], back: [number, number] }} size each view's picture as drawn, [w, h]
 * @param {{ front: boolean, back: boolean }} own whether each view draws the part's own picture (not a stand-in)
 * @returns {RobotJointPx}
 */
export function robotJoint(piece, stored, view, size, own) {
  /* a back drawn with the front's picture (no back picture of its own) joins as the front does */
  if (view === 'back' && !own.back && own.front) return robotJoint(piece, stored, 'front', size, own);
  const [w, h] = size[view],
    S = /** @type {RobotJoint} */ ((own[view] && stored?.[view]) || {}),
    C = robotJointComputed(piece, w, h, view),
    pivot = S.pivot ? robotPx(S.pivot, w, h) : C.pivot,
    front = view === 'back' ? robotJoint(piece, stored, 'front', size, own) : null,
    sockets = /** @type {Record<string, [number, number]>} */ ({});
  for (const [n, p] of Object.entries(C.sockets)) {
    const s = S.sockets?.[/** @type {keyof RobotJoint['sockets']} */ (n)];
    if (s) sockets[n] = robotPx(s, w, h);
    else if (front) {
      const f = front.sockets[n];
      sockets[n] = [pivot[0] + f[0] - front.pivot[0], pivot[1] + f[1] - front.pivot[1]];
    } else sockets[n] = p;
  }
  return { pivot, sockets, z: S.z ?? C.z };
}

/* ---------- robots.json as a part kit, for the workbench's Part mode ---------- */
/** the kit part id of a torso's head */
export const robotHeadId = (/** @type {string} */ id) => id + ':head';
/** the kit part id of a gem */
export const robotGemId = (/** @type {string} */ id) => 'gem:' + id;
/** the robots.json part (and whether it is a torso's head) a kit part id names, or null
 * @param {RobotData} D @param {string} kitId @returns {{ id: string, part: RobotPart, head: boolean } | null} */
export function robotKitPart(D, kitId) {
  const head = kitId.endsWith(':head'),
    id = head ? kitId.slice(0, -5) : kitId,
    part = D.parts[id];
  return part && (!head || part.slot === 'torso') ? { id, part, head } : null;
}
/**
 * robots.json as part kits (game/data/partKits.json's shape): each part with a picture, a torso's head as
 * `<torso>:head`, each gem as `gem:<id>`, every point the one the game draws (stored or computed). Arms and legs are
 * drawn the same on both sides (not mirrored), so each gets a hidden copy for the right side (`<id>_r`, `mirrorOf`)
 * that partForSide picks. size(path) is a picture's [w, h], or null while it is not loaded (that view is left out).
 * @param {RobotData} D @param {(path: string) => [number, number] | null} size @returns {PartKits & { robots: true }}
 */
export function robotKit(D, size) {
  const parts = /** @type {Record<string, KitPart & { hidden?: boolean, robot: string }>} */ ({});
  /** @param {string} kitId @param {string} robot @param {RobotPiece} piece @param {string | undefined} front
   *  @param {string | undefined} back @param {RobotJoints | undefined} stored @param {[number, number] | undefined} turn */
  const add = (kitId, robot, piece, front, back, stored, turn) => {
    const sf = front ? size(front) : null,
      sb = back ? size(back) : null;
    if (!sf && !sb) return;
    /** @type {{ front: [number, number], back: [number, number] }} */
    const sz = { front: sf || /** @type {[number, number]} */ (sb), back: sb || /** @type {[number, number]} */ (sf) },
      own = { front: !!sf, back: !!sb },
      views = /** @type {KitPart['views']} */ ({}),
      z = /** @type {{ front?: number, back?: number }} */ ({});
    for (const [view, file, s] of /** @type {const} */ ([
      ['front', front, sf],
      ['back', back, sb],
    ])) {
      if (!file || !s) continue;
      const J = robotJoint(piece, stored, view, sz, own),
        sockets = /** @type {Record<string, [number, number]>} */ ({});
      for (const [n, p] of Object.entries(J.sockets)) sockets[n] = robotFrac(p, s[0], s[1]);
      views[view] = { file, w: s[0], h: s[1], pivot: robotFrac(J.pivot, s[0], s[1]), sockets };
      z[view] = J.z;
    }
    const P = /** @type {KitPart & { hidden?: boolean, robot: string }} */ ({
      kit: 'robots',
      animal: 'robot',
      kind: piece,
      slot: /** @type {any} */ (piece),
      pivot: views.front?.pivot || /** @type {[number, number]} */ (views.back?.pivot),
      size: 'M',
      views,
      z,
      robot,
    });
    if (turn) P.turn = turn;
    parts[kitId] = P;
    if (piece === 'arm' || piece === 'legs') parts[kitId + '_r'] = { ...P, mirrorOf: kitId, hidden: true };
  };
  for (const [id, P] of Object.entries(D.parts || {})) {
    const A = P.art,
      piece = /** @type {RobotPiece} */ (P.slot);
    add(id, id, piece, A.img, A.imgB, A.joints, A.turn);
    if (P.slot === 'torso') add(robotHeadId(id), id, 'head', A.head, A.headB, A.headJoints, A.headTurn);
  }
  for (const [id, G] of Object.entries(D.gems || {}))
    if (G.img) add(robotGemId(id), id, 'gem', G.img, undefined, undefined, undefined);
  /** @type {Record<string, any>} */
  const socketRules = {};
  for (const [n, slot] of Object.entries(ROBOT_SOCKET_SLOTS)) socketRules[n] = [slot];
  return {
    robots: true,
    sides: { arm: 'L', legs: 'L' },
    z: ROBOT_Z,
    socketRules,
    parts,
  };
}
/** what Part mode stores when a point is moved: the part's joints with one view's pivot, socket or draw order set
 * (a fraction of that view's picture), or with it removed (value null: back to computed)
 * @param {RobotJoints | undefined} stored @param {'front'|'back'} view @param {'pivot'|'z'|string} key a socket name,
 *  'pivot' or 'z' @param {[number, number] | number | null} value @returns {RobotJoints | undefined} */
export function robotJointSet(stored, view, key, value) {
  const out = /** @type {RobotJoints} */ (JSON.parse(JSON.stringify(stored || {}))),
    J = /** @type {RobotJoint} */ (out[view] || {});
  if (key === 'pivot' || key === 'z') {
    const R = /** @type {Record<string, any>} */ (J);
    if (value == null) delete R[key];
    else R[key] = value;
  } else {
    const S = /** @type {Record<string, [number, number]>} */ (J.sockets || {});
    if (value == null) delete S[key];
    else S[key] = /** @type {[number, number]} */ (value);
    if (Object.keys(S).length) J.sockets = S;
    else delete J.sockets;
  }
  if (Object.keys(J).length) out[view] = J;
  else delete out[view];
  return Object.keys(out).length ? out : undefined;
}
