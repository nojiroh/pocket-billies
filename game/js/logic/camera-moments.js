// @ts-check
'use strict';
/* ================= CAMERA MOMENTS (camera track CAM-2) =================
   The moments that frame something for a while, as plain numbers (tools/test/camera-moments.test.mjs). Each frame
   `momentStep` picks at most one, by priority, and hands the walking camera its goal (logic/camera-follow.js
   blendGoals); the others are asked for at weight 0, so they ramp out at their own pace:
   - talk: while someone talks to you, a two-shot (the aim between you and them), zoomed in;
   - boss: the first time you come near a run's boss in a place, a short reveal (the aim leans toward the boss);
   - interest: a landmark or a shop's or clinic's door near you (logic/camera-interest.js), a gentle lean;
   - idle: standing still a few seconds, a slow drift in, gone quickly when you move;
   - run: running, a small ease out.
   The encounter's shot is the swoop (walk/camera.js), above all of these. Nothing starts within a moment of a sharp
   turn (Nesky #35), though what is already on carries on. With reduced motion idle and run are off and the others
   count half. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  MOMENT_DIALS: [() => MOMENT_DIALS],
  // @ts-expect-error -- replaced on purpose
  momentNew: [() => momentNew, v => (momentNew = v)],
  // @ts-expect-error -- replaced on purpose
  momentStep: [() => momentStep, v => (momentStep = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/**
 * @typedef {object} MomentDials
 * @property {boolean} talkOn
 * @property {number} talkZoom
 * @property {number} talkBlend seconds
 * @property {boolean} bossOn
 * @property {number} bossNear metres
 * @property {number} bossTime seconds
 * @property {number} bossZoom
 * @property {number} bossLean metres
 * @property {boolean} arenaOn WM-7: a leader's arena framed while its intro lasts
 * @property {number} arenaZoom
 * @property {number} arenaBlend seconds
 * @property {boolean} idleOn
 * @property {number} idleDelay seconds
 * @property {number} idleZoom
 * @property {number} idleBlend seconds
 * @property {boolean} runOn
 * @property {number} runZoom
 * @property {number} runBlend seconds
 * @property {number} turnHold seconds
 * @property {number} turnAngle degrees
 */
/** @type {MomentDials} */
export const MOMENT_DIALS = {
  talkOn: true,
  talkZoom: 0.75,
  talkBlend: 0.5,
  bossOn: true,
  bossNear: 9,
  bossTime: 2.2,
  bossZoom: 0.85,
  bossLean: 3,
  arenaOn: true,
  arenaZoom: 1.2,
  arenaBlend: 0.7,
  idleOn: true,
  idleDelay: 4,
  idleZoom: 0.9,
  idleBlend: 2,
  runOn: true,
  runZoom: 1.06,
  runBlend: 0.8,
  turnHold: 0.5,
  turnAngle: 60,
};
/**
 * @typedef {object} MomentState
 * @property {number} still seconds standing still
 * @property {number} turn seconds since the last sharp turn
 * @property {number[] | null} dir the last way you pushed
 * @property {Record<string, boolean>} on the moments on now
 * @property {Record<string, boolean>} seen the bosses already revealed
 * @property {{id: string, t: number} | null} boss the reveal under way
 * @property {string | null} id the moment picked last
 */
/** @returns {MomentState} */
export function momentNew() {
  return { still: 0, turn: 99, dir: null, on: {}, seen: {}, boss: null, id: null };
}
/**
 * @typedef {object} MomentInput
 * @property {number} px where you are
 * @property {number} pz
 * @property {boolean} moving walking this frame (or on a route)
 * @property {boolean} running
 * @property {number[]} dir the way you push (length 0-1)
 * @property {number[] | null} talk who talks to you (x, z), while they do
 * @property {{id: string, x: number, z: number} | null} boss the run's boss in this place, if any
 * @property {number[] | null} [arena] WM-7: a leader's arena's middle (x, z), while its intro frames it
 * @property {{w: number, lean: number[], zoom: number} | null} interest the strongest point of interest near you
 * @property {boolean} reduced reduced motion
 */
/**
 * @param {MomentState} st
 * @param {MomentInput} I
 * @param {MomentDials} D
 * @param {number} dt
 * @returns {{id: string | null, goals: import('./camera-follow.js').CameraGoal[]}}
 */
export function momentStep(st, I, D, dt) {
  /* a sharp turn: the way you push swings past the turn angle */
  const dl = Math.hypot(I.dir[0], I.dir[1]);
  if (dl > 0.3) {
    if (st.dir) {
      const c = (I.dir[0] * st.dir[0] + I.dir[1] * st.dir[1]) / dl;
      if (c < Math.cos((D.turnAngle * Math.PI) / 180)) st.turn = 0;
    }
    st.dir = [I.dir[0] / dl, I.dir[1] / dl];
  }
  st.turn += dt;
  st.still = I.moving || I.talk ? 0 : st.still + dt;
  const k = I.reduced ? 0.5 : 1,
    turned = st.turn < D.turnHold,
    /* a moment that may only start away from a sharp turn: on if it was, or if nothing turned just now */
    may = (/** @type {string} */ id, /** @type {boolean} */ want) => want && (st.on[id] || !turned);
  /* the boss's reveal: once a place, the first time you come near */
  if (st.boss && (!I.boss || I.boss.id !== st.boss.id)) st.boss = null;
  if (st.boss) st.boss.t += dt;
  if (D.bossOn && I.boss && !st.seen[I.boss.id] && Math.hypot(I.boss.x - I.px, I.boss.z - I.pz) < D.bossNear) {
    st.seen[I.boss.id] = true;
    st.boss = { id: I.boss.id, t: 0 };
  }
  if (st.boss && st.boss.t > D.bossTime) st.boss = null;
  const want = {
    arena: D.arenaOn && !!I.arena,
    talk: D.talkOn && !!I.talk,
    boss: !!(st.boss && I.boss),
    interest: may('interest', !!I.interest),
    idle: may('idle', D.idleOn && !I.reduced && st.still >= D.idleDelay),
    run: may('run', D.runOn && !I.reduced && I.running && I.moving),
  };
  const id =
    /** @type {(keyof typeof want)[]} */ (['arena', 'talk', 'boss', 'interest', 'idle', 'run']).find(m => want[m]) ||
    null;
  st.id = id;
  for (const m of Object.keys(want)) st.on[m] = m === id;
  /** @type {import('./camera-follow.js').CameraGoal[]} */
  const goals = [];
  const lean = (/** @type {number} */ x, /** @type {number} */ z, /** @type {number} */ cap) => {
    const dx = x - I.px,
      dz = z - I.pz,
      d = Math.hypot(dx, dz),
      s = d > cap ? cap / d : 1;
    return [I.px + dx * s, I.pz + dz * s];
  };
  /* only the moment picked asks; the one before ramps out as it last was, at its own pace (`out`) */
  /* WM-7: a leader's arena: the ring framed, the camera eased out over it, while its intro lasts (before the talk) */
  if (id === 'arena' && I.arena)
    goals.push({ id: 'arena', w: k, blend: D.arenaBlend, out: 0.8, at: [I.arena[0], I.arena[1]], zoom: D.arenaZoom });
  else if (id === 'talk' && I.talk)
    goals.push({
      id: 'talk',
      w: k,
      blend: D.talkBlend,
      at: [(I.px + I.talk[0]) / 2, (I.pz + I.talk[1]) / 2],
      zoom: D.talkZoom,
    });
  else if (id === 'boss' && I.boss)
    goals.push({ id: 'boss', w: k, blend: 0.5, out: 0.8, at: lean(I.boss.x, I.boss.z, D.bossLean), zoom: D.bossZoom });
  else if (id === 'interest' && I.interest)
    goals.push({
      id: 'interest',
      w: I.interest.w * k,
      at: [I.px + I.interest.lean[0], I.pz + I.interest.lean[1]],
      zoom: I.interest.zoom,
    });
  /* idle drifts in slowly and goes quickly */
  else if (id === 'idle') goals.push({ id: 'idle', w: 1, blend: D.idleBlend, out: 0.3, zoom: D.idleZoom });
  else if (id === 'run') goals.push({ id: 'run', w: 1, blend: D.runBlend, zoom: D.runZoom });
  return { id, goals };
}
