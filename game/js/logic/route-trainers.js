// @ts-check
'use strict';
/* ================= ROUTE TRAINERS (roguelite track RL-12b) =================
   Trainers who stand by a run route's road and walk up when they see you, as in Pokémon (the owner's answer, 9.6 28):
   - each route place has rules.json run.trainers.perRoute of them by its row (fewest-most, from the node's stream),
     each of a different class (events.json classes), its Billies from the region's dex at the place's top wild level
     plus `up` (logic/encounters.js encClassFoe); a route trainer beaten leaves a reward pick (logic/rewards.js);
   - RT-2: about half of them (`required`) stand by the road, where you can't help being seen; the rest are optional,
     in the layout's pockets, clearings and dead ends; now and then (`pair`) two stand together and fight as a double
     battle, one entry with both teams that counts as two;
   - where they stand: on the spots the generator marked (logic/mapgen.js mapgenLayoutSpots), the kinds its class
     likes first (events.json classes.<c>.likes), facing the way the spot faces (routeTrainersPlace);
   - they see a straight line `sight` metres long the way they face, a metre and a bit wide (routeInSight); walking
     into it, they spot you: a "!", they walk up, say their line and the battle starts (route-sight.js, the page's).
   RL-14: a scrapyard's agents stand and fight the same way (scrapyardAgents).
   Logic only: no DOM, no Date, no Math.random (tools/test/route-trainers.test.mjs). */
/** @import { Run } from '../../types/save-data' */
/** @import { EventsData } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { FACTIONS } from '../game-data.js';
import { rngFrom } from './rng.js';
import { runNodeSeed } from './run-map.js';
import { MAPGEN_WET, mapgenResample } from './mapgen.js';
import { encClassFoe } from './encounters.js';
/* eslint-disable no-func-assign */
expose({
  ROUTE_ARENA_GAP: [() => ROUTE_ARENA_GAP],
  ROUTE_ARENA_IN: [() => ROUTE_ARENA_IN],
  ROUTE_ARENA_MIN: [() => ROUTE_ARENA_MIN],
  ROUTE_ARENA_OFF: [() => ROUTE_ARENA_OFF],
  ROUTE_RARE_SPOTS: [() => ROUTE_RARE_SPOTS],
  ROUTE_SIGHT_HALF: [() => ROUTE_SIGHT_HALF],
  ROUTE_SPOTS: [() => ROUTE_SPOTS],
  // @ts-expect-error -- replaced on purpose
  routeArenaLine: [() => routeArenaLine, v => (routeArenaLine = v)],
  // @ts-expect-error -- replaced on purpose
  routeInSight: [() => routeInSight, v => (routeInSight = v)],
  // @ts-expect-error -- replaced on purpose
  routeRareSpots: [() => routeRareSpots, v => (routeRareSpots = v)],
  // @ts-expect-error -- replaced on purpose
  routeTrainerCount: [() => routeTrainerCount, v => (routeTrainerCount = v)],
  routeTrainerId: [() => routeTrainerId],
  // @ts-expect-error -- replaced on purpose
  routeTrainerTally: [() => routeTrainerTally, v => (routeTrainerTally = v)],
  // @ts-expect-error -- replaced on purpose
  routeTrainersPlace: [() => routeTrainersPlace, v => (routeTrainersPlace = v)],
  routeUnderCanopy: [() => routeUnderCanopy],
  // @ts-expect-error -- replaced on purpose
  routeWaySpot: [() => routeWaySpot, v => (routeWaySpot = v)],
  // @ts-expect-error -- replaced on purpose
  routeWet: [() => routeWet, v => (routeWet = v)],
  // @ts-expect-error -- replaced on purpose
  runRouteTrainers: [() => runRouteTrainers, v => (runRouteTrainers = v)],
  // @ts-expect-error -- replaced on purpose
  scrapyardAgents: [() => scrapyardAgents, v => (scrapyardAgents = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** half the width of a trainer's line of sight (m) */
export const ROUTE_SIGHT_HALF = 0.9;

/** RT-2: the spot kinds a required trainer stands on (by the road: its sight crosses it) and an optional one's */
export const ROUTE_SPOTS = {
  road: ['roadside', 'pinch', 'bridge'],
  aside: ['pocket', 'clearing', 'deadend'],
};

/** a route trainer's id @param {number} i the map node @param {number} k its number on the route */
export const routeTrainerId = (i, k) => `run_${i}_t${k}`;

/** how many trainers stand on route node i's place (a pair counts as two), from its row: rules.json
 * run.trainers.perRoute is [fewest, most] by row from the first route row on, the last for every row after
 * @param {{ row: number }} node @param {any} R rules.json run.trainers @param {{ int: (a: number, b: number) => number }} g */
export function routeTrainerCount(node, R, g) {
  const rows = R.perRoute,
    [lo, hi] = rows[Math.max(0, Math.min(rows.length - 1, node.row - 1))];
  return g.int(lo, hi);
}

/**
 * The run's route trainers, by id (trainer entries, as runFoes makes them): on each `route` node, routeTrainerCount
 * of them, classes drawn without repeats from the node's stream ('route|trainers'), each one's Billies from its own
 * ('route|<k>'). The first `required` share stand by the road, the rest aside (`route.opt`); with the `pair` chance
 * ('route|pair') the first entry is two trainers fought together as a double (its own two classes, at most two
 * Billies each, paying both rewards; the second class is `mate`). Each carries its line(s) and a script (the lines,
 * then the battle) for trainerTalk and `route` {k, n, opt}; where it stands comes later, from the place's scene
 * (routeTrainersPlace). WM-7: on each `miniboss` node, arenas.json trainers of them, all required, no pair (with
 * data.arenas).
 * @param {Run} run @param {{ classes: EventsData['classes'], species: Record<string, any>, rules: any,
 *   arenas?: import('../../types/game-data').ArenasData | null }} data rules: rules.json run (its trainers and wild)
 * @returns {Record<string, any>}
 */
export function runRouteTrainers(run, data) {
  /** @type {Record<string, any>} */
  const out = {},
    R = data.rules.trainers,
    classes = Object.keys(data.classes).sort();
  if (!run.map || !R || !classes.length) return out;
  run.map.nodes.forEach((node, i) => {
    /* RL-14: a scrapyard's agents (factions.json scrapyard) */
    if (node.type === 'scrapyard') return Object.assign(out, scrapyardAgents(run, i, data));
    /* WM-7: a mini-boss's place has a line of them before its leader's ring (arenas.json trainers), all by the road,
       no pair, from a stream of their own ('arena|trainers') */
    const arena = node.type === 'miniboss' && data.arenas ? data.arenas.trainers : 0;
    if (node.type !== 'route' && !arena) return;
    const seed = runNodeSeed(run.seed, i),
      g = rngFrom(seed, arena ? 'arena|trainers' : 'route|trainers'),
      total = Math.min(classes.length, arena || routeTrainerCount(node, R, g)),
      pair = !arena && total >= 2 && rngFrom(seed, 'route|pair').chance(R.pair || 0),
      n = pair ? total - 1 : total,
      need = arena ? total : Math.max(1, Math.round(total * (R.required ?? 1)));
    let left = classes.slice();
    const draw = () => {
      const c = left[g.int(0, left.length - 1)];
      left = left.filter(x => x !== c);
      return c;
    };
    /* how many trainers stand ahead of entry k (a pair is two) */
    const before = k => k + (pair && k > 0 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const cls = draw(),
        mate = pair && k === 0 ? draw() : null,
        id = routeTrainerId(i, k),
        foe = (/** @type {string} */ c, /** @type {string} */ salt) =>
          encClassFoe(run, i, id, c, {
            classes: data.classes,
            species: data.species,
            rules: data.rules,
            up: R.up,
            salt,
            reward: R.reward,
            foe: 'route',
          }),
        T = foe(cls, 'route|' + k),
        route = { k, n, opt: before(k) >= need },
        /* RL-S1: a Bureau agent's line is picked by the run history (banter.json bureau) */
        say = T.bureau ? 'pick bureau' : `“${T.sight}”`;
      if (!mate) {
        if (!T.team.length) continue;
        out[id] = { ...T, route, script: [say, `battle ${id}`] };
        continue;
      }
      const B = foe(mate, 'route|' + k + '|b'),
        team = [...T.team.slice(-2), ...B.team.slice(-2)];
      if (team.length < 2) continue;
      const M = data.classes[mate];
      out[id] = {
        ...T,
        name: `${T.name} & ${B.name}`,
        team,
        double: true,
        reward: T.reward + B.reward,
        mate: { cls: mate, who: B.who, name: M.name },
        route,
        script: [say, `${B.who}: “${B.sight}”`, `battle ${id}`],
      };
    }
  });
  return out;
}

/** RL-14: a scrapyard's agents, by id as route trainers are: [least, most] of its faction's scrapyard classes (the
 * first faction by id that has some), drawn from the node's own stream ('scrapyard|agents'), each fielding its bots
 * (encClassFoe), standing by the road (none optional, no pairs), paying a route trainer's reward
 * @param {Run} run @param {number} i @param {{ classes: EventsData['classes'], species: Record<string, any>, rules: any,
 *   factions?: Record<string, import('../../types/game-data').Faction> }} data @returns {Record<string, any>} */
export function scrapyardAgents(run, i, data) {
  const all = data.factions || FACTIONS,
    id = Object.keys(all)
      .sort()
      .find(k => all[k].scrapyard.classes.some(c => data.classes[c])),
    out = /** @type {Record<string, any>} */ ({});
  if (!id) return out;
  const F = all[id],
    classes = F.scrapyard.classes.filter(c => data.classes[c]),
    g = rngFrom(runNodeSeed(run.seed, i), 'scrapyard|agents'),
    n = g.int(F.scrapyard.trainers[0], F.scrapyard.trainers[1]),
    R = data.rules.trainers;
  for (let k = 0; k < n; k++) {
    const tid = routeTrainerId(i, k),
      cls = classes[g.int(0, classes.length - 1)],
      T = encClassFoe(run, i, tid, cls, {
        classes: data.classes,
        species: data.species,
        rules: data.rules,
        up: R.up,
        salt: 'scrapyard|' + k,
        reward: R.reward,
        foe: 'route',
        factions: all,
      });
    if (!T.team.length) continue;
    out[tid] = {
      ...T,
      route: { k, n, opt: false },
      script: [T.bureau ? 'pick bureau' : `“${T.sight}”`, `battle ${tid}`],
    };
  }
  return out;
}

/** RT-2: how many route trainers each map node has (a pair is two), for its wild stock (logic/rules.js
 * encounterStock) @param {Record<string, any>} trainers runRouteTrainers' @returns {Record<number, number>} */
export function routeTrainerTally(trainers) {
  /** @type {Record<number, number>} */
  const out = {};
  for (const T of Object.values(trainers))
    if (T.route && T.runNode != null) out[T.runNode] = (out[T.runNode] || 0) + (T.mate ? 2 : 1);
  return out;
}

/**
 * RT-2: where each route trainer stands, from its place's scene (the generator's spots, in the scene's own metres):
 * `route.at`, `route.look` (a point 2 m the way it faces), `route.spot` (the spot's kind) and, for a pair,
 * `route.mate` (where the second stands, 1.2 m to the side). Required ones take ROUTE_SPOTS.road, optional ones
 * ROUTE_SPOTS.aside, the kinds their class likes first, drawn from the node's 'route|spots' stream, each spot 6 m
 * from the ones taken; when a place runs out of one, the other; with no spot left, a point 3 m off the way ahead.
 * Changes the entries in place.
 * @param {Run} run @param {Record<string, any>} trainers runRouteTrainers' @param {any[]} scenes the run's, by node
 * @param {EventsData['classes']} classes
 */
export function routeTrainersPlace(run, trainers, scenes, classes) {
  if (!run.map) return;
  /** @type {Record<number, any[]>} */
  const byNode = {};
  for (const T of Object.values(trainers)) if (T.route && T.runNode != null) (byNode[T.runNode] ||= []).push(T);
  for (const [ni, list] of Object.entries(byNode)) {
    const i = +ni,
      sc = scenes[i];
    if (!sc) continue;
    /* WM-7: before a leader's ring they stand in a line on the road (routeArenaLine); WM-3b: on the generator's spots
       as on any route when the ring is too near the way in for a line (3 leader places in 300) */
    if (sc.arena && sc.arena.mode === 'leader' && list.every((_, k) => routeArenaLine(sc, k, list.length))) {
      list.sort((a, b) => a.route.k - b.route.k);
      list.forEach((T, k) => {
        const S = routeArenaLine(sc, k, list.length);
        if (!S) return;
        const r2 = (/** @type {number} */ v) => Math.round(v * 100) / 100;
        T.route.at = [r2(S.at[0]), r2(S.at[1])];
        T.route.look = [r2(S.road[0]), r2(S.road[1])];
        T.route.spot = 'arena';
      });
      continue;
    }
    const g = rngFrom(runNodeSeed(run.seed, i), 'route|spots'),
      taken = /** @type {[number, number][]} */ ([]),
      spots = (sc.spots || []).filter(p => Number.isFinite(p.face) && (p.kind !== 'pinch' || p.stand)),
      free = (/** @type {string[]} */ kinds) =>
        spots.filter(p => kinds.includes(p.kind) && taken.every(t => Math.hypot(t[0] - p.x, t[1] - p.z) > 6));
    list.sort((a, b) => a.route.k - b.route.k);
    for (const T of list) {
      const likes = (classes[T.cls] && classes[T.cls].likes) || [],
        mine = T.route.opt ? ROUTE_SPOTS.aside : ROUTE_SPOTS.road,
        other = T.route.opt ? ROUTE_SPOTS.road : ROUTE_SPOTS.aside;
      let pool = free(mine);
      if (!pool.length) pool = free(other);
      const liked = pool.filter(p => likes.includes(p.kind)),
        from = liked.length ? liked : pool,
        p = from.length ? from[g.int(0, from.length - 1)] : null;
      /** @type {[number, number]} */
      let at, look;
      if (p) {
        at = p.stand ? [p.stand[0], p.stand[1]] : [p.x, p.z];
        const a = (p.face * Math.PI) / 180;
        look = [at[0] + Math.cos(a) * 2, at[1] + Math.sin(a) * 2];
        taken.push([p.x, p.z]);
      } else {
        const S = routeWaySpot(sc, T.route.k, T.route.n);
        if (!S) continue;
        [at, look] = [S.at, S.road];
      }
      const r2 = (/** @type {number} */ v) => Math.round(v * 100) / 100;
      T.route.at = [r2(at[0]), r2(at[1])];
      T.route.look = [r2(look[0]), r2(look[1])];
      T.route.spot = p ? p.kind : 'way';
      if (T.mate) {
        const fx = look[0] - at[0],
          fz = look[1] - at[1],
          l = Math.hypot(fx, fz) || 1,
          side = (/** @type {number} */ s) =>
            /** @type {[number, number]} */ ([r2(at[0] - (fz / l) * 1.2 * s), r2(at[1] + (fx / l) * 1.2 * s)]),
          /** @type {[number, number]} */
          behind = [r2(at[0] - (fx / l) * 1.2), r2(at[1] - (fz / l) * 1.2)];
        /* never in water (a bridge's spot is on the bank by its stream): the other side, then a step behind */
        T.route.mate = [side(1), side(-1), behind].find(q => !routeWet(sc, q)) || side(1);
      }
    }
  }
}

/** whether a point (a scene's own metres) stands on a water tile (MAPGEN_WET) @param {any} sc @param {number[]} p
 * @returns {boolean} */
export function routeWet(sc, p) {
  return MAPGEN_WET.includes(((sc.tiles || [])[sc.h - 1 - Math.floor(p[1])] || '')[Math.floor(p[0])] || '');
}
/** RT-4: the spot kinds a route's rarer one waits in, the hardest to reach first */
export const ROUTE_RARE_SPOTS = ['pocket', 'deadend', 'clearing'];
/**
 * RT-4: where each run route's rarer one waits (logic/rules.js spawnRare), in its scene's own metres: a pocket, else a
 * dead end, else a clearing (ROUTE_RARE_SPOTS), more than 6 m from every trainer of the place and 4 m from its set
 * pieces, where no forest canopy hides it from the camera (routeUnderCanopy), drawn from the node's 'route|rare' stream; none on a place with no such spot (it waits in the grass then).
 * After routeTrainersPlace @param {Run} run @param {Record<string, any>} trainers @param {any[]} scenes
 * @returns {Record<number, [number, number]>}
 */
export function routeRareSpots(run, trainers, scenes) {
  /** @type {Record<number, [number, number][]>} */
  const stand = {};
  for (const T of Object.values(trainers))
    if (T.route && T.runNode != null && T.route.at) {
      (stand[T.runNode] ||= []).push(T.route.at);
      if (T.route.mate) stand[T.runNode].push(T.route.mate);
    }
  /** @type {Record<number, [number, number]>} */
  const out = {};
  if (!run.map) return out;
  for (const ni of Object.keys(stand)) {
    const i = +ni,
      sc = scenes[i];
    if (!sc) continue;
    const g = rngFrom(runNodeSeed(run.seed, i), 'route|rare'),
      pieces = sc.pieces || [],
      canopy = (sc.props || []).filter((/** @type {any} */ q) => /canopy/.test(q.k)),
      free = (sc.spots || []).filter(
        (/** @type {any} */ p) =>
          stand[i].every(t => Math.hypot(t[0] - p.x, t[1] - p.z) > 6) &&
          pieces.every((/** @type {any} */ q) => Math.hypot(q.x - p.x, q.z - p.z) > 4) &&
          canopy.every((/** @type {any} */ q) => !routeUnderCanopy(q, p))
      );
    for (const kind of ROUTE_RARE_SPOTS) {
      const pool = free.filter((/** @type {any} */ p) => p.kind === kind);
      if (!pool.length) continue;
      const p = pool[g.int(0, pool.length - 1)];
      out[i] = [p.x, p.z];
      break;
    }
  }
  return out;
}

/** RT-4: whether a forest's canopy piece q hides spot p from the camera (it looks north, from the south): within 4.5 m,
 * or up to 7 m south of it and within 3 m to the side @param {{ x: number, z: number }} q
 * @param {{ x: number, z: number }} p */
export const routeUnderCanopy = (q, p) =>
  Math.hypot(q.x - p.x, q.z - p.z) < 4.5 || (q.z < p.z && p.z - q.z < 7 && Math.abs(q.x - p.x) < 3);

/** a place with no spot left: on the way ahead (the first exit by t on its way on's side, WM-3: the scene's `ahead`
 * dial, north or south too, east without one; else the first exit with a road) at (k + 1) / (n + 1) of it, 3 m
 * to one side for even k and the other for odd ones, facing it @param {any} sc @param {number} k @param {number} n
 * @returns {{ at: [number, number], road: [number, number] } | null} */
export function routeWaySpot(sc, k, n) {
  const E = (sc.edgeExits || []).filter((/** @type {any} */ e) => e.path && e.path.length > 1),
    A = (sc.gen && sc.gen.params && sc.gen.params.ahead) || 'E',
    ahead =
      E.filter((/** @type {any} */ e) => e.side === A).sort(
        (/** @type {any} */ a, /** @type {any} */ b) => a.t - b.t
      )[0] || E[0];
  if (!ahead) return null;
  const P = ahead.path,
    seg = [];
  let L = 0;
  for (let j = 1; j < P.length; j++) {
    const d = Math.hypot(P[j][0] - P[j - 1][0], P[j][1] - P[j - 1][1]);
    seg.push(d);
    L += d;
  }
  let want = (L * (k + 1)) / (n + 1),
    j = 0;
  while (j < seg.length - 1 && want > seg[j]) want -= seg[j++];
  const a = P[j],
    b = P[j + 1],
    t = seg[j] ? want / seg[j] : 0,
    road = /** @type {[number, number]} */ ([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]),
    l = seg[j] || 1,
    side = k % 2 ? 1 : -1;
  return {
    at: [road[0] + (-(b[1] - a[1]) / l) * 3 * side, road[1] + ((b[0] - a[0]) / l) * 3 * side],
    road,
  };
}

/** WM-7: how far apart the trainers before a leader's ring stand, along the road (m) */
export const ROUTE_ARENA_GAP = 8;
/** WM-3: the closest the line's trainers stand (m), and the nearest the way in the first may (m: past where a seam's
 * walk starts, 4 m in) */
export const ROUTE_ARENA_MIN = 6;
export const ROUTE_ARENA_IN = 5;
/** WM-7: how far off the road's middle they stand (m: their sight, ROUTE_SIGHT_HALF wide, crosses all of it) */
export const ROUTE_ARENA_OFF = 2.8;
/** WM-7: where trainer k of n stands before a scene's leader's ring: on its main road (the way in's path back to
 * the hub, then the way on's out: its first two exits, on any side since WM-3), the last 3 m before the road comes within ROUTE_ARENA_OFF and a metre of the ring's
 * apron, each ROUTE_ARENA_GAP before the next (closer when the road is short, but ROUTE_ARENA_MIN at least; 10 m from the way in, ROUTE_ARENA_IN on a short road), on alternate sides ROUTE_ARENA_OFF
 * off it, facing it (WM-3: out of the water: the other side, or a metre either way); null without a ring or a main road
 * @param {any} sc @param {number} k @param {number} n @returns {{ at: [number, number], road: [number, number] } | null} */
export function routeArenaLine(sc, k, n) {
  const A = sc.arena,
    E = sc.edgeExits || [],
    /* the way in and the way on: a run scene's first two exits (logic/run-scenes.js runSceneExits: the first back,
       the first ahead, the main road between them; WM-3: on any side) */
    W = E[0],
    F = E[1];
  if (!A || !W || !F || !W.path || !F.path) return null;
  /* every half metre (a path's points can lie metres apart) */
  const P = mapgenResample([...W.path.slice().reverse(), ...F.path.slice(1)], 0.5),
    acc = [0];
  for (let j = 1; j < P.length; j++) acc.push(acc[j - 1] + Math.hypot(P[j][0] - P[j - 1][0], P[j][1] - P[j - 1][1]));
  /* the road's first point within the ring's apron (an octagon's distance, as logic/arena-gen.js arenaOct) */
  const oct = (/** @type {number[]} */ p) => {
      const dx = Math.abs(p[0] - A.x),
        dz = Math.abs(p[1] - A.z);
      return Math.max(dx, dz, (dx + dz) * Math.SQRT1_2);
    },
    /* (as near as standing ROUTE_ARENA_OFF to the side keeps them off the apron) */
    j0 = P.findIndex(p => oct(p) <= A.r + 1.5 + ROUTE_ARENA_OFF + 1);
  if (j0 < 1) return null;
  const end = acc[j0] - 3,
    /* WM-3: never closer than ROUTE_ARENA_MIN (a ring nearer the way in, where its barrier fits, leaves less road):
       then the line reaches back to ROUTE_ARENA_IN from the way in instead of 10 m */
    gap = Math.max(ROUTE_ARENA_MIN, Math.min(ROUTE_ARENA_GAP, (end - 10) / Math.max(1, n - 1))),
    /* the spot `side` of the road at d metres along it */
    stand = (/** @type {number} */ d, /** @type {number} */ side) => {
      let j = 1;
      while (j < P.length - 1 && acc[j] < d) j++;
      const a = P[j - 1],
        b = P[j],
        l = acc[j] - acc[j - 1] || 1,
        t = Math.min(1, Math.max(0, (d - acc[j - 1]) / l)),
        road = /** @type {[number, number]} */ ([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      return {
        at: /** @type {[number, number]} */ ([
          road[0] + (-(b[1] - a[1]) / l) * ROUTE_ARENA_OFF * side,
          road[1] + ((b[0] - a[0]) / l) * ROUTE_ARENA_OFF * side,
        ]),
        road,
      };
    },
    /* WM-3: never in water (a stream by a bridge on the way): the other side, then a metre either way (the line
       stays ROUTE_ARENA_GAP apart, give or take two) */
    wet = (/** @type {number[]} */ p) =>
      MAPGEN_WET.includes(((sc.tiles || [])[sc.h - 1 - Math.floor(p[1])] || '')[Math.floor(p[0])] || ''),
    /* a trainer's spot near d along: out of the water if it can be */
    dry = (/** @type {number} */ d, /** @type {number} */ side) => {
      for (const e of [d, d - 1, d + 1])
        for (const sg of [side, -side]) {
          const S = stand(e, sg);
          if (!wet(S.at)) return S;
        }
      return stand(d, side);
    };
  /* the line from the ring back: each `gap` before the next along the road, then further back while it stands
     nearer than ROUTE_ARENA_MIN to one placed (a road that winds round the hub), never past ROUTE_ARENA_IN */
  /** @type {{ at: [number, number], road: [number, number] }[]} */
  const line = [];
  for (let q = n - 1, d = end; q >= k; q--, d -= gap) {
    let S = dry(Math.max(ROUTE_ARENA_IN, d), q % 2 ? 1 : -1);
    while (d > ROUTE_ARENA_IN && line.some(o => Math.hypot(o.at[0] - S.at[0], o.at[1] - S.at[1]) < ROUTE_ARENA_MIN)) {
      d = Math.max(ROUTE_ARENA_IN, d - 0.5);
      S = dry(d, q % 2 ? 1 : -1);
    }
    line.push(S);
  }
  return line[line.length - 1];
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
