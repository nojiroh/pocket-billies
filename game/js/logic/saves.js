'use strict';
/* ================= SAVES =================
   Phase 04e: the save format, moved here from game-state.js (a new save, filling one out, the load checks) and
   settings-screen.js (the backup check). Where a save is kept (this browser, the account) stays in game-state.js
   and account.js. Logic only (game/js/logic/, see rules.js). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { saveData } from '../hooks.js';
import { random } from '../util.js';
import {
  COINS,
  EGGS,
  ITEMS,
  JOBS,
  LINES,
  LOCATIONS,
  MOVES,
  RULES,
  SPECIES,
  START_NODE,
  STATUS_NAMES,
  roadCost,
} from '../game-data.js';
import { cleanName, emptyJob, jobSlotCount, movesAt, teamSize, today } from './rules.js';
/* eslint-disable no-func-assign */
expose({
  SAVE_NEW_MSG: [() => SAVE_NEW_MSG],
  SAVE_OLD_MSG: [() => SAVE_OLD_MSG],
  SAVE_VERSION: [() => SAVE_VERSION],
  loadSave: [() => loadSave, v => (loadSave = v)],
  migrate: [() => migrate, v => (migrate = v)],
  newSave: [() => newSave, v => (newSave = v)],
  newSaveKeepingPreferences: [() => newSaveKeepingPreferences, v => (newSaveKeepingPreferences = v)],
  saveAge: [() => saveAge, v => (saveAge = v)],
  validSave: [() => validSave, v => (validSave = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @returns {SaveData} */
export function newSave() {
  const R = RULES.start,
    coins = /** @type {Record<string, number>} */ ({}),
    items = /** @type {Record<string, number>} */ ({});
  Object.keys(COINS).forEach(k => (coins[k] = 0));
  Object.keys(ITEMS).forEach(k => (items[k] = 0));
  Object.assign(coins, R.coins);
  Object.assign(items, R.items);
  return {
    v: 4,
    saveVersion: SAVE_VERSION,
    gameVersion: PB_VERSION,
    avatar: null,
    preferences: { theme: 'system', motion: 'system', fps: 60, effects: 'full' },
    started: false,
    gender: null,
    starter: null,
    team: [],
    box: [],
    seen: {},
    caught: {},
    se: R.se,
    seFrac: 0,
    coins,
    items,
    day: { date: today(), steps: 0 },
    totalSteps: 0,
    trip: { node: START_NODE, prog: 0, plan: [], hold: false },
    mapSeen: null,
    meter: 0,
    queue: [],
    buddy: null,
    buddyRem: 0,
    flags: {},
    seats: [],
    visited: { [START_NODE]: 1 },
    serial: 300,
    eggs: [],
    jobs: Array.from({ length: jobSlotCount() }, emptyJob),
    savedAt: 0,
    /* trainer card: ID number, start date (0 = unknown, older saves) and eggs hatched */
    tid: 10000 + Math.floor(random() * 90000),
    since: 0,
    hatched: 0,
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
export function migrate(o) {
  if (!o || typeof o !== 'object') return null;
  const f = newSave();
  /** @type {SaveData} */
  const s = Object.assign(f, o);
  const zero = obj => Object.fromEntries(Object.keys(obj).map(k => [k, 0]));
  s.coins = Object.assign(zero(COINS), o.coins || {});
  s.items = Object.assign(zero(ITEMS), o.items || {});
  s.flags = o.flags || {};
  const p = (s.preferences = Object.assign(
    { theme: 'system', motion: 'system', fps: 60, effects: 'full' },
    o.preferences || {}
  ));
  if (![30, 60, 90, 120].includes(+p.fps)) p.fps = 60;
  if (p.aim !== 'smooth') p.aim = 'sharp';
  p.effects = 'full';
  p.fps = +p.fps;
  if (!Array.isArray(s.eggs)) s.eggs = [];
  if (!Array.isArray(s.jobs)) s.jobs = [];
  while (s.jobs.length < jobSlotCount()) s.jobs.push(emptyJob());
  while (s.jobs.length > jobSlotCount()) {
    const j = /** @type {JobSlot} */ (s.jobs.pop());
    const m = [...(s.team || []), ...(s.box || [])].find(x => x.uid === j.uid);
    if (m) {
      m.job = null;
      m.boxedAt = Date.now();
    }
  }
  if (!SPECIES[s.starter + '0'] && s.started)
    s.starter = RULES.start.starters.find(l => SPECIES[l + '0']) || LINES[0].id;
  s.team = (s.team || []).filter(m => SPECIES[m.sp]);
  s.box = (s.box || []).filter(m => SPECIES[m.sp]);
  [...s.team, ...s.box].forEach(m => {
    if (m.nick != null) m.nick = cleanName(m.nick, 16);
  });
  if (s.avatar && typeof s.avatar === 'object' && 'name' in s.avatar)
    s.avatar.name = cleanName(s.avatar.name, 18) || 'Trainer';
  [...s.team, ...s.box].forEach(m => {
    m.moves = (m.moves || []).filter(k => MOVES[k]);
    if (!m.moves.length) m.moves = movesAt(SPECIES[m.sp].line, m.lvl);
  });
  for (const key of ['seen', 'caught'])
    if (s[key] && typeof s[key] === 'object') for (const id of Object.keys(s[key])) if (!SPECIES[id]) delete s[key][id];
  s.queue = (s.queue || []).filter(q => SPECIES[q.sp]);
  s.eggs = s.eggs.filter(e => EGGS[e.tier]);
  s.jobs.forEach(j => {
    if (j.job && !JOBS[j.job]) j.job = Object.keys(JOBS)[0] || null;
  });
  if (!s.trip || !LOCATIONS[s.trip.node]) s.trip = { node: START_NODE, prog: 0, plan: [], hold: false };
  s.trip.plan = (Array.isArray(s.trip.plan) ? s.trip.plan : []).filter(x => LOCATIONS[x]);
  if (s.trip.plan.length && !roadCost(s.trip.node, s.trip.plan[0])) {
    s.trip.plan = [];
    s.trip.prog = 0;
  }
  s.trip.hold = !!s.trip.hold;
  if (!s.visited || typeof s.visited !== 'object') s.visited = {};
  s.visited[s.trip.node] = 1;
  if (s.started && !s.team.length && !s.box.length) return newSave();
  s.v = 4;
  s.saveVersion = SAVE_VERSION;
  s.gameVersion = PB_VERSION;
  return s;
}
/* phase 02: every save says which save format it is (saveVersion; raise it when old saves can't be read any more; 2 since phase 05).
   A save without one (alpha 0.5 and earlier) or from a newer format is not loaded: the game says so and starts fresh.
   saveAge: null (no save), 'ok', 'old' or 'new'. A newer save is never written over (saveHold) */
export const SAVE_VERSION = 2;
/** @param {any} o @returns {'ok' | 'old' | 'new' | null} */
export function saveAge(o) {
  if (!o || typeof o !== 'object') return null;
  const v = o.saveVersion;
  return v === SAVE_VERSION ? 'ok' : Number.isInteger(v) && v > SAVE_VERSION ? 'new' : 'old';
}
/** @param {any} o @returns {SaveData | null} */
export function loadSave(o) {
  return saveAge(o) === 'ok' ? migrate(o) : null;
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
  const ids = new Set();
  for (const m of o.team.concat(o.box)) {
    if (
      !m ||
      !SPECIES[m.sp] ||
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
  if (
    !o.trip ||
    !Number.isInteger(o.trip.node) ||
    !num(o.trip.node, 0, LOCATIONS.length - 1) ||
    !num(o.trip.prog, 0, 1e9) ||
    !o.day ||
    !num(o.day.steps, 0, 1e9) ||
    !num(o.se, 0, 1e12) ||
    !num(o.totalSteps, 0, 1e12)
  )
    return false;
  if (
    !Array.isArray(o.queue) ||
    o.queue.length > Math.max(10, RULES.steps.maxEncounters) ||
    o.queue.some(q => !q || !SPECIES[q.sp] || !num(q.lvl, 1, 100))
  )
    return false;
  if (!Array.isArray(o.eggs) || o.eggs.some(e => !e || !num(e.prog, 0, 1e12))) return false;
  if (
    !Array.isArray(o.jobs) ||
    o.jobs.length > 12 ||
    o.jobs.some(
      j => !j || (j.uid && (!ids.has(j.uid) || !JOBS[j.job])) || !num(j.acc, 0, 1e12) || !num(j.pend, 0, 1e12)
    )
  )
    return false;
  for (const k of ['coins', 'items'])
    if (!o[k] || typeof o[k] !== 'object' || Object.values(o[k]).some(n => !num(n, 0, 1e12))) return false;
  const record = v => v && typeof v === 'object' && !Array.isArray(v) && !Object.hasOwn(v, '__proto__');
  if (
    !record(o.seen) ||
    !record(o.caught) ||
    !record(o.flags) ||
    !Array.isArray(o.seats) ||
    o.seats.some(v => typeof v !== 'string') ||
    Object.hasOwn(o, '__proto__')
  )
    return false;
  if (!num(o.meter, 0, 1e9) || !num(o.serial, 0, 1e12) || !num(o.seFrac, 0, 1) || !num(o.buddyRem, 0, 1e12))
    return false;
  for (const m of o.team.concat(o.box))
    if (
      typeof (m.nick || '') !== 'string' ||
      (m.status != null && !STATUS_NAMES[m.status]) ||
      (m.job != null &&
        (!Number.isInteger(m.job) || m.job < 0 || m.job >= o.jobs.length || o.jobs[m.job].uid !== m.uid))
    )
      return false;
  return true;
}
