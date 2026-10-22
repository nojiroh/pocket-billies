// @ts-check
'use strict';
/* ================= A NEW VERSION, LOADED (the owner, 2026-10-22: "make sure the game loads the latest version") =================
   The built site (vite.config.js) names each deploy: PB_BUILD in version.js and the same in build.json. The game
   asks for build.json (never from a cache) when it starts, when it comes back to the screen (a phone's app switched
   back to) and every ten minutes; when the site has another build, it saves and loads the page again, at once if
   nothing is going on, else as soon as the battle, cutscene, flight or window you are in is over. Before loading, it
   lets the service worker (sw.js) update to the new build's, so the files come from the network, not a cache.
   Off where there is no build (the repository served as it is, Start-Game, the checks: PB_BUILD is '') and in the
   fixtures. One reload a session per new build, so a site that keeps answering with another build can't loop. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { FIXTURE, activeBattle, saveHeld, saveNow, uiState } from './game-state.js';
import { cutscene } from './cutscene/director.js';
import { airshipFlight } from './airship.js';
import { toast } from './ui.js';
/* eslint-disable no-func-assign */
expose({
  UPDATE_EVERY: [() => UPDATE_EVERY],
  UPDATE_GAP: [() => UPDATE_GAP],
  updateBuild: [() => updateBuild],
  // @ts-expect-error -- replaced on purpose
  updateCheckStart: [() => updateCheckStart, v => (updateCheckStart = v)],
  // @ts-expect-error -- replaced on purpose
  updateLook: [() => updateLook, v => (updateLook = v)],
  // @ts-expect-error -- replaced on purpose
  updateReload: [() => updateReload, v => (updateReload = v)],
  // @ts-expect-error -- replaced on purpose
  updateSafe: [() => updateSafe, v => (updateSafe = v)],
  updateState: [() => updateState],
  // @ts-expect-error -- replaced on purpose
  updateWorker: [() => updateWorker, v => (updateWorker = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** how often the game asks while it stays on screen, and the least time between two asks */
const UPDATE_EVERY = 10 * 60 * 1000;
const UPDATE_GAP = 60 * 1000;
const updateState = { latest: '', at: 0, told: false, waiting: false };

/** the build this page runs ('' without one: not the built site) */
const updateBuild = () => String((typeof self !== 'undefined' && /** @type {any} */ (self).PB_BUILD) || '');

/** may the page load again now: no battle, cutscene, airship flight or window on, the save not held by a battle */
function updateSafe() {
  return (
    !(typeof activeBattle !== 'undefined' && activeBattle) &&
    !(typeof cutscene !== 'undefined' && cutscene.on) &&
    !(typeof airshipFlight !== 'undefined' && airshipFlight.on) &&
    !(typeof uiState !== 'undefined' && uiState.modal) &&
    !(typeof saveHeld === 'function' && saveHeld())
  );
}

/** ask the site which build it has; when it isn't this page's, load the new one (now or when it is safe)
 * @param {boolean} [force] ask even if it asked less than a minute ago */
async function updateLook(force = false) {
  const mine = updateBuild();
  if (!mine || location.protocol === 'file:' || (typeof FIXTURE !== 'undefined' && FIXTURE)) return;
  if (!force && Date.now() - updateState.at < UPDATE_GAP) return;
  updateState.at = Date.now();
  let latest = '';
  try {
    const r = await fetch('build.json', { cache: 'no-store' });
    if (!r.ok) return;
    latest = String((await r.json()).build || '');
  } catch {
    return;
  }
  if (!latest || latest === mine) return;
  updateState.latest = latest;
  updateReload();
}

/** the service worker updated to the site's (sw.js imports version.js, so a new build is a new worker), waited for
 * at most a few seconds */
async function updateWorker() {
  try {
    const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
    if (!reg) return;
    await reg.update();
    const w = reg.installing || reg.waiting;
    if (!w) return;
    await new Promise(done => {
      const t = setTimeout(done, 5000);
      w.addEventListener('statechange', () => {
        if (w.state === 'activated' || w.state === 'redundant') {
          clearTimeout(t);
          done(null);
        }
      });
    });
  } catch {
    /* no worker: the page loads from the network anyway */
  }
}

/** load the new build: saved first; while something is going on, said once and tried again every few seconds */
function updateReload() {
  const latest = updateState.latest;
  if (!latest || updateState.waiting) return;
  let tried = '';
  try {
    tried = sessionStorage.getItem('pb-update') || '';
  } catch {
    /* no session storage: still one try, below */
  }
  if (tried === latest) return;
  if (!updateSafe()) {
    if (!updateState.told && typeof toast === 'function') {
      updateState.told = true;
      toast('A new version of the game is ready. It loads when this is over.');
    }
    setTimeout(updateReload, 4000);
    return;
  }
  updateState.waiting = true;
  try {
    sessionStorage.setItem('pb-update', latest);
  } catch {
    /* nothing kept: the reload happens once anyway, this page goes away */
  }
  if (typeof saveNow === 'function') saveNow();
  updateWorker().finally(() => location.reload());
}

/** start asking: now, when the page comes back to the screen or the window gets focus, and every UPDATE_EVERY */
export function updateCheckStart() {
  if (!updateBuild()) return;
  updateLook(true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') updateLook();
  });
  addEventListener('focus', () => updateLook());
  setInterval(() => updateLook(true), UPDATE_EVERY);
}
