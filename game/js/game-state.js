// @ts-check
'use strict';
/* ================= CORE ================= */
/** @import { SaveData } from '../types/save-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { flushAccountSave, provide, runWorld, runWorldSync, toast } from './hooks.js';
import { TEST_BOOT } from './test-boot.js';
import { loadSave, newSave, saveAge } from './logic/saves.js';
/* eslint-disable no-func-assign */
expose({
  ACCOUNT_ID: [() => ACCOUNT_ID],
  ACCOUNT_KEY: [() => ACCOUNT_KEY],
  FIXTURE: [() => FIXTURE],
  SAVE_FOUND: [() => SAVE_FOUND],
  SAVE_KEY: [() => SAVE_KEY],
  SAVE_KEY_BASE: [() => SAVE_KEY_BASE],
  SET_ASIDE_KEY: [() => SET_ASIDE_KEY],
  // @ts-expect-error -- replaced on purpose
  accountSetAside: [() => accountSetAside, v => (accountSetAside = v)],
  // @ts-expect-error -- replaced on purpose
  accountSetAsideRead: [() => accountSetAsideRead, v => (accountSetAsideRead = v)],
  activeBattle: [() => activeBattle, v => setActiveBattle(v)],
  escapeHtml: [() => escapeHtml],
  // @ts-expect-error -- replaced on purpose
  flushSave: [() => flushSave, v => (flushSave = v)],
  holdBefore: [() => holdBefore, v => (holdBefore = v)],
  // @ts-expect-error -- replaced on purpose
  pauseSaving: [() => pauseSaving, v => (pauseSaving = v)],
  // @ts-expect-error -- replaced on purpose
  readStoredSave: [() => readStoredSave, v => (readStoredSave = v)],
  reducedMotion: [() => reducedMotion, v => setReducedMotion(v)],
  // @ts-expect-error -- replaced on purpose
  resumeSaving: [() => resumeSaving, v => (resumeSaving = v)],
  save: [() => save, v => setSave(v)],
  saveData: [() => saveData, v => setSaveData(v)],
  // @ts-expect-error -- replaced on purpose
  saveHeld: [() => saveHeld, v => (saveHeld = v)],
  saveHold: [() => saveHold, v => setSaveHold(v)],
  // @ts-expect-error -- replaced on purpose
  saveNow: [() => saveNow, v => ((saveNow = v), provide({ saveNow }))],
  saveTimer: [() => saveTimer, v => (saveTimer = v)],
  // @ts-expect-error -- replaced on purpose
  setActiveBattle: [() => setActiveBattle, v => ((setActiveBattle = v), provide({ setActiveBattle }))],
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
provide({ save, saveNow, setActiveBattle });
/* to-module: end */
export const escapeHtml = s =>
  String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export let reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
provide({ reducedMotion }); /* to-module */
export let saveHold = false;
/* alpha 0.4.1: one save per player. Without an account the save lives in this browser (the original key); a player who
   signs in with Google (js/account.js) gets their own save, kept online and copied in this browser under their id */
export const SAVE_KEY_BASE = 'networth-save-v1',
  ACCOUNT_KEY = 'pb-account';
/* the fast check's fixture (?fixture=<name>, js/fixture.js): a ready-made game with a save of its own in this browser
   and no account, so a player's save is never touched */
export const FIXTURE = (() => {
  try {
    return new URLSearchParams(location.search).get('fixture') || '';
  } catch (e) {
    return '';
  }
})();
export const ACCOUNT_ID = (() => {
  if (FIXTURE) return '';
  try {
    return localStorage.getItem(ACCOUNT_KEY) || '';
  } catch (e) {
    return '';
  }
})();
export const SAVE_KEY = FIXTURE
  ? SAVE_KEY_BASE + '-fixture'
  : ACCOUNT_ID
    ? SAVE_KEY_BASE + '-u-' + ACCOUNT_ID
    : SAVE_KEY_BASE;
/** @returns {any} what this browser has under SAVE_KEY, parsed (null when nothing or unreadable) */
function readStoredSave() {
  if (TEST_BOOT) return null; /* phase 16 test boot (js/test-boot.js): every load starts fresh */
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
  } catch (e) {
    return null;
  }
}
/** @param {SaveData} o */
export function writeStoredSave(o) {
  if (saveHold || TEST_BOOT || saveHeld()) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(o));
  } catch (e) {
    if (typeof uiState !== 'undefined' && !uiState.saveWarning) {
      uiState.saveWarning = true;
      setTimeout(() => toast('Browser storage is full or unavailable. Export a save backup from Settings.'), 0);
    }
  }
}
/* a save set aside in this browser (one, the latest), when your account and this browser held different games and you
   kept one (account.js): Settings > Save restores it or downloads it */
const SET_ASIDE_KEY = () => SAVE_KEY + '-set-aside';
export function accountSetAside(json, from) {
  try {
    localStorage.setItem(SET_ASIDE_KEY(), JSON.stringify({ json, from, at: Date.now() }));
  } catch (e) {
    console.warn(e);
  }
}
export function accountSetAsideRead() {
  try {
    const v = JSON.parse(localStorage.getItem(SET_ASIDE_KEY()) || 'null');
    return v && v.json ? v : null;
  } catch (e) {
    return null;
  }
}
/* a save here that this version can't load: an older one is replaced by the new game (the title says so); a newer
   one is never written over (saveHold) */
export const SAVE_FOUND = saveAge(readStoredSave());
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
  /* RL-7: the world follows the save (a run's or the hub's: game/js/run-world.js), once boot has put the first in */
  if (typeof runWorld !== 'undefined' && runWorld.live) runWorldSync();
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
  /* phase 06-2: the opening couldn't start ('cant') or broke ('stopped'): the Try again screen */
  openingFailed: /** @type {false | 'cant' | 'stopped'} */ (false),
  modal: null,
  mq: [],
  /* moves waiting to be learned in place of another */
  learnQ: /** @type {{ uid: string, mv: string }[]} */ ([]),
  /* phase 06: toasts (js/logic/messages.js); older code may push plain strings */
  toastQ: /** @type {Array<import('./logic/messages.js').Toast | string>} */ ([]),
  toastOn: /** @type {false | import('./logic/messages.js').Toast} */ (false),
  /* phase 06: notices that can wait, behind the dot on the portrait (ui.js notice) */
  inbox: /** @type {{ id: string, title: string, html: string, onRead?: () => void }[]} */ ([]),
  evT: null,
  throwing: false,
  disp: { se: null },
  seenEnc: new Set(),
  mapSel: null,
  /* the Actions sheet over the world is open (walk-tab.js walkSheetSync) */
  walkSheet: false,
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
/* RL-8: while a run's battle is on, nothing is written: the save holds the battle's start (run.at phase 'battle', saved
   as it began), so a phone killed mid-battle starts it again from its seed. Worked out, not stored: the save's run is
   in that phase and the battle on screen is that one (runK, run.js), so swapping the save or clearing the battle lets
   go of it whatever ends it */
export function saveHeld() {
  const run = saveData && saveData.run,
    b = /** @type {any} */ (activeBattle);
  return !!(run && run.at && run.at.phase === 'battle' && b && b.runK != null && b.runK === run.at.battle);
}
/* RL-8: a run's checkpoint (its start, an arrival, a battle about to begin, its end): written here and sent to the
   account at once, not after save()'s few seconds, so a phone killed right after resumes from it */
export function saveNow() {
  save();
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (saveHold || TEST_BOOT || saveHeld()) return;
  if (typeof flushAccountSave === 'function') flushAccountSave(true);
}
export function flushSave() {
  if (saveHold || TEST_BOOT || saveHeld()) return;
  if (typeof flushAccountSave === 'function') flushAccountSave();
}
/* phase 13: the in-game full test (self-test.js) changes the save while it runs, so nothing is written, in this browser,
   to the account or to friends, until it has put your save back. The hold that was there before (a newer save kept
   aside) comes back after; then your save goes to the account again, in case a write was waiting when the test began */
/** @type {boolean | null} */
let holdBefore = null;
export function pauseSaving() {
  if (holdBefore !== null) return;
  holdBefore = saveHold;
  setSaveHold(true);
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}
export function resumeSaving() {
  if (holdBefore === null) return;
  setSaveHold(holdBefore);
  holdBefore = null;
  flushSave();
}
