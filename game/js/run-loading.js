'use strict';
/* ================= A RUN'S LOADING SCREEN (hub track HB-2) =================
   A run's landing waits for its world: the take-off makes the run's scenes over several frames (run-world.js
   runWorldMake), the airship flies, and at the landing this screen (the UI kit's pb-loading) stays up until every
   stage is ready: the landing map put together (prepareMap: its maps, art and ground), the model recipes of the
   landing and the places joined to it with their decal pictures, the run's world map prewarmed (world-bowl.js
   worldMapPrewarm), the walk view drawn. The stages start with the flight, so a slow phone gets a head start and a
   fast one never sees the screen. A reload mid-run (resume) shows it from the boot on. The cap (rules.json
   run.load.capMs, the owner: 20 s) lifts it anyway; the debug log gets one 'load' line either way: the stages' times,
   which were late, how the scenes were made. Never a seed, a name or the save.
   runLoad is the signal the checks wait on: `on` while a loading runs, `ready` once it has ended.
   HB-8 puts the train carriage in the screen's `view` slot (runLoadView). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide } from './hooks.js';
import { RULES } from './game-data.js';
import { runLoadNew, runLoadPart, runLoadShare, runLoadSummary, runLoadTick } from './logic/run-load.js';
import { reducedMotion, saveData, uiState } from './game-state.js';
import { artLoad } from './art.js';
import { mapArtPaths, mapById, prepareMap, walkData, walkView } from './walk-view.js';
import { walkRenderer } from './walk/walk-state.js';
import { loadPropModelRecipe } from './prop-models.js';
import { seamlessHubMap } from './seamless-world.js';
import { worldMapPrewarm } from './world-bowl.js';
import { loreLoadingLines } from './lore.js';
import { runWorld } from './run-world.js';
/* eslint-disable no-func-assign */
expose({
  RUN_LOAD_STAGES: [() => RUN_LOAD_STAGES],
  runLoad: [() => runLoad],
  runLoadBegin: [() => runLoadBegin, v => (runLoadBegin = v)],
  runLoadEnd: [() => runLoadEnd, v => (runLoadEnd = v)],
  runLoadHide: [() => runLoadHide, v => (runLoadHide = v)],
  runLoadModels: [() => runLoadModels, v => (runLoadModels = v)],
  runLoadShow: [() => runLoadShow, v => ((runLoadShow = v), provide({ runLoadShow }))],
  runLoadStep: [() => runLoadStep, v => (runLoadStep = v)],
  runLoadView: [() => runLoadView, v => (runLoadView = v)],
  runLoadWalkReady: [() => runLoadWalkReady, v => (runLoadWalkReady = v)],
});
/* eslint-enable no-func-assign */
provide({ runLoadShow });
/* to-module: end */
/** the stages, in the order the screen lists them (their weights in the bar) */
const RUN_LOAD_STAGES = [
  { id: 'map', label: 'The landing', w: 3 },
  { id: 'models', label: 'Buildings and things', w: 2 },
  { id: 'bowl', label: 'The world map', w: 2 },
  { id: 'walk', label: 'Setting down', w: 1 },
];
/** the loading under way (or the last one): `on` while it runs, `ready` once it has ended, its stages (logic/run-load.js)
 * and the screen while it shows */
const runLoad = {
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
  /** @type {Record<string, number>} */
  more: {},
};

/** start loading a run's landing (world node `node`), the screen not shown yet (runLoadShow): the take-off as the
 * flight starts, a resume at boot. A loading already under way is ended first, unlogged
 * @param {'take-off' | 'resume'} why @param {number} node */
export function runLoadBegin(why, node) {
  if (runLoad.timer) clearInterval(runLoad.timer);
  runLoadHide();
  const gen = ++runLoad.gen,
    L = runLoadNew(why, RUN_LOAD_STAGES, performance.now()),
    mine = () => runLoad.gen === gen && runLoad.L === L,
    part = (/** @type {string} */ id, /** @type {number} */ f) => {
      if (mine()) runLoadPart(L, id, f, performance.now());
    };
  Object.assign(runLoad, {
    on: true,
    ready: false,
    L,
    node,
    more: runWorld.wall
      ? { scenes: runWorld.scenes, work: runWorld.ms, wall: runWorld.wall }
      : { scenes: runWorld.scenes, work: runWorld.ms },
  });
  /* the landing: its maps, art and ground, then the recipes of every model on it (and its neighbours' in the
     composed view) and their decal pictures */
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
  /* the run's world map, its slow parts done ahead */
  if (typeof worldMapPrewarm === 'function') worldMapPrewarm(() => part('bowl', 1));
  else part('bowl', 1);
  runLoad.timer = setInterval(() => runLoadStep(gen), 100);
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
  if (runLoadWalkReady()) runLoadPart(L, 'walk', 1, performance.now());
  const end = runLoadTick(L, performance.now(), (RULES.run.load && RULES.run.load.capMs) || 20000);
  if (runLoad.el) {
    const el = /** @type {any} */ (runLoad.el);
    el.value = runLoadShare(L);
    el.stages = L.stages.map(s => ({
      id: s.id,
      label: s.label,
      state: s.late ? 'late' : s.f >= 1 ? 'ready' : s.f > 0 ? 'working' : 'waiting',
    }));
  }
  if (end) runLoadEnd(end);
}

/** the loading ends: logged (stages and ms only), the screen lifted, `ready` for the checks
 * @param {string} how 'ready', 'capped', or 'gone' (the run left: nothing logged) */
function runLoadEnd(how) {
  if (runLoad.timer) clearInterval(runLoad.timer);
  runLoad.timer = 0;
  const L = runLoad.L;
  if (L && how !== 'gone' && typeof debugLog !== 'undefined')
    debugLog.add('load', `run ${runLoadSummary(L, { ...runLoad.more, shown: runLoad.el ? 1 : 0 })}`);
  Object.assign(runLoad, { on: false, ready: true });
  runLoadHide();
}

/** show the screen over the page while the loading runs (the take-off's landing, a resume); nothing when it has
 * ended already */
function runLoadShow() {
  if (!runLoad.on || runLoad.el || !runLoad.L) return;
  const el = /** @type {any} */ (document.createElement('pb-loading')),
    run = saveData.run,
    tips = typeof loreLoadingLines === 'function' ? loreLoadingLines() : [];
  el.id = 'runload';
  el.sub = runLoad.L.why === 'resume' ? 'Back on the run' : 'Landing';
  el.heading = (run && run.region && run.region.name) || 'The wild lands';
  el.tip = tips[0] || '';
  el.value = runLoadShare(runLoad.L);
  el.stages = runLoad.L.stages.map(s => ({ id: s.id, label: s.label, state: s.f >= 1 ? 'ready' : 'waiting' }));
  document.body.appendChild(el);
  runLoad.el = el;
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
