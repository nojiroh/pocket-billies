// @ts-check
'use strict';
/* ================= SAVES =================
   Phase 04e: the save format, moved here from game-state.js (a new save, filling one out, the load checks) and
   settings-screen.js (the backup check). Where a save is kept (this browser, the account) stays in game-state.js
   and account.js. Logic only (game/js/logic/, see rules.js). */
/** @import { SaveData } from '../../types/save-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { saveData, unlockTidy } from '../hooks.js';
import { random } from '../util.js';
import {
  EGGS,
  HUB_LOCATIONS,
  ITEMS,
  LINES,
  MOVES,
  PYRAMIDS,
  RULES,
  SPECIES,
  START_NODE,
  STATUS_NAMES,
  STAT_IDS,
  UNLOCK_DATA,
  hubRoadCost,
} from '../game-data.js';
import { graftStability } from './genes.js';
import { isRobot, robotGemDef, robotPartDef, robotRules, speciesOf } from './fighters.js';
import { billyGraft, cleanName, geneData, movesAt, refreshRobot, teamSize, unstableTidy } from './rules.js';
import { metaFill, newMeta, validMeta } from './meta-state.js';
import { newRanch, ranchFill, validRanch } from './ranch-state.js';
import { ranchTidy } from './ranch.js';
import { runNodeCount, runRestore, validRun } from './run-state.js';
/* eslint-disable no-func-assign */
expose({
  SAVE_NEW_MSG: [() => SAVE_NEW_MSG],
  SAVE_OLD_MSG: [() => SAVE_OLD_MSG],
  SAVE_VERSION: [() => SAVE_VERSION],
  // @ts-expect-error -- replaced on purpose
  billiesOk: [() => billiesOk, v => (billiesOk = v)],
  // @ts-expect-error -- replaced on purpose
  graftShapeOk: [() => graftShapeOk, v => (graftShapeOk = v)],
  // @ts-expect-error -- replaced on purpose
  graftTidy: [() => graftTidy, v => (graftTidy = v)],
  // @ts-expect-error -- replaced on purpose
  loadSave: [() => loadSave, v => (loadSave = v)],
  // @ts-expect-error -- replaced on purpose
  newSave: [() => newSave, v => (newSave = v)],
  // @ts-expect-error -- replaced on purpose
  newSaveKeepingPreferences: [() => newSaveKeepingPreferences, v => (newSaveKeepingPreferences = v)],
  // @ts-expect-error -- replaced on purpose
  saveAge: [() => saveAge, v => (saveAge = v)],
  // @ts-expect-error -- replaced on purpose
  saveFill: [() => saveFill, v => (saveFill = v)],
  // @ts-expect-error -- replaced on purpose
  validSave: [() => validSave, v => (validSave = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @returns {SaveData} */
export function newSave() {
  const R = RULES.start,
    pyramids = /** @type {Record<string, number>} */ ({}),
    items = /** @type {Record<string, number>} */ ({});
  Object.keys(PYRAMIDS).forEach(k => (pyramids[k] = 0));
  Object.keys(ITEMS).forEach(k => (items[k] = 0));
  Object.assign(pyramids, R.pyramids);
  Object.assign(items, R.items);
  return {
    saveVersion: SAVE_VERSION,
    gameVersion: PB_VERSION,
    avatar: null,
    preferences: { theme: 'system', motion: 'system', fps: 60, effects: 'full' },
    started: false,
    gender: null,
    starter: null,
    team: [],
    box: [],
    parts: [],
    seen: {},
    caught: {},
    se: R.se,
    pyramids,
    items,
    trip: { node: START_NODE, plan: [] },
    mapSeen: null,
    wild: {},
    buddy: null,
    flags: {},
    seats: [],
    visited: { [START_NODE]: 1 },
    serial: 300,
    eggs: [],
    savedAt: 0,
    /* trainer card: ID number, start date (0 = unknown, older saves) and eggs hatched */
    tid: 10000 + Math.floor(random() * 90000),
    since: 0,
    hatched: 0,
    /* roguelite track RL-3: what lasts between runs, the run in progress (null in the hub), the ranch */
    meta: newMeta(),
    run: null,
    ranch: newRanch(),
  };
}
/* a new game on the same device keeps its settings (theme, motion, effects, sound…) */
/** @returns {SaveData} */
export function newSaveKeepingPreferences() {
  const p = typeof saveData !== 'undefined' && saveData && saveData.preferences,
    f = newSave();
  if (p) f.preferences = Object.assign(f.preferences, JSON.parse(JSON.stringify(p)));
  return f;
}
/* alpha 0.4.1: saves only need to work with this version. A save is filled out with anything new and checked against
   the game data (things the Studio may have removed are dropped), but old formats are no longer converted */
/** @param {any} o a save as stored (parsed JSON) @returns {SaveData | null} */
export function saveFill(o) {
  if (!o || typeof o !== 'object') return null;
  const f = newSave();
  /** @type {SaveData} */
  const s = Object.assign(f, o);
  const zero = obj => Object.fromEntries(Object.keys(obj).map(k => [k, 0]));
  s.pyramids = Object.assign(zero(PYRAMIDS), o.pyramids || {});
  s.items = Object.assign(zero(ITEMS), o.items || {});
  s.flags = o.flags || {};
  /* roguelite track RL-3: meta and ranch filled out; a run that fails its check can't be resumed, so the hub's
     working fields come back from it (nothing is paid) before the checks below clean them */
  s.meta = metaFill(o.meta);
  s.ranch = ranchFill(o.ranch);
  if (s.run != null && !validRun(s.run)) runRestore(s);
  if (s.run === undefined) s.run = null;
  const p = (s.preferences = Object.assign(
    { theme: 'system', motion: 'system', fps: 60, effects: 'full' },
    o.preferences || {}
  ));
  if (![30, 60, 90, 120].includes(+p.fps)) p.fps = 60;
  if (p.aim !== 'smooth') p.aim = 'sharp';
  p.effects = 'full';
  p.fps = +p.fps;
  if (!Array.isArray(s.eggs)) s.eggs = [];
  if (!SPECIES[s.starter + '0'] && s.started)
    s.starter = RULES.start.starters.find(l => SPECIES[l + '0']) || LINES[0].id;
  s.team = (s.team || []).filter(m => speciesOf(m));
  s.box = (s.box || []).filter(m => speciesOf(m));
  const start = s.run && s.run.start;
  if (start) start.team = start.team.filter(m => speciesOf(m));
  s.ranch.nursery = s.ranch.nursery.filter(n => !isRobot(n.egg) && speciesOf(n.egg));
  /* every Billie the save holds: the team, the box, the nursery's eggs (RL-10) and, during a run, the hub's team as
     the run started */
  const members = () => [...s.team, ...s.box, ...s.ranch.nursery.map(n => n.egg), ...(start ? start.team : [])];
  /* phase 17: robot parts you own, and robots' sp and moves made again from their parts */
  s.parts = (Array.isArray(o.parts) ? o.parts : [])
    .filter(p => p && typeof p.uid === 'string' && (robotPartDef(p.id) || robotGemDef(p.id)))
    .map(p => ({ uid: p.uid, id: p.id, up: Math.max(0, Math.min(robotRules().maxUpgrade, Math.floor(+p.up || 0))) }));
  members().forEach(m => {
    if (isRobot(m)) refreshRobot(m);
  });
  members().forEach(m => {
    if (m.nick != null) m.nick = cleanName(m.nick, 16);
    if (m.mut && m.mut.name != null) m.mut.name = cleanName(m.mut.name, 24) || speciesOf(m).name;
    /* RL-12c: a held item the data no longer has as one is dropped */
    if (m.held != null && !(ITEMS[m.held] && ITEMS[m.held].hold)) delete m.held;
    /* SP-2: a splice keeps the slots that still fit; one with none left, or past what Stability ever allows, goes */
    graftTidy(m);
  });
  if (s.avatar && typeof s.avatar === 'object' && 'name' in s.avatar)
    s.avatar.name = cleanName(s.avatar.name, 18) || 'Trainer';
  members().forEach(m => {
    m.moves = (m.moves || []).filter(k => MOVES[k]);
    if (!m.moves.length && !isRobot(m)) m.moves = movesAt(speciesOf(m).line, m.lvl);
  });
  for (const key of ['seen', 'caught'])
    if (s[key] && typeof s[key] === 'object') for (const id of Object.keys(s[key])) if (!SPECIES[id]) delete s[key][id];
  if (!s.wild || typeof s.wild !== 'object') s.wild = {};
  for (const w of Object.values(s.wild)) {
    w.list = (w.list || []).filter(q => SPECIES[q.sp]);
    w.list.forEach(graftTidy);
  }
  s.eggs = s.eggs.filter(e => EGGS[e.tier]);
  /* RL-9: a trainee whose Billie isn't in storage any more stops training */
  ranchTidy(s);
  /* RL-11: owned unlocks the table no longer has are forgotten; the buildings' levels follow the owned ones */
  unlockTidy(s, UNLOCK_DATA);
  if (s.run) {
    /* RL-3: during a run the trip is on the run's world (0 Copperleaf, then the map's nodes), which is made from the
       seed after loading (RL-7): it is kept as it is, bounded by the run's map, not by today's LOCATIONS */
    const nodes = runNodeCount(s.run),
      onRun = x => Number.isInteger(x) && x >= 0 && x < nodes;
    if (!s.trip || !onRun(s.trip.node)) s.trip = { node: 0, plan: [] };
    s.trip.plan = (Array.isArray(s.trip.plan) ? s.trip.plan : []).filter(onRun);
    if (!HUB_LOCATIONS[s.run.start.trip.node]) s.run.start.trip = { node: START_NODE, plan: [] };
  } else {
    /* RL-7: in the hub's world, whatever world is in while the save loads (a backup restored during a run) */
    if (!s.trip || !HUB_LOCATIONS[s.trip.node]) s.trip = { node: START_NODE, plan: [] };
    s.trip.plan = (Array.isArray(s.trip.plan) ? s.trip.plan : []).filter(x => HUB_LOCATIONS[x]);
    if (s.trip.plan.length && !hubRoadCost(s.trip.node, s.trip.plan[0])) s.trip.plan = [];
  }
  if (!s.visited || typeof s.visited !== 'object') s.visited = {};
  s.visited[s.trip.node] = 1;
  if (s.started && !s.team.length && !s.box.length) return newSave();
  s.saveVersion = SAVE_VERSION;
  s.gameVersion = PB_VERSION;
  return s;
}
/* phase 02: every save says which save format it is (saveVersion; raise it when old saves can't be read any more; 2 since
   phase 05, 3 since phase 08: steps are gone, encounters live on each map, no jobs; 4 since roguelite track RL-3: meta,
   run and ranch; 5 since reflavour RF-4: perks, research, crests, pyramids, expeditions and the item, status and
   passive ids renamed; older saves are set aside, no migration).
   A save without one (alpha 0.5 and earlier) or from a newer format is not loaded: the game says so and starts fresh.
   saveAge: null (no save), 'ok', 'old' or 'new'. A newer save is never written over (saveHold) */
export const SAVE_VERSION = 5;
/** @param {any} o @returns {'ok' | 'old' | 'new' | null} */
export function saveAge(o) {
  if (!o || typeof o !== 'object') return null;
  const v = o.saveVersion;
  return v === SAVE_VERSION ? 'ok' : Number.isInteger(v) && v > SAVE_VERSION ? 'new' : 'old';
}
/** @param {any} o @returns {SaveData | null} */
export function loadSave(o) {
  return saveAge(o) === 'ok' ? saveFill(o) : null;
}
export const SAVE_OLD_MSG = 'This save is from an older version of the game and can’t be loaded in this one.',
  SAVE_NEW_MSG = 'This save is from a newer version of the game. Reload the page to get the newest version.';
export function validSave(o) {
  if (!o || typeof o !== 'object' || !o.started || typeof o.starter !== 'string') return false;
  const num = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
  if (
    !Array.isArray(o.team) ||
    !Array.isArray(o.box) ||
    !o.team.length ||
    o.team.length > Math.max(6, teamSize()) ||
    o.box.length > 5000
  )
    return false;
  /* RL-3: the run's checks; during a run the hub's team as it started is checked like the team */
  if (!validMeta(o.meta) || !validRanch(o.ranch) || (o.run !== null && !validRun(o.run))) return false;
  const nodes = o.run ? runNodeCount(o.run) : HUB_LOCATIONS.length;
  /* RL-10: the nursery's eggs are Billies to be: checked with the team and storage (one set of uids) */
  if (
    !billiesOk(
      o.team.concat(
        o.box,
        o.ranch.nursery.map(n => n.egg)
      )
    ) ||
    (o.run && !billiesOk(o.run.start.team))
  )
    return false;
  if (!o.trip || !Number.isInteger(o.trip.node) || !num(o.trip.node, 0, nodes - 1) || !num(o.se, 0, 1e12)) return false;
  if (o.run && !num(o.run.start.trip.node, 0, HUB_LOCATIONS.length - 1)) return false;
  if (!Array.isArray(o.eggs) || o.eggs.some(e => !e || !num(e.prog, 0, 1e12))) return false;
  for (const k of ['pyramids', 'items'])
    if (!o[k] || typeof o[k] !== 'object' || Object.values(o[k]).some(n => !num(n, 0, 1e12))) return false;
  /* phase 17: robot parts you own (missing in a save from before robots) and robots' damaged parts */
  if (
    o.parts != null &&
    (!Array.isArray(o.parts) ||
      o.parts.length > 5000 ||
      o.parts.some(p => !p || typeof p.uid !== 'string' || typeof p.id !== 'string' || !num(p.up || 0, 0, 99)))
  )
    return false;
  const record = v => v && typeof v === 'object' && !Array.isArray(v) && !Object.hasOwn(v, '__proto__');
  if (
    !record(o.wild) ||
    Object.keys(o.wild).length > HUB_LOCATIONS.length + nodes ||
    Object.values(o.wild).some(
      w =>
        !w ||
        !num(w.at, 0, 1e13) ||
        !Array.isArray(w.list) ||
        w.list.length > 12 ||
        w.list.some(q => !q || !SPECIES[q.sp] || !num(q.lvl, 1, 100) || !graftShapeOk(q.graft))
    )
  )
    return false;
  if (
    !record(o.seen) ||
    !record(o.caught) ||
    !record(o.flags) ||
    !Array.isArray(o.seats) ||
    o.seats.some(v => typeof v !== 'string') ||
    Object.hasOwn(o, '__proto__')
  )
    return false;
  if (!num(o.serial, 0, 1e12)) return false;
  return true;
}
/** SP-2: a splice as a save holds it: none, or a few slot -> Gene id ("part@donor") pairs of short strings
 * @param {unknown} g */
export function graftShapeOk(g) {
  if (g == null) return true;
  if (typeof g !== 'object' || Array.isArray(g) || Object.hasOwn(g, '__proto__')) return false;
  const pairs = Object.entries(g);
  return pairs.length <= 8 && pairs.every(([k, v]) => k.length <= 12 && typeof v === 'string' && v.length <= 64);
}
/** SP-2: a loaded Billie's or encounter's splice: the slots that still fit it; none left, or a splice past what
 * Stability allows at the default limit, and it goes @param {{ sp: string, graft?: Record<string, string>,
 *   unstable?: { up: string, down: string, name: string } }} m */
export function graftTidy(m) {
  if (m.graft == null) {
    delete m.unstable;
    return;
  }
  const g = billyGraft(m);
  if (!g || graftStability(geneData(), m.sp, g).refused) delete m.graft;
  else m.graft = g;
  /* an Unstable roll keeps two different stats and a clean name, and goes with a splice that is stable again */
  const u = m.unstable;
  if (u && (!STAT_IDS.includes(u.up) || !STAT_IDS.includes(u.down) || u.up === u.down)) delete m.unstable;
  else if (u) u.name = cleanName(u.name, 24) || speciesOf(m).name;
  unstableTidy(m);
}
/** a list of Billies a save holds: each one well formed, no uid twice */
export function billiesOk(list) {
  const num = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
  const ids = new Set();
  for (const m of list) {
    if (
      !m ||
      !speciesOf(m) ||
      typeof m.uid !== 'string' ||
      ids.has(m.uid) ||
      !num(m.lvl, 1, 100) ||
      !Number.isInteger(m.lvl) ||
      !num(m.hp, 0, 9999) ||
      !num(m.xp, 0, 1e12) ||
      !Array.isArray(m.moves) ||
      !m.moves.length ||
      m.moves.length > 4 ||
      m.moves.some(k => !MOVES[k])
    )
      return false;
    ids.add(m.uid);
  }
  for (const m of list)
    if (
      m.kind === 'robot' &&
      (!m.partDmg || typeof m.partDmg !== 'object' || Object.values(m.partDmg).some(n => !num(n, 0, 1e6)))
    )
      return false;
  for (const m of list)
    if (typeof (m.nick || '') !== 'string' || (m.status != null && !STATUS_NAMES[m.status])) return false;
  /* RL-12c: a held item is an item id (saveFill drops one the data doesn't have) */
  for (const m of list) if (m.held != null && (typeof m.held !== 'string' || m.held.length > 40)) return false;
  /* SP-2: a splice is a few slot -> Gene id pairs (saveFill drops what the data no longer fits) */
  for (const m of list) if (!graftShapeOk(m.graft)) return false;
  for (const m of list) {
    const u = m.unstable;
    if (u == null) continue;
    if (typeof u !== 'object' || Array.isArray(u)) return false;
    if ([u.up, u.down, u.name].some(v => typeof v !== 'string' || v.length > 24)) return false;
  }
  /* RL-10: a bred Billie's mark: a quirk, or an abomination with a short name and two different stats */
  for (const m of list) {
    const u = m.mut;
    if (u == null) continue;
    if (typeof u !== 'object' || Array.isArray(u) || (u.k !== 'quirk' && u.k !== 'abom')) return false;
    if (
      u.k === 'abom' &&
      (typeof u.name !== 'string' ||
        !u.name ||
        u.name.length > 24 ||
        !STAT_IDS.includes(u.up) ||
        !STAT_IDS.includes(u.down) ||
        u.up === u.down)
    )
      return false;
  }
  return true;
}
