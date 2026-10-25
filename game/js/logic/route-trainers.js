// @ts-check
'use strict';
/* ================= ROUTE TRAINERS (roguelite track RL-12b) =================
   Trainers who stand by a run route's road and walk up when they see you, as in Pokémon (the owner's answer, 9.6 28):
   - each route place has rules.json run.trainers.perRoute of them (fewest-most, from the node's stream), each of a
     different class (events.json classes), its Billies from the region's dex at the place's top wild level plus `up`
     (logic/encounters.js encClassFoe); a route trainer beaten leaves a reward pick (logic/rewards.js);
   - where they stand: spread along the road from the hub to the way ahead (west), off to one side and the other in
     turn, facing the road (routeTrainerSpot);
   - they see a straight line `sight` metres long the way they face, a metre and a bit wide (routeInSight); walking
     into it, they spot you: a "!", they walk up, say their line and the battle starts (route-sight.js, the page's).
   Logic only: no DOM, no Date, no Math.random (tools/test/route-trainers.test.mjs). */
/** @import { Run } from '../../types/save-data' */
/** @import { EventsData } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { rngFrom } from './rng.js';
import { runNodeSeed } from './run-map.js';
import { encClassFoe } from './encounters.js';
/* eslint-disable no-func-assign */
expose({
  ROUTE_SIGHT_HALF: [() => ROUTE_SIGHT_HALF],
  // @ts-expect-error -- replaced on purpose
  routeInSight: [() => routeInSight, v => (routeInSight = v)],
  routeTrainerId: [() => routeTrainerId],
  // @ts-expect-error -- replaced on purpose
  routeTrainerSpot: [() => routeTrainerSpot, v => (routeTrainerSpot = v)],
  // @ts-expect-error -- replaced on purpose
  runRouteTrainers: [() => runRouteTrainers, v => (runRouteTrainers = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** half the width of a trainer's line of sight (m) */
export const ROUTE_SIGHT_HALF = 0.9;

/** a route trainer's id @param {number} i the map node @param {number} k its number on the route */
export const routeTrainerId = (i, k) => `run_${i}_t${k}`;

/**
 * The run's route trainers, by id (trainer entries, as runFoes makes them): on each `route` node, perRoute of them,
 * classes drawn without repeats from the node's stream ('route|trainers'), each one's Billies from its own
 * ('route|<k>'). Each carries its line and a script (its line, then the battle) for trainerTalk, `route` {k, n} for
 * where it stands, and pays run.trainers.reward.
 * @param {Run} run @param {{ classes: EventsData['classes'], species: Record<string, any>, rules: any }} data rules:
 *   rules.json run (its trainers and wild)
 * @returns {Record<string, any>}
 */
export function runRouteTrainers(run, data) {
  /** @type {Record<string, any>} */
  const out = {},
    R = data.rules.trainers,
    classes = Object.keys(data.classes).sort();
  if (!run.map || !R || !classes.length) return out;
  run.map.nodes.forEach((node, i) => {
    if (node.type !== 'route') return;
    const g = rngFrom(runNodeSeed(run.seed, i), 'route|trainers'),
      n = Math.min(classes.length, g.int(R.perRoute[0], R.perRoute[1]));
    let left = classes.slice();
    for (let k = 0; k < n; k++) {
      const cls = left[g.int(0, left.length - 1)],
        id = routeTrainerId(i, k);
      left = left.filter(c => c !== cls);
      const T = encClassFoe(run, i, id, cls, {
        classes: data.classes,
        species: data.species,
        rules: data.rules,
        up: R.up,
        salt: 'route|' + k,
        reward: R.reward,
        foe: 'route',
      });
      if (!T.team.length) continue;
      /* RL-S1: a Bureau agent's line is picked by the run history (banter.json bureau) */
      const say = T.bureau ? 'pick bureau' : `“${T.sight}”`;
      out[id] = { ...T, route: { k, n }, script: [say, `battle ${id}`] };
    }
  });
  return out;
}

/**
 * Where route trainer k of n stands in its place, in the place's own metres: along the road from the hub to the way
 * ahead (the westmost exit), at (k + 1) / (n + 1) of the way, `off` metres to the north for even k and to the south
 * for odd ones; `road` is the point of the road it faces. Null without a way ahead.
 * @param {[number, number]} hub @param {[number, number][]} exits @param {number} k @param {number} n
 * @param {number} [off] @returns {{ at: [number, number], road: [number, number] } | null}
 */
export function routeTrainerSpot(hub, exits, k, n, off = 3) {
  if (!exits || !exits.length) return null;
  const ahead = exits.reduce((a, e) => (e[0] < a[0] ? e : a)),
    t = (k + 1) / (n + 1),
    road = /** @type {[number, number]} */ ([hub[0] + (ahead[0] - hub[0]) * t, hub[1] + (ahead[1] - hub[1]) * t]),
    dx = ahead[0] - hub[0],
    dz = ahead[1] - hub[1],
    l = Math.hypot(dx, dz) || 1,
    side = k % 2 ? 1 : -1;
  /* the road's normal, to one side or the other */
  return { at: [road[0] + (-dz / l) * off * side, road[1] + (dx / l) * off * side], road };
}

/** whether a trainer at `at` facing `look` sees the point `p`: within `range` metres ahead of it, ROUTE_SIGHT_HALF to
 * either side @param {[number, number]} at @param {[number, number]} look a point it faces
 * @param {[number, number]} p @param {number} range */
export function routeInSight(at, look, p, range) {
  const fx = look[0] - at[0],
    fz = look[1] - at[1],
    fl = Math.hypot(fx, fz);
  if (!fl) return false;
  const ux = fx / fl,
    uz = fz / fl,
    px = p[0] - at[0],
    pz = p[1] - at[1],
    along = px * ux + pz * uz,
    side = Math.abs(px * -uz + pz * ux);
  return along > 0.3 && along <= range && side <= ROUTE_SIGHT_HALF;
}
