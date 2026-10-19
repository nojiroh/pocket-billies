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
  SOLID_PROP_SHADERS,
  drawBuildings,
  drawPropModels,
  drawSolidProps,
  drawStructures,
  lifeStep,
  noWebGL,
  propModelShaders,
  provide,
  seamlessLookTick,
  seamlessPrepareAhead,
  worldBillyLabels,
} from './hooks.js';
import { gpuPass } from './engine/gpu-counters.js';
import { frameCount, frameTask, userFps } from './frame-scheduler.js';
import {
  drawBubble,
  drawExitLabels,
  drawExitMarks,
  drawLabelPill,
  drawLevelTag,
  drawSpeech,
  drawTapMark,
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
import { PLAIN_LOOK, beginFrameSettings, endFrameSettings, engineContext, engineSetting } from './engine/settings.js';
import {
  beginGpuTimer,
  endGpuTimer,
  ensurePrograms,
  gpuLoading,
  gpuState,
  initWebgl,
  normalize3,
  pollPendingPrograms,
  precompilePrograms,
  renderTarget,
  runNormalMapJobs,
  setFrameBlockMode,
  smooth01,
  trimTextures,
  webgl2Supported,
} from './engine/webgl.js';
import { sunLight } from './engine/light.js';
import { POST_EFFECT_SHADERS, drawPostEffects, screenSnapshot, sunScreenPosition } from './engine/post-effects.js';
import { environment, environmentFrame } from './environment.js';
import { PREP_BUDGET_MS, walkRenderer } from './walk/walk-state.js';
import { standingHeightAt } from './walk/heights.js';
import { WALK_SHADERS } from './walk/walk-shaders.js';
import { worldCurveDrop } from './walk/draw-common.js';
import { groundOcclusionWork } from './walk/ground-textures.js';
import { buildFarProps, buildGrass, grassWork } from './walk/grass-build.js';
import { MAP_CACHE_FIELDS, groundPrepWork, mapCacheKey, swapMapCache, updateNearRing } from './walk/map-cache.js';
import { adaptQuality, cullItems, easedMood, heatHaze, heatSources } from './walk/quality-cull.js';
import { drawSky } from './walk/sky.js';
import { drawRoomFront } from './walk/rooms.js';
import { drawWater, reflectionPass } from './walk/water.js';
import { gatherFrameItems } from './walk/frame-items.js';
import { drawBoxFaces, drawSprites } from './walk/sprites.js';
import { battleCamera, cutsceneCamera, screenRay, walkCamera } from './walk/camera.js';
import { mapSun, walkLightContext } from './walk/lighting.js';
import { lampShadowMaps, shadowPass } from './walk/shadows.js';
import { drawGrass, drawGround } from './walk/ground-draw.js';
import { gatherFountainBasins } from './walk/fountains-weather.js';
import { effectsPass } from './walk/effects.js';
import { bindGestures, handleCanvasClick } from './walk/input.js';
/* eslint-disable no-func-assign */
expose({
  baseStopWalkView: [() => baseStopWalkView],
  canvasForContext: [() => canvasForContext, v => (canvasForContext = v)],
  drawWalkFrame: [() => drawWalkFrame, v => (drawWalkFrame = v)],
  drawWalkFrameInner: [() => drawWalkFrameInner, v => (drawWalkFrameInner = v)],
  ensureLitPrograms: [() => ensureLitPrograms, v => (ensureLitPrograms = v)],
  ensureWalkGl: [() => ensureWalkGl, v => (ensureWalkGl = v)],
  labelLayer: [() => labelLayer, v => (labelLayer = v)],
  mountWalkView: [() => mountWalkView, v => setMountWalkView(v)],
  onGlContextRestored: [() => onGlContextRestored, v => ((onGlContextRestored = v), provide({ onGlContextRestored }))],
  screenToGround2d: [() => screenToGround2d],
  setMountWalkView: [() => setMountWalkView, v => (setMountWalkView = v)],
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
  if (walkView.id !== id) {
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
      walkView.ready = true;
      frameTask('dio', drawWalkFrame, () => (walkView.opt.cap ? walkView.opt.cap() : userFps()));
      cv.classList.add('in');
    })
    .catch(e => {
      walkView.err = e;
      console.error(e);
    });
}
/* phase 04d: the Studio swaps in its own (studio/js/engine-editor.js and viewport.js) */
export function setMountWalkView(v) {
  mountWalkView = v; // eslint-disable-line no-func-assign
  provide({ mountWalkView });
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
  setFrameBlockMode(engineSetting('quality', 'frameBlock'));
  try {
    ensurePrograms(WALK_SHADERS);
    ensurePrograms(POST_EFFECT_SHADERS);
    for (const d of [
      typeof BUILDING_SHADERS !== 'undefined' && BUILDING_SHADERS,
      typeof SOLID_PROP_SHADERS !== 'undefined' && SOLID_PROP_SHADERS,
      typeof propModelShaders === 'function' && propModelShaders(),
    ])
      if (d)
        precompilePrograms(
          d
        ); /* alpha 0.4: the low-poly props' too (they were built on first use, in the first place with props) */
  } catch (e) {
    console.error(e);
    gpuState.fail = 1;
    if (typeof debugLog !== 'undefined') debugLog.add('webgl', 'shader failed: ' + e.message);
    return false;
  }
  walkRenderer.gkey = '';
  walkRenderer.farKey = '';
  walkRenderer.sceneCache = null;
  walkRenderer.wtex = null;
  for (const k of MAP_CACHE_FIELDS) walkRenderer[k] = null;
  return true;
}
/* every program with the light code, now (the Frame block was switched; a few frames' stall, only when it is) */
function ensureLitPrograms() {
  for (const d of [
    WALK_SHADERS,
    POST_EFFECT_SHADERS,
    typeof BUILDING_SHADERS !== 'undefined' && BUILDING_SHADERS,
    typeof SOLID_PROP_SHADERS !== 'undefined' && SOLID_PROP_SHADERS,
    typeof propModelShaders === 'function' && propModelShaders(),
  ])
    if (d) ensurePrograms(d);
}
function onGlContextRestored(cv) {
  if (walkView.id && walkView.cv === cv) {
    const id = walkView.id;
    walkView.id = null;
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
  runNormalMapJobs(walkView.warm ? 40 : 3);
  pollPendingPrograms(1);
  groundOcclusionWork();
  groundPrepWork(walkRenderer.bt ? 0 : PREP_BUDGET_MS);
  const cssW = cv.clientWidth,
    cssH = cv.clientHeight;
  if (!cssW || !cssH) return;
  const R0 = Math.min(devicePixelRatio || 1, 1.75) * engineSetting('quality', 'resolution'),
    R = R0 * Math.min(1, Math.sqrt(1.6e6 / (cssW * cssH * R0 * R0))) * walkView.R,
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
  engineContext.env = !sc.plain && typeof environment !== 'undefined' && (environment.on || !!environment.force);
  if (engineContext.env) environmentFrame(sc, dt);
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
  /* phase 20 C3: the Frame block switched on or off: the lit programs compile again in the new mode, here */
  if (setFrameBlockMode(engineSetting('quality', 'frameBlock'))) ensureLitPrograms();
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
  const C = BT ? (BT.look ? cutsceneCamera(rw, rh, BT.look) : battleCamera(rw, rh, BT)) : walkCamera(rw, rh, st, dt);
  walkView.C = C;
  const sun = mapSun(sc, sunLight(!!sc.indoor));
  walkRenderer.sun = sun;
  /* v46: the near ring follows the camera's focus (in a battle, the stage) */
  {
    const bc = BT && (BT.center || (BT.look && [BT.look.tgt[0], BT.look.tgt[2]])),
      T = walkRenderer.camT;
    const fx = bc ? bc[0] : T ? T[0] : walkView.pl.x,
      fz = bc ? bc[1] : T ? T[1] : walkView.pl.z;
    updateNearRing(sc, fx, fz, PREP_BUDGET_MS);
  }
  walkRenderer.budT = performance.now();
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
  const X = walkLightContext(C, sun, dark, items, shadow, BT);
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
  drawSky(C, sun, 0);
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
  if (typeof drawBuildings === 'function') drawBuildings(C, X, items, walkRenderer.bfade);
  gpuPass('structures');
  if (typeof drawStructures === 'function') drawStructures(C, X);
  gpuPass('water');
  gatherFountainBasins(items);
  if (walkRenderer.water || walkRenderer.basin) drawWater(C, X, rw, rh);
  gpuPass('effects');
  effectsPass(C, items, X, dark, t, dt);
  gpuPass('post');
  /* focus: on you, or on what you tapped for a moment */
  let fx = BT ? BT.center[0] : P.x,
    fz = BT ? BT.center[1] : P.z;
  const ft = BT ? null : walkRenderer.focusT;
  if (ft && walkView.t - ft.t < 2600) {
    const kf = smooth01((walkView.t - ft.t) / 350) * (1 - smooth01((walkView.t - ft.t - 1800) / 800));
    fx = P.x + (ft.x - P.x) * kf;
    fz = P.z + (ft.z - P.z) * kf;
  }
  const fy = standingHeightAt(fx, fz) + 0.8,
    v = [fx - C.eye[0], fy - C.eye[1], fz - C.eye[2]],
    dir = normalize3([C.tgt[0] - C.eye[0], C.tgt[1] - C.eye[1], C.tgt[2] - C.eye[2]]),
    fd = v[0] * dir[0] + v[1] * dir[1] + v[2] * dir[2];
  walkRenderer.focus = BT
    ? BT.focus
    : walkRenderer.focus == null
      ? fd
      : walkRenderer.focus + (fd - walkRenderer.focus) * 0.12;
  if (D.noPost) {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, S.f);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.blitFramebuffer(0, 0, rw, rh, 0, 0, rw, rh, gl.COLOR_BUFFER_BIT, gl.NEAREST);
  } else
    drawPostEffects(S, C, walkRenderer.focus, rw, rh, {
      blur: BT ? BT.blur : sc.plain ? 0 : (sc.blur ?? 1) * (walkView.opt.blur ?? 1) * (st.focusY != null ? 0.6 : 1),
      fast: walkView.R < 0.75 || QE >= 1,
      noAO: QE >= 1,
      noRays: QE >= 3,
      bloomN: QE >= 3 ? 3 : 5,
      noDof: QE >= 4,
      /* the sharp zone and the blur's growth in metres as if the camera stood 16 m off, whatever the zoom: measured
         from the real distance (36 m at zoom 1, 58 m at 1.6) the blur only built up past the edge of the place */
      dofRef: BT ? null : 16,
      heat: heatHaze(sc),
      heatS: heatSources(C),
      mood: easedMood(sc),
      sun: sc.indoor ? null : sunScreenPosition(C, sun.dir, 300),
      X,
      ivp: C.ivp,
      noVol: QE >= 3 || (!!sc.indoor && !dark),
      volDens: sc.indoor ? 0.5 : 1 + (engineContext.env ? environment.fog * 1.5 + environment.rain * 0.4 : 0),
    });
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
          l.act === 'clinic' ? '#E8607A' : l.act === 'shop' ? '#4E9BE0' : l.act === 'closed' ? '#7E7888' : '#8E6CCB'
        );
    }
    drawExitLabels(C, st, hits, mapHub(sc));
  }
  /* v28: photo mode asks for the picture as it is drawn (before the browser clears it) */ if (walkRenderer.photoReq) {
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
