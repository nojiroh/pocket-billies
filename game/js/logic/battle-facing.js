// @ts-check
'use strict';
/* ================= A BATTLE'S FACING: THE WATER BEHIND IT (water track WA-7) =================
   A battle happens where you stand (battle-3d.js), filmed from behind your side towards the other, which looked north
   always. By a lake, a river or the coast (the owner, 2026-10-25: water backdrops on battle stages) it turns, the
   whole battle round the middle of the action, so the scene's own water lies behind the two sides: the backdrop is the
   walk's water itself, in its pixel style. It turns only when water lies within BATTLE_WATER_REACH of the middle, when
   the turned view shows clearly more of it than north does (water behind trees or a house is not counted), and
   where nobody would stand in water or off the map.
   Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  BATTLE_WATER_REACH: [() => BATTLE_WATER_REACH],
  BETTER_BY: [() => BETTER_BY],
  HIDDEN_NEAR: [() => HIDDEN_NEAR],
  TURNS: [() => TURNS],
  VIEW_FAR: [() => VIEW_FAR],
  VIEW_HALF: [() => VIEW_HALF],
  VIEW_NEAR: [() => VIEW_NEAR],
  // @ts-expect-error -- replaced on purpose
  battleTurnPoint: [() => battleTurnPoint, v => (battleTurnPoint = v)],
  // @ts-expect-error -- replaced on purpose
  battleWaterFacing: [() => battleWaterFacing, v => (battleWaterFacing = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** water this close to the middle of the action (metres) turns a battle: further off, a pond seen from the battle
 * camera's 1.6 m is a thin line under the depth of field's blur (WA-7's pictures: a pond 15-19 m away), and a turn
 * that shows no water gains nothing */
export const BATTLE_WATER_REACH = 12;
/* the view: water counts from this far in front of the camera to the far end, within the frame's half width a metre
   ahead (battle-stage.js: FOCAL_LENGTH 170 over the 224 px frame); the turns tried; how much more water a turn must
   show (in counted tiles, each nearer one counting more) */
export const VIEW_NEAR = 6.5,
  VIEW_FAR = 30,
  VIEW_HALF = 0.62,
  TURNS = 16,
  BETTER_BY = 4,
  /* blockers this close to the middle stand in the lane a battle clears (battle-3d.js hides them) */
  HIDDEN_NEAR = 3.5;

/** a battle-space point (x, z) as the walk scene's metres, turned by yaw round the middle of the action c; the
 * battle's forward (+z) becomes (sin yaw, cos yaw), as walk/camera.js battleCamera reads a camera's yaw
 * @param {number} x @param {number} z @param {number} yaw @param {{x: number, z: number}} c @param {number[]} off
 * @returns {[number, number]} */
export function battleTurnPoint(x, z, yaw, c, off) {
  const dx = x - c.x,
    dz = z - c.z,
    cs = Math.cos(yaw),
    sn = Math.sin(yaw);
  return [c.x + off[0] + dx * cs + dz * sn, c.z + off[1] - dx * sn + dz * cs];
}

/** the yaw (radians, 0 north) that puts the most water behind the battle, or 0
 * @param {{water: number[][], w: number, h: number, c: {x: number, z: number}, off: number[], spots: {x: number, z: number}[], wet?: (x: number, z: number) => boolean, blockers?: number[][]}} o
 *   water: the scene's water tiles' middles [x, z]; w, h: the scene's size; c: the middle of the action (battle
 *   space); off: battle space to the scene; spots: where the fighters, trainers and the camera stand (battle space);
 *   wet: whether a scene point is water (by default: within the water tiles); blockers: what stands up in the scene
 *   ([x, z, radius]: trees, buildings), hiding the water behind it (those beside the fighters are hidden in a battle)
 * @returns {number} */
export function battleWaterFacing(o) {
  const { water, w, h, c, off, spots } = o;
  if (!water || !water.length) return 0;
  const mx = c.x + off[0],
    mz = c.z + off[1],
    B = (o.blockers || []).filter(b => {
      const d = Math.hypot(b[0] - mx, b[1] - mz);
      return d > HIDDEN_NEAR && d < VIEW_FAR;
    }),
    /* a tile seen from the middle of the action: nothing standing within its radius of the line to it */
    seen = (/** @type {number[]} */ p) => {
      const dx = p[0] - mx,
        dz = p[1] - mz,
        L = Math.hypot(dx, dz);
      return !B.some(b => {
        const t = ((b[0] - mx) * dx + (b[1] - mz) * dz) / (L * L);
        if (t <= 0 || t * L > L - 0.5) return false;
        return Math.hypot(mx + dx * t - b[0], mz + dz * t - b[1]) < b[2] + 0.3;
      });
    },
    near = water.filter(p => Math.hypot(p[0] - mx, p[1] - mz) <= BATTLE_WATER_REACH + VIEW_FAR && seen(p));
  if (!near.some(p => Math.hypot(p[0] - mx, p[1] - mz) <= BATTLE_WATER_REACH)) return 0;
  const set = new Set(water.map(p => Math.floor(p[0]) + ',' + Math.floor(p[1]))),
    wet = o.wet || ((x, z) => set.has(Math.floor(x) + ',' + Math.floor(z)));
  /* camera at the battle's origin: a tile's place in the turned battle's view */
  const score = yaw => {
    const cs = Math.cos(yaw),
      sn = Math.sin(yaw);
    let s = 0;
    for (const p of near) {
      const dx = p[0] - mx,
        dz = p[1] - mz,
        bx = c.x + dx * cs - dz * sn,
        bz = c.z + dx * sn + dz * cs;
      if (bz < VIEW_NEAR || bz > VIEW_FAR || Math.abs(bx) > bz * VIEW_HALF) continue;
      s += 1 / (1 + (bz - VIEW_NEAR) / 10);
    }
    return s;
  };
  const fits = yaw =>
    spots.every(q => {
      const [x, z] = battleTurnPoint(q.x, q.z, yaw, c, off);
      return x > 0.5 && z > 0.5 && x < w - 0.5 && z < h - 0.5 && !wet(x, z);
    });
  const s0 = score(0);
  let best = 0,
    bs = s0;
  for (let k = 1; k < TURNS; k++) {
    /* nearer turns first, so a tie keeps the smaller one */
    const yaw = (Math.ceil(k / 2) * (k % 2 ? 1 : -1) * 2 * Math.PI) / TURNS;
    const s = score(yaw);
    if (s > bs + 1e-9 && fits(yaw)) {
      best = yaw;
      bs = s;
    }
  }
  return bs >= s0 + BETTER_BY ? best : 0;
}
