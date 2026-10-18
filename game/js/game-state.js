// @ts-check
'use strict';
/* ================= CORE ================= */
/** @import { Billy, JobSlot, SaveData } from '../types/save-data' */
/** @import { Trainer } from '../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { flushAccountSave, provide, toast } from './hooks.js';
import { random } from './util.js';
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
  roadCost,
} from './game-data.js';
import { cleanName, emptyJob, jobSlotCount, movesAt, today } from './logic/rules.js';
/* eslint-disable no-func-assign */
expose({
  ACCOUNT_ID: [() => ACCOUNT_ID],
  ACCOUNT_KEY: [() => ACCOUNT_KEY],
  SAVE_FOUND: [() => SAVE_FOUND],
  SAVE_KEY: [() => SAVE_KEY],
  SAVE_KEY_BASE: [() => SAVE_KEY_BASE],
  SAVE_NEW_MSG: [() => SAVE_NEW_MSG],
  SAVE_OLD_MSG: [() => SAVE_OLD_MSG],
  SAVE_VERSION: [() => SAVE_VERSION],
  activeBattle: [() => activeBattle, v => setActiveBattle(v)],
  escapeHtml: [() => escapeHtml],
  // @ts-expect-error -- replaced on purpose
  flushSave: [() => flushSave, v => (flushSave = v)],
  // @ts-expect-error -- replaced on purpose
  loadSave: [() => loadSave, v => (loadSave = v)],
  // @ts-expect-error -- replaced on purpose
  migrate: [() => migrate, v => (migrate = v)],
  // @ts-expect-error -- replaced on purpose
  newSave: [() => newSave, v => (newSave = v)],
  // @ts-expect-error -- replaced on purpose
  newSaveKeepingPreferences: [() => newSaveKeepingPreferences, v => (newSaveKeepingPreferences = v)],
  // @ts-expect-error -- replaced on purpose
  readStoredSave: [() => readStoredSave, v => (readStoredSave = v)],
  reducedMotion: [() => reducedMotion, v => setReducedMotion(v)],
  save: [() => save, v => setSave(v)],
  // @ts-expect-error -- replaced on purpose
  saveAge: [() => saveAge, v => (saveAge = v)],
  saveData: [() => saveData, v => setSaveData(v)],
  saveHold: [() => saveHold, v => setSaveHold(v)],
  saveTimer: [() => saveTimer, v => (saveTimer = v)],
  // @ts-expect-error -- replaced on purpose
  setActiveBattle: [() => setActiveBattle, v => (setActiveBattle = v)],
  // @ts-expect-error -- replaced on purpose
  setNoSaving: [() => setNoSaving, v => (setNoSaving = v)],
  // @ts-expect-error -- replaced on purpose
  setReducedMotion: [() => setReducedMotion, v => (setReducedMotion = v)],
  // @ts-expect-error -- replaced on purpose
  setSave: [() => setSave, v => (setSave = v)],
  // @ts-expect-error -- replaced on purpose
  setSaveData: [() => setSaveData, v => (setSaveData = v)],
  // @ts-expect-error -- replaced on purpose
  setSaveHold: [() => setSaveHold, v => (setSaveHold = v)],
  uiState: [() => uiState],
  // @ts-expect-error -- replaced on purpose
  writeStoredSave: [() => writeStoredSave, v => (writeStoredSave = v)],
});
/* eslint-enable no-func-assign */
provide({ save });
/* to-module: end */
export const escapeHtml = s =>
  String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export let reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
provide({ reducedMotion }); /* to-module */
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
export let saveHold = false;
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
/* alpha 0.4.1: one save per player. Without an account the save lives in this browser (the original key); a player who
   signs in with Google (js/account.js) gets their own save, kept online and copied in this browser under their id */
export const SAVE_KEY_BASE = 'networth-save-v1',
  ACCOUNT_KEY = 'pb-account';
export const ACCOUNT_ID = (() => {
  try {
    return localStorage.getItem(ACCOUNT_KEY) || '';
  } catch (e) {
    return '';
  }
})();
export const SAVE_KEY = ACCOUNT_ID ? SAVE_KEY_BASE + '-u-' + ACCOUNT_ID : SAVE_KEY_BASE;
/** @returns {any} what this browser has under SAVE_KEY, parsed (null when nothing or unreadable) */
function readStoredSave() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
  } catch (e) {
    return null;
  }
}
/** @param {SaveData} o */
export function writeStoredSave(o) {
  if (saveHold) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(o));
  } catch (e) {
    if (typeof uiState !== 'undefined' && !uiState.saveWarning) {
      uiState.saveWarning = true;
      setTimeout(() => toast('Browser storage is full or unavailable. Export a save backup from Settings.'), 0);
    }
  }
}
/* a save here that this version can't load is kept aside in this browser (once), and the title says why it's a new game */
export const SAVE_FOUND = saveAge(readStoredSave());
if (SAVE_FOUND === 'old' || SAVE_FOUND === 'new')
  try {
    const k = SAVE_KEY + '-set-aside';
    /* SAVE_FOUND says the key holds a save */
    if (localStorage.getItem(k) == null)
      localStorage.setItem(k, /** @type {string} */ (localStorage.getItem(SAVE_KEY)));
  } catch (e) {}
if (SAVE_FOUND === 'new') saveHold = true;
export let saveData = loadSave(readStoredSave()) || newSave();
provide({ saveData }); /* to-module */
export let activeBattle = null;
provide({ activeBattle }); /* to-module */
/* phase 04d: other modules change the save, the battle, reduced motion and the save hold through these (an imported
   name can't be assigned); each hands the new value to hooks.js for the modules that read it from there */
export function setSaveData(v) {
  saveData = v;
  provide({ saveData });
}
export function setActiveBattle(v) {
  activeBattle = v;
  provide({ activeBattle });
}
export function setReducedMotion(v) {
  reducedMotion = v;
  provide({ reducedMotion });
}
export function setSaveHold(v) {
  saveHold = v;
  provide({ saveHold });
}
/* test mode (?test, boot.js): nothing the checks do reaches the save */
export function setNoSaving() {
  /* eslint-disable no-func-assign */
  // @ts-expect-error -- replaced on purpose
  writeStoredSave = function () {};
  // @ts-expect-error -- replaced on purpose
  flushSave = async function () {};
  /* eslint-enable no-func-assign */
  provide({ writeStoredSave, flushSave });
}
export const uiState = {
  tab: 'walk',
  lastTab: null,
  intro: 0,
  modal: null,
  mq: [],
  /* moves waiting to be learned in place of another */
  learnQ: /** @type {{ uid: string, mv: string }[]} */ ([]),
  toastQ: [],
  toastOn: false,
  evT: null,
  throwing: false,
  disp: { steps: null, se: null },
  seenEnc: new Set(),
  mapSel: null,
};
provide({ uiState }); /* to-module */

/* ---------- saving: in this browser, and on the account when signed in (account.js) ---------- */
/** @type {ReturnType<typeof setTimeout> | null} */
let saveTimer = null;
export function save() {
  saveData.savedAt = Date.now();
  writeStoredSave(saveData);
  if (!saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null;
      flushSave();
    }, 4000);
}
/* phase 04d: the in-game full test (self-test.js) keeps your save out of it */
export function setSave(v) {
  // @ts-expect-error -- replaced on purpose
  save = v; // eslint-disable-line no-func-assign
  provide({ save });
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    flushSave();
  }
});
export function flushSave() {
  if (saveHold) return;
  if (typeof flushAccountSave === 'function') flushAccountSave();
}
