'use strict';
/* ================= TITLE SCREEN =================
   v47: after loading, a slow camera over Sundown from above the rooftops (the real scene, drawn by the game, at your
   local time of day), the Pocket Billies logo in pixel lettering, title music, and three choices: Continue (your trainer,
   where you are and how long you've played), New game, Settings. On a phone one tap anywhere continues.
   Without the 3D scene the title stands on the painted landscape instead. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { NW_TEST, accChipHTML, closeModal, modal, postProcess, render, sceneIdAt, settings } from './hooks.js';
import { $, clamp } from './util.js';
import { LOCATIONS, START_NODE } from './game-data.js';
import {
  escapeHtml,
  flushSave,
  newSaveKeepingPreferences,
  reducedMotion,
  saveData,
  setSaveData,
  uiState,
  writeStoredSave,
} from './game-state.js';
import { userFps } from './frame-scheduler.js';
import { uiIconHTML } from './art.js';
import { humanHTML } from './person-art.js';
import { applyPreferences } from './settings-screen.js';
import { mapById, stopWalkView, walkView } from './walk-view.js';
import { mountWalkView, standingHeightAt, walkRenderer } from './walk-view-gl.js';
import { music, musicFor } from './sound.js';
import { csSceneId, csStart, csStartName, csWanted } from './cutscene.js';
/* eslint-disable no-func-assign */
expose({
  TITLE: [() => TITLE],
  renderTitle: [() => renderTitle, v => (renderTitle = v)],
  titleEnd: [() => titleEnd, v => (titleEnd = v)],
  titleFrame: [() => titleFrame, v => (titleFrame = v)],
  titleMount: [() => titleMount, v => (titleMount = v)],
  titleNew: [() => titleNew, v => (titleNew = v)],
  titlePlayTime: [() => titlePlayTime, v => (titlePlayTime = v)],
  titleStart: [() => titleStart, v => (titleStart = v)],
  titleWanted: [() => titleWanted, v => (titleWanted = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const TITLE = { on: false, t0: 0, run: 0, mounted: false };
export function titleWanted() {
  return !(typeof NW_TEST !== 'undefined' && NW_TEST) && !(saveData.preferences && saveData.preferences.skipTitle);
}
/* the camera: a slow drift along the front of the town, high above the rooftops, looking up the main street */
function titleFrame() {
  if (!TITLE.on || !walkView.sc) return null;
  const sc = walkView.sc,
    now = performance.now(),
    k = reducedMotion ? 0.5 : 0.5 - 0.5 * Math.cos(((now - TITLE.t0) / 1000) * 0.05),
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
function titlePlayTime() {
  const m = Math.floor((saveData.playMs || 0) / 60000);
  return m < 1
    ? 'just started'
    : m < 60
      ? `${m} min`
      : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}
export function renderTitle() {
  const cont = saveData.started && saveData.avatar,
    place = cont && LOCATIONS[saveData.route.node] ? LOCATIONS[saveData.route.node].name : '',
    nm = cont ? saveData.avatar.name || 'Trainer' : '';
  return `<div class="ttl${cont ? ' can-tap' : ''}" data-a="${cont ? 'ttltap' : ''}"><div class="ttl-bg" aria-hidden="true"></div>
  <div class="ttl-acc">${typeof accChipHTML === 'function' ? accChipHTML() : ''}</div><div class="ttl-top"><h1 class="ttl-logo" aria-label="Pocket Billies"><span>POCKET</span><span>BILLIES</span></h1><p class="ttl-tag">Gotta tax 'em all!</p></div><p class="ttl-ver">${escapeHtml(PB_VERSION)}</p>
  <div class="ttl-bottom">
   ${cont ? `<button class="ttl-cont" data-a="ttlgo"><span class="ttl-face">${humanHTML('me', 56)}</span><span class="ttl-ct"><b>Continue</b><small>${escapeHtml(nm)} · ${escapeHtml(place)}</small><small>${titlePlayTime()} played</small></span></button>` : ''}
   <div class="ttl-btns">${cont ? `<button class="pb quiet" data-a="ttlnew">New game</button>` : `<button class="pb gold big wide" data-a="intro">New game</button>`}<button class="pb quiet" data-a="ttlset">${uiIconHTML('gear', 14)} Settings</button></div>
   ${cont ? '<p class="ttl-hint">Tap anywhere to continue</p>' : ''}</div></div>`;
}
/* the scene behind the title: Sundown, drawn by the walk renderer with the title camera */
export async function titleMount() {
  if (TITLE.mounted || !TITLE.on) return;
  TITLE.mounted = true;
  if (typeof music === 'function') music('title');
  if (typeof csWanted === 'function' && !csWanted()) {
    document.body.classList.add('ttl-flat');
    return;
  }
  const run = ++TITLE.run;
  let cv = $('#dio');
  if (!cv) {
    cv = document.createElement('canvas');
    cv.id = 'dio';
    document.body.prepend(cv);
  }
  cv.hidden = false;
  cv.setAttribute(
    'aria-label',
    (typeof csStartName === 'function' ? csStartName() : 'The town') + ', from above the rooftops'
  );
  TITLE.t0 = performance.now();
  walkView.director = { frame: titleFrame };
  try {
    await mountWalkView(cv, typeof csSceneId === 'function' ? csSceneId() : sceneIdAt(START_NODE), {
      state: () => ({ who: null, npcs: [], enc: [], mode: 'line' }),
      keys: () => false,
      active: () => false,
      onPick: () => {},
      cap: () => (document.hidden ? 1 : Math.min(30, userFps())),
    });
  } catch (e) {
    console.error(e);
  }
  if (!TITLE.on || run !== TITLE.run) return;
  if (!walkRenderer.on || !walkView.ready) {
    document.body.classList.add('ttl-flat');
    return;
  }
  walkView.cv.classList.add('in');
  /* the painted landscape stays in front until the town's ground is laid and drawn, then fades away */
  const t0 = performance.now(),
    poll = () => {
      if (!TITLE.on || run !== TITLE.run) return;
      if ((walkRenderer.gtex && walkRenderer.frames > 3) || performance.now() - t0 > 20000) {
        document.body.classList.add('ttl-live');
        return;
      }
      setTimeout(poll, 200);
    };
  poll();
}
export function titleStart() {
  if (TITLE.on) return;
  TITLE.on = true;
  TITLE.mounted = false;
  uiState.title = true;
  document.body.classList.add('in-title');
}
function titleEnd() {
  if (!TITLE.on) return;
  TITLE.on = false;
  TITLE.run++;
  uiState.title = false;
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
    if (typeof csWanted === 'function' && csWanted()) csStart();
    else {
      uiState.intro = 1;
      render();
    }
    return;
  }
  modal({
    title: 'Start a new game?',
    html: '<p>This replaces the game in this save slot: your team, Field Guide and money. (Settings → Save slots can keep a copy first.)</p>',
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
          if (typeof csWanted === 'function' && csWanted()) csStart();
          else {
            uiState.intro = 1;
            render();
          }
        },
      },
      { l: 'Keep playing this one', c: 'quiet', f: closeModal },
    ],
  });
}
/* play time: counted while the game is open and in view */
setInterval(() => {
  if (typeof saveData !== 'undefined' && saveData && saveData.started && !document.hidden && !uiState.title)
    saveData.playMs = (saveData.playMs || 0) + 15000;
}, 15000);
document.addEventListener(
  'click',
  ev => {
    if (!TITLE.on) return;
    const el = ev.target.closest('[data-a]'),
      a = el && el.dataset.a;
    if (!a) return;
    if (a === 'intro') {
      titleEnd();
      return;
    } /* a new game from the title: the opening takes over (ui.js starts it) */
    if (a === 'ttlgo' || (a === 'ttltap' && !ev.target.closest('button'))) {
      ev.stopPropagation();
      titleEnd();
      if (typeof music === 'function' && typeof musicFor === 'function') music(musicFor());
      render();
      if (typeof postProcess === 'function') setTimeout(postProcess, 400);
      return;
    }
    if (a === 'ttlnew') {
      ev.stopPropagation();
      titleNew();
      return;
    }
    if (a === 'ttlset') {
      ev.stopPropagation();
      settings();
      return;
    }
  },
  true
);
document.addEventListener('keydown', ev => {
  if (!TITLE.on || uiState.modal) return;
  if ((ev.key === 'Enter' || ev.key === ' ') && saveData.started) {
    ev.preventDefault();
    titleEnd();
    render();
  }
});
