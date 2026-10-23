// @ts-check
'use strict';
/* ================= CAMERA FOLLOW (camera track CAM-1) =================
   How the walking camera follows you, as plain numbers (no page, no renderer; tools/test/camera-follow.test.mjs):
   - a critically damped spring per axis (Game Programming Gems 4, 1.10; Unity's SmoothDamp), solved exactly, so it
     moves the same at 30, 60 or 144 frames a second;
   - a dead zone (you move inside it, the camera doesn't) and a soft zone (past the dead zone the camera catches up;
     you never leave the soft zone), both as shares of the screen; while you stand still the dead zone closes, so the
     camera settles on you;
   - a look-ahead from the way you push (the joystick, else the way you walk), smoothed by its own spring, larger
     sideways on a tall screen;
   - small changes of ground height ignored while you walk;
   - goals: the camera's other wishes (look up at a landmark, frame a room, swoop to a battle...) as weights that ramp
     in and out, blended into one aim, one tilt and one distance. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  blendGoals: [() => blendGoals, v => (blendGoals = v)],
  // @ts-expect-error -- replaced on purpose
  followNew: [() => followNew, v => (followNew = v)],
  // @ts-expect-error -- replaced on purpose
  followStep: [() => followStep, v => (followStep = v)],
  // @ts-expect-error -- replaced on purpose
  leadStep: [() => leadStep, v => (leadStep = v)],
  // @ts-expect-error -- replaced on purpose
  springStep: [() => springStep, v => (springStep = v)],
  // @ts-expect-error -- replaced on purpose
  zoneAxis: [() => zoneAxis, v => (zoneAxis = v)],
  // @ts-expect-error -- replaced on purpose
  zoneMetres: [() => zoneMetres, v => (zoneMetres = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/**
 * One step of a critically damped spring from `x` (moving at `v`) toward `target`, over `dt` seconds. `smooth` is
 * the smooth time (seconds): how long it trails behind a target moving at a steady speed. `from` is where the target
 * was at the start of the step (the target moves in a straight line from there during it; leave it out for a target
 * that holds still). Solved exactly, so the result doesn't depend on how the time is cut into frames. A target that
 * holds still is never passed (as SmoothDamp: the speed it had on the way can't carry it beyond).
 * @param {number} x
 * @param {number} v
 * @param {number} target
 * @param {number} smooth
 * @param {number} dt
 * @param {number} [from]
 * @returns {[number, number]} the new position and speed
 */
export function springStep(x, v, target, smooth, dt, from) {
  if (!(smooth > 0)) return [target, 0];
  if (!(dt > 0)) return [x, v];
  const w = 2 / smooth,
    g0 = from ?? target,
    u = (target - g0) / dt,
    /* relative to the target's steady trail (2u/w behind it): a plain critically damped decay */
    c = x - g0 + (2 * u) / w,
    s = v - u,
    a = s + w * c,
    e = Math.exp(-w * dt),
    nx = target - (2 * u) / w + (c + a * dt) * e,
    nv = u + (s - w * a * dt) * e;
  if (u === 0 && (x - target) * (nx - target) < 0) return [target, 0];
  return [nx, nv];
}

/**
 * One axis of the dead and soft zones. `pos` is where the camera aims, `goal` where it would like to aim, `dead` and
 * `soft` the zones' half sizes (metres). Returns where the spring should head (`target`: nowhere new while the goal
 * is inside the dead zone, else so the goal sits on the dead zone's edge) and where the aim must be at least
 * (`pos`: moved only when the goal is past the soft zone, the hard limit). `hold`: the goal is inside the dead zone.
 * @param {number} pos
 * @param {number} goal
 * @param {number} dead
 * @param {number} soft
 */
export function zoneAxis(pos, goal, dead, soft) {
  const d = Math.max(0, dead),
    s = Math.max(d, soft),
    off = goal - pos,
    a = Math.abs(off),
    sg = Math.sign(off);
  return { target: a <= d ? pos : goal - sg * d, pos: a > s ? goal - sg * s : pos, hold: a <= d };
}

/**
 * A zone's half size on the ground (metres) from shares of the screen. `visW` is the view's width on the ground at
 * the aim (metres), `rw` and `rh` the screen's size, `pitch` the camera's tilt (radians): a share of the screen's
 * height covers more ground the flatter the camera looks.
 * @param {number} shareW
 * @param {number} shareH
 * @param {number} visW
 * @param {number} rw
 * @param {number} rh
 * @param {number} pitch
 * @returns {[number, number]} half sizes across (screen right) and along (screen up)
 */
export function zoneMetres(shareW, shareH, visW, rw, rh, pitch) {
  const visH = (visW * rh) / Math.max(1, rw) / Math.max(0.2, Math.sin(pitch));
  return [(Math.max(0, shareW) * visW) / 2, (Math.max(0, shareH) * visH) / 2];
}

/**
 * The follow's state: the aim (`x`, `z`, `y`) and its speed `v`, the look-ahead `lead` and its speed, the targets
 * the springs headed for last frame (`tg` x, z, y and `lt` the look-ahead's; null: none, or held still), how much
 * you are moving (`move`, 0-1, ramped), the goals' weights `w` and each goal as it was last asked for (`last`).
 * @typedef {{ x: number, z: number, y: number, v: number[], lead: number[], leadV: number[], move: number,
 *   tg: (number | null)[], lt: (number | null)[], w: Record<string, number>,
 *   last: Record<string, CameraGoal> }} FollowState
 */
/**
 * A follow state resting at an aim point.
 * @param {number} x
 * @param {number} z
 * @param {number} y
 * @returns {FollowState}
 */
export function followNew(x, z, y) {
  return {
    x,
    z,
    y,
    v: [0, 0, 0],
    lead: [0, 0],
    leadV: [0, 0],
    move: 0,
    tg: [null, null, null],
    lt: [null, null],
    w: {},
    last: {},
  };
}

/**
 * The look-ahead: `dir` is the way you push (world x and z, length 0-1), `dist` how far ahead at full push (metres),
 * `right` the screen's right on the ground ([x, z], length 1), `side` how much more the sideways part reaches on a
 * tall screen (`tall`), `smooth` its spring's smooth time. Moves `st.lead` and returns it.
 * @param {FollowState} st
 * @param {number[]} dir
 * @param {number} dist
 * @param {number[]} right
 * @param {number} side
 * @param {boolean} tall
 * @param {number} smooth
 * @param {number} dt
 */
export function leadStep(st, dir, dist, right, side, tall, smooth, dt) {
  const l = Math.hypot(dir[0], dir[1]),
    k = l > 1 ? 1 / l : 1,
    dx = dir[0] * k * dist,
    dz = dir[1] * k * dist,
    across = dx * right[0] + dz * right[1],
    extra = tall ? across * (side - 1) : 0,
    tx = dx + right[0] * extra,
    tz = dz + right[1] * extra;
  [st.lead[0], st.leadV[0]] = springStep(st.lead[0], st.leadV[0], tx, smooth, dt, st.lt[0] ?? tx);
  [st.lead[1], st.leadV[1]] = springStep(st.lead[1], st.leadV[1], tz, smooth, dt, st.lt[1] ?? tz);
  st.lt = [tx, tz];
  return st.lead;
}

/**
 * @typedef {object} FollowInput
 * @property {number} gx where the camera would like to aim (x), the look-ahead already in it
 * @property {number} gz the same, z
 * @property {number} gy the ground height under you
 * @property {number[]} right the screen's right on the ground ([x, z], length 1)
 * @property {number[]} dead the dead zone's half sizes (metres: across, along)
 * @property {number[]} soft the soft zone's half sizes
 * @property {number} smooth the spring's smooth time (seconds)
 * @property {number} band height changes smaller than this (metres) are ignored while you move
 * @property {boolean} moving whether you are walking (the dead zone and the height band open)
 * @property {number} [free] 0-1: how much the zones apply (a goal that frames something else turns them off)
 */
/**
 * One frame of the follow: the zones, the hard limit and the springs. Moves `st` and returns it.
 * @param {FollowState} st
 * @param {FollowInput} I
 * @param {number} dt
 */
export function followStep(st, I, dt) {
  st.move += ((I.moving ? 1 : 0) - st.move) * (1 - Math.exp(-dt / 0.35));
  const open = st.move * (I.free ?? 1),
    R = I.right,
    F = [-R[1], R[0]],
    /* into the screen's axes: across (right) and along (up the screen) */
    pa = st.x * R[0] + st.z * R[1],
    pf = st.x * F[0] + st.z * F[1],
    ga = I.gx * R[0] + I.gz * R[1],
    gf = I.gx * F[0] + I.gz * F[1],
    A = zoneAxis(pa, ga, I.dead[0] * open, I.soft[0]),
    B = zoneAxis(pf, gf, I.dead[1] * open, I.soft[1]),
    /* the springs run along the screen's axes (a held axis heads for a still target; the others for a target that
       moved from where it was last frame), their speeds and last targets kept on the ground */
    va = st.v[0] * R[0] + st.v[1] * R[1],
    vf = st.v[0] * F[0] + st.v[1] * F[1],
    last =
      st.tg[0] == null || st.tg[1] == null
        ? null
        : [st.tg[0] * R[0] + st.tg[1] * R[1], st.tg[0] * F[0] + st.tg[1] * F[1]],
    /* where the target was last frame: none when held, or when it jumped further than the soft zone (a cut, not a
       move) */
    fromOf = (
      /** @type {{ hold: boolean, target: number }} */ Z,
      /** @type {number | undefined} */ l,
      /** @type {number} */ s
    ) => (Z.hold || l == null || Math.abs(Z.target - l) > s ? undefined : l),
    [na0, nva] = springStep(A.pos, va, A.target, I.smooth, dt, fromOf(A, last?.[0], I.soft[0])),
    [nf0, nvf] = springStep(B.pos, vf, B.target, I.smooth, dt, fromOf(B, last?.[1], I.soft[1])),
    /* the hard limit holds after the step too */
    na = zoneAxis(na0, ga, 0, I.soft[0]).pos,
    nf = zoneAxis(nf0, gf, 0, I.soft[1]).pos,
    back = (/** @type {number} */ a, /** @type {number} */ f) => [a * R[0] + f * F[0], a * R[1] + f * F[1]];
  [st.x, st.z] = back(na, nf);
  [st.v[0], st.v[1]] = back(nva, nvf);
  const tg = back(A.target, B.target),
    H = zoneAxis(st.y, I.gy, I.band * st.move, Infinity);
  [st.y, st.v[2]] = springStep(
    st.y,
    st.v[2],
    H.target,
    I.smooth,
    dt,
    H.hold || st.tg[2] == null ? undefined : st.tg[2]
  );
  st.tg = [tg[0], tg[1], H.hold ? null : H.target];
  return st;
}

/**
 * @typedef {object} CameraGoal
 * @property {string} id
 * @property {number} w how much it wants to apply now (0-1)
 * @property {number} [blend] its own ramp time (seconds; 0: no ramp), else the common one
 * @property {number} [out] CAM-2: its ramp time going out, if not the same
 * @property {number} [pitch] degrees added to the tilt at full weight
 * @property {number} [yaw] radians added to the turn at full weight
 * @property {number} [dist] the distance's factor at full weight
 * @property {number} [zoom] CAM-2: the zoom's factor at full weight (logic/camera-zoom.js turns the zoom into tilt,
 *   distance and field of view)
 * @property {number[]} [at] an aim point ([x, z]) it pulls toward
 */
/**
 * Blends the goals into one: each goal's weight ramps toward what it asks (`st.w`, by id; a goal that stops being
 * asked for ramps out as it last was, `st.last`), then the tilts add up, the distance and zoom factors multiply and the aim points pull in order. `snap` jumps
 * every weight to its target.
 * @param {FollowState} st
 * @param {CameraGoal[]} goals
 * @param {number} dt
 * @param {number} blend
 * @param {boolean} [snap]
 */
export function blendGoals(st, goals, dt, blend, snap) {
  const seen = new Set(),
    out = {
      pitch: 0,
      yaw: 0,
      dist: 1,
      zoom: 1,
      at: /** @type {number[] | null} */ (null),
      atW: 0,
      list: /** @type {[string, number][]} */ ([]),
    };
  const ramp = (
    /** @type {string} */ id,
    /** @type {number} */ to,
    /** @type {number | undefined} */ b,
    /** @type {number | undefined} */ o
  ) => {
    const w0 = st.w[id] ?? 0,
      t = (to < w0 ? o : undefined) ?? b ?? blend,
      w = snap || !(t > 0) ? to : w0 + (to - w0) * (1 - Math.exp(-dt / t));
    if (w < 1e-3 && to === 0) delete st.w[id];
    else st.w[id] = w;
    return w < 1e-3 ? 0 : w;
  };
  let keep = 1;
  const pulls = /** @type {[number[], number][]} */ ([]),
    /* a goal that isn't asked for this frame ramps out as it last was (its tilt, its aim point) */
    all = goals.concat(
      Object.keys(st.w)
        .filter(id => !goals.some(g => g.id === id) && st.last[id])
        .map(id => ({ ...st.last[id], w: 0 }))
    );
  for (const g of all) {
    seen.add(g.id);
    st.last[g.id] = g;
    const w = ramp(g.id, Math.max(0, Math.min(1, g.w)), g.blend, g.out);
    if (!(g.id in st.w)) delete st.last[g.id];
    if (!w) continue;
    out.list.push([g.id, w]);
    out.pitch += (g.pitch || 0) * w;
    out.yaw += (g.yaw || 0) * w;
    if (g.dist != null) out.dist *= 1 + (g.dist - 1) * w;
    if (g.zoom != null) out.zoom *= 1 + (g.zoom - 1) * w;
    if (g.at) {
      pulls.push([g.at, w]);
      keep *= 1 - w;
    }
  }
  for (const id of Object.keys(st.w)) if (!seen.has(id)) delete st.w[id];
  /* each pull moves the aim toward its point by its weight, in order: the follow's own aim keeps `keep` of it and
     the points share the rest (`at` is their mix, `atW` how much it counts) */
  if (pulls.length && keep < 1) {
    let ax = 0,
      az = 0;
    for (const [p, w] of pulls) {
      ax += (p[0] - ax) * w;
      az += (p[1] - az) * w;
    }
    out.at = [ax / (1 - keep), az / (1 - keep)];
    out.atW = 1 - keep;
  }
  return out;
}
