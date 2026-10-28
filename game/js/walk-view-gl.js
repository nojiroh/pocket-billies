'use strict';
/* ================= WALK SCENE on the engine (v12) =================
   The walk scene drawn by the shared WebGL engine (js/engine/*): ground with real height and cliffs, a Hollow Earth
   horizon that bends up, pixel sprites standing in 3D with gentle automatic shading, sun shadows from a shadow map
   (buildings cast solid shadows, people and trees their cut-out shape), contact shadows, lamps and windows that light
   the ground in front of them and glow through bloom, ponds that reflect, grass that sways and bends away from you,
   mist, cloud shadows, and a lens with depth of field. Every dial is an engine setting (Studio → Engine).
   Same scenes, walking and taps as js/walk-view.js (scene data, paths, the player); this file draws them. */
/* which material a prop is made of: its own "mat", else guessed from its name */
/* ---------- canvas plumbing: the WebGL canvas plus a 2D layer on top for labels ---------- */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import {
  BUILDING_SHADERS,
  MODEL_SHADOW_SHADERS,
  SOLID_PROP_SHADERS,
  WORLD_BOWL_SHADERS,
  buildingState,
  drawBuildings,
  drawPropModels,
  drawSolidProps,
  drawStructures,
  festivalArrive,
  lifeStep,
  noWebGL,
  propModelShaders,
  propModelState,
  provide,
  runWaterWeatherSync,
  seamlessLookTick,
  seamlessPrepareAhead,
  solidPropState,
  structureState,
  worldBillyLabels,
  worldExtra,
  worldMapPrewarm,
} from './hooks.js';
import { personPicture } from './logic/person-view.js';
import { focusAim, focusPlane, leanStep } from './logic/lens-focus.js';
import { FOG_MARCH_STEPS, fogGridBox, fogMarchOn } from './logic/fog-grid.js';
import { gpuCountSummary, gpuPass } from './engine/gpu-counters.js';
import { frameCount, frameTask, userFps } from './frame-scheduler.js';
import {
  drawBubble,
  drawExitLabels,
  drawExitMarks,
  drawLabelPill,
  drawLevelTag,
  drawSpeech,
  drawTapMark,
  drawWalkMark,
  ensureGround,
  hitAt,
  mapById,
  mapHub,
  navGrid,
  prepareMap,
  screenToGround,
  setScreenToGround,
  setStopWalkView,
  setWorldToScreen,
  stopWalkView,
  updateFolk,
  updatePlayer,
  walkData,
  walkView,
  worldToScreen,
} from './walk-view.js';
import {
  PLAIN_LOOK,
  beginFrameSettings,
  endFrameSettings,
  engineContext,
  engineSetting,
  graphicsOff,
  playerBlur,
} from './engine/settings.js';
import {
  beginGpuTimer,
  endGpuTimer,
  ensurePrograms,
  gpuLoading,
  gpuOnRestore,
  gpuPictureBytes,
  gpuState,
  initWebgl,
  normalize3,
  pollPendingPrograms,
  precompilePrograms,
  renderTarget,
  runNormalMapJobs,
  trimTextures,
  webgl2Supported,
} from './engine/webgl.js';
import { frameBlockLost, sunLight } from './engine/light.js';
import { POST_EFFECT_SHADERS, drawPostEffects, screenSnapshot, sunScreenPosition } from './engine/post-effects.js';
import { environment, environmentFrame } from './environment.js';
import { PREP_BUDGET_MS, walkRenderer } from './walk/walk-state.js';
import { standingHeightAt } from './walk/heights.js';
import { SPRITE_INSTANCE_SHADERS, WALK_SHADERS } from './walk/walk-shaders.js';
import { worldCurveDrop } from './walk/draw-common.js';
import { groundOcclusionWork } from './walk/ground-textures.js';
import { buildFarProps, buildGrass, grassWork } from './walk/grass-build.js';
import {
  MAP_CACHE_FIELDS,
  groundPrepWork,
  isGroundPrepared,
  mapCacheKey,
  prepareMapGround,
  swapMapCache,
  updateNearRing,
} from './walk/map-cache.js';
import {
  adaptQuality,
  coverItems,
  cullItems,
  easedMood,
  frameBudgetRemaining,
  heatHaze,
  heatSources,
} from './walk/quality-cull.js';
import { drawSky } from './walk/sky.js';
import { drawRoomFront } from './walk/rooms.js';
import { drawWater, reflectionPass } from './walk/water.js';
import { figureReport, figuresOn } from './figures.js';
import { gatherFrameItems } from './walk/frame-items.js';
import { drawBoxFaces, drawPlayerSilhouette, drawSprites, hideQueriesLost } from './walk/sprites.js';
import { battleCamera, cutsceneCamera, screenRay, startSceneZoom, walkCamera } from './walk/camera.js';
import { mapSun, walkLightContext } from './walk/lighting.js';
import { SHADOW_INSTANCE_SHADERS, lampShadowMaps, shadowPass } from './walk/shadows.js';
import { drawGrass, drawGround } from './walk/ground-draw.js';
import { gatherFountainBasins } from './walk/fountains-weather.js';
import { RIBBON_SHADERS, WEATHER_FX_SHADERS, effectsPass, ribbonPass } from './walk/effects.js';
import { BATTLE_FX_SHADERS } from './walk/battle-fx.js';
import { drawFogGridBlocks, fogGridFrame, fogGridState, fogMarchNote } from './walk/fog-grid.js';
import { bindGestures, handleCanvasClick } from './walk/input.js';
/* eslint-disable no-func-assign */
expose({
  GROUND_SLICE_MS: [() => GROUND_SLICE_MS],
  PHONE: [() => PHONE],
  baseStopWalkView: [() => baseStopWalkView],
  canvasForContext: [() => canvasForContext, v => (canvasForContext = v)],
  drawWalkFrame: [() => drawWalkFrame, v => (drawWalkFrame = v)],
  drawWalkFrameInner: [() => drawWalkFrameInner, v => (drawWalkFrameInner = v)],
  dropWalkGpuCaches: [() => dropWalkGpuCaches, v => (dropWalkGpuCaches = v)],
  ensureWalkGl: [() => ensureWalkGl, v => (ensureWalkGl = v)],
  groundBuiltBeforeShow: [() => groundBuiltBeforeShow, v => (groundBuiltBeforeShow = v)],
  impactOnScreen: [() => impactOnScreen, v => (impactOnScreen = v)],
  labelLayer: [() => labelLayer, v => (labelLayer = v)],
  litSunScreenPosition: [() => litSunScreenPosition, v => (litSunScreenPosition = v)],
  mountWalkView: [() => mountWalkView, v => setMountWalkView(v)],
  onGlContextRestored: [() => onGlContextRestored, v => ((onGlContextRestored = v), provide({ onGlContextRestored }))],
  peopleReport: [() => peopleReport, v => (peopleReport = v)],
  phoneStarted: [() => phoneStarted, v => (phoneStarted = v)],
  screenToGround2d: [() => screenToGround2d],
  setMountWalkView: [() => setMountWalkView, v => (setMountWalkView = v)],
  walkViewGpuLost: [() => walkViewGpuLost, v => (walkViewGpuLost = v)],
  walkWarmUp: [() => walkWarmUp, v => (walkWarmUp = v)],
  worldToScreen2d: [() => worldToScreen2d],
});
/* eslint-enable no-func-assign */
provide({ onGlContextRestored });
/* to-module: end */
export function canvasForContext(cv, type) {
  if (!cv._ctx) {
    cv._ctx = type;
    return cv;
  }
  if (cv._ctx === type) return cv;
  const n = document.createElement('canvas');
  n.id = cv.id;
  n.className = cv.className;
  n.hidden = cv.hidden;
  const al = cv.getAttribute('aria-label');
  if (al) n.setAttribute('aria-label', al);
  n._ctx = type;
  cv.replaceWith(n);
  return n;
}
function labelLayer(cv) {
  let u = walkRenderer.ui;
  if (!u || !u.isConnected) {
    u = document.getElementById('dioui') || document.createElement('canvas');
    u.id = 'dioui';
    u.setAttribute('aria-hidden', 'true');
    walkRenderer.ui = u;
  }
  if (u.previousElementSibling !== cv) cv.after(u);
  u.hidden = false;
  return u;
}
const baseStopWalkView = stopWalkView,
  worldToScreen2d = worldToScreen,
  screenToGround2d = screenToGround;
/* 0.1.0 alpha: the walk view is WebGL only (the Lite 2D painter is gone). Without it the game says this device can't
   run it (boot.js noWebGL); the Studio shows its own message (engine-editor.js) */
export function mountWalkView(cv, id, opt = {}) {
  const useGL = !gpuState.fail && webgl2Supported();
  cv = canvasForContext(cv, 'gl');
  if (!useGL) {
    walkRenderer.on = false;
    if (walkRenderer.ui) walkRenderer.ui.hidden = true;
    walkView.ready = false;
    walkView.err = new Error('WebGL 2 is not available');
    if (typeof noWebGL === 'function') noWebGL(gpuState.fail ? 'failed' : '');
    return Promise.resolve();
  }
  walkView.cv = cv;
  walkView.opt = opt;
  const fresh = walkView.id !== id;
  if (fresh) {
    walkView.id = id;
    walkView.cam = null;
    Object.assign(walkView.pl, { t: -1, fresh: true, route: null, goal: null, walk: 0 });
    walkView.gkey = '';
    walkView.cand = null;
    walkView.nav = null;
    walkView.npcAt = {};
    walkView.folk = [];
    walkView.folkAll = [];
    walkView.folkId = '';
    walkView.parts = [];
    walkView.tap = null;
    walkRenderer.gkey = '';
    walkRenderer.focus = null;
    walkRenderer.camT = null;
    walkRenderer.farKey = '';
  }
  walkView.sc = mapById(id);
  /* CAM-4b: a fresh scene starts at its zoom stop (walk/camera.js) */
  if (fresh) startSceneZoom(walkView.sc);
  walkView.ready = false;
  walkView.err = null;
  gpuLoading();
  cv.classList.add('gl');
  if (!ensureWalkGl(cv)) return mountWalkView(cv, id, opt);
  const ui = labelLayer(cv);
  walkView.x = ui.getContext('2d');
  walkRenderer.on = true;
  if (!cv._dioBound) {
    cv._dioBound = 1;
    cv.addEventListener('click', handleCanvasClick);
    cv.addEventListener('pointermove', ev => {
      const h = hitAt(ev);
      cv.style.cursor = h ? 'pointer' : walkView.st.roam ? 'crosshair' : '';
    });
    bindGestures(cv);
  }
  return prepareMap(id)
    .then(sc => {
      if (walkView.id !== id) return;
      walkView.sc = sc;
      ensureGround();
      return groundBuiltBeforeShow(id, sc);
    })
    .then(() => {
      if (walkView.id !== id) return;
      walkView.ready = true;
      /* HB-10e: coming home to a festival or market day says so (town-square.js) */
      if (typeof festivalArrive === 'function') festivalArrive(walkView.sc);
      frameTask('dio', drawWalkFrame, () => (walkView.opt.cap ? walkView.opt.cap() : userFps()));
      /* the hub: the world map's slow parts done ahead, so it opens whole (world-bowl.js worldMapPrewarm) */
      if (typeof worldMapPrewarm === 'function' && !worldExtra.look) setTimeout(worldMapPrewarm, 1500);
      return walkWarmUp(cv, id);
    })
    .catch(e => {
      walkView.err = e;
      console.error(e);
    });
}
/* 0.1.0 alpha: a place's ground is built on the card a slice at a time before its view is shown. It was built in one go
   on the view's first frame: in the owner's logs entering Copperleaf (and the opening, which waits for that ground) froze
   2 s on a phone, 3 s on a laptop and 12 s on an iPad. Now the page keeps answering while it is built, and the first
   frame only swaps it in (swapMapCache). A room's floor is small and is built as before; so is a view whose job is
   dropped (it failed), or one still not ready after 30 s. */
/* phase 20 R2 (D4): a phone, as the automatic quality has it (walk/quality-cull.js); the iPad is not one */
const PHONE = typeof navigator !== 'undefined' && /Android|iPhone/.test(navigator.userAgent);
let phoneStarted = false;
const GROUND_SLICE_MS = 10; /* an urgent job gets twice this (groundPrepWork) */
function groundBuiltBeforeShow(id, sc) {
  if (!walkRenderer.on || !walkView.ground || sc.groundOf || sc.roomScene) return Promise.resolve();
  const key = mapCacheKey(id, sc, walkView.gkey),
    t0 = performance.now();
  let ours = false;
  return new Promise(done => {
    const step = () => {
      const J = walkRenderer.prep;
      if (walkView.id !== id) {
        /* another view was asked for meanwhile: this one goes on as a look-ahead, which an urgent one may stop */
        if (J && J.hk === key) J.urgent = 0;
        return done();
      }
      if (!walkRenderer.on || gpuState.lost || isGroundPrepared(id, sc, walkView.gkey)) return done();
      if (J && J.hk === key) ours = true;
      else if (ours) return done();
      else prepareMapGround(id, sc, walkView.ground, true);
      groundPrepWork(GROUND_SLICE_MS);
      if (performance.now() - t0 > 30000) {
        if (typeof debugLog !== 'undefined')
          debugLog.add('scene', `${id}: its ground wasn't ready in 30 s; built on the spot`);
        return done();
      }
      setTimeout(step, 0);
    };
    step();
  });
}
/* phase 04d: the Studio swaps in its own (studio/js/engine-editor.js and viewport.js) */
export function setMountWalkView(v) {
  mountWalkView = v; // eslint-disable-line no-func-assign
  provide({ mountWalkView });
}
/* CH-1: people in the debug log (debug-log.js `people` and the samples' `ppl`; tools/look-people.py): how many the last
   frame drew, their draws in the last counted frame (engine/gpu-counters.js's `person` tag) in all and by pass, and
   their pictures on the graphics card with their MB (engine/webgl.js gpuPictureBytes). Numbers only. */
export function peopleReport() {
  const g = gpuCountSummary(),
    byPass = {};
  let draws = 0;
  for (const p in (g && g.dct) || {})
    if (g.dct[p].person) {
      byPass[p] = g.dct[p].person;
      draws += g.dct[p].person;
    }
  const T = gpuPictureBytes(personPicture);
  return {
    drawn: walkRenderer.people || 0,
    draws: Math.round(draws * 10) / 10,
    byPass,
    textures: T.n,
    mb: Math.round((T.bytes / 1048576) * 10) / 10,
    /* CH-2: the figure baker's numbers, once it has baked (figures.js figureReport) */
    ...(typeof figureReport === 'function' && (figuresOn() || figureReport().bakes) ? { figures: figureReport() } : {}),
  };
}
/* the GL context on this canvas, with the walk scene's programs (v47: also used by the opening's fall, which draws the
   world map on the same canvas before Sundown is mounted; a context made by the map alone gets the walk programs here) */
export function ensureWalkGl(cv) {
  if (gpuState.cv === cv && gpuState.gl) {
    if (!gpuState.lost)
      try {
        ensurePrograms(WALK_SHADERS);
      } catch (e) {
        console.error(e);
        gpuState.fail = 1;
        return false;
      }
    return true;
  }
  if (!initWebgl(cv)) {
    gpuState.fail = 1;
    return false;
  }
  try {
    /* LD-2: every program starts compiling first (the driver may work on them side by side), then the ones the first
       frame needs are finished; the rest finish in the background (pollPendingPrograms) */
    precompilePrograms(WALK_SHADERS);
    precompilePrograms(POST_EFFECT_SHADERS);
    for (const d of [
      typeof BUILDING_SHADERS !== 'undefined' && BUILDING_SHADERS,
      typeof SOLID_PROP_SHADERS !== 'undefined' && SOLID_PROP_SHADERS,
      typeof propModelShaders === 'function' && propModelShaders(),
      /* 0.1.0 alpha: the world map's too: its first open compiled its eight programs on the spot */
      typeof WORLD_BOWL_SHADERS !== 'undefined' && WORLD_BOWL_SHADERS,
      /* phase 20 E6: the instanced pictures' program, while Engine > Quality "Pictures in batches" is on */
      engineSetting('quality', 'spriteInstances') && SPRITE_INSTANCE_SHADERS,
      /* phase 20 R2: the weather in one draw */
      WEATHER_FX_SHADERS,
      /* VFX-2: a thrown pyramid's ribbon, so the first throw doesn't compile it */
      RIBBON_SHADERS,
      /* VFX-9: the battle effects' pool */
      BATTLE_FX_SHADERS,
      /* phase 20 R3: the instanced shadow pictures' and shadow models' programs */
      SHADOW_INSTANCE_SHADERS,
      typeof MODEL_SHADOW_SHADERS !== 'undefined' && MODEL_SHADOW_SHADERS,
    ])
      if (d)
        precompilePrograms(
          d
        ); /* alpha 0.4: the low-poly props' too (they were built on first use, in the first place with props) */
    ensurePrograms(WALK_SHADERS);
    ensurePrograms(POST_EFFECT_SHADERS);
  } catch (e) {
    console.error(e);
    gpuState.fail = 1;
    if (typeof debugLog !== 'undefined') debugLog.add('webgl', 'shader failed: ' + e.message);
    return false;
  }
  walkRenderer.gkey = '';
  walkRenderer.farKey = '';
  walkRenderer.sceneCache = null;
  walkRenderer.roomFloors = null;
  walkRenderer.wtex = null;
  for (const k of MAP_CACHE_FIELDS) walkRenderer[k] = null;
  return true;
}
/* phase 20 H: a restored context is the same object with nothing on it, so every cache that keeps a buffer or a
   texture is dropped (not freed: the old ones are gone with the context), whether or not the walk view shows: the world
   map may make the context again first, and the walk view then skips ensureWalkGl's own clearing. Run by the resource
   registry on every restore (engine/webgl.js gpuOnRestore), before the walk view is mounted again */
function dropWalkGpuCaches() {
  walkRenderer.gkey = '';
  walkRenderer.farKey = '';
  walkRenderer.hkey = '';
  walkRenderer.sceneCache = null;
  walkRenderer.roomFloors = null;
  walkRenderer.wtex = null;
  walkRenderer.prep = null;
  walkRenderer.basin = null;
  walkRenderer.basinKey = null;
  /* the sun's shadow map of the last frame (drawn every other frame on a struggling phone) and its cache key */
  walkRenderer.lastShadow = null;
  walkRenderer.shKey = '';
  for (const k of MAP_CACHE_FIELDS) walkRenderer[k] = null;
  walkView.gkey = '';
  /* a real loss also comes a frame or more before its event, and a frame drawn on the dead context turns the buildings,
     models and solid props off (their guards): on the new context they try again (a real fault turns them off again) */
  if (typeof buildingState !== 'undefined') {
    buildingState.mesh = new WeakMap();
    buildingState.fail = '';
  }
  if (typeof propModelState !== 'undefined') {
    propModelState.meshes.clear();
    propModelState.fail = '';
  }
  if (typeof solidPropState !== 'undefined') {
    solidPropState.meshes = new WeakMap();
    solidPropState.live.clear();
    solidPropState.fail = '';
  }
  if (typeof structureState !== 'undefined') {
    structureState.mesh = null;
    structureState.parts = [];
    structureState.key = '';
  }
}
function walkViewGpuLost() {
  dropWalkGpuCaches();
  frameBlockLost();
  hideQueriesLost();
}
gpuOnRestore('walk view', walkViewGpuLost);
/* phase 20 H5: the view is shown once two frames have drawn behind its fade (at most 1.5 s): their first draws compile
   what the background compile hasn't finished and upload their pictures while nothing can be seen. A restore fades
   out and back in the same way (Engine > Quality "Warm up before showing", on) */
function walkWarmUp(cv, id) {
  const f0 = walkRenderer.frames,
    t0 = performance.now(),
    n = engineSetting('quality', 'warmUp') === false ? 0 : 2;
  return new Promise(done => {
    const look = () => {
      if (walkView.id !== id) return done();
      if (walkRenderer.frames < f0 + n && performance.now() - t0 < 1500) return void requestAnimationFrame(look);
      cv.classList.add('in');
      if (n && typeof debugLog !== 'undefined') debugLog.mark('warming up a scene', t0, performance.now());
      done();
    };
    look();
  });
}
function onGlContextRestored(cv) {
  if (walkView.id && walkView.cv === cv) {
    const id = walkView.id;
    walkView.id = null;
    if (engineSetting('quality', 'warmUp') !== false) cv.classList.remove('in');
    mountWalkView(cv, id, walkView.opt);
  }
}
setStopWalkView(function () {
  baseStopWalkView();
  if (walkRenderer.ui) walkRenderer.ui.hidden = true;
});
setWorldToScreen(function (C, x, y, z) {
  if (!C || !C.gl) return worldToScreen2d(C, x, y, z);
  const wy = standingHeightAt(x, z) + y + worldCurveDrop(x, z),
    m = C.vp,
    cx = m[0] * x + m[4] * wy + m[8] * z + m[12],
    cy = m[1] * x + m[5] * wy + m[9] * z + m[13],
    w = m[3] * x + m[7] * wy + m[11] * z + m[15];
  if (w < 0.2) return null;
  return { x: ((cx / w) * 0.5 + 0.5) * C.rw, y: (1 - ((cy / w) * 0.5 + 0.5)) * C.rh, s: C.F / w, d: w };
});
setScreenToGround(function (sx, sy) {
  const C = walkView.C;
  if (!C || !C.gl) return screenToGround2d(sx, sy);
  const r = screenRay(C, sx, sy);
  let t = 0,
    prev = null;
  for (let k = 0; k < 400; k++) {
    t += 0.12 + k * 0.004;
    const x = r.o[0] + r.d[0] * t,
      y = r.o[1] + r.d[1] * t,
      z = r.o[2] + r.d[2] * t,
      g = standingHeightAt(x, z);
    if (y <= g) {
      if (prev) {
        let a = prev,
          b = t;
        for (let i = 0; i < 8; i++) {
          const m = (a + b) / 2,
            yy = r.o[1] + r.d[1] * m,
            xx = r.o[0] + r.d[0] * m,
            zz = r.o[2] + r.d[2] * m;
          if (yy <= standingHeightAt(xx, zz)) b = m;
          else a = m;
        }
        t = b;
      }
      return { x: r.o[0] + r.d[0] * t, z: r.o[2] + r.d[2] * t };
    }
    prev = t;
  }
  return null;
});
/* ---------- frame ---------- */
function drawWalkFrame(ts, dtm) {
  const cv = walkView.cv;
  if (!cv || !cv.isConnected) {
    stopWalkView();
    return;
  }
  if (!walkView.ready || gpuState.lost) return;
  /* WA-5a: a new run day lays its weather on the places' water (run-world.js; nothing to do on the same day) */
  if (typeof runWaterWeatherSync === 'function') runWaterWeatherSync();
  const w0 = performance.now(),
    gl = gpuState.gl,
    sc = walkView.sc;
  if (!gpuState.loaded) {
    if (!gpuState.loadAt) gpuState.loadAt = w0 + 1000;
    else if (w0 >= gpuState.loadAt) gpuState.loaded = true;
  }
  engineContext.look = sc.plain ? PLAIN_LOOK : sc.look || null;
  gpuState.fr = (gpuState.fr || 0) + 1;
  if (gpuState.fr % 120 === 0) trimTextures();
  /* LD-5: the one-off work's budget starts here (walk/quality-cull.js frameBudgetLeft) */
  walkRenderer.budT = performance.now();
  runNormalMapJobs(walkView.warm ? 40 : 3);
  /* LD-2: behind a loading screen (the boot's, a run's) as many as fit in 12 ms a frame, so none is left for play */
  pollPendingPrograms(1, document.body.classList.contains('ld-on') || document.getElementById('runload') ? 12 : 0);
  groundOcclusionWork();
  groundPrepWork(walkRenderer.bt ? 0 : Math.min(PREP_BUDGET_MS, Math.max(1, frameBudgetRemaining())));
  const cssW = cv.clientWidth,
    cssH = cv.clientHeight;
  if (!cssW || !cssH) return;
  /* phase 20 R2 (D4): with quality.phonePixels a phone (Android, iPhone) draws at most 1.2 million pixels (1.6
     elsewhere), and its automatic resolution starts a step lower (0.9; it climbs back when frames have room) */
  const phoneK = PHONE && !!engineSetting('quality', 'phonePixels');
  if (phoneK && !phoneStarted) {
    phoneStarted = true;
    if (walkView.R >= 1) walkView.R = 0.9;
  }
  const R0 = Math.min(devicePixelRatio || 1, 1.75) * engineSetting('quality', 'resolution'),
    R = R0 * Math.min(1, Math.sqrt((phoneK ? 1.2e6 : 1.6e6) / (cssW * cssH * R0 * R0))) * walkView.R,
    rw = Math.max(64, Math.min(2400, Math.round(cssW * R))),
    rh = Math.max(64, Math.round((cssH * rw) / cssW));
  if (cv.width !== rw || cv.height !== rh) {
    cv.width = rw;
    cv.height = rh;
  }
  const ui = walkRenderer.ui;
  if (ui.width !== rw || ui.height !== rh) {
    ui.width = rw;
    ui.height = rh;
  }
  const dms = Math.min(dtm, 60);
  walkView.t += dms;
  const dt = dms / 1000,
    t = walkView.t,
    C0 = walkData().sc,
    PPU = C0.ppu || 34;
  /* v26: the hour, the weather and the season (environment.js) lean on the engine dials while this frame draws */
  engineContext.env =
    !sc.plain && !graphicsOff() && typeof environment !== 'undefined' && (environment.on || !!environment.force);
  if (engineContext.env) environmentFrame(sc, dt);
  else if (typeof environment !== 'undefined') environment.look = null; /* no time-of-day look left over */
  const gq = beginGpuTimer();
  try {
    drawWalkFrameInner(ts, dt, dtm, t, C0, PPU, rw, rh, w0);
  } finally {
    endFrameSettings();
    engineContext.env = false;
    endGpuTimer(gq);
  }
}
function drawWalkFrameInner(ts, dt, dtm, t, C0, PPU, rw, rh, w0) {
  if (typeof seamlessLookTick === 'function') seamlessLookTick();
  if (typeof seamlessPrepareAhead === 'function') seamlessPrepareAhead(performance.now());
  /* phase 20 C1: every dial looked up once for this frame (settings.js) */
  beginFrameSettings();
  const gl = gpuState.gl,
    sc = walkView.sc,
    cv = walkView.cv;
  ensureGround();
  const hk = mapCacheKey(walkView.id, sc, walkView.gkey);
  if (walkRenderer.gkey !== walkView.gkey || walkRenderer.hkey !== hk) {
    const old = walkRenderer.hkey;
    walkRenderer.gkey = walkView.gkey;
    walkRenderer.hkey = hk;
    /* the ground changed: the props' heights and their grid are worked out again */
    walkRenderer.itemGen = (walkRenderer.itemGen || 0) + 1;
    walkView.nav = null;
    navGrid();
    swapMapCache(old, hk);
  }
  navGrid();
  if (walkRenderer.grassKey !== engineSetting('grass', 'density')) buildGrass();
  else grassWork(4);
  if (walkRenderer.farKey !== walkView.id + '|' + Math.round(engineSetting('world', 'farProps'))) buildFarProps();
  /* a battle (battle-3d.js) borrows the scene: its own camera, the fighters as lit sprites, props in the way hidden */
  const BT =
    (walkView.battle && walkView.battle.frame ? walkView.battle.frame() : null) ||
    (walkView.director && walkView.director.frame ? walkView.director.frame() : null);
  walkRenderer.bt = BT;
  const st = BT ? { who: null, npcs: [], enc: [], battle: 1 } : walkView.opt.state ? walkView.opt.state() : { t: 0 };
  if (!BT) {
    walkView.st = st;
    updatePlayer(st, dt);
  }
  const P = walkView.pl;
  if (!BT && sc.folk && st.mode && st.mode !== 'line') updateFolk(sc.folk, dt);
  else if (!BT) {
    walkView.folk = [];
    walkView.folkAll = [];
  }
  if (!BT && typeof lifeStep === 'function') lifeStep(dt);
  /* the Studio's free camera (studio/js/free-camera.js): a view's own eye and target instead of following the walker */
  const look = !BT && walkView.opt.look ? walkView.opt.look(dt) : null;
  const C = BT
    ? BT.look
      ? cutsceneCamera(rw, rh, BT.look)
      : battleCamera(rw, rh, BT)
    : look
      ? cutsceneCamera(rw, rh, look)
      : walkCamera(rw, rh, st, dt);
  walkView.C = C;
  const sun = mapSun(sc, sunLight(!!sc.indoor));
  walkRenderer.sun = sun;
  /* v46: the near ring follows the camera's focus (in a battle, the stage) */
  {
    const bc =
        (BT && (BT.center || (BT.look && [BT.look.tgt[0], BT.look.tgt[2]]))) || (look && [look.tgt[0], look.tgt[2]]),
      T = walkRenderer.camT;
    const fx = bc ? bc[0] : T ? T[0] : walkView.pl.x,
      fz = bc ? bc[1] : T ? T[1] : walkView.pl.z;
    updateNearRing(sc.groundOf || sc, fx, fz, Math.min(PREP_BUDGET_MS, Math.max(1, frameBudgetRemaining())));
  }
  /* phase 20: the GPU counters (engine/gpu-counters.js) put each call that follows in the pass named last */
  gpuPass('other');
  let items = gatherFrameItems(st, C, PPU, C0);
  const hits = [],
    labels = [];
  if (BT) {
    items = items.filter(it => !(it.k === 'prop' && BT.hide && BT.hide.has(it.p)));
    for (const it of BT.items) items.push(it);
  } else walkView.hits = hits;
  cullItems(items, C);
  /* CH-1: the people in this frame, for the debug log (peopleReport); people are never culled (walk/quality-cull.js) */
  let people = 0;
  for (let i = 0; i < items.length; i++) if (personPicture(items[i].im)) people++;
  walkRenderer.people = people;
  coverItems(items, C, dt);
  const dark0 = sc.tint && sc.tint !== '#000000' ? 1 : sc.indoor ? 0.7 : 0,
    lk = engineContext.env && !sc.indoor ? environment.lampK : 0,
    dark = Math.max(dark0, lk > 0.4 ? lk : 0);
  /* shadow map (every other frame when the device is struggling) */
  const QE = Math.max(walkRenderer.q || 0, BT && (engineSetting('quality', 'battleLite') ?? true) ? 2 : 0);
  walkRenderer.qe = QE;
  let shadow = walkRenderer.lastShadow || null;
  if (!((walkView.R < 0.7 || QE >= 2) && walkRenderer.frames % 2 && shadow)) {
    shadow = shadowPass(items, sun, C);
    walkRenderer.lastShadow = shadow;
  }
  gpuPass('other');
  /* AIR-2: the fog grid round you (walk/fog-grid.js), kept up before the light so this frame's march and mist agree.
     AIR-3: when the light-in-air march reads it, fogit's low mist steps aside inside the grid (X.mistBox) */
  fogGridFrame(sc, P, BT, PHONE);
  const FGS = fogGridState(),
    fogK = engineSetting('air', 'fogVolume') ?? 1,
    fogOn = fogMarchOn({ grid: !!FGS, battle: !!BT, qe: QE, k: fogK }) && !(walkRenderer.dbg || {}).noPost,
    fogBox = fogOn ? fogGridBox(FGS.G) : null,
    fogSteps = FOG_MARCH_STEPS[PHONE ? 'phone' : 'full'];
  fogMarchNote(
    fogOn,
    fogOn ? 'on' : BT ? 'battle' : !FGS ? 'no grid' : QE >= 3 ? 'quality' : fogK <= 0.01 ? 'dial' : 'no post',
    fogOn ? fogSteps : 0
  );
  const X = walkLightContext(C, sun, dark, items, shadow, BT);
  if (fogBox) X.mistBox = [fogBox.cx, fogBox.cz, fogBox.r, 1];
  walkRenderer.X = X;
  if (dark > 0.3 && !BT && shadow) lampShadowMaps(items, X, dark);
  gpuPass('reflection');
  if (walkRenderer.water && !(QE >= 2 && walkRenderer.frames % 2 && gpuState.fb.refl))
    reflectionPass(items, C, rw, rh, X);
  gpuPass('sky');
  const S = renderTarget('scene', rw, rh, { depth: true, hdr: true });
  gl.bindFramebuffer(gl.FRAMEBUFFER, S.f);
  gl.viewport(0, 0, rw, rh);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const D = walkRenderer.dbg || {};
  /* phase 20 R2 (D1): with quality.skyLast the sky fills only what the opaque things left at the cleared depth (1.0),
     drawn after them and before anything blended (building fronts, water, effects); a room's front is blended over
     the ground, so a frame that shows one keeps the sky first */
  const skyLast =
      !!engineSetting('quality', 'skyLast') && !(sc.room && (engineSetting('lights', 'roomLight') ?? true) !== false),
    bpart = skyLast ? 'solid' : undefined;
  if (!skyLast) drawSky(C, sun);
  gpuPass('ground');
  drawGround(C, X);
  drawRoomFront(C, X);
  gpuPass('grass');
  if (walkRenderer.grass && !D.noGrass) drawGrass(C, X);
  gpuPass('sprites');
  drawSprites(C, items, X, hits, labels, PPU);
  gpuPass('solid');
  if (typeof drawSolidProps === 'function') drawSolidProps(C, items, X, hits, labels, PPU);
  gpuPass('models');
  if (typeof drawPropModels === 'function') drawPropModels(C, items, X, null, null, PPU);
  gpuPass('box');
  drawBoxFaces(C, items, X);
  gpuPass('buildings');
  if (typeof drawBuildings === 'function') drawBuildings(C, X, items, walkRenderer.bfade, bpart);
  gpuPass('structures');
  if (typeof drawStructures === 'function') drawStructures(C, X);
  if (skyLast) {
    gpuPass('sky');
    drawSky(C, sun, true);
  }
  if (bpart && typeof drawBuildings === 'function') {
    gpuPass('buildings');
    drawBuildings(C, X, items, walkRenderer.bfade, 'fronts');
  }
  gpuPass('silhouette');
  drawPlayerSilhouette(C, items, X);
  gpuPass('water');
  gatherFountainBasins(items);
  if (walkRenderer.water || walkRenderer.basin) drawWater(C, X, rw, rh);
  /* AIR-2: the fog grid's blocks from the debug menu */
  if (D.fogGrid) {
    gpuPass('other');
    drawFogGridBlocks(C);
  }
  gpuPass('effects');
  effectsPass(C, items, X, dark, t, dt);
  /* VFX-2: a thrown pyramid's motion lines (battle-3d.js) */
  if (BT && BT.ribbon) ribbonPass(C, BT.ribbon, X);
  /* VFX-5: a dashing Billie's (battle-3d.js) */
  if (BT && BT.rigRibbons) for (const R of BT.rigRibbons) ribbonPass(C, R, X);
  gpuPass('post');
  /* focus: on you, or on what you tapped for a moment */
  let fx = BT ? BT.center[0] : P.x,
    fz = BT ? BT.center[1] : P.z;
  if (!BT) {
    /* CAM-3: the focus follows the camera's moments: the middle of you and who you talk to, the encounter's spot
       while the camera swoops, a boss as it is revealed, else the spot you tapped (logic/lens-focus.js focusAim). It
       leans away from you over Engine > Lens > Focus moves in, measured from you so walking never leaves it behind */
    const ms = walkRenderer.momSpots,
      sw = walkRenderer.swoop,
      A = focusAim({
        px: P.x,
        pz: P.z,
        t: walkView.t,
        moment: walkRenderer.camInfo ? walkRenderer.camInfo.moment : null,
        talk: ms ? ms.talk : null,
        boss: ms ? ms.boss : null,
        swoop: sw && isFinite(sw.ex) && isFinite(sw.ez) ? sw : null,
        tap: walkRenderer.focusT,
      }),
      L0 = walkRenderer.focus == null || !walkRenderer.focusLean ? [A.x - P.x, A.z - P.z] : walkRenderer.focusLean;
    walkRenderer.focusLean = leanStep(L0, [A.x - P.x, A.z - P.z], dt, engineSetting('lens', 'focusEase') ?? 0.35);
    walkRenderer.focusKind = A.kind;
    fx = P.x + walkRenderer.focusLean[0];
    fz = P.z + walkRenderer.focusLean[1];
  }
  const fy = standingHeightAt(fx, fz) + 0.8,
    v = [fx - C.eye[0], fy - C.eye[1], fz - C.eye[2]],
    dir = normalize3([C.tgt[0] - C.eye[0], C.tgt[1] - C.eye[1], C.tgt[2] - C.eye[2]]),
    fd = v[0] * dir[0] + v[1] * dir[1] + v[2] * dir[2];
  /* CAM-1: the focus moves 12% of the way a frame at 60 fps, and as fast at any frame rate (was 12% of every frame) */
  walkRenderer.focus = BT
    ? BT.focus
    : walkRenderer.focus == null
      ? fd
      : walkRenderer.focus + (fd - walkRenderer.focus) * (1 - Math.pow(0.88, dt * 60));
  /* CAM-3: the plane of focus through that point, leaning by Engine > Lens > Tilt of the sharp zone (0: facing the
     camera, as before); battles keep the slab */
  const tilt = BT ? 0 : engineSetting('lens', 'focusTilt') || 0,
    FP = BT || !C.ivp ? null : focusPlane(C, [fx, fy, fz], walkRenderer.focus, tilt);
  walkRenderer.lensPlane = FP;
  let LF = null;
  if (D.noPost) {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, S.f);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.blitFramebuffer(0, 0, rw, rh, 0, 0, rw, rh, gl.COLOR_BUFFER_BIT, gl.NEAREST);
  } else
    LF = drawPostEffects(S, C, walkRenderer.focus, rw, rh, {
      /* CAM-3: times the player's blur slider (Settings → Graphics → Blur), in battles too */
      /* CAM-4b: times the zoom stops' blur at the zoom (walk/camera.js), not in battles */
      blur:
        (BT
          ? BT.blur
          : sc.plain || graphicsOff()
            ? 0
            : (sc.blur ?? 1) * (walkView.opt.blur ?? 1) * (walkRenderer.zoomBlur ?? 1)) * playerBlur(),
      fast: walkView.R < 0.75 || QE >= 1,
      noAO: QE >= 1,
      noRays: QE >= 3,
      bloomN: QE >= 3 ? 3 : 5,
      cheapDof: QE >= 4 /* CAM-3: a cheap blur on the slowest setting, not none */,
      /* the sharp zone and the blur's growth in metres as if the camera stood 16 m off, whatever the zoom: measured
         from the real distance (36 m at zoom 1, 58 m at 1.6) the blur only built up past the edge of the place */
      dofRef: BT ? null : 16,
      dofView: !!walkView.opt.dofView /* CAM-3: the Studio's blur heatmap */,
      plane: FP && tilt > 0 ? [FP.g[0], FP.g[1], FP.g[2], FP.h] : null /* (tilt 0: the old slab, to the bit) */,
      heat: heatHaze(sc),
      heatS: heatSources(C),
      mood: easedMood(sc),
      sun: sc.indoor ? null : litSunScreenPosition(C, sun),
      sunCol: engineSetting('sun', 'followLight') ? sun.col : null,
      X,
      ivp: C.ivp,
      noVol: QE >= 3 || (!!sc.indoor && !dark),
      /* air track AIR-4: shade in the near haze, outdoors and not in battles (they keep fogit as it is) */
      hazeShade: BT || sc.indoor ? 0 : (engineSetting('air', 'hazeShade') ?? 0),
      volDens: sc.indoor ? 0.5 : 1 + (engineContext.env ? environment.fog * 1.5 + environment.rain * 0.4 : 0),
      airLamps: PHONE ? 4 : 6,
      fog: fogOn
        ? { tex: FGS.tex, G: FGS.G, B: fogBox, k: fogK, lk: engineSetting('air', 'fogLamps') ?? 1, steps: fogSteps }
        : null,
      impact: BT && BT.impact ? impactOnScreen(C, BT.impact) : null,
      caPulse: BT ? BT.caPulse || 0 : 0,
    });
  /* CAM-3: what the blur did this frame, for the debug log, the Studio's blur guides and the checks (no names) */
  walkRenderer.lensInfo = {
    path: LF ? LF.path : 'off',
    on: BT ? 'battle' : walkRenderer.focusKind,
    focus: Math.round(walkRenderer.focus * 100) / 100,
    at: [Math.round(fx * 100) / 100, Math.round(fz * 100) / 100],
    tilt,
    blur: LF ? Math.round(LF.scale * 100) / 100 : 0,
    slider: playerBlur(),
    spread: !!(LF && LF.nearSpread) /* lens.nearSpread: the blur in front spread over what is behind it */,
  };
  gpuPass('other');
  /* labels and markers stay sharp on the layer above */
  const x = walkView.x;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, rw, rh);
  /* phase 13: the debug log's picture is taken from this layer, and speech can name a Billie (the buddy says its
     nickname): in that frame speech is drawn after the picture */
  const snapping = walkRenderer.snapReq && typeof debugLog !== 'undefined',
    sayLater = [];
  if (!BT && !(walkView.opt.active && !walkView.opt.active())) {
    drawExitMarks(C, st, t);
    drawTapMark(C, t);
    if (typeof worldBillyLabels === 'function' && !BT) worldBillyLabels(C, labels);
    for (const l of labels) {
      if (l.k === 'enc') drawLevelTag(x, l.x, l.y, l.e);
      else if (l.k === 'bang') drawBubble(x, l.x, l.y, '!', l.col);
      else if (l.k === 'say') {
        if (snapping) sayLater.push(l);
        else drawSpeech(x, l.x, l.y, l.t, l.a);
      } else if (l.k === 'act' && l.y > rh * 0.1)
        drawLabelPill(
          x,
          l.x,
          l.y,
          l.t,
          l.act === 'clinic'
            ? '#E8607A'
            : l.act === 'shop' || l.act === 'stall'
              ? '#4E9BE0'
              : l.act === 'closed'
                ? '#7E7888'
                : '#8E6CCB'
        );
    }
    drawExitLabels(C, st, hits, mapHub(sc));
    drawWalkMark(C, t, labels);
  }
  /* v28: a picture as it is drawn (before the browser clears it), for the Studio's engine editor */ if (
    walkRenderer.photoReq
  ) {
    const cb = walkRenderer.photoReq;
    walkRenderer.photoReq = null;
    try {
      cb(screenSnapshot(rw, rh, null, 2048));
    } catch (e) {
      cb(null);
    }
  }
  if (walkRenderer.snapReq && typeof debugLog !== 'undefined') {
    walkRenderer.snapReq = 0;
    try {
      const c = screenSnapshot(rw, rh, walkRenderer.ui);
      debugLog.shot = { t: debugLog.now(), what: walkView.id, jpeg: c.toDataURL('image/jpeg', 0.72) };
    } catch (e) {
      debugLog.shot = { t: debugLog.now(), error: String(e.message || e) };
    }
  }
  for (const l of sayLater) drawSpeech(x, l.x, l.y, l.t, l.a);
  walkRenderer.frames++;
  const work = performance.now() - w0;
  walkView.slow = walkView.slow * 0.9 + work * 0.1;
  adaptQuality(dtm, work);
  /* v30: how long frames take, for the debug log */ {
    const H = walkRenderer.hist || (walkRenderer.hist = [0, 0, 0, 0, 0, 0]);
    H[work < 8 ? 0 : work < 16 ? 1 : work < 33 ? 2 : work < 66 ? 3 : work < 133 ? 4 : 5]++;
  }
  if (typeof frameCount === 'function' && walkView.opt.meter) frameCount(work);
}
/* the sun's place on screen for the shafts and the glare; with Rays follow the light (sun.followLight) its strength
   fades with the night, so the moon gives no full-strength warm glare */
/* VFX-4: the battle's impact frame for the grade pass: [u, v, mode, age] and [lines, seed, warm]; the hit point on
   screen (off screen, the lines still come from where it would be) */
function impactOnScreen(C, I) {
  const p = I.p,
    m = C.vp,
    y = p[1] + worldCurveDrop(p[0], p[2]),
    x = m[0] * p[0] + m[4] * y + m[8] * p[2] + m[12],
    yy = m[1] * p[0] + m[5] * y + m[9] * p[2] + m[13],
    w = m[3] * p[0] + m[7] * y + m[11] * p[2] + m[15];
  const uv = w > 0.01 ? [(x / w) * 0.5 + 0.5, (yy / w) * 0.5 + 0.5] : [0.5, 0.5];
  return { a: [uv[0], uv[1], I.mode, I.age], b: [I.n, I.seed, I.warm ? 1 : 0, 0] };
}
function litSunScreenPosition(C, sun) {
  const sp = sunScreenPosition(C, sun.dir, 300);
  if (!sp || !engineSetting('sun', 'followLight') || !engineContext.env) return sp;
  sp[2] *= 1 - 0.85 * (environment.night || 0);
  return sp;
}
