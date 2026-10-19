'use strict';
/* ================= TITLE SCREEN =================
   After loading: the Pocket Billies logo in pixel lettering and title music over a slow camera on a real scene, drawn
   by the game: Copperleaf from above the rooftops at your local time of day when you have a game, the city of the
   opening at night in the rain when you don't (cutscenes/city.json). Without the 3D scene, the painted sky.
   2026-10-19 (the owner): signed out, a glass card offers Sign in with Google or Play without an account (folded to a
   corner chip for this visit); signed in, your account chip in the corner (tap: email, where the save is, Sign out).
   With a game: the Continue card (portrait, name, place, time played), New game and Settings quiet under it; signed in,
   Continue presses itself after 4 s, a ring filling round it, unless you touch anything first. The version and What's
   new (meta.json whatsNew) at the bottom. On a phone one tap anywhere continues. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import {
  GOOGLE_ICON_SVG,
  TEST_RUN,
  account,
  accountChipHTML,
  accountOn,
  accountSignOut,
  closeModal,
  mapIdAt,
  modal,
  openSettings,
  render,
  showPendingWindows,
} from './hooks.js';
import { $, clamp } from './util.js';
import { TEST_BOOT } from './test-boot.js';
import { CUTSCENES, LOCATIONS, START_NODE, gameData } from './game-data.js';
import { encountersHere } from './logic/rules.js';
import { newSaveKeepingPreferences } from './logic/saves.js';
import {
  activeBattle,
  escapeHtml,
  flushSave,
  reducedMotion,
  save,
  saveData,
  setSaveData,
  uiState,
  writeStoredSave,
} from './game-state.js';
import { userFps } from './frame-scheduler.js';
import { uiIconHTML } from './art.js';
import { personHTML } from './person-art.js';
import { applyPreferences } from './settings-screen.js';
import { mapById, stopWalkView, walkView } from './walk-view.js';
import { environment } from './environment.js';
import { walkRenderer } from './walk/walk-state.js';
import { standingHeightAt } from './walk/heights.js';
import { mountWalkView } from './walk-view-gl.js';
import { music, musicFor } from './sound.js';
import { cutsceneMapId, cutsceneStart, cutsceneStartName, cutsceneWanted } from './cutscene/opening.js';
/* eslint-disable no-func-assign */
expose({
  TITLE_AUTO_MS: [() => TITLE_AUTO_MS],
  playSeenEncounters: [() => playSeenEncounters, v => (playSeenEncounters = v)],
  playTicks: [() => playTicks, v => (playTicks = v)],
  renderTitle: [() => renderTitle, v => (renderTitle = v)],
  titleAccountHTML: [() => titleAccountHTML, v => (titleAccountHTML = v)],
  titleAccountSheet: [() => titleAccountSheet, v => (titleAccountSheet = v)],
  titleAccounts: [() => titleAccounts],
  titleAutoCheck: [() => titleAutoCheck, v => (titleAutoCheck = v)],
  titleAutoStop: [() => titleAutoStop, v => (titleAutoStop = v)],
  titleCityFrame: [() => titleCityFrame, v => (titleCityFrame = v)],
  titleContinue: [() => titleContinue, v => (titleContinue = v)],
  titleEnd: [() => titleEnd, v => (titleEnd = v)],
  titleFrame: [() => titleFrame, v => (titleFrame = v)],
  titleMount: [() => titleMount, v => (titleMount = v)],
  titleNew: [() => titleNew, v => (titleNew = v)],
  titleNews: [() => titleNews, v => (titleNews = v)],
  titlePlayTime: [() => titlePlayTime, v => (titlePlayTime = v)],
  titleScreen: [() => titleScreen],
  titleSignInHTML: [() => titleSignInHTML, v => (titleSignInHTML = v)],
  titleSignedIn: [() => titleSignedIn],
  titleStart: [() => titleStart, v => (titleStart = v)],
  titleWanted: [() => titleWanted, v => (titleWanted = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const titleScreen = {
  on: false,
  t0: 0,
  run: 0,
  mounted: false,
  guest: false,
  autoT: 0,
  autoOff: false,
  city: false,
};
/* how long Continue waits before it presses itself, signed in */
const TITLE_AUTO_MS = 4000;
export function titleWanted() {
  return (
    !(typeof TEST_RUN !== 'undefined' && TEST_RUN) &&
    !TEST_BOOT &&
    !(saveData.preferences && saveData.preferences.skipTitle)
  );
}
/* the camera: a slow drift along the front of the town, high above the rooftops, looking up the main street */
function titleFrame() {
  if (!titleScreen.on || !walkView.sc) return null;
  if (titleScreen.city) return titleCityFrame();
  const sc = walkView.sc,
    now = performance.now(),
    k = reducedMotion ? 0.5 : 0.5 - 0.5 * Math.cos(((now - titleScreen.t0) / 1000) * 0.05),
    /* (in the walk view the town is one part of a bigger picture: frame the town itself) */ b = sc.baseId
      ? mapById(sc.baseId) || sc
      : sc,
    o = sc.baseOff || [0, 0],
    x = o[0] + b.w * (0.28 + 0.44 * k),
    gy = standingHeightAt(clamp(x, o[0] + 1, o[0] + b.w - 1), clamp(o[1] + b.h * 0.3, o[1] + 1, o[1] + b.h - 1)),
    eye = [x, gy + 17, o[1] - 4],
    tgt = [x + 5, gy + 1.2, o[1] + b.h * 0.36],
    fd = Math.hypot(tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]);
  return {
    look: { eye, tgt, fov: 44, w: 0 },
    items: [],
    lights: [],
    parts: [],
    hide: null,
    focus: fd,
    blur: 0.12,
    center: [tgt[0], tgt[2]],
    cut: 2.6,
  };
}
/* the city behind the title for a new player: down the avenue from the opening's canyon shot, gliding on slowly */
function titleCityFrame() {
  const C = CUTSCENES.city,
    K = C && C.shots.canyon;
  if (!K) return null;
  const now = performance.now(),
    k = reducedMotion ? 0.3 : 0.5 - 0.5 * Math.cos(((now - titleScreen.t0) / 1000) * 0.035),
    dz = 26 * k,
    eye = [K.eye[0], K.eye[1] + 4 - 6 * k, K.eye[2] + dz],
    tgt = [K.tgt[0], K.tgt[1] + 6, K.tgt[2] + dz + 20],
    fd = Math.hypot(tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]);
  return {
    look: { eye, tgt, fov: K.fov || 45, w: 0 },
    items: [],
    lights: [],
    parts: [],
    hide: null,
    focus: fd,
    blur: 0.1,
    center: [tgt[0], tgt[2]],
    cut: 2.6,
  };
}
function titlePlayTime() {
  const m = Math.floor((saveData.playMs || 0) / 60000);
  return m < 1
    ? 'just started'
    : m < 60
      ? `${m} min`
      : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}
/* signed in (and its save looked at online): auto-continue applies; accounts on in this copy of the game at all */
const titleSignedIn = () => typeof account !== 'undefined' && !!account.user;
const titleAccounts = () => typeof accountOn === 'function' && accountOn();
/* the corner: your account chip, or (signed out, the card folded away) a small Sign in */
function titleAccountHTML() {
  if (!titleAccounts()) return '';
  if (titleSignedIn()) {
    const u = account.user,
      first = String(u.name || 'Player').split(/\s+/)[0],
      pic = u.photo
        ? `<img src="${escapeHtml(u.photo)}" alt="" referrerpolicy="no-referrer">`
        : `<i>${escapeHtml(first.slice(0, 1).toUpperCase())}</i>`;
    return `<button class="ttl-chip" data-a="ttlacc" aria-label="Signed in as ${escapeHtml(u.name || first)}">${pic}<span>${escapeHtml(first)}</span></button>`;
  }
  if (!titleScreen.guest || !account.ready) return '';
  return typeof accountChipHTML === 'function' ? accountChipHTML() : '';
}
/* signed out: the sign-in card under the logo, until you choose to play without an account (this visit) */
function titleSignInHTML() {
  if (!titleAccounts() || titleSignedIn() || titleScreen.guest || !account.ready) return '';
  return `<section class="ttl-card" aria-label="Sign in"><b>Keep your game online</b><p>Sign in with Google and your game is saved to your account, so you can carry on from any device.</p><button class="pb ttl-google" data-a="acc-in">${typeof GOOGLE_ICON_SVG !== 'undefined' ? GOOGLE_ICON_SVG : ''}<span>Sign in with Google</span></button>${account.err ? `<p class="ttl-warn">${escapeHtml(account.err)}</p>` : ''}<button class="ttl-link" data-a="ttlguest">Play without an account</button></section>`;
}
export function renderTitle() {
  const cont = saveData.started && saveData.avatar,
    place = cont && LOCATIONS[saveData.trip.node] ? LOCATIONS[saveData.trip.node].name : '',
    nm = cont ? saveData.avatar.name || 'Trainer' : '',
    news = (gameData.meta && gameData.meta.whatsNew) || [];
  return `<div class="ttl${cont ? ' can-tap' : ''}" data-a="${cont ? 'ttltap' : ''}"><div class="ttl-bg" aria-hidden="true"></div>
  <div class="ttl-acc">${titleAccountHTML()}</div><div class="ttl-top"><h1 class="ttl-logo" aria-label="Pocket Billies"><span>POCKET</span><span>BILLIES</span></h1><p class="ttl-tag">Gotta tax 'em all!</p>${titleSignInHTML()}</div>
  <div class="ttl-bottom">
   ${cont ? `<button class="ttl-cont" data-a="ttlgo"><span class="ttl-face">${personHTML('me', 56)}<svg class="ttl-ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29"/></svg></span><span class="ttl-ct"><b>Continue</b><small>${escapeHtml(nm)} · ${escapeHtml(place)}</small><small>${titlePlayTime()} played</small></span></button>` : ''}
   <div class="ttl-btns">${cont ? `<button class="pb quiet" data-a="ttlnew">New game</button>` : `<button class="pb gold big wide" data-a="intro">New game</button>`}<button class="pb quiet" data-a="ttlset">${uiIconHTML('gear', 14)} Settings</button></div>
   ${cont ? '<p class="ttl-hint">Tap anywhere to continue</p>' : ''}
   <div class="ttl-foot"><span>${escapeHtml(PB_VERSION)}</span>${news.length ? `<button class="ttl-link" data-a="ttlnews">What’s new</button>` : ''}</div></div></div>`;
}
/* ---------- auto-continue (signed in, with a game): 4 s, a ring round Continue; any touch or key stops it ---------- */
export function titleAutoCheck() {
  if (!titleScreen.on || titleScreen.autoT || titleScreen.autoOff || uiState.modal) return;
  if (!titleSignedIn() || !account.pulled || !(saveData.started && saveData.avatar)) return;
  document.body.classList.add('ttl-auto');
  titleScreen.autoT = setTimeout(() => {
    titleScreen.autoT = 0;
    document.body.classList.remove('ttl-auto');
    if (titleScreen.on && !uiState.modal && !titleScreen.autoOff) titleContinue();
  }, TITLE_AUTO_MS);
}
function titleAutoStop() {
  clearTimeout(titleScreen.autoT);
  titleScreen.autoT = 0;
  titleScreen.autoOff = true;
  document.body.classList.remove('ttl-auto');
}
function titleContinue() {
  titleEnd();
  if (typeof music === 'function' && typeof musicFor === 'function') music(musicFor());
  render();
  if (typeof showPendingWindows === 'function') setTimeout(showPendingWindows, 400);
}
/* the account sheet: who, where the game is kept, Sign out */
function titleAccountSheet() {
  const u = account.user;
  if (!u) return;
  modal({
    title: u.name || 'Your account',
    html: `<p>${escapeHtml(u.email || '')}</p><p class="note">Your game is saved to this account and in this browser, so you can carry on from any device you sign in on.</p>`,
    btns: [
      { l: 'Sign out', c: 'quiet', f: () => (closeModal(), typeof accountSignOut === 'function' && accountSignOut()) },
      { l: 'Close', c: 'gold', f: closeModal },
    ],
  });
}
/* What's new: the latest entry of meta.json whatsNew */
function titleNews() {
  const N = ((gameData.meta && gameData.meta.whatsNew) || [])[0];
  if (!N) return;
  modal({
    title: `New in ${N.version}`,
    html: `<ul class="ttl-news">${String(N.text || '')
      .split('\n')
      .filter(l => l.trim())
      .map(l => `<li>${escapeHtml(l.trim())}</li>`)
      .join('')}</ul>`,
    btns: [{ l: 'OK', c: 'gold', f: closeModal }],
  });
}
/* the scene behind the title: Copperleaf with a game, the city at night without one, drawn by the walk renderer
   with the title camera */
export async function titleMount() {
  if (titleScreen.mounted || !titleScreen.on) return;
  titleScreen.mounted = true;
  /* signed in already (the account was quicker than the title): Continue may press itself */
  setTimeout(titleAutoCheck, 50);
  if (typeof music === 'function') music('title');
  if (typeof cutsceneWanted === 'function' && !cutsceneWanted()) {
    document.body.classList.add('ttl-flat');
    return;
  }
  const run = ++titleScreen.run;
  let cv = $('#dio');
  if (!cv) {
    cv = document.createElement('canvas');
    cv.id = 'dio';
    document.body.prepend(cv);
  }
  cv.hidden = false;
  cv.setAttribute(
    'aria-label',
    (typeof cutsceneStartName === 'function' ? cutsceneStartName() : 'The town') + ', from above the rooftops'
  );
  titleScreen.t0 = performance.now();
  const C = CUTSCENES.city;
  titleScreen.city = !saveData.started && !!C && !!mapById(C.map);
  if (titleScreen.city) {
    cv.setAttribute('aria-label', 'A city at night, in the rain');
    titleScreen.force = environment.force;
    environment.force = { ...(environment.force || {}), ...(C.look || {}) };
  }
  walkView.director = { frame: titleFrame };
  try {
    const id = titleScreen.city ? C.map : typeof cutsceneMapId === 'function' ? cutsceneMapId() : mapIdAt(START_NODE);
    await mountWalkView(cv, id, {
      state: () => ({ who: null, npcs: [], enc: [], mode: 'line' }),
      keys: () => false,
      active: () => false,
      onPick: () => {},
      cap: () => (document.hidden ? 1 : Math.min(30, userFps())),
    });
  } catch (e) {
    console.error(e);
  }
  if (!titleScreen.on || run !== titleScreen.run) return;
  if (!walkRenderer.on || !walkView.ready) {
    document.body.classList.add('ttl-flat');
    return;
  }
  walkView.cv.classList.add('in');
  /* the painted landscape stays in front until the town's ground is laid and drawn, then fades away */
  const t0 = performance.now(),
    poll = () => {
      if (!titleScreen.on || run !== titleScreen.run) return;
      if ((walkRenderer.gtex && walkRenderer.frames > 3) || performance.now() - t0 > 20000) {
        document.body.classList.add('ttl-live');
        return;
      }
      setTimeout(poll, 200);
    };
  poll();
}
export function titleStart() {
  if (titleScreen.on) return;
  titleScreen.on = true;
  titleScreen.mounted = false;
  titleScreen.autoOff = false;
  uiState.title = true;
  document.body.classList.add('in-title');
}
function titleEnd() {
  if (!titleScreen.on) return;
  titleScreen.on = false;
  titleScreen.run++;
  uiState.title = false;
  clearTimeout(titleScreen.autoT);
  titleScreen.autoT = 0;
  document.body.classList.remove('ttl-auto');
  if (titleScreen.city) {
    environment.force = titleScreen.force || null;
    titleScreen.city = false;
  }
  document.body.classList.remove('in-title', 'ttl-live', 'ttl-flat');
  if (walkView.director && walkView.director.frame === titleFrame) {
    walkView.director = null;
    walkRenderer.camT = null;
    walkRenderer.focus = null;
  }
  if (walkView.cv) stopWalkView();
}
function titleNew() {
  if (!saveData.started) {
    titleEnd();
    if (typeof cutsceneWanted === 'function' && cutsceneWanted()) cutsceneStart();
    else {
      uiState.openingFailed = 'cant';
      render();
    }
    return;
  }
  modal({
    title: 'Start a new game?',
    html: '<p>This replaces your game: your team, Field Guide and money. (Settings → Save → Export save keeps a copy first.)</p>',
    btns: [
      {
        l: 'Start a new game',
        c: 'red',
        f: () => {
          setSaveData(newSaveKeepingPreferences());
          saveData.savedAt = Date.now();
          writeStoredSave(saveData);
          flushSave();
          uiState.intro = 0;
          uiState.pg = null;
          uiState.avatarDraft = null;
          uiState.trainerDraft = null;
          uiState.tab = 'walk';
          applyPreferences();
          closeModal();
          titleEnd();
          if (typeof cutsceneWanted === 'function' && cutsceneWanted()) cutsceneStart();
          else {
            uiState.openingFailed = 'cant';
            render();
          }
        },
      },
      { l: 'Keep playing this one', c: 'quiet', f: closeModal },
    ],
  });
}
/* play time: counted while the game is open and in view, and saved every minute (phase 08: walking saved it before) */
let playTicks = 0,
  playSeenEncounters = 0;
setInterval(() => {
  if (typeof saveData !== 'undefined' && saveData && saveData.started && !document.hidden && !uiState.title) {
    saveData.playMs = (saveData.playMs || 0) + 15000;
    if (++playTicks % 4 === 0) save();
    /* a wild Billie wandered over: the walk card shows it (walking redrew the screen every few metres before) */
    const n = typeof encountersHere === 'function' ? encountersHere().length : 0;
    if (n !== playSeenEncounters && uiState.tab === 'walk' && !uiState.modal && !activeBattle) render();
    playSeenEncounters = n;
  }
}, 15000);
document.addEventListener(
  'click',
  ev => {
    if (!titleScreen.on) return;
    const el = ev.target.closest('[data-a]'),
      a = el && el.dataset.a;
    if (!a) return;
    if (a === 'intro') {
      titleEnd();
      return;
    } /* a new game from the title: the opening takes over (ui.js starts it) */
    if (a === 'ttlgo' || (a === 'ttltap' && !ev.target.closest('button'))) {
      ev.stopPropagation();
      titleContinue();
      return;
    }
    if (a === 'ttlguest') {
      ev.stopPropagation();
      titleScreen.guest = true;
      render();
      return;
    }
    if (a === 'ttlacc') {
      ev.stopPropagation();
      titleAccountSheet();
      return;
    }
    if (a === 'ttlnews') {
      ev.stopPropagation();
      titleNews();
      return;
    }
    if (a === 'ttlnew') {
      ev.stopPropagation();
      titleNew();
      return;
    }
    if (a === 'ttlset') {
      ev.stopPropagation();
      openSettings();
      return;
    }
  },
  true
);
/* any touch or key on the title stops Continue pressing itself (a tap on Continue continues anyway) */
for (const t of ['pointerdown', 'keydown'])
  document.addEventListener(
    t,
    () => {
      if (titleScreen.on && (titleScreen.autoT || document.body.classList.contains('ttl-auto'))) titleAutoStop();
    },
    true
  );
document.addEventListener('keydown', ev => {
  if (!titleScreen.on || uiState.modal) return;
  if ((ev.key === 'Enter' || ev.key === ' ') && saveData.started) {
    ev.preventDefault();
    titleContinue();
  }
});
