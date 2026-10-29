// @ts-check
'use strict';
/* ================= THE PREPARED FIRST RUN (intro track IN-1) =================
   The first run is written by hand in game/data/firstRun.json (docs/phases/intro-track.md section 5): its seed, its
   map (each node's type, row, lane, biome and links), and what a few places hold for sure: a route's wild Billies (a
   species list, or one by the starter's line: the starter's counter type), how many trainers stand on it, a
   waystation's event, a mini-boss's leader and level step, the boss (a bosses.json bot), the Perk planted in the first
   mini-boss's pick, and the crash site on the landing (the wreck and the cutscene's spots, pinned to the landing's
   mast). Everything else is the game's as on any run: each place is still made by mapgen from its node's seed (the
   run's seed and the node's number), so a mapgen change moves the places (tools/test/first-run.test.mjs keeps a
   snapshot of them). A run is the prepared one while run.first is true (logic/run-start.js runStartPrepared).
   Logic only: no DOM, no Date, no Math.random; runs in Node (tools/test/first-run.test.mjs). */
/** @import { Run, RunMap, RunNode } from '../../types/save-data' */
/** @import { FirstRunData, FirstRunNode, NodeType } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { FIRST_RUN, MAPGEN_VERSION, encOf } from '../hooks.js';
import { turnedPoint } from './prop-turn.js';
import { rivalRunStart } from './rival.js';
import { newRun } from './run-state.js';
import { runForecastDays, runMapGrid, runReveal, runRevealAll } from './run-map.js';
/* eslint-disable no-func-assign */
expose({
  FIRST_RUN_SPOTS: [() => FIRST_RUN_SPOTS],
  // @ts-expect-error -- replaced on purpose
  firstRunBoss: [() => firstRunBoss, v => (firstRunBoss = v)],
  // @ts-expect-error -- replaced on purpose
  firstRunCrash: [() => firstRunCrash, v => (firstRunCrash = v)],
  // @ts-expect-error -- replaced on purpose
  firstRunCutscene: [() => firstRunCutscene, v => (firstRunCutscene = v)],
  // @ts-expect-error -- replaced on purpose
  firstRunEvents: [() => firstRunEvents, v => (firstRunEvents = v)],
  firstRunLine: [() => firstRunLine],
  // @ts-expect-error -- replaced on purpose
  firstRunMap: [() => firstRunMap, v => (firstRunMap = v)],
  firstRunMast: [() => firstRunMast],
  // @ts-expect-error -- replaced on purpose
  firstRunNode: [() => firstRunNode, v => (firstRunNode = v)],
  // @ts-expect-error -- replaced on purpose
  firstRunPlan: [() => firstRunPlan, v => (firstRunPlan = v)],
  // @ts-expect-error -- replaced on purpose
  firstRunPlant: [() => firstRunPlant, v => (firstRunPlant = v)],
  // @ts-expect-error -- replaced on purpose
  firstRunPool: [() => firstRunPool, v => (firstRunPool = v)],
  // @ts-expect-error -- replaced on purpose
  firstRunProblems: [() => firstRunProblems, v => (firstRunProblems = v)],
  // @ts-expect-error -- replaced on purpose
  firstRunRows: [() => firstRunRows, v => (firstRunRows = v)],
  // @ts-expect-error -- replaced on purpose
  firstRunSpots: [() => firstRunSpots, v => (firstRunSpots = v)],
  // @ts-expect-error -- replaced on purpose
  firstRunStarter: [() => firstRunStarter, v => (firstRunStarter = v)],
  firstRunStock: [() => firstRunStock],
  firstRunTeam: [() => firstRunTeam],
  firstRunTrainers: [() => firstRunTrainers],
  firstRunUp: [() => firstRunUp],
  // @ts-expect-error -- replaced on purpose
  firstRunZones: [() => firstRunZones, v => (firstRunZones = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the spots the crash site names for the cold open's cutscene (IN-5): the wreck, you, Chosen, Kappi and the three
 * pyramids of the starter pick */
export const FIRST_RUN_SPOTS = /** @type {const} */ (['wreck', 'me', 'chosen', 'kappi', 'star1', 'star2', 'star3']);
/** the starter's line: a species id without its stage digits (musk0 -> musk) @param {string} sp */
export const firstRunLine = sp => String(sp || '').replace(/\d+$/, '');

/** the file's node i while the run is the prepared one, else null @param {Run | null | undefined} run
 * @param {number} i @param {FirstRunData | null} [F] @returns {FirstRunNode | null} */
export function firstRunNode(run, i, F = FIRST_RUN) {
  return run && run.first && F && run.map && !run.map.nodes[i]?.side ? F.nodes[i] || null : null;
}

/** the map rules the file's map has: its rows and mini-bosses (runStartPlan draws the region for them)
 * @param {FirstRunData} F @returns {{ rows: number, minibosses: number }} */
export function firstRunRows(F) {
  return {
    rows: Math.max(...F.nodes.map(n => n.row)) + 1,
    minibosses: F.nodes.filter(n => n.type === 'miniboss').length,
  };
}

/** the file's map as a run's: its nodes (type, row, lane, links, biome, zone) laid out on the region grid from the
 * file's seed (run-map.js runMapGrid: footprints by the types' shapes, a town at its size), so its places are made like
 * any run's. Throws when the grid can't hold it
 * @param {FirstRunData} F @param {Record<string, NodeType>} nodeTypes
 * @param {{ townSizes?: { cells: Record<string, [number, number]> } }} M rules.json run.map (the towns' cells)
 * @returns {RunMap} */
export function firstRunMap(F, nodeTypes, M) {
  const zones = firstRunZones(F),
    /** @type {RunNode[]} */
    nodes = F.nodes.map(n => ({
      type: n.type,
      row: n.row,
      lane: n.lane,
      to: n.to.slice().sort((a, b) => a - b),
      seen: 0,
      biome: n.biome,
      zone: zones.findIndex(z => z.from <= n.row && n.row < z.from + z.rows),
    })),
    C = (M.townSizes && M.townSizes.cells) || {},
    want = F.nodes.map(n => (n.type === 'town' && n.size && C[n.size] ? C[n.size].slice() : null));
  if (!runMapGrid(F.seed, nodes, nodeTypes, want)) throw new Error(`firstRunMap: the grid can't hold ${F.seed}'s map`);
  return { nodes };
}

/** the file's rows as zones: a zone a run of rows with one biome (the region's zones, by row)
 * @param {FirstRunData} F @returns {{ biome: string, rows: number, from: number }[]} */
export function firstRunZones(F) {
  const rows = firstRunRows(F).rows,
    biome = (/** @type {number} */ r) => (F.nodes.find(n => n.row === r) || { biome: '' }).biome,
    /** @type {{ biome: string, rows: number, from: number }[]} */
    out = [];
  for (let r = 0; r < rows; r++) {
    const last = out[out.length - 1];
    if (last && last.biome === biome(r)) last.rows++;
    else out.push({ biome: biome(r), rows: 1, from: r });
  }
  return out;
}

/** put the file on a run's start plan (logic/run-start.js runStartPrepared): its map, the region's zones and leaders
 * the file's (the mini-bosses' and the boss's, in node order), the landing shown and the forecast rolled for the new
 * map, nothing on the map that the file doesn't hold (no rival, ghost or side area), and the plan marked as the
 * first run's. Returns the plan
 * @param {import('./run-start.js').RunStartPlan} plan @param {FirstRunData} F
 * @param {{ nodeTypes: Record<string, NodeType>, biomes: Record<string, { climate?: string }>, rules: any }} data */
export function firstRunPlan(plan, F, data) {
  const map = firstRunMap(F, data.nodeTypes, data.rules.map),
    scratch = newRun(F.seed, F.expedition || 1, MAPGEN_VERSION, /** @type {any} */ ({}));
  scratch.map = map;
  runReveal(map, 0, data.rules.reveal);
  runRevealAll(scratch);
  runForecastDays(scratch, data.biomes, data.rules.clock.ahead);
  plan.map = map;
  plan.forecast = scratch.forecast;
  plan.ghost = null;
  if (plan.region) {
    plan.region.zones = firstRunZones(F).map(z => ({ biome: z.biome, rows: z.rows }));
    const leaders = F.nodes.flatMap(n => ((n.type === 'miniboss' || n.type === 'boss') && n.leader ? [n.leader] : []));
    if (leaders.length) plan.region.leaders = leaders;
  }
  plan.first = true;
  return plan;
}

/** the file's waystations' events, pinned on the run (run-enc.js: a node's event once drawn), so eventAt finds them
 * @param {Run} run @param {FirstRunData} F */
export function firstRunEvents(run, F) {
  const e = encOf(run);
  F.nodes.forEach((n, i) => {
    if (n.event) e.node[String(i)] = n.event;
  });
}

/** a place's wild Billies as the file pins them, or null (the place's own pool): its levels, and its species (`list`)
 * or, by the starter's line (`by`; the run's lead, run.rival.lead, is the starter), those of the starter's counter
 * type; a line the file doesn't name: the place's own pool
 * @param {Run} run @param {number} i @param {FirstRunData | null} [F]
 * @returns {{ lv: [number, number], list: [string, number][] } | null} */
export function firstRunPool(run, i, F = FIRST_RUN) {
  const W = firstRunNode(run, i, F)?.wild;
  if (!W) return null;
  const lead = run.rival ? run.rival.lead : '',
    ids = W.list || (W.by && W.by[firstRunLine(lead)]) || null;
  return ids && ids.length ? { lv: [W.lv[0], W.lv[1]], list: ids.map(id => [id, 1]) } : null;
}

/** how many wild Billies the file's place holds (rules.js encounterStock), or null (the game's count)
 * @param {Run} run @param {number} i @param {FirstRunData | null} [F] */
export const firstRunStock = (run, i, F = FIRST_RUN) => firstRunNode(run, i, F)?.wild?.stock ?? null;
/** how many route trainers stand on the file's place (route-trainers.js), or null (the game's count)
 * @param {Run} run @param {number} i @param {FirstRunData | null} [F] */
export const firstRunTrainers = (run, i, F = FIRST_RUN) => firstRunNode(run, i, F)?.trainers ?? null;
/** a mini-boss's or the boss's levels over its row's top wild level (run-loop.js runFoes), or null (rules.json
 * run.foes) @param {Run} run @param {number} i @param {FirstRunData | null} [F] */
export const firstRunUp = (run, i, F = FIRST_RUN) => firstRunNode(run, i, F)?.up ?? null;

/** a mini-boss's Billies as the file names them (at its leader's strongest levels: run-loop.js runFoes), or null (the
 * leader's team built for the run) @param {Run} run @param {number} i @param {FirstRunData | null} [F]
 * @returns {string[] | null} */
export const firstRunTeam = (run, i, F = FIRST_RUN) => firstRunNode(run, i, F)?.team ?? null;
/** the first run's boss as [id, its bosses.json entry], or null (not the first run, or the file's boss isn't there)
 * @param {Run} run @param {Record<string, import('../../types/game-data').BossDef>} bosses
 * @param {FirstRunData | null} [F] @returns {[string, import('../../types/game-data').BossDef] | null} */
export function firstRunBoss(run, bosses, F = FIRST_RUN) {
  return run && run.first && F && F.boss && bosses && bosses[F.boss] ? [F.boss, bosses[F.boss]] : null;
}

/** the Perk the file plants in the first run's first mini-boss pick: it takes the last card (kept when it is
 * already offered; nothing when it is held or isn't a Perk). Returns the offer
 * @param {Run} run @param {string[]} ids the offer as drawn @param {Record<string, any>} perks
 * @param {FirstRunData | null} [F] @returns {string[]} */
export function firstRunPlant(run, ids, perks, F = FIRST_RUN) {
  const id = run && run.first && F ? F.plant : '';
  if (!id || !perks[id] || run.offerN !== 0 || !ids.length || ids.includes(id) || run.perks.includes(id)) return ids;
  return [...ids.slice(0, -1), id];
}

/** the landing's mast (its first prop with act 'fly'), or null @param {any} scene */
export const firstRunMast = scene =>
  ((scene && scene.props) || []).find((/** @type {any} */ p) => p.act === 'fly') || null;

/** the crash site's named spots on the landing's scene (IN-5's cutscene): each the file's offset from the mast, turned
 * as the mast is (prop-turn.js turnedPoint), in the scene's metres; {} when the scene has no mast
 * @param {any} scene @param {FirstRunData | null} [F] @returns {Record<string, { x: number, z: number }>} */
export function firstRunSpots(scene, F = FIRST_RUN) {
  const m = firstRunMast(scene);
  if (!m || !F || !F.crash) return {};
  /** @type {Record<string, { x: number, z: number }>} */
  const out = {};
  for (const [k, [dx, dz]] of Object.entries(F.crash.spots)) {
    const [x, z] = turnedPoint(m, dx, dz);
    out[k] = { x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 };
  }
  return out;
}

/** the crash site on the prepared run's landing scene: the props round it cleared away (within `clear` metres of each
 * spot, and of each crash prop its own `clear`; never the mast or a prop that does something), then the wreck and its
 * cargo put down (the file's props, offsets from the mast, turned with it). Changes the scene; returns the props put
 * down @param {any} scene @param {FirstRunData | null} [F] */
export function firstRunCrash(scene, F = FIRST_RUN) {
  const m = firstRunMast(scene);
  if (!m || !F || !F.crash) return [];
  const C = F.crash,
    r = m.rot || 0,
    put = C.props.map(q => {
      const [x, z] = turnedPoint(m, q.at[0], q.at[1]);
      return { k: q.k, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, rot: r + (q.rot || 0), crash: 1 };
    }),
    rings = [
      ...Object.values(firstRunSpots(scene, F)).map(s => ({ ...s, d: C.clear })),
      ...put.map((p, k) => ({ x: p.x, z: p.z, d: C.props[k].clear || 0 })),
    ],
    near = (/** @type {any} */ p) => rings.some(c => Math.hypot(p.x - c.x, p.z - c.z) < c.d);
  scene.props = scene.props.filter((/** @type {any} */ p) => p === m || p.act || !near(p));
  scene.props.push(...put);
  return put;
}

/** IN-5: the crash cutscene (game/data/cutscenes/crash.json, `landing`) laid on the landing's scene: its spots and its
 * shots' eye and target, written as metres from the mast, turned as the mast is into the scene's metres; its map the
 * landing's own (the view it is mounted in may hold more). Null when the scene has no mast
 * @param {any} C the cutscene's file @param {any} scene @param {string} mapId @returns {any} */
export function firstRunCutscene(C, scene, mapId) {
  const m = firstRunMast(scene);
  if (!m || !C) return null;
  const r2 = (/** @type {number} */ v) => Math.round(v * 100) / 100,
    P = (/** @type {number[]} */ p) => {
      const [x, z] = turnedPoint(m, p[0], p[1]);
      return [r2(x), r2(z)];
    },
    P3 = (/** @type {number[]} */ p) => {
      const [x, z] = P([p[0], p[2]]);
      return [x, p[1], z];
    };
  /* what is cleared while filming: an area turned with the mast is no longer square to the map, so it clears the
     square round its four turned corners; the eyes are points */
  const K = C.clear,
    box = (/** @type {number[]} */ [a, b, c, d]) => {
      const q = [P([a, b]), P([c, b]), P([a, d]), P([c, d])];
      return [
        Math.min(...q.map(v => v[0])),
        Math.min(...q.map(v => v[1])),
        Math.max(...q.map(v => v[0])),
        Math.max(...q.map(v => v[1])),
      ];
    },
    clear = K
      ? {
          ...K,
          ...(K.areas ? { areas: K.areas.map(box) } : {}),
          ...(K.eyes ? { eyes: K.eyes.map(P) } : {}),
        }
      : undefined;
  return {
    ...C,
    map: mapId,
    ...(clear ? { clear } : {}),
    spots: Object.fromEntries(Object.entries(C.spots || {}).map(([k, p]) => [k, P(/** @type {number[]} */ (p))])),
    shots: Object.fromEntries(
      Object.entries(C.shots || {}).map(([k, s]) => [
        k,
        { .../** @type {any} */ (s), eye: P3(/** @type {any} */ (s).eye), tgt: P3(/** @type {any} */ (s).tgt) },
      ])
    ),
  };
}

/** IN-5: the starter picked in the crash scene takes the place of the stand-in New game started the run with: the
 * same uid (so the run's home, the buddy and the hub's snapshot still name it), the run's lead (its rival's counter,
 * which the counter lane's wild Billies follow: firstRunPool) and the dex. `m` is the picked Billie, made by the page
 * (logic/rules.js makeBilly). Returns the Billie it replaced, or null when there was no run or nobody to replace
 * @param {any} s the save @param {any} m @param {string} line the starter's line */
export function firstRunStarter(s, m, line) {
  const run = s && s.run,
    old = s && s.team && s.team[0];
  if (!run || !old) return null;
  m.uid = old.uid;
  s.team[0] = m;
  s.buddy = m.uid;
  s.starter = line;
  if (s.caught) s.caught[m.sp] = 1;
  if (s.seen) s.seen[m.sp] = 1;
  if (run.start && Array.isArray(run.start.team))
    run.start.team = run.start.team.map((/** @type {any} */ x) =>
      x.uid === m.uid ? JSON.parse(JSON.stringify(m)) : x
    );
  run.rival = rivalRunStart(m.sp, s.meta && s.meta.history);
  return old;
}

/**
 * The file's problems, in words ([] when none): the shape the schema can't check. Its nodes are numbered row by row,
 * lane by lane (the map's numbering), its links go one row on to a node that exists, every node but the boss leads on
 * and every node but the landing is reached; one landing on row 0 and the boss alone on the last row; the types, biomes,
 * species, starters' lines, trainers, events, Perk, boss and props are the game's; the spots are every one IN-5 names.
 * @param {any} F
 * @param {{ nodeTypes: Record<string, any>, biomes: Record<string, any>, species: Record<string, any>,
 *   trainers: Record<string, any>, events: Record<string, any>, perks: Record<string, any>,
 *   bosses: Record<string, any>, props: Record<string, any>, starters: string[], townSizes?: Record<string, any> }} D
 * @returns {string[]}
 */
export function firstRunProblems(F, D) {
  /** @type {string[]} */
  const out = [],
    N = (F && F.nodes) || [],
    say = (/** @type {string} */ t) => out.push(t);
  if (!N.length) return ['no nodes'];
  N.forEach((/** @type {any} */ n, /** @type {number} */ i) => {
    const at = `node ${i}`,
      prev = N[i - 1];
    if (prev && (prev.row > n.row || (prev.row === n.row && prev.lane >= n.lane)))
      say(`${at}: not in row-then-lane order`);
    if (!D.nodeTypes[n.type]) say(`${at}: no node type ${n.type}`);
    if (!D.biomes[n.biome]) say(`${at}: no biome ${n.biome}`);
    for (const j of n.to) if (!N[j] || N[j].row !== n.row + 1) say(`${at}: its link to ${j} isn't one row on`);
    if (n.type !== 'boss' && !n.to.length) say(`${at}: leads nowhere`);
    if (i > 0 && !N.some((/** @type {any} */ p) => p.to.includes(i))) say(`${at}: nothing leads to it`);
    const W = n.wild;
    if (W) {
      if (!!W.list === !!W.by) say(`${at}: its wild Billies need a list or a list by starter, not both`);
      for (const id of W.list || []) if (!D.species[id]) say(`${at}: no species ${id}`);
      if (W.by)
        for (const line of D.starters) {
          const L = W.by[line];
          if (!L || !L.length) say(`${at}: no wild Billies for the ${line} starter`);
          else for (const id of L) if (!D.species[id]) say(`${at}: no species ${id}`);
        }
      if (W.lv[0] > W.lv[1]) say(`${at}: its levels run backwards`);
    }
    if (n.leader && !(D.trainers[n.leader] && D.trainers[n.leader].miniboss))
      say(`${at}: ${n.leader} is not a leader (trainers with miniboss)`);
    if (n.leader && n.type !== 'miniboss' && n.type !== 'boss') say(`${at}: a leader on a ${n.type}`);
    for (const id of n.team || []) if (!D.species[id]) say(`${at}: no species ${id} in its team`);
    if (n.team && n.type !== 'miniboss') say(`${at}: a team on a ${n.type}`);
    if (n.team && n.leader && D.trainers[n.leader] && n.team.length > D.trainers[n.leader].team.length)
      say(`${at}: a team bigger than its leader's`);
    if (n.event && !D.events[n.event]) say(`${at}: no event ${n.event}`);
    if (n.event && n.type !== 'event') say(`${at}: an event on a ${n.type}`);
    if (n.size && !(n.type === 'town' && D.townSizes && D.townSizes[n.size])) say(`${at}: no town size ${n.size}`);
  });
  if (N[0].type !== 'landing' || N[0].row !== 0 || N.filter((/** @type {any} */ n) => n.row === 0).length !== 1)
    say('the landing must be node 0, alone on row 0');
  const last = Math.max(...N.map((/** @type {any} */ n) => n.row)),
    end = N.filter((/** @type {any} */ n) => n.row === last);
  if (end.length !== 1 || end[0].type !== 'boss') say('the boss must stand alone on the last row');
  if (N.filter((/** @type {any} */ n) => n.type === 'boss').length !== 1) say('one boss, no more');
  if (!D.bosses[F.boss]) say(`no boss ${F.boss} in bosses.json`);
  if (F.plant && !D.perks[F.plant]) say(`no Perk ${F.plant}`);
  const C = F.crash;
  if (C) {
    for (const k of FIRST_RUN_SPOTS) if (!C.spots[k]) say(`the crash site has no spot ${k}`);
    for (const q of C.props) if (!D.props[q.k]) say(`the crash site's prop ${q.k} isn't in scenery.json`);
  } else say('no crash site');
  return out;
}
