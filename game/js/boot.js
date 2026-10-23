'use strict';
/* ================= BOOT =================
   Clear stale art if Pocket Billies Studio changed any (meta.artVersion), then load and check every piece of art the game
   uses (billionaires, battle stages, walk scenes, the world map, icons) behind the loading screen, so nothing pops in
   later and a missing file shows up right away. Then draw the game. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide } from './hooks.js';
import { TEST_BOOT } from './test-boot.js';
import {
  DATA_WARN,
  LOCATIONS,
  RELICS,
  RULES,
  SPECIES,
  START_NODE,
  UNLOCKS,
  gameData,
  worldExtraMaps,
} from './game-data.js';
import { makeBilly } from './logic/rules.js';
import { applyUiTheme } from './theme-sheet.js';
import { SAVE_NEW_MSG, SAVE_OLD_MSG, newSave } from './logic/saves.js';
import { battleStageKey } from './logic/battle-engine.js';
import { RUN_TEST_SHORT, runTestOf } from './logic/run-test.js';
import { storySwitches, storySwitchesOf } from './logic/story-checks.js';
import { applyStoryPreset } from './logic/script.js';
import { loadAllMaps, loadMapsAhead, watchMapsAhead } from './map-files.js';
import {
  FIXTURE,
  SAVE_FOUND,
  escapeHtml,
  reducedMotion,
  saveData,
  setNoSaving,
  setSaveData,
  uiState,
} from './game-state.js';
import { ART_CACHE, COIN_ART, EGG_ART, ICON_ATLAS, artBoot, artImg, uiIconURL } from './art.js';
import { personArtPaths } from './person-art.js';
import { rigAtlas } from './skeleton-rig.js';
import { AREAS, battleStagePrepare } from './battle-stage.js';
import { mapArtPaths, mapById, walkData, walkView } from './walk-view.js';
import { gpuState, webgl2Supported } from './engine/webgl.js';
import { environment } from './environment.js';
import { walkRenderer } from './walk/walk-state.js';
import { startTownRise } from './walk/sprites.js';
import { seamlessWorld } from './seamless-world.js';
import { worldBowlReset } from './world-bowl.js';
import { cutsceneStart, cutsceneWanted } from './cutscene/opening.js';
import { titleMount, titleScreen, titleStart, titleWanted } from './title.js';
import { loreLoadingLines } from './lore.js';
import { runWorld, runWorldSync } from './run-world.js';
import { runResume, runTakeOff } from './run.js';
import { labMilestones } from './lab-board.js';
import { initAccount } from './account.js';
import { notice, renderOverlay, toast } from './overlay.js';
import { showPendingWindows, whenWorldShows } from './pending-windows.js';
import { initPixelSky } from './pixel-sky.js';
import { mapIdAt } from './walk-control.js';
import { render, startGame } from './ui.js';
import { fixtureStart } from './fixture.js';
import { updateCheckStart } from './update-check.js';
/* eslint-disable no-func-assign */
expose({
  ART_VERSION_KEY: [() => ART_VERSION_KEY],
  LOADER_ISLAND_COLORS: [() => LOADER_ISLAND_COLORS],
  LOAD_PHASES: [() => LOAD_PHASES],
  LOAD_TIPS: [() => LOAD_TIPS],
  TEST_RUN: [() => TEST_RUN],
  UI_ICONS: [() => UI_ICONS],
  artCacheCheck: [() => artCacheCheck, v => (artCacheCheck = v)],
  bootLoad: [() => bootLoad, v => (bootLoad = v)],
  idle: [() => idle],
  loadList: [() => loadList, v => (loadList = v)],
  loadOne: [() => loadOne, v => (loadOne = v)],
  loadSvg: [() => loadSvg, v => (loadSvg = v)],
  loaderHide: [() => loaderHide, v => (loaderHide = v)],
  loaderIsland: [() => loaderIsland],
  loaderIslandDraw: [() => loaderIslandDraw, v => (loaderIslandDraw = v)],
  loaderIslandInit: [() => loaderIslandInit, v => (loaderIslandInit = v)],
  loaderIslandLoop: [() => loaderIslandLoop, v => (loaderIslandLoop = v)],
  loaderIslandRandom: [() => loaderIslandRandom, v => (loaderIslandRandom = v)],
  loaderIslandThing: [() => loaderIslandThing, v => (loaderIslandThing = v)],
  loaderLines: [() => loaderLines, v => (loaderLines = v)],
  loaderSet: [() => loaderSet, v => (loaderSet = v)],
  loaderTip: [() => loaderTip, v => (loaderTip = v)],
  loadingScreen: [() => loadingScreen],
  mountLoaderTown: [() => mountLoaderTown, v => (mountLoaderTown = v)],
  noWebGL: [() => noWebGL, v => ((noWebGL = v), provide({ noWebGL }))],
  preloadAll: [() => preloadAll, v => (preloadAll = v)],
  runTestStart: [() => runTestStart, v => (runTestStart = v)],
  studioChannel: [() => studioChannel, v => (studioChannel = v)],
  studioDraftReady: [() => studioDraftReady, v => (studioDraftReady = v)],
  studioLive: [() => studioLive, v => (studioLive = v)],
  studioTestStart: [() => studioTestStart, v => (studioTestStart = v)],
  townPaths: [() => townPaths, v => (townPaths = v)],
  walkViewWarmup: [() => walkViewWarmup, v => (walkViewWarmup = v)],
});
/* eslint-enable no-func-assign */
provide({ noWebGL });
/* to-module: end */
const ART_VERSION_KEY = 'networth-artv';
async function artCacheCheck() {
  const v = String(gameData.meta.artVersion || 0);
  let old = null;
  try {
    old = localStorage.getItem(ART_VERSION_KEY);
  } catch (e) {}
  if (old !== v) {
    try {
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k.includes('-art')).map(k => caches.delete(k)));
      }
    } catch (e) {}
    try {
      localStorage.setItem(ART_VERSION_KEY, v);
    } catch (e) {}
  }
}
const idle = (fn, t = 1200) =>
  'requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: t }) : setTimeout(fn, 200);
const UI_ICONS = [
  'profile',
  'house',
  'lock',
  'flag',
  'leaf',
  'list',
  'globe',
  'back',
  'bag',
  'bolt',
  'bug',
  'chev',
  'close',
  'coin',
  'pyramid',
  'fight',
  'gauge',
  'gear',
  'heart',
  'ledger',
  'map',
  'mint',
  'minus',
  'plus',
  'run',
  'shop',
  'spark',
  'team',
  'walk',
  'drop',
  'fish',
  'camera',
  'boat',
  'sun',
  'moon',
  'cloud',
  'rain',
  'snow',
  'fog',
  'ash',
  'door',
];
/* v26: the walk scenes follow the real clock, the weather and the season (environment.js; the Studio leaves this off) */
if (typeof environment !== 'undefined') environment.on = true;
const LOAD_PHASES = [
  'Polishing the coins',
  'Waking up the Billies',
  'Building the battlefields',
  'Planting trees and painting towns',
  'Unrolling the world map',
];
const LOAD_TIPS = [
  'Billies wait in the tall grass along the roads. More come out while you play.',
  'The ranch breeds two of your Billies into an egg. It hatches a few hours later, even while you’re away.',
  'Tap the ground to walk around. Tap a building to visit it.',
  'Push the joystick past its rim to run. On a keyboard, hold Shift.',
  'Clinics heal your whole team for free. Just walk up to the door.',
  'A Billie hides in the grass with only its level showing. You find out who it is when the battle starts.',
  'Fire beats Grass, Grass beats Water, Water beats Fire. The classics never go out of style.',
  'Throw a pyramid at a tired Billie to catch it.',
  'The world map shows every road. Pick a place, and gold arrows lead you there.',
  'Road signs at the edge of town tell you where each road goes.',
];
/* every art file, grouped by loading phase */
function loadList() {
  const L = new Map(),
    add = (p, ph) => {
      if (p && !L.has(p)) L.set(p, ph);
    };
  [ICON_ATLAS, ...COIN_ART, ...EGG_ART].forEach(p => add(p, 0));
  for (const sp of Object.keys(SPECIES)) {
    const R = RIGS[sp];
    if (!R) continue;
    for (const v of ['front', 'back']) if (R[v]) add(rigAtlas(sp, v), 1);
  }
  try {
    const D = walkData();
    for (const id of Object.keys(D.scenes)) mapArtPaths(D.scenes[id]).forEach(p => add(p, 3));
    for (const P of Object.values(D.sc.props)) {
      add(P.img, 3);
      if (P.blades) add(P.blades.img, 3);
      for (const h of P.hands || []) add(h.img, 3);
    }
    for (const T of Object.values(D.sc.terrains)) add(T.tile, 3);
  } catch (e) {
    console.error(e);
  }
  try {
    personArtPaths().forEach(p => add(p, 0));
  } catch (e) {
    console.error(e);
  }
  return L;
}
const loadingScreen = { el: null, tipI: 0, tipT: null, shown: 0, f: 0 };
provide({ loadingScreen }); /* to-module */
function loaderSet(done, total, phase) {
  const el = loadingScreen.el;
  if (!el) return;
  const f = total ? done / total : 0,
    pct = Math.round(f * 100);
  loadingScreen.f = Math.max(loadingScreen.f, f);
  const bar = el.querySelector('.ld-bar i');
  if (bar) bar.style.width = pct + '%';
  if (loadingScreen.town) {
    const cv = document.getElementById('dio');
    if (cv) cv.style.clipPath = `circle(${Math.round(14 + loadingScreen.f * 110)}% at 50% 56%)`;
  }
  el.setAttribute('aria-valuenow', pct);
  el.querySelector('.ld-count').textContent = `${pct}%`;
  if (phase != null) el.querySelector('.ld-phase').textContent = LOAD_PHASES[phase] || phase;
}
/* ---------- alpha 0.4.1: the island that builds itself while the game loads ----------
   Drawn by hand on a 256 x 168 canvas (no art is loaded yet): isometric ground tiles drop in from the middle outward
   as the files come in, then trees, little houses, lamps and an airship station whose ship bobs at its mast. Each
   thing waits for its share of the loading; when the load is done the whole island is there. */
const loaderIsland = { cv: null, x: null, tiles: [], things: [], raf: 0, last: 0 };
function loaderIslandRandom(i, k) {
  const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return v - Math.floor(v);
}
function loaderIslandInit() {
  const cv = loadingScreen.el && loadingScreen.el.querySelector('.ld-world');
  if (!cv || !cv.getContext) return;
  loaderIsland.cv = cv;
  loaderIsland.x = cv.getContext('2d');
  const T = [];
  for (let i = -6; i <= 6; i++)
    for (let j = -6; j <= 6; j++) {
      const d = Math.hypot(i, j * 1.05);
      if (d > 6.2 + loaderIslandRandom(i + 20, j + 20) * 0.9) continue;
      T.push({ i, j, d, o: d + loaderIslandRandom(i, j) * 1.6 });
    }
  T.sort((a, b) => a.o - b.o);
  const n = T.length,
    maxD = Math.max(...T.map(t => t.d));
  T.forEach((t, k) => {
    t.need = 0.04 + (0.56 * k) / n;
    t.edge = t.d > maxD - 1.3;
    t.road = (t.i === 0 || t.j === 1) && !t.edge;
    t.at = 0;
    t.h = t.edge ? 2 : 3 + Math.round(loaderIslandRandom(t.i, t.j + 7) * 1.2);
  });
  loaderIsland.tiles = T;
  /* things on the island: what, which tile, when it may come */
  const free = T.filter(t => !t.edge && !t.road),
    pick = k => free.splice(Math.floor(loaderIslandRandom(k, 3) * free.length) % Math.max(1, free.length), 1)[0],
    TH = [];
  const st = T.find(t => t.i === 2 && t.j === -2) || free[0];
  if (st && free.includes(st)) free.splice(free.indexOf(st), 1);
  for (let k = 0; k < 4; k++) {
    const t = pick(k + 40);
    if (t) TH.push({ k: 'house', t, need: 0.5 + k * 0.08, c: k % 3 });
  }
  for (let k = 0; k < 11; k++) {
    const t = pick(k + 1);
    if (t) TH.push({ k: 'tree', t, need: 0.3 + k * 0.045, c: k % 3 });
  }
  for (let k = 0; k < 3; k++) {
    const t = pick(k + 80);
    if (t) TH.push({ k: 'lamp', t, need: 0.72 + k * 0.05 });
  }
  if (st) {
    TH.push({ k: 'mast', t: st, need: 0.82 });
    TH.push({ k: 'ship', t: st, need: 0.9 });
  }
  TH.forEach(o => (o.at = 0));
  loaderIsland.things = TH;
  loaderIsland.t0 = performance.now();
  loaderIslandLoop();
}
const LOADER_ISLAND_COLORS = {
  grass: ['#7cc35a', '#5a9a47', '#467a3a'],
  sand: ['#ead48f', '#c9ae68', '#a98d52'],
  road: ['#d8b98a', '#b8956a', '#97764f'],
};
function loaderIslandLoop() {
  loaderIsland.raf = requestAnimationFrame(loaderIslandLoop);
  const now = performance.now();
  if (now - loaderIsland.last < 32) return;
  loaderIsland.last = now;
  try {
    loaderIslandDraw(now);
  } catch (e) {
    cancelAnimationFrame(loaderIsland.raf);
  }
}
function loaderIslandDraw(now) {
  const x = loaderIsland.x,
    W = 256,
    H = 168,
    f = loadingScreen.f,
    cx = 128,
    cy = 74,
    TW = 10,
    TH2 = 5;
  x.clearRect(0, 0, W, H);
  const ease = k => (k <= 0 ? 0 : k >= 1 ? 1 : 1 - Math.pow(1 - k, 3)),
    back = k => {
      if (k <= 0) return 0;
      if (k >= 1) return 1;
      const c = 1.9;
      return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
    };
  /* the sea under the island: a soft ellipse with glints */
  const sea = ease((now - loaderIsland.t0) / 900);
  x.globalAlpha = 0.55 * sea;
  x.fillStyle = '#3d7fa6';
  x.beginPath();
  x.ellipse(cx, cy + 16, 92 * sea, 40 * sea, 0, 0, 7);
  x.fill();
  x.globalAlpha = 0.35 * sea;
  x.fillStyle = '#8fd0e8';
  for (let g = 0; g < 14; g++) {
    const a = g * 0.45 + now / 2400,
      r = 60 + 20 * loaderIslandRandom(g, 1);
    x.fillRect(Math.round(cx + Math.cos(a) * r * 1.3), Math.round(cy + 16 + Math.sin(a) * r * 0.42), 3, 1);
  }
  x.globalAlpha = 1;
  const P = (i, j) => [cx + (i - j) * TW, cy + (i + j) * TH2];
  const L = [];
  for (const t of loaderIsland.tiles) {
    if (f >= t.need && !t.at) t.at = now;
    if (t.at) L.push(t);
  }
  L.sort((a, b) => a.i + a.j - (b.i + b.j));
  for (const t of L) {
    const k = ease((now - t.at) / 420),
      drop = (1 - k) * -34,
      [px, py] = P(t.i, t.j),
      y = py + drop,
      C = t.edge ? LOADER_ISLAND_COLORS.sand : t.road ? LOADER_ISLAND_COLORS.road : LOADER_ISLAND_COLORS.grass,
      h = t.h;
    x.globalAlpha = Math.min(1, k * 2);
    x.fillStyle = C[1];
    x.beginPath();
    x.moveTo(px - TW, y);
    x.lineTo(px, y + TH2);
    x.lineTo(px, y + TH2 + h);
    x.lineTo(px - TW, y + h);
    x.fill();
    x.fillStyle = C[2];
    x.beginPath();
    x.moveTo(px + TW, y);
    x.lineTo(px, y + TH2);
    x.lineTo(px, y + TH2 + h);
    x.lineTo(px + TW, y + h);
    x.fill();
    x.fillStyle = C[0];
    x.beginPath();
    x.moveTo(px, y - TH2);
    x.lineTo(px + TW, y);
    x.lineTo(px, y + TH2);
    x.lineTo(px - TW, y);
    x.fill();
    if (!t.edge && !t.road && loaderIslandRandom(t.i, t.j + 3) < 0.5) {
      x.fillStyle = '#9bd86a';
      x.fillRect(Math.round(px - 3 + loaderIslandRandom(t.i, t.j) * 6), Math.round(y - 1), 2, 1);
    }
    if (!t.edge && !t.road && loaderIslandRandom(t.i + 9, t.j) < 0.18) {
      x.fillStyle = ['#ff8fa6', '#ffe066', '#ffffff'][Math.floor(loaderIslandRandom(t.i, t.j + 5) * 3)];
      x.fillRect(Math.round(px + 2 - loaderIslandRandom(t.j, t.i) * 5), Math.round(y), 1, 1);
    }
  }
  x.globalAlpha = 1;
  /* things, back to front, each springing up once its tile has landed */
  const O = [];
  for (const o of loaderIsland.things) {
    if (f >= o.need && o.t.at && now - o.t.at > 300 && !o.at) o.at = now;
    if (o.at) O.push(o);
  }
  O.sort((a, b) => a.t.i + a.t.j - (b.t.i + b.t.j) || (a.k === 'ship') - (b.k === 'ship'));
  for (const o of O) {
    const k = back((now - o.at) / 520),
      [px, py] = P(o.t.i, o.t.j);
    x.save();
    x.translate(px, py);
    x.scale(1, Math.max(0.01, k));
    loaderIslandThing(x, o, now);
    x.restore();
  }
}
function loaderIslandThing(x, o, now) {
  const R = (a, b, w, h, c) => {
    x.fillStyle = c;
    x.fillRect(a, b, w, h);
  };
  if (o.k === 'tree') {
    const G = [
      ['#4f9a3f', '#3b7a32', '#6cbc52'],
      ['#5aa64a', '#41823a', '#7fcf62'],
      ['#6f9e3a', '#557c2e', '#93c255'],
    ][o.c];
    R(-1, -7, 2, 8, '#7a4a2c');
    x.fillStyle = G[1];
    x.beginPath();
    x.arc(0, -11, 6, 0, 7);
    x.fill();
    x.fillStyle = G[0];
    x.beginPath();
    x.arc(-1, -12, 5, 0, 7);
    x.fill();
    x.fillStyle = G[2];
    x.fillRect(-3, -15, 3, 2);
    return;
  }
  if (o.k === 'house') {
    const wall = ['#f1e3c6', '#e9d2b0', '#dfe7ee'][o.c],
      roof = ['#c8553d', '#4f7fb8', '#7a9a3c'][o.c];
    R(-8, -9, 9, 9, wall);
    R(1, -9, 7, 9, '#c9b48f');
    R(-6, -6, 2, 2, '#ffe28a');
    R(-2, -4, 2, 4, '#7a4a2c');
    R(3, -6, 2, 2, '#8fc6e6');
    x.fillStyle = roof;
    x.beginPath();
    x.moveTo(-10, -8);
    x.lineTo(-1, -16);
    x.lineTo(1, -16);
    x.lineTo(10, -8);
    x.fill();
    x.fillStyle = 'rgba(0,0,0,.18)';
    x.beginPath();
    x.moveTo(1, -16);
    x.lineTo(10, -8);
    x.lineTo(1, -8);
    x.fill();
    return;
  }
  if (o.k === 'lamp') {
    R(0, -10, 1, 10, '#3a3348');
    const g = 0.6 + 0.4 * Math.sin(now / 300 + o.t.i);
    x.fillStyle = `rgba(255,220,130,${0.35 * g})`;
    x.beginPath();
    x.arc(0.5, -11, 4, 0, 7);
    x.fill();
    R(-1, -12, 3, 2, '#ffe7a0');
    return;
  }
  if (o.k === 'mast') {
    R(-1, -34, 2, 34, '#3d4a56');
    for (let y = -32; y < 0; y += 4) {
      R(-3, y, 6, 1, '#56657a');
    }
    R(-6, -2, 12, 2, '#b0a089');
    R(-3, -36, 6, 2, '#c9a548');
    return;
  }
  if (o.k === 'ship') {
    const b = Math.sin(now / 650) * 1.5,
      sw = Math.sin(now / 900) * 1;
    x.translate(sw, b);
    x.fillStyle = '#d9824a';
    x.beginPath();
    x.ellipse(-12, -40, 15, 6, 0, 0, 7);
    x.fill();
    x.fillStyle = '#f4e6cf';
    for (const dx of [-20, -12, -4]) x.fillRect(Math.round(dx), -46, 3, 12);
    x.fillStyle = 'rgba(0,0,0,.15)';
    x.beginPath();
    x.ellipse(-12, -37, 15, 3, 0, 0, Math.PI);
    x.fill();
    R(-17, -33, 10, 3, '#8a5a36');
    R(-25, -41, 3, 3, '#c96a3a');
    const sp = now / 60;
    R(-28, -41 + Math.round(Math.sin(sp) * 2), 1, 3, '#e8e2d4');
    return;
  }
}
/* v47: lines from the world (lore.loading: lore, tips and jokes) between the tips, a new one every few seconds */
function loaderLines() {
  if (!loadingScreen.lines) {
    const W = typeof loreLoadingLines === 'function' ? loreLoadingLines() : [],
      T = LOAD_TIPS.slice();
    loadingScreen.lines = [];
    while (W.length || T.length) {
      if (W.length) loadingScreen.lines.push(W.shift());
      if (W.length) loadingScreen.lines.push(W.shift());
      if (T.length) loadingScreen.lines.push(T.shift());
    }
  }
  return loadingScreen.lines;
}
function loaderTip() {
  const p = loadingScreen.el && loadingScreen.el.querySelector('.ld-tip');
  if (!p) return;
  const L = loaderLines();
  if (!L.length) return;
  p.classList.add('out');
  setTimeout(() => {
    p.textContent = L[loadingScreen.tipI++ % L.length];
    p.classList.remove('out');
  }, 350);
}
function loadOne(p) {
  artImg(p);
  return ART_CACHE.wait[p].then(async im => {
    if (!(im && im.naturalWidth)) return false;
    try {
      if (im.decode) await im.decode();
    } catch (e) {}
    return true;
  });
}
function loadSvg(k) {
  return new Promise(res => {
    const im = new Image();
    im.onload = () => res(true);
    im.onerror = () => res(false);
    im.src = uiIconURL(k);
  });
}
/* loads phase by phase (files within a phase in parallel), then checks the world map and the scene you start in */
/* alpha 0.4.1: the title's town comes first. Its ground, props and buildings load before everything else, then it is
   put up behind the loading screen and builds itself while the rest comes in (onTown) */
function townPaths() {
  try {
    if (!(
      typeof titleWanted === 'function' &&
      titleWanted() &&
      typeof cutsceneWanted === 'function' &&
      cutsceneWanted()
    ))
      return new Set();
    const id = mapIdAt(START_NODE),
      sc = mapById(id);
    return sc ? new Set(mapArtPaths(sc)) : new Set();
  } catch (e) {
    console.error(e);
    return new Set();
  }
}
async function preloadAll(onTown) {
  const L = loadList(),
    byPh = [[], [], [], [], [], []],
    TP = townPaths();
  for (const p of TP) if (!L.has(p)) L.set(p, 0);
  for (const [p, ph] of L) byPh[TP.has(p) ? 0 : ph + 1].push(p);
  const T0 = performance.now(),
    phT = [];
  const total = L.size + UI_ICONS.length + 2;
  let done = 0;
  const fails = [];
  loaderSet(0, total, 0);
  for (let ph = 0; ph < byPh.length; ph++) {
    loaderSet(done, total, ph ? ph - 1 : 'Laying out the town');
    const jobs = byPh[ph].map(p =>
      loadOne(p).then(ok => {
        if (!ok) fails.push(p);
        loaderSet(++done, total);
      })
    );
    if (ph === 1)
      UI_ICONS.forEach(k =>
        jobs.push(
          loadSvg(k).then(ok => {
            if (!ok) fails.push(`ui/${k}.svg`);
            loaderSet(++done, total);
          })
        )
      );
    const pt = performance.now();
    await Promise.all(jobs);
    phT.push({
      phase: ph ? LOAD_PHASES[ph - 1] : 'the town',
      files: byPh[ph].length,
      ms: Math.round(performance.now() - pt),
    });
    if (ph === 0 && onTown && TP.size)
      try {
        onTown();
      } catch (e) {
        console.error(e);
      }
  }
  /* the first scene needs its ground built (phase 10: the bowl map paints its own ground when it first opens) */
  loaderSet(++done, total);
  try {
    if (saveData.started) {
      const area = battleStageKey();
      await battleStagePrepare(AREAS[area] ? area : 'grass');
    }
  } catch (e) {
    console.error(e);
  }
  loaderSet(++done, total);
  if (typeof debugLog !== 'undefined') {
    debugLog.load = { ms: Math.round(performance.now() - T0), files: total, failed: fails.slice(0, 50), phases: phT };
    debugLog.add('load', `${total} files in ${debugLog.load.ms} ms, ${fails.length} failed`);
  }
  return fails;
}
async function bootLoad() {
  loadingScreen.el = document.getElementById('loader');
  if (!loadingScreen.el) return artBoot();
  loadingScreen.shown = performance.now();
  document.body.classList.add('ld-on', 'from-ld');
  try {
    loaderIslandInit();
  } catch (e) {
    console.error(e);
  }
  if (typeof saveData !== 'undefined' && saveData && saveData.gender === 'boy') loadingScreen.el.classList.add('boy');
  loadingScreen.tipT = setInterval(loaderTip, 3600);
  for (;;) {
    const fails = await preloadAll(loadingScreen.town ? null : mountLoaderTown);
    if (!fails.length) break;
    console.error('Pocket Billies: art that failed to load:', fails);
    loadingScreen.el.classList.add('failed');
    loadingScreen.el.querySelector('.ld-phase').textContent =
      `${fails.length} file${fails.length === 1 ? '' : 's'} didn’t load`;
    const box = loadingScreen.el.querySelector('.ld-fail');
    box.hidden = false;
    box.innerHTML = `<b>Some art is missing or couldn’t be reached.</b><ul>${fails
      .slice(0, 30)
      .map(f => `<li>${escapeHtml(f)}</li>`)
      .join(
        ''
      )}</ul><p>Check your connection, or that the game folder is complete. You can still play; missing pictures just won’t show.</p><div class="ld-btns"><button data-ld="retry">Try again</button><button class="q" data-ld="go">Play anyway</button></div>`;
    const pick = await new Promise(res =>
      box.addEventListener('click', ev => {
        const b = ev.target.closest('[data-ld]');
        if (b) res(b.dataset.ld);
      })
    );
    box.hidden = true;
    loadingScreen.el.classList.remove('failed');
    if (pick === 'go') break;
    for (const f of fails) {
      const p = f.split(' ')[0];
      delete ART_CACHE.img[p];
      delete ART_CACHE.wait[p];
    }
  }
  clearInterval(loadingScreen.tipT);
  loadingScreen.f = 1;
  loaderIsland.doneAt = performance.now();
  loadingScreen.el.classList.add('ready');
  loadingScreen.el.querySelector('.ld-phase').textContent = 'Ready';
  const wait = Math.max(
    reducedMotion ? 0 : 650,
    (reducedMotion ? 0 : 1400) - (performance.now() - loadingScreen.shown)
  );
  await new Promise(r => setTimeout(r, wait));
}
/* wait (at most 5 s) until the walk scene has drawn a few frames, so its first, slow frame happens behind the loader */
async function walkViewWarmup() {
  if (!saveData.started || typeof walkView === 'undefined') return;
  const t0 = performance.now();
  if (loadingScreen.el) loadingScreen.el.querySelector('.ld-phase').textContent = 'Setting the scene';
  while (performance.now() - t0 < 5000) {
    const ok =
      walkView.ready &&
      (typeof walkRenderer === 'undefined' || !walkRenderer.on || walkRenderer.frames > 4) &&
      (typeof gpuState === 'undefined' || !gpuState.normQ || !gpuState.normQ.length);
    if (ok || !document.getElementById('dio')) break;
    await new Promise(r => setTimeout(r, 60));
  }
  if (typeof debugLog !== 'undefined') debugLog.add('load', `scene ready in ${Math.round(performance.now() - t0)} ms`);
}
/* the town behind the loader: the title starts, its town is put up and grows in as the loading goes on */
function mountLoaderTown() {
  if (loadingScreen.town) return;
  loadingScreen.town = true;
  titleStart();
  titleMount();
  loadingScreen.el.classList.add('town');
  if (typeof startTownRise === 'function') startTownRise(true);
}
function loaderHide() {
  const el = loadingScreen.el;
  if (!el) {
    document.body.classList.remove('ld-on');
    return;
  }
  loadingScreen.f = 1;
  const end = () => {
    cancelAnimationFrame(loaderIsland.raf);
    el.remove();
    loadingScreen.el = null;
    document.body.classList.remove('ld-on', 'ttl-reveal');
  };
  if (!(typeof titleScreen !== 'undefined' && titleScreen.on)) {
    el.classList.add('done');
    document.body.classList.remove('ld-on');
    setTimeout(end, 900);
    return;
  }
  /* alpha 0.4.1: the title comes out of the loader. Wait (at most 9 s) for the town behind the title to be drawn, give
    the island a moment to finish, then open the town out of it */
  if (loadingScreen.town && !document.body.classList.contains('ttl-flat')) {
    const cv = document.getElementById('dio');
    if (cv) cv.style.clipPath = '';
    el.classList.add('reveal');
    setTimeout(
      () => {
        const top = el.querySelector('.ld-top');
        if (top) top.style.visibility = 'hidden';
        document.body.classList.remove('ld-on');
      },
      reducedMotion ? 0 : 700
    );
    setTimeout(end, reducedMotion ? 300 : 1400);
    return;
  }
  const t0 = performance.now(),
    go = () => {
      const live = document.body.classList.contains('ttl-live'),
        flat = document.body.classList.contains('ttl-flat');
      if (!live && !flat && performance.now() - t0 < 9000) return setTimeout(go, 120);
      if (flat || !live) {
        el.classList.add('done');
        document.body.classList.remove('ld-on');
        setTimeout(end, 900);
        return;
      }
      document.body.classList.add('ttl-reveal');
      el.classList.add('reveal');
      if (typeof startTownRise === 'function') startTownRise();
      setTimeout(
        () => {
          const top = el.querySelector('.ld-top');
          if (top) top.style.visibility = 'hidden';
          document.body.classList.remove('ld-on');
        },
        reducedMotion ? 0 : 950
      );
      setTimeout(end, reducedMotion ? 300 : 2200);
    };
  setTimeout(go, reducedMotion ? 0 : Math.max(0, 900 - (performance.now() - (loaderIsland.doneAt || 0))));
}
/* phase 10, session 5: &tab=map opens the world map (the Studio's "Open the 3D bowl").
   v29: Pocket Billies Studio and an open game tab. A test run (?test=1&scene=<id>) is a throwaway game that starts in that
   scene and never touches your save; while the Studio is open, its edits to scenes, props and the engine reach the
   game as you make them (no saving needed to see them). Project Story: ?story=<preset> is a test run that starts at a
   point in the story (story.json presets), alone or with ?test=1. S3, the Studio's Play from here: &place=<location>
   starts you in the real place (its people, trainers and exits; not the scene alone), &at=x,z on that spot,
   &flags=a,!b,beat:chad switches flags and trainers on top of the preset, and &draft=1 waits for the open Studio's
   unsaved data (2 s at most) before starting. Studio plan T2.6, "Play this seed": ?debug&run=<seed> (logic/run-test.js:
   the unlocks, short map, party and Loopholes) is a test run that takes off at once on that seed (runTestStart). */
const TEST_RUN = (() => {
  try {
    const q = new URLSearchParams(location.search),
      at = (q.get('at') || '').split(',').map(Number),
      run = runTestOf(q, { species: SPECIES, unlocks: UNLOCKS, relics: RELICS, cap: RULES.run.relics.cap });
    return q.get('test') || q.get('story') || run
      ? {
          run,
          scene: q.get('scene'),
          story: q.get('story'),
          place: q.get('place'),
          at: at.length === 2 && at.every(Number.isFinite) ? at : null,
          flags: storySwitchesOf(q.get('flags')),
          draft: q.get('draft') === '1',
          tab: q.get('tab'),
        }
      : null;
  } catch (e) {
    return null;
  }
})();
provide({ TEST_RUN }); /* to-module */
if (TEST_RUN) {
  setNoSaving();
  setSaveData(newSave());
}
function studioTestStart() {
  if (!TEST_RUN) return;
  if (TEST_RUN.run) return runTestStart(TEST_RUN.run);
  uiState.pg = 'girl';
  startGame((RULES.start.starters || [])[0]);
  saveData.story = { met_chad: 1, met_chad2: 1 };
  uiState.modal = null;
  uiState.mq = [];
  renderOverlay();
  /* a preset (and Play from here) says which story flags hold, from none */
  if (TEST_RUN.story || TEST_RUN.place) saveData.story = {};
  const preset = TEST_RUN.story ? applyStoryPreset(saveData, TEST_RUN.story) : null;
  if (TEST_RUN.story && !preset) toast(`No story preset “${TEST_RUN.story}” (story.json presets).`);
  storySwitches(saveData, gameData, TEST_RUN.flags);
  const node = TEST_RUN.place ? LOCATIONS.findIndex(r => r.id === TEST_RUN.place) : -1;
  if (node >= 0) {
    /* Play from here: the place itself, on the spot picked in the Studio */
    saveData.trip = { node, plan: [] };
    saveData.visited[node] = 1;
    saveData.mapSeen = null;
    uiState.roam = TEST_RUN.at ? { node, id: mapIdAt(node), x: TEST_RUN.at[0], z: TEST_RUN.at[1] } : null;
  } else if (TEST_RUN.scene && mapById(TEST_RUN.scene)) uiState.bench = { id: TEST_RUN.scene };
  uiState.tab = 'walk';
  /* phase 10, the Studio's "Open the 3D bowl": &tab=map opens the world map, every place seen */
  if (TEST_RUN.tab === 'map') {
    LOCATIONS.forEach((l, i) => (saveData.visited[i] = 1));
    uiState.tab = 'map';
  }
  render();
  const where =
    node >= 0
      ? LOCATIONS[node].name
      : TEST_RUN.scene && mapById(TEST_RUN.scene)
        ? mapById(TEST_RUN.scene).name || TEST_RUN.scene
        : '';
  toast(
    `Test run${preset ? ' at ' + TEST_RUN.story : ''}${where ? ' in ' + where : ''}${TEST_RUN.draft ? (studioLive.told ? ' with your Studio edits' : ' (the Studio’s edits didn’t come: saved data)') : ''}. Nothing here is saved.`
  );
}
/** Studio plan T2.6, "Play this seed": a new game (the party asked for, else the first starter) with the unlocks asked
 * for takes off from the mast at once on the seed, through runTakeOff as the mast does (logic/run-start.js), every
 * Billie in the party flying; then the Loopholes asked for are held. A test run: nothing is saved, no account
 * @param {NonNullable<ReturnType<typeof runTestOf>>} R */
function runTestStart(R) {
  uiState.pg = 'girl';
  startGame((RULES.start.starters || [])[0]);
  const s = saveData;
  s.story = { met_chad: 1, met_chad2: 1 };
  if (R.party.length) {
    s.team = R.party.map(p => makeBilly(p.sp, p.lv));
    s.buddy = s.team[0].uid;
    for (const m of s.team) s.caught[m.sp] = s.seen[m.sp] = 1;
  }
  for (const id of R.unlocks) s.meta.unlocks[id] = 1;
  uiState.modal = null;
  uiState.mq = [];
  runTakeOff(R.seed, R.short ? RUN_TEST_SHORT : undefined, [], {
    home: s.team.map(m => m.uid),
    pack: { items: {}, coins: {} },
  });
  if (!saveData.run) return toast(`Test run: seed ${R.seed} couldn’t take off with this data.`);
  if (R.relics.length) saveData.run.relics = R.relics.slice();
  toast(
    `Test run on seed ${R.seed}${R.short ? ', short map' : ''}${TEST_RUN.draft ? (studioLive.told ? ', with your Studio edits' : ' (the Studio’s edits didn’t come: saved data)') : ''}${R.left.length ? `. Left out: ${R.left.join(', ')}` : ''}. Nothing here is saved.`
  );
}
/* &draft=1: the open Studio's unsaved data first (it answers hello), 2 s at most */
function studioDraftReady() {
  if (!TEST_RUN || !TEST_RUN.draft || !studioChannel) return Promise.resolve();
  return new Promise(res => {
    studioDraftReady.done = res;
    setTimeout(res, 2000);
    try {
      studioChannel.postMessage({ type: 'hello' });
    } catch (e) {
      res();
    }
  });
}
function studioLive(D) {
  let any = false;
  for (const k of ['maps', 'scenery', 'engine'])
    if (D[k]) {
      gameData[k] = D[k];
      any = true;
    }
  /* RL-7: a run's scenes aren't the Studio's: they stay while its world is in */
  if (D.maps) Object.assign(gameData.maps, worldExtraMaps());
  /* phase 10, session 5: the world map's look and the places' landmarks; the bowl is worked out again */
  if (D.worldmap) {
    gameData.worldmap = D.worldmap;
    any = true;
  }
  if (D.landmarks)
    for (const l of LOCATIONS) {
      if (D.landmarks[l.id]) l.landmark = D.landmarks[l.id];
      else delete l.landmark;
      any = true;
    }
  if ((D.worldmap || D.landmarks) && typeof worldBowlReset === 'function') worldBowlReset();
  /* UI-1: the UI's look, written again at once (nothing in the world to work out again) */
  if (D.uiTheme) {
    gameData.uiTheme = D.uiTheme;
    applyUiTheme(D.uiTheme);
  }
  /* Project Story S3: the story and the trainers, in place (STORY_DATA and TRAINERS are these objects). Studio plan
     T2.6: in a test run (never a player's game, which would save what draft rules gave) also what a run is made of,
     before a Play this seed run takes off (&draft=1) and while it goes: RULES, NODE_TYPES, RELICS, UNLOCKS and ITEMS
     are these objects too, so a clinic's price or a shop's wares follow an unsaved edit */
  for (const k of TEST_RUN
    ? ['story', 'trainers', 'rules', 'nodeTypes', 'relics', 'unlocks', 'items']
    : ['story', 'trainers'])
    if (D[k] && gameData[k]) {
      for (const x of Object.keys(gameData[k])) delete gameData[k][x];
      Object.assign(gameData[k], D[k]);
      any = true;
    }
  if (studioDraftReady.done) studioDraftReady.done();
  if (!any) return;
  if (typeof seamlessWorld !== 'undefined') {
    seamlessWorld.gen++;
    seamlessWorld.cache.clear();
  }
  if (typeof walkView !== 'undefined' && walkView.id && gameData.maps[walkView.id]) {
    walkView.sc = gameData.maps[walkView.id];
    walkView.gkey = '';
    walkView.nav = null;
    walkView.cand = null;
    if (typeof walkRenderer !== 'undefined') {
      walkRenderer.hkey = '';
      walkRenderer.farKey = '';
    }
  }
  if (typeof environment !== 'undefined') environment.id = null;
  if (!studioLive.told) {
    studioLive.told = 1;
    toast('Showing your Studio edits as you make them.');
  }
}
let studioChannel = null;
try {
  studioChannel = new BroadcastChannel('networth-studio');
  studioChannel.onmessage = ev => {
    const m = ev.data || {};
    if (m.type === 'data' && m.D)
      try {
        studioLive(m.D);
      } catch (e) {
        console.error(e);
      }
  };
} catch (e) {}
/* 0.1.0 alpha: the game needs WebGL 2 (there is no 2D fallback any more). Without it, or when it fails for good, a
   screen says so and offers a retry and the debug log */
function noWebGL(why) {
  if (document.getElementById('nogl')) return;
  if (typeof debugLog !== 'undefined') debugLog.add('webgl', 'no WebGL 2: ' + (why || 'unavailable'));
  const el = document.createElement('div');
  el.id = 'nogl';
  el.setAttribute('role', 'alertdialog');
  el.setAttribute('aria-labelledby', 'nogl-h');
  el.innerHTML = `<div class="nogl-card"><h1 id="nogl-h">This device can’t run Pocket Billies</h1><p>The game draws its world with WebGL 2, and this browser doesn’t offer it${why === 'failed' ? ' any more (the graphics stopped working)' : ''}. An up-to-date Chrome, Safari or Firefox usually does; on a computer, hardware acceleration must be on.</p><div class="nogl-btns"><button data-ng="retry">Try again</button><button class="q" data-ng="log">Export debug log</button></div></div>`;
  el.addEventListener('click', ev => {
    const b = ev.target.closest('[data-ng]');
    if (!b) return;
    if (b.dataset.ng === 'retry') location.reload();
    else if (typeof exportDebugLog === 'function') exportDebugLog();
  });
  document.body.appendChild(el);
}
/* RL-7: the world the save needs goes in before anything reads where you stand (a run's, made from its seed; the
   hub's is in already); from here a swapped save brings its own (game-state.js setSaveData) */
runWorldSync();
runWorld.live = true;
if (!webgl2Supported()) noWebGL();
else
  /* phase 04b: the maps round where you are come with the art check; the others after the loader (js/map-files.js) */
  Promise.all([artCacheCheck(), loadMapsAhead(saveData.trip ? saveData.trip.node : START_NODE)])
    .then(() => bootLoad())
    .then(async () => {
      if (typeof debugLog !== 'undefined') debugLog.hook();
      initPixelSky();
      if (typeof titleWanted === 'function' && titleWanted()) titleStart();
      /* phase 16 test boot (js/test-boot.js): no title; the opening cutscene starts on the professor's scene (below), or,
         where it can't run, the Try again screen */
      const quickOpening = TEST_BOOT && !TEST_RUN && !FIXTURE && !saveData.started;
      if (quickOpening && !(typeof cutsceneWanted === 'function' && cutsceneWanted())) uiState.openingFailed = 'cant';
      render();
      if (TEST_RUN) await studioDraftReady();
      if (TEST_RUN) studioTestStart();
      if (FIXTURE) fixtureStart();
      /* an open Studio sends its unsaved edits */ if (studioChannel)
        try {
          studioChannel.postMessage({ type: 'hello' });
        } catch (e) {}
      await walkViewWarmup();
      loaderHide();
      if (quickOpening && uiState.intro === 0 && typeof cutsceneWanted === 'function' && cutsceneWanted())
        cutsceneStart({ quick: true });
      watchMapsAhead();
      loadAllMaps();
      /* phase 06: a notice, not a choice: it waits behind the dot on the portrait */
      if (SAVE_FOUND === 'old' || SAVE_FOUND === 'new')
        notice({
          id: 'save-found',
          title: SAVE_FOUND === 'old' ? 'A new game' : 'A newer save',
          html: `<p>${SAVE_FOUND === 'old' ? SAVE_OLD_MSG + ' A new game starts here.' : SAVE_NEW_MSG}</p>`,
        });
      /* phase 06: a waiting choice (hatch, learn a move, evolve) opens only once the world is showing */
      if (saveData.started && !TEST_RUN && !FIXTURE) whenWorldShows(showPendingWindows);
      /* RL-8: a run picks up where it was (its payout screen) */
      if (saveData.started && saveData.run && !TEST_RUN) whenWorldShows(runResume);
      /* RL-11: milestones met since the last visit (in the hub) */
      if (saveData.started && !saveData.run && !TEST_RUN) whenWorldShows(labMilestones);
      if (TEST_BOOT && !TEST_RUN && !FIXTURE)
        setTimeout(() => toast('Test boot: the opening with Professor Chosen, nothing is saved.'), 900);
      if (location.protocol === 'file:')
        setTimeout(
          () => toast('Battles and the map need a local web server. Open the game with Start-Game (see README).'),
          900
        );
      if (DATA_WARN.length)
        console.info(
          `Pocket Billies: ${DATA_WARN.length} game data warning(s). Open the debug menu (Ctrl+Shift+D) to see them.`
        );
    });
/* the fast check's fixture never signs in */
if (typeof initAccount === 'function' && !FIXTURE) initAccount();
/* a new build's worker is fetched past the browser's cache (sw.js and the version.js it imports) */
if ('serviceWorker' in navigator && location.protocol !== 'file:')
  addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {}));
/* the owner, 2026-10-22: a phone always plays the site's latest build (update-check.js; off without a build) */
addEventListener('load', () => updateCheckStart());
