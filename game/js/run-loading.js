'use strict';
/* ================= A RUN'S LOADING SCREEN (hub track HB-2) =================
   A run's landing waits for its world. HB-8: the take-off's sky train flies into the portal (train-ride.js), and
   behind the white-out this screen (the UI kit's pb-loading, the carriage's inside in its `view`: train-carriage.js)
   comes up while the run's places are made over several frames (run-world.js runWorldMake: the first stage, hard: the
   cap waits for it), then stays until every stage of the landing is ready: the landing map put together (prepareMap:
   its maps, art and ground), the model recipes of the landing and the places joined to it with their decal pictures,
   the run's world map prewarmed (world-bowl.js worldMapPrewarm), the walk view drawn. A reload mid-run (resume) shows
   it from the boot on, with no places stage. The cap (rules.json
   run.load.capMs, the owner: 20 s) lifts it anyway; the debug log gets one 'load' line either way: the stages' times,
   which were late, how the scenes were made. Never a seed, a name or the save.
   runLoad is the signal the checks wait on: `on` while a loading runs, `ready` once it has ended.
   The carriage goes in the screen's `view` slot (runLoadView) at a take-off. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { pillColor } from './hooks.js';
import { RULES, TRAINERS, gameData } from './game-data.js';
import { runLoadNew, runLoadPart, runLoadShare, runLoadSummary, runLoadTick } from './logic/run-load.js';
import { runCardOut } from './logic/run-card.js';
import { runIconURL } from './ui-run-kit.js';
import { reducedMotion, saveData, uiState } from './game-state.js';
import { artLoad } from './art.js';
import { RIG_CANVAS_SIZE } from './skeleton-rig.js';
import { mapArtPaths, mapById, prepareMap, walkData, walkView } from './walk-view.js';
import { WEATHER_NAMES } from './environment.js';
import { walkRenderer } from './walk/walk-state.js';
import { loadPropModelRecipe } from './prop-models.js';
import { seamlessHubMap } from './seamless-world.js';
import { BOWL_INDEX, worldBowl, worldMapPrewarm } from './world-bowl.js';
import { loreLoadingLines } from './lore.js';
import { runWorld } from './run-world.js';
import { trainName } from './train-ride.js';
import { trainCarriage } from './train-carriage.js';
/* eslint-disable no-func-assign */
expose({
  LOAD_WEATHER_ICONS: [() => LOAD_WEATHER_ICONS],
  RUN_LOAD_PLACES: [() => RUN_LOAD_PLACES],
  RUN_LOAD_STAGES: [() => RUN_LOAD_STAGES],
  cardEl: [() => cardEl, v => (cardEl = v)],
  cardList: [() => cardList, v => (cardList = v)],
  cardOf: [() => cardOf, v => (cardOf = v)],
  cardRow: [() => cardRow, v => (cardRow = v)],
  cardSpan: [() => cardSpan, v => (cardSpan = v)],
  runHomeScreen: [() => runHomeScreen, v => (runHomeScreen = v)],
  runLoad: [() => runLoad],
  runLoadBegin: [() => runLoadBegin, v => (runLoadBegin = v)],
  runLoadCard: [() => runLoadCard, v => (runLoadCard = v)],
  runLoadEnd: [() => runLoadEnd, v => (runLoadEnd = v)],
  runLoadHide: [() => runLoadHide, v => (runLoadHide = v)],
  runLoadLanding: [() => runLoadLanding, v => (runLoadLanding = v)],
  runLoadModels: [() => runLoadModels, v => (runLoadModels = v)],
  runLoadPlaces: [() => runLoadPlaces, v => (runLoadPlaces = v)],
  runLoadScreen: [() => runLoadScreen, v => (runLoadScreen = v)],
  runLoadShow: [() => runLoadShow, v => (runLoadShow = v)],
  runLoadStep: [() => runLoadStep, v => (runLoadStep = v)],
  runLoadView: [() => runLoadView, v => (runLoadView = v)],
  runLoadWalkReady: [() => runLoadWalkReady, v => (runLoadWalkReady = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** HB-8: a take-off's first stage, the run's places made behind the screen (run-world.js runWorldMake) */
const RUN_LOAD_PLACES = { id: 'places', label: 'The run’s places', w: 3, hard: true };
/** the landing's stages, in the order the screen lists them (their weights in the bar) */
const RUN_LOAD_STAGES = [
  { id: 'map', label: 'The landing', w: 3 },
  { id: 'models', label: 'Buildings and things', w: 2 },
  { id: 'bowl', label: 'The world map', w: 2 },
  { id: 'walk', label: 'Setting down', w: 1 },
];
/** the loading under way (or the last one): `on` while it runs, `ready` once it has ended, its stages (logic/run-load.js)
 * and the screen while it shows */
export const runLoad = {
  on: false,
  ready: true,
  /** @type {import('./logic/run-load.js').RunLoad | null} */
  L: null,
  /** @type {HTMLElement | null} */
  el: null,
  /** @type {any} */
  timer: 0,
  node: -1,
  gen: 0,
  /** HB-8: the train a take-off rides (its carriage on the screen) */
  train: '',
  /** @type {(id: string, f: number) => void} a stage's share, for the loading under way */
  part: () => {},
  /** @type {Record<string, number>} */
  more: {},
};

/** start a run's loading, the screen not shown yet (runLoadShow): a take-off behind the train's white-out (node -1:
 * the run's places first, runLoadPlaces counts them, then runLoadLanding once the world is in), a resume at boot (its
 * landing at once). A loading already under way is ended first, unlogged
 * @param {'take-off' | 'resume'} why @param {number} node the landing, or -1 (not made yet) @param {string} [train]
 * the take-off's train (its carriage) */
export function runLoadBegin(why, node, train = '') {
  if (runLoad.timer) clearInterval(runLoad.timer);
  runLoadHide();
  const gen = ++runLoad.gen,
    L = runLoadNew(why, node < 0 ? [RUN_LOAD_PLACES, ...RUN_LOAD_STAGES] : RUN_LOAD_STAGES, performance.now()),
    mine = () => runLoad.gen === gen && runLoad.L === L,
    part = (/** @type {string} */ id, /** @type {number} */ f) => {
      if (mine()) runLoadPart(L, id, f, performance.now());
    };
  Object.assign(runLoad, { on: true, ready: false, L, node: -1, train, part, more: {} });
  if (typeof debugLog !== 'undefined') debugLog.stage('run loading: ' + why);
  if (node >= 0) runLoadLanding(node);
  runLoad.timer = setInterval(() => runLoadStep(gen), 100);
}

/** HB-8: the run's places made so far (made of `of`), the take-off's first stage @param {number} made @param {number} of */
export function runLoadPlaces(made, of) {
  if (runLoad.on) runLoad.part('places', of ? made / of : 0);
}

/** the landing's stages begin (world node `node`): its maps, art and ground, then the recipes of every model on it (and
 * its neighbours' in the composed view) and their decal pictures; the run's world map, its slow parts done ahead
 * @param {number} node */
export function runLoadLanding(node) {
  const part = runLoad.part;
  if (!runLoad.on || runLoad.node >= 0) return;
  runLoad.node = node;
  part('places', 1);
  runLoad.more = runWorld.wall
    ? { scenes: runWorld.scenes, work: runWorld.ms, wall: runWorld.wall }
    : { scenes: runWorld.scenes, work: runWorld.ms };
  const gen = runLoad.gen,
    L = runLoad.L,
    mine = () => runLoad.gen === gen && runLoad.L === L;
  let sc = null;
  try {
    sc = typeof seamlessHubMap === 'function' ? seamlessHubMap(node) : null;
  } catch (e) {
    console.error(e);
  }
  if (!sc || !sc.id || typeof prepareMap !== 'function') {
    part('map', 1);
    part('models', 1);
  } else
    prepareMap(sc.id)
      .catch(e => console.error(e))
      .then(() => {
        part('map', 1);
        if (mine()) runLoadModels(mapById(sc.id) || sc, f => part('models', f));
      });
  if (typeof worldMapPrewarm === 'function') worldMapPrewarm(() => part('bowl', 1), true);
  else part('bowl', 1);
}

/** the recipes of a scene's models fetched, then the pictures their layers name (the decals); f(share) as they come
 * @param {any} sc @param {(f: number) => void} f */
function runLoadModels(sc, f) {
  const C = walkData().sc,
    paths = new Set();
  for (const p of sc.props || []) {
    const M = C.props[p.k];
    if (!M || !M.model) continue;
    paths.add(M.model);
    const V = p.v && M.variants ? M.variants[p.v - 1] : null;
    if (V && typeof V.model === 'string') paths.add(V.model);
  }
  const all = [...paths];
  if (!all.length) return f(1);
  let tries = 0;
  const look = () => {
    const got = all.filter(q => loadPropModelRecipe(q) !== null).length;
    if (got < all.length && ++tries < 400) {
      f((0.8 * got) / all.length);
      return void setTimeout(look, 50);
    }
    f(0.8);
    Promise.resolve(artLoad(mapArtPaths(sc)))
      .catch(() => {})
      .then(() => f(1));
  };
  look();
}

/** the walk view at the landing drawn a few frames, or nothing to wait for. Not the GPU's normal-map queue (boot.js
 * walkViewWarmup waits on it for 5 s at most): it drains a few a second in software drawing and the scene is whole
 * without it */
function runLoadWalkReady() {
  if (typeof walkView === 'undefined' || !document.getElementById('dio')) return uiState.tab === 'walk';
  return (
    uiState.tab === 'walk' &&
    !!walkView.ready &&
    (typeof walkRenderer === 'undefined' || !walkRenderer.on || walkRenderer.frames > 4)
  );
}

/** every 100 ms while it runs: the walk stage, the screen's bar and stages, and the end (ready or capped)
 * @param {number} gen */
function runLoadStep(gen) {
  const L = runLoad.L;
  if (runLoad.gen !== gen || !L) return;
  /* the run ended or the save was swapped: nothing to wait for */
  if (!saveData.run) return runLoadEnd('gone');
  /* HB-8: nothing of the landing counts while the run's places are made (the hub's walk view is still up) */
  if (runLoad.node < 0) return runLoadScreen(L);
  if (runLoadWalkReady()) runLoadPart(L, 'walk', 1, performance.now());
  /* the world map's share: the rows of its terrain worked out (most of the prewarm's time) */
  const T = worldBowl.ground && worldBowl.ground.terrain;
  if (T && !T.ready) {
    const a = T.row0 || 0,
      z = T.rowEnd ?? BOWL_INDEX;
    runLoadPart(L, 'bowl', (0.9 * (T.row - a)) / Math.max(1, z - a), performance.now());
  }
  const end = runLoadTick(L, performance.now(), (RULES.run.load && RULES.run.load.capMs) || 20000);
  runLoadScreen(L);
  if (end) runLoadEnd(end);
}

/** the screen's bar and stages as the loading stands @param {import('./logic/run-load.js').RunLoad} L */
function runLoadScreen(L) {
  if (!runLoad.el) return;
  const el = /** @type {any} */ (runLoad.el);
  el.value = runLoadShare(L);
  el.stages = L.stages.map(s => ({
    id: s.id,
    label: s.label,
    state: s.late ? 'late' : s.f >= 1 ? 'ready' : s.f > 0 ? 'working' : 'waiting',
  }));
}

/** the loading ends: logged (stages and ms only), the screen lifted, `ready` for the checks
 * @param {string} how 'ready', 'capped', or 'gone' (the run left: nothing logged) */
function runLoadEnd(how) {
  if (runLoad.timer) clearInterval(runLoad.timer);
  runLoad.timer = 0;
  const L = runLoad.L;
  if (L && how !== 'gone' && typeof debugLog !== 'undefined')
    debugLog.add('load', `run ${runLoadSummary(L, { ...runLoad.more, shown: runLoad.el ? 1 : 0 })}`);
  if (how !== 'gone' && typeof debugLog !== 'undefined') debugLog.stage('run loaded: ' + how);
  Object.assign(runLoad, { on: false, ready: true });
  runLoadHide();
}

/** show the screen over the page while the loading runs (the take-off's landing, a resume); nothing when it has
 * ended already */
export function runLoadShow() {
  if (!runLoad.on || runLoad.el || !runLoad.L) return;
  const el = /** @type {any} */ (document.createElement('pb-loading')),
    run = saveData.run,
    tips = typeof loreLoadingLines === 'function' ? loreLoadingLines() : [];
  el.id = 'runload';
  el.sub =
    runLoad.L.why === 'resume'
      ? 'Back on the run'
      : runLoad.train
        ? `Through the portal · ${trainName(runLoad.train)}`
        : 'Landing';
  el.heading = (run && run.region && run.region.name) || 'The wild lands';
  el.tip = tips[0] || '';
  /* cutscenes track C: the tips turn over, the screen in the tunnel's dark, the region's card under its name */
  el.tips = tips;
  el.night = true;
  el.value = runLoadShare(runLoad.L);
  el.stages = runLoad.L.stages.map(s => ({ id: s.id, label: s.label, state: s.f >= 1 ? 'ready' : 'waiting' }));
  const card = runLoadCard(run);
  if (card) el.appendChild(card);
  document.body.appendChild(el);
  runLoad.el = el;
  /* HB-8: a take-off's screen is the train's carriage, the portal's tunnel past its windows */
  if (runLoad.train && typeof trainCarriage === 'function') runLoadView(trainCarriage(runLoad.train, !!reducedMotion));
}

/** a card's part: a tag with its class and text @param {string} tag @param {string} [cls] @param {string} [text]
 * @returns {HTMLElement} */
function cardEl(tag, cls = '', text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}
/** a labelled row of the card @param {string} label @param {Node[]} parts */
function cardRow(label, parts) {
  const r = cardEl('div', 'lc-row');
  r.append(cardEl('small', '', label), ...parts);
  return r;
}
/** parts side by side, wrapping @param {Node[]} parts */
function cardSpan(parts) {
  const sp = cardEl('span');
  sp.append(...parts);
  return sp;
}
/** a list of the card @param {string} cls @param {Node[]} items */
function cardList(cls, items) {
  const o = cardEl('ol', cls);
  for (const it of items) {
    const li = cardEl('li');
    li.append(it);
    o.append(li);
  }
  return o;
}
/** the card itself, its rows coming in one after another (--i) @param {Node[]} rows */
function cardOf(rows) {
  const box = cardEl('div', 'load-card');
  box.setAttribute('slot', 'card');
  rows.forEach((r, i) => {
    const w = cardEl('div', 'lc-in');
    w.style.setProperty('--i', String(i));
    w.append(r);
    box.append(w);
  });
  return box;
}

/** cutscenes track C: the region's card (logic/run-card.js runCardOut) in the screen's `card` slot, its rows coming in
 * one after another: the zones in order (each its biome's sky), the types it favours, the leaders, the regional dex
 * (a few of its species as silhouettes), the weather ahead; null for a run with no region @param {any} run */
function runLoadCard(run) {
  const F = runCardOut(run, {
    themes: gameData.regions && gameData.regions.themes,
    biomes: gameData.biomes,
    trainers: TRAINERS,
  });
  if (!F) return null;
  const s = (/** @type {number} */ n, /** @type {string} */ w) => `${n} ${w}${n === 1 ? '' : 's'}`,
    rows = [
      cardEl(
        'p',
        'lc-about',
        `${F.theme} · Expedition ${F.expedition} · ${s(F.places, 'place')} · ${s(F.towns, 'town')} · ${s(F.guards, 'guard')}`
      ),
    ];
  const zones = cardEl('ol', 'lc-zones');
  zones.setAttribute('aria-label', 'Zones');
  for (const z of F.zones) {
    const li = cardEl('li', '', z.name);
    if (z.sky[0]) li.style.setProperty('--a', z.sky[0]);
    if (z.sky[2] || z.sky[1]) li.style.setProperty('--b', z.sky[2] || z.sky[1]);
    zones.append(li);
  }
  rows.push(zones);
  if (F.types.length)
    rows.push(
      cardRow('Types', [
        cardSpan(
          F.types.map(t => {
            const pill = /** @type {any} */ (cardEl('pb-pill', '', t === 'None' ? 'Normal' : t));
            pill.type = t;
            pill.tone = pillColor(t);
            return pill;
          })
        ),
      ])
    );
  if (F.leaders.length)
    rows.push(
      cardRow('Leaders', [
        cardList(
          'lc-leaders',
          F.leaders.map(L => cardEl('span', L.boss ? 'boss' : '', L.name))
        ),
      ])
    );
  const dex = cardEl('span', 'lc-dex');
  for (const sp of F.sample) {
    const c = /** @type {HTMLCanvasElement} */ (cardEl('canvas', 'rig sil'));
    c.width = RIG_CANVAS_SIZE.w * 2;
    c.height = RIG_CANVAS_SIZE.h * 2;
    c.dataset.sp = sp;
    c.dataset.v = 'front';
    c.dataset.still = '1';
    c.setAttribute('aria-hidden', 'true');
    dex.append(c);
  }
  dex.append(cardEl('b', '', `${F.dex} Billies`));
  rows.push(cardRow('Dex', [dex]));
  if (F.weather.length)
    rows.push(
      cardRow('Weather', [
        cardList(
          'lc-wx',
          F.weather.map(w => {
            const sp = cardEl('span'),
              ic = cardEl('i', 'ic');
            ic.style.setProperty('--ico', `url('${runIconURL(LOAD_WEATHER_ICONS[w] || 'cloud')}')`);
            ic.setAttribute('aria-hidden', 'true');
            sp.append(ic, (WEATHER_NAMES && WEATHER_NAMES[w]) || w);
            return sp;
          })
        ),
      ])
    );
  if (F.side) rows.push(cardEl('p', 'lc-about', `Rumour has it: ${F.side}`));
  return cardOf(rows);
}
/** the weather's icons (ui-run-kit.js's own set) */
const LOAD_WEATHER_ICONS = {
  clear: 'sun',
  cloudy: 'cloud',
  rain: 'rain',
  storm: 'bolt',
  fog: 'fog',
  snow: 'snow',
  ash: 'ash',
};

/** cutscenes track C: the way home's screen, up at once when "Ride home" is pressed (in place of HB-8's plain white
 * veil): the carriage, "Heading home", what the run came to (logic/run-card.js runCardHome), while the hub's world goes
 * back in behind it; the ride home lifts it (train-ride.js trainRideHome's cover) @param {string} train
 * @param {ReturnType<typeof import('./logic/run-card.js').runCardHome>} F @returns {HTMLElement} */
export function runHomeScreen(train, F) {
  const el = /** @type {any} */ (document.createElement('pb-loading')),
    tips = typeof loreLoadingLines === 'function' ? loreLoadingLines() : [];
  el.id = 'runhome';
  el.night = true;
  el.sub = `Heading home · ${trainName(train)}`;
  el.heading = 'Copperleaf Town';
  el.tips = tips;
  el.tip = tips[0] || '';
  el.value = 0;
  el.stages = [];
  const rows = [
    cardEl(
      'p',
      'lc-about',
      `${F.won ? 'Run won' : 'Run over'}${F.name ? ` in ${F.name}` : ''} · day ${F.days} · ${F.cleared} place${F.cleared === 1 ? '' : 's'} cleared`
    ),
  ];
  const pay = /** @type {[number, string][]} */ ([
    [F.research, 'Research'],
    [F.crests, 'Crests'],
    [F.scrap, 'Scrap'],
  ]).filter(p => p[0] > 0);
  if (pay.length)
    rows.push(
      cardList(
        'lc-pay',
        pay.map(([n, w]) => {
          const sp = cardEl('span');
          sp.append(cardEl('b', '', `+${n}`), ` ${w}`);
          return sp;
        })
      )
    );
  if (F.kept.length) rows.push(cardRow('Coming home', [cardEl('span', '', F.kept.join(', '))]));
  const card = cardOf(rows);
  el.appendChild(card);
  if (typeof trainCarriage === 'function') {
    const v = trainCarriage(train, !!reducedMotion);
    v.setAttribute('slot', 'view');
    el.appendChild(v);
  }
  document.body.appendChild(el);
  /* the bar creeps on while the hub comes back (the ride lifts the screen when it can film) */
  const t0 = performance.now(),
    tick = () => {
      if (!el.isConnected) return;
      el.value = 1 - Math.exp(-(performance.now() - t0) / 2500);
      setTimeout(tick, 120);
    };
  tick();
  return el;
}

/** the screen's picture (HB-8: the carriage), in its `view` slot; null takes it out @param {Element | null} node */
function runLoadView(node) {
  const el = runLoad.el;
  if (!el) return;
  for (const c of [...el.children]) if (c.getAttribute('slot') === 'view') c.remove();
  if (node) {
    node.setAttribute('slot', 'view');
    el.appendChild(node);
  }
}

function runLoadHide() {
  const el = runLoad.el;
  runLoad.el = null;
  if (!el) return;
  if (reducedMotion) return el.remove();
  el.style.transition = 'opacity .35s ease-out';
  el.style.opacity = '0';
  setTimeout(() => el.remove(), 400);
}
