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
  LIFE_KIND,
  SOLID_PROP_PARTS,
  SOLID_PROP_SHADERS,
  ambientLife,
  buildingFrontPicture,
  buildingGuard,
  buildingState,
  buildingsOn,
  chimneySmoke,
  clueDraw,
  drawBuildingShadows,
  drawBuildings,
  drawPropModelShadows,
  drawPropModels,
  drawSolidPropShadows,
  drawSolidProps,
  drawStructureShadows,
  drawStructures,
  frontWindowLight,
  lifeStep,
  litWindowFraction,
  noWebGL,
  propModelShaders,
  provide,
  reducedMotion,
  saveData,
  seamlessLookTick,
  stampDraw,
  worldBillies,
  worldBillyGlows,
  worldBillyLabels,
} from './hooks.js';
import { clamp } from './util.js';
import { gpuPass } from './engine/gpu-counters.js';
import { frameCount, frameTask, userFps } from './frame-scheduler.js';
import { hexToRgb } from './art.js';
import {
  EFFECT_FRAMES,
  GROUND_BORDER_M,
  artImage,
  canvasPoint,
  drawBubble,
  drawExitLabels,
  drawExitMarks,
  drawLabelPill,
  drawLevelTag,
  drawSpeech,
  drawTapMark,
  ensureGround,
  handleWalkClick,
  hash2d,
  hitAt,
  isWalkable,
  mapById,
  mapHub,
  navGrid,
  prepareMap,
  screenToGround,
  setScreenToGround,
  setStopWalkView,
  setWorldToScreen,
  stopWalkView,
  terrainAt,
  updateFolk,
  updatePlayer,
  walkData,
  walkView,
  worldToScreen,
} from './walk-view.js';
import { PLAIN_LOOK, engineColor, engineContext, engineSetting } from './engine/settings.js';
import {
  beginGpuTimer,
  bindQuad,
  endGpuTimer,
  ensurePrograms,
  freeMesh,
  gpuLoading,
  gpuState,
  imageTexture,
  initWebgl,
  normalize3,
  pollPendingPrograms,
  precompilePrograms,
  renderTarget,
  runNormalMapJobs,
  smooth01,
  trimTextures,
  uploadMesh,
  webgl2Supported,
  windGustAt,
} from './engine/webgl.js';
import { beginLampShadow, beginSunShadow, endShadow, lightContext, pickPointLights, sunLight } from './engine/light.js';
import { POST_EFFECT_SHADERS, drawPostEffects, screenSnapshot, sunScreenPosition } from './engine/post-effects.js';
import { environment, environmentFrame, environmentSky, environmentWindowLit } from './environment.js';
import { FIXED_RIGHT, PREP_BUDGET_MS, walkRenderer } from './walk/walk-state.js';
import { WALL_COLORS, defaultWallMaterial, standingHeightAt } from './walk/heights.js';
import { WALK_SHADERS } from './walk/walk-shaders.js';
import { setSpriteUniforms, useWalkProgram, worldCurveArgs, worldCurveDrop } from './walk/draw-common.js';
import { setShoreUniforms } from './walk/water-data.js';
import { groundOcclusionWork } from './walk/ground-textures.js';
import { buildFarProps, buildGrass, grassWork } from './walk/grass-build.js';
import {
  MAP_CACHE_FIELDS,
  groundPrepWork,
  mapCacheKey,
  setNearRingUniforms,
  swapMapCache,
  updateNearRing,
} from './walk/map-cache.js';
import {
  adaptQuality,
  computeFrustum,
  cullItems,
  easedMood,
  heatHaze,
  heatSources,
  inFrustum,
} from './walk/quality-cull.js';
import { drawSky, skyColors } from './walk/sky.js';
import { drawRoomEffects, drawRoomFront, roomBoxOf, roomLights, roomSkyLight, windowLightShare } from './walk/rooms.js';
import { addRipple, drawWater, reflectionPass, waterAt } from './walk/water.js';
import { gatherFrameItems } from './walk/frame-items.js';
import { drawBoxFaces, drawSprites } from './walk/sprites.js';
import {
  battleCamera,
  cameraTurnLimit,
  clampZoom,
  cutsceneCamera,
  freeCameraOn,
  screenRay,
  walkCamera,
} from './walk/camera.js';
/* eslint-disable no-func-assign */
expose({
  FLOWER_COLORS: [() => FLOWER_COLORS],
  FLOWER_SET_BY_LOCATION: [() => FLOWER_SET_BY_LOCATION],
  FOOTPRINT_COLORS: [() => FOOTPRINT_COLORS],
  GRASS_PUSHER_BUFFER: [() => GRASS_PUSHER_BUFFER],
  addFootprint: [() => addFootprint, v => (addFootprint = v)],
  askDeviceTilt: [() => askDeviceTilt, v => (askDeviceTilt = v)],
  baseStopWalkView: [() => baseStopWalkView],
  bindGestures: [() => bindGestures, v => (bindGestures = v)],
  canvasForContext: [() => canvasForContext, v => (canvasForContext = v)],
  drawFootprints: [() => drawFootprints, v => (drawFootprints = v)],
  drawFountainEffects: [() => drawFountainEffects, v => (drawFountainEffects = v)],
  drawGrass: [() => drawGrass, v => setDrawGrass(v)],
  drawGround: [() => drawGround, v => setDrawGround(v)],
  drawLifeEffects: [() => drawLifeEffects, v => (drawLifeEffects = v)],
  drawShadowSprites: [() => drawShadowSprites, v => (drawShadowSprites = v)],
  drawWalkFrame: [() => drawWalkFrame, v => (drawWalkFrame = v)],
  drawWalkFrameInner: [() => drawWalkFrameInner, v => (drawWalkFrameInner = v)],
  drawWeather: [() => drawWeather, v => (drawWeather = v)],
  effectsPass: [() => effectsPass, v => setEffectsPass(v)],
  ensureWalkGl: [() => ensureWalkGl, v => (ensureWalkGl = v)],
  fittedShadowPass: [() => fittedShadowPass, v => (fittedShadowPass = v)],
  gatherFountainBasins: [() => gatherFountainBasins, v => (gatherFountainBasins = v)],
  grassPushers: [() => grassPushers, v => (grassPushers = v)],
  grassTrail: [() => grassTrail, v => (grassTrail = v)],
  handleCanvasClick: [() => handleCanvasClick, v => (handleCanvasClick = v)],
  labelLayer: [() => labelLayer, v => (labelLayer = v)],
  lampLit: [() => lampLit, v => (lampLit = v)],
  lampShadowMaps: [() => lampShadowMaps, v => (lampShadowMaps = v)],
  listenDeviceTilt: [() => listenDeviceTilt, v => (listenDeviceTilt = v)],
  mapFlowers: [() => mapFlowers, v => (mapFlowers = v)],
  mapSun: [() => mapSun, v => (mapSun = v)],
  mountWalkView: [() => mountWalkView, v => setMountWalkView(v)],
  onGlContextRestored: [() => onGlContextRestored, v => ((onGlContextRestored = v), provide({ onGlContextRestored }))],
  roomDimming: [() => roomDimming, v => (roomDimming = v)],
  screenToGround2d: [() => screenToGround2d],
  setMountWalkView: [() => setMountWalkView, v => (setMountWalkView = v)],
  shadowMapArea: [() => shadowMapArea, v => (shadowMapArea = v)],
  shadowPass: [() => shadowPass, v => setShadowPass(v)],
  updateBasinMeshes: [() => updateBasinMeshes, v => (updateBasinMeshes = v)],
  walkLightContext: [() => walkLightContext, v => (walkLightContext = v)],
  windowLit: [() => windowLit, v => (windowLit = v)],
  worldToScreen2d: [() => worldToScreen2d],
});
/* eslint-enable no-func-assign */
provide({ onGlContextRestored });
export function setDrawGrass(v) {
  drawGrass = v; // eslint-disable-line no-func-assign
  provide({ drawGrass });
}
export function setDrawGround(v) {
  drawGround = v; // eslint-disable-line no-func-assign
  provide({ drawGround });
}
export function setEffectsPass(v) {
  effectsPass = v; // eslint-disable-line no-func-assign
  provide({ effectsPass });
}
export function setShadowPass(v) {
  shadowPass = v; // eslint-disable-line no-func-assign
  provide({ shadowPass });
}
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
function handleCanvasClick(ev) {
  if (walkView.battle || walkView.director || !walkView.ready || (walkView.opt.active && !walkView.opt.active()))
    return;
  if (typeof saveData !== 'undefined') askDeviceTilt();
  if (walkRenderer.dragged) {
    walkRenderer.dragged = false;
    return;
  }
  const [sx, sy] = canvasPoint(ev),
    g = screenToGround(sx, sy);
  if (g) {
    walkRenderer.focusT = { x: g.x, z: g.z, t: walkView.t };
  }
  handleWalkClick(ev);
}
function bindGestures(cv) {
  const pts = new Map();
  let g0 = null;
  cv.addEventListener('pointerdown', ev => {
    pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      g0 = {
        d: Math.hypot(a[0] - b[0], a[1] - b[1]),
        yaw: walkRenderer.yawT,
        zoom: walkRenderer.zoomT,
        cx: (a[0] + b[0]) / 2,
      };
    }
    if (ev.button === 2 || ev.button === 1) {
      walkRenderer.drag = { x: ev.clientX, yaw: walkRenderer.yawT };
      ev.preventDefault();
    }
  });
  cv.addEventListener('pointermove', ev => {
    if (walkRenderer.drag) {
      walkRenderer.yawT = clamp(
        walkRenderer.drag.yaw + (ev.clientX - walkRenderer.drag.x) * 0.006,
        -cameraTurnLimit(),
        cameraTurnLimit()
      );
      walkRenderer.dragged = true;
      return;
    }
    if (!pts.has(ev.pointerId)) return;
    pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (pts.size === 2 && g0) {
      const [a, b] = [...pts.values()],
        d = Math.hypot(a[0] - b[0], a[1] - b[1]),
        cx = (a[0] + b[0]) / 2;
      walkRenderer.zoomT = clampZoom((g0.zoom * g0.d) / Math.max(20, d));
      walkRenderer.yawT = clamp(g0.yaw + (cx - g0.cx) * 0.006, -cameraTurnLimit(), cameraTurnLimit());
      walkRenderer.dragged = true;
    }
  });
  const up = ev => {
    pts.delete(ev.pointerId);
    if (pts.size < 2) g0 = null;
    if (walkRenderer.drag && (ev.button === 2 || ev.button === 1 || !ev.buttons)) walkRenderer.drag = null;
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener(
    'wheel',
    ev => {
      if (walkView.opt.active && !walkView.opt.active()) return;
      if (!ev.ctrlKey && !freeCameraOn()) return;
      ev.preventDefault();
      walkRenderer.zoomT = clampZoom(walkRenderer.zoomT * Math.exp(ev.deltaY * 0.0012));
    },
    { passive: false }
  );
  addEventListener('keydown', ev => {
    if (!walkRenderer.on || !walkView.cv || (walkView.opt.active && !walkView.opt.active())) return;
    if (freeCameraOn() && !(walkView.opt.keys && walkView.opt.keys())) return;
    const t = ev.target;
    if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
    if (ev.key === 'q' || ev.key === 'Q')
      walkRenderer.yawT = clamp(walkRenderer.yawT - 0.12, -cameraTurnLimit(), cameraTurnLimit());
    else if (ev.key === 'e' || ev.key === 'E')
      walkRenderer.yawT = clamp(walkRenderer.yawT + 0.12, -cameraTurnLimit(), cameraTurnLimit());
    else if (ev.key === 'r' || ev.key === 'R') {
      walkRenderer.yawT = 0;
      walkRenderer.zoomT = 1;
    }
  });
  addEventListener(
    'pointermove',
    ev => {
      if (ev.pointerType === 'mouse')
        walkRenderer.mouse = [ev.clientX / innerWidth - 0.5, ev.clientY / innerHeight - 0.5];
    },
    { passive: true }
  );
  listenDeviceTilt();
}
function listenDeviceTilt() {
  if (walkRenderer._tl) return;
  walkRenderer._tl = 1;
  addEventListener('deviceorientation', ev => {
    if (ev.beta == null) return;
    const p = (typeof saveData !== 'undefined' && saveData && saveData.preferences) || {};
    if (p.tilt === false) return;
    if (!walkRenderer.orient) walkRenderer.orient = { b: ev.beta, g: ev.gamma };
    const o = walkRenderer.orient;
    o.b += (ev.beta - o.b) * 0.01;
    o.g += (ev.gamma - o.g) * 0.01;
    walkRenderer.tiltX = clamp((ev.gamma - o.g) / 30, -1, 1);
    walkRenderer.tiltY = clamp((ev.beta - o.b) / 30, -1, 1);
  });
}
function askDeviceTilt() {
  if (walkRenderer._asked) return;
  walkRenderer._asked = 1;
  try {
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function'
    ) {
      const p = (saveData && saveData.preferences) || {};
      if (p.tilt === false) return;
      DeviceOrientationEvent.requestPermission().catch(() => {});
    }
  } catch (e) {}
}
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
    engineContext.env = false;
    endGpuTimer(gq);
  }
}
function drawWalkFrameInner(ts, dt, dtm, t, C0, PPU, rw, rh, w0) {
  if (typeof seamlessLookTick === 'function') seamlessLookTick();
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
/* the light context: sky ambient, fog, mist, shadows, contact shadows and the nearest lamps, windows and fires */
/* v43: the light that stands in for the sun in a room: daylight through the windows, from the front at a slant (roomSkyLight
   says how bright and from which side), so shadows fall into the room; it is what the shadow maps are drawn from too */
function mapSun(sc, sun) {
  if (!sc || !sc.room || (engineSetting('lights', 'roomLight') ?? true) === false) return sun;
  const Rk = roomSkyLight(),
    wd = normalize3([Rk.dx * 0.45, 0.6, -0.7]);
  return Object.assign({}, sun, {
    dir: wd,
    travel: [-wd[0], -wd[1], -wd[2]],
    col: Rk.c.map(
      v =>
        v *
        Math.max(0.25, Rk.I) *
        0.3 *
        (engineSetting('lights', 'windowLight') ?? 1) *
        engineSetting('sun', 'strength')
    ),
    indoor: true,
    room: true,
  });
}
/* v46: inside a building laid into the place (seamless-world.js seamlessRoomMap) the town around the room dims over 0.6 s; walking
   out it brightens again over 0.7 s, as your eyes adjust */
export function roomDimming(sc) {
  const now = performance.now(),
    k0 = engineSetting('world', 'roomDim') ?? 0.68;
  let R = sc.roomRect,
    k = 0;
  if (R) {
    if (walkRenderer.roomIn !== sc.id) {
      walkRenderer.roomIn = sc.id;
      walkRenderer.roomT0 = now;
      walkRenderer.roomLast = R;
      walkRenderer.roomOutT = 0;
    }
    k = smooth01((now - walkRenderer.roomT0) / 600);
  } else if (walkRenderer.roomIn) {
    walkRenderer.roomIn = null;
    walkRenderer.roomOutT = now;
  }
  if (!R && walkRenderer.roomOutT && walkRenderer.roomLast) {
    const t = (now - walkRenderer.roomOutT) / 700;
    if (t < 1) {
      R = walkRenderer.roomLast;
      k = (1 - smooth01(t)) * 0.7;
    } else walkRenderer.roomOutT = 0;
  }
  return R && k > 0 ? { b: [R[0], R[1], R[0] + R[2], R[1] + R[3]], dim: k0 * k } : null;
}
/* alpha 0.4: how far a lamp is on (0-1). Outdoors with the world's hours each lamp has its own moment as the light
   fails (environment.lampK: dusk, night, a grey storm, fog), so they come on one by one; in a dark place or a room, all on */
export function lampLit(x, z, dark) {
  const sc = walkView.sc,
    E = typeof environment !== 'undefined' && engineContext.env && !sc.indoor ? environment : null;
  if (!E || (sc.tint && sc.tint !== '#000000')) return dark ? 1 : 0;
  const th = 0.16 + 0.3 * hash2d(Math.round(x * 7), Math.round(z * 11));
  return Math.min(1, Math.max(0, (E.lampK - th) / 0.07));
}
/* an old (picture-only) house's window: lit at this hour or not (environment.js environmentWindowLit) */
function windowLit(x, z) {
  return typeof environmentWindowLit === 'function' && typeof environment !== 'undefined' && engineContext.env
    ? environmentWindowLit(x, z, environment.tod)
    : true;
}
function walkLightContext(C, sun, dark, items, shadow, BT) {
  const dark0L = dark;
  const sc = walkView.sc,
    t = walkView.t,
    R = C.right,
    P = BT ? { x: BT.center[0], z: BT.center[1] } : walkView.pl,
    lb = engineSetting('lights', 'brightness'),
    flick = engineSetting('lights', 'flicker'),
    winDay = engineSetting('lights', 'windowsDay');
  const L = [],
    ao = [],
    RR = sc.roomRect,
    dOut = RR && typeof environment !== 'undefined' && engineContext.env ? environment.lampK || 0 : 0;
  for (const it of items) {
    if (it.k !== 'prop' || it.far || it.layer) continue;
    const M = it.M,
      s = it.mpp,
      out = !!RR && (it.x < RR[0] || it.x > RR[0] + RR[2] || it.z < RR[1] || it.z > RR[1] + RR[3]),
      dark = out ? (dOut > 0.4 ? dOut : 0) : dark0L;
    if (!it.flat && it.sh > 0) {
      const box = M.box;
      ao.push(
        box
          ? [it.x, it.z + box[1] * 0.5 * (it.p.s || 1), box[0] * 0.62 * (it.p.s || 1), box[1] * 0.75 * (it.p.s || 1)]
          : [it.x, it.z, Math.max(0.25, it.sh * 0.62), Math.max(0.2, it.sh * 0.47)]
      );
    }
    const at = (fx, fy) => [it.x + R[0] * fx * s * it.flip, it.y - fy * s, it.z + R[2] * fx * s * it.flip];
    /* alpha 0.4: one light per lamp however many glasses it has (a four-lamp lantern took four of the sixteen lights and
     shone four times as bright, so lamps farther off got none), a pool of light on the ground under every lamp that hangs
     high, each lamp coming on at its own moment at dusk, and the windows' light as one soft pool in front of a house
     from its lit ground-floor windows (the upper floors' never reached the ground) */
    const fl = 1 - flick * 0.15 + flick * 0.15 * Math.sin(t / 170 + it.x * 3) * Math.sin(t / 97 + it.z),
      on = lampLit(it.x, it.z, dark),
      pk = (engineSetting('lights', 'pools') ?? 1) * lb,
      G = [],
      inRoom = !!sc.room && !out,
      E = it.bld3 && typeof buildingState !== 'undefined' ? buildingState.mesh.get(it.p) : null;
    let W = null;
    for (const e of M.fx || []) {
      if (e.k === 'fire')
        L.push({ p: at(e.x, e.y), r: 4.4, c: [1.7, 0.8, 0.32].map(v => v * fl * lb * (dark ? 1 : 0.6)) });
      else if (e.k === 'window' && !inRoom && !E) {
        const p = at(e.x, e.y);
        if (p[1] - it.y < 2.6 && windowLit(p[0], p[2])) (W || (W = [])).push(p);
      } else if (e.k === 'glow') G.push(at(e.x, e.y));
    }
    if (E && E.fw && !inRoom) {
      const lf = litWindowFraction();
      for (const f of E.fw) if (f[1] - it.y < 2.6 && frontWindowLight(f[3], lf)) (W || (W = [])).push(f);
    }
    const wk = inRoom ? 0 : dark ? 1 : winDay;
    if (W && wk > 0.01) {
      const n = W.length,
        fn = E ? E.fn : [0, -1],
        cx = W.reduce((a, q) => a + q[0], 0) / n,
        cz = W.reduce((a, q) => a + q[2], 0) / n;
      L.push({
        p: [cx + fn[0] * 0.5, it.y + 1.2, cz + fn[1] * 0.5],
        r: 2.4 + Math.min(1.6, n * 0.5),
        front: true,
        c: [1.1, 0.8, 0.45].map(v => v * Math.min(2, 0.7 + n * 0.35) * wk * lb * (dark ? 1 : 0.6)),
      });
    }
    if (G.length) {
      const n = G.length,
        k = on * (M.glowK ?? 1); /* alpha 0.1: a prop's own strength (scenery glowK) */
      if (k > 0.01) {
        const p = [0, 1, 2].map(i => G.reduce((a, q) => a + q[i], 0) / n);
        L.push({
          p,
          r: 3.6 + 0.35 * Math.min(3, n - 1),
          own: it.p,
          c: [1.3, 1.05, 0.7].map(v => v * Math.min(1.6, n) * fl * k * lb),
        });
        if (p[1] - it.y > 1.2 && pk > 0)
          L.push({
            p: [p[0], it.y + 0.35, p[2] + 0.05],
            r: Math.min(4.2, (p[1] - it.y) * 1.25),
            pool: 1,
            c: [1, 0.8, 0.52].map(v => v * 0.85 * k * pk * Math.min(1.3, n)),
          });
      }
    }
    if (M.glow && on > 0.01) {
      const c = hexToRgb(M.glow.c),
        p = [it.x, it.y + M.glow.y, it.z - 0.1];
      L.push({
        p,
        r: M.glow.r * 2.2,
        own: it.p,
        c: [(c[0] / 255) * 1.3, (c[1] / 255) * 1.3, (c[2] / 255) * 1.3].map(v => v * lb * on),
      });
      /* v34: a lamp up high also lays a pool of light on the ground under it after dark */
      if (M.glow.y > 1.2 && pk > 0)
        L.push({
          p: [it.x, it.y + 0.35, it.z + 0.05],
          r: Math.min(4.2, M.glow.y * 1.25),
          pool: 1,
          c: [(c[0] / 255) * 0.9 * pk * on, (c[1] / 255) * 0.78 * pk * on, (c[2] / 255) * 0.55 * pk * on],
        });
    }
  }
  for (const it of items)
    if (it.person || it.k === 'enc' || (it.k === 'life' && it.sh > 0))
      ao.push([it.x, it.z, it.aoR || 0.34, (it.aoR || 0.34) * 0.76]);
  if (BT) for (const l of BT.lights) L.push(l);
  ao.forEach(a => (a.d = Math.hypot(a[0] - P.x, a[1] - P.z)));
  ao.sort((a, b) => a.d - b.d);
  /* v26: dark caves (and the night) — you carry a lantern */
  const E = typeof environment !== 'undefined' && engineContext.env ? environment : null,
    cave = (sc.dark ?? (sc.indoor && sc.far === 'cave' ? 1 : 0)) * engineSetting('air', 'caveDark'),
    night = E ? E.night : 0,
    lan = Math.max(cave, night * 0.75);
  if (lan > 0.02) {
    const y = standingHeightAt(P.x, P.z) + 1.5;
    L.push({
      p: [P.x, y, P.z - 0.25],
      r: cave > 0.02 ? 6.8 : 5,
      c: [2.5, 1.95, 1.3].map(v => v * lan * (cave > 0.02 ? 1 : 0.55) * lb),
    });
  }
  roomLights(sc, L, lb);
  const lights = pickPointLights(L, P.x, P.z, 16),
    sky = skyColors(sc);
  let hz = hexToRgb(engineSetting('air', 'haze') || sc.haze || (sc.sky || [])[2] || '#EAD9C0').map(v => v / 255);
  if (E && !sc.indoor) hz = environmentSky([hz, hz, hz], false)[2];
  const tint = sc.tint && sc.tint !== '#000000' ? hexToRgb(sc.tint).map(v => 0.35 + (v / 255) * 1.3) : null;
  let ambTop = sc.indoor
      ? [0.62, 0.58, 0.52]
      : [0.3 + sky[0][0] * 0.24, 0.32 + sky[0][1] * 0.24, 0.36 + sky[0][2] * 0.28],
    ambBot = sc.indoor ? [0.38, 0.31, 0.25] : [0.3, 0.32, 0.24];
  /* v43: a room is lit by its windows: the daylight comes in from the front at a slant (roomSkyLight says how bright and from which side), warm walls and a dark floor make the ambient, no sun lobe; the lamps do the rest after dark */
  let roomSH = null;
  if (sc.room && (engineSetting('lights', 'roomLight') ?? true) !== false) {
    const Rk = roomSkyLight();
    const wc = sc.wallCol && sc.wallCol[0] ? hexToRgb(sc.wallCol[0]).map(v => v / 255) : [0.78, 0.7, 0.58];
    const wk = 0.3 + 0.2 * Math.max(0.25, Rk.I);
    ambTop = wc.map(v => v * wk);
    ambBot = [0.24, 0.19, 0.15];
    const hor = wc.map(v => v * wk * 0.85);
    roomSH = { top: ambTop, hor, gnd: ambBot };
  }
  if (E && !sc.indoor) {
    const nk = 1 - night * 0.5,
      gk = 1 + E.grey * 0.12;
    ambTop = ambTop.map((v, i) => v * nk * gk * (i === 2 ? 1 + night * 0.25 : 1));
    ambBot = ambBot.map((v, i) => v * nk * (i === 2 ? 1 + night * 0.2 : 1));
  }
  if (cave > 0) {
    const k = 1 - cave * 0.62;
    ambTop = ambTop.map(v => v * k);
    ambBot = ambBot.map(v => v * k);
    hz = hz.map(v => v * (1 - cave * 0.5));
    sun = Object.assign({}, sun, { col: sun.col.map(v => v * (1 - cave * 0.55)) });
  }
  const fogK = E && !sc.indoor ? (1 - E.fog * 0.45) * (1 - E.rain * 0.22) * (1 - E.snow * 0.3) * (1 - E.ash * 0.2) : 1;
  const ambHor = roomSH
    ? roomSH.hor
    : sc.indoor
      ? ambTop.map((v, i) => v * 0.9 + ambBot[i] * 0.1)
      : [0.3 + sky[2][0] * 0.26, 0.32 + sky[2][1] * 0.26, 0.34 + sky[2][2] * 0.26].map(
          (v, i) => v * (E ? 1 - night * 0.5 : 1)
        ); /* v43: the horizon's colour for the sky-shaped ambient */
  const RD = BT ? null : roomDimming(sc);
  return lightContext({
    roomB: RD ? RD.b : null,
    roomDim: RD ? RD.dim : 0,
    eye: C.eye,
    sun,
    ambTop,
    ambBot,
    ambHor,
    noSunLobe: !!roomSH,
    haze: hz,
    fogStart: C.df * engineSetting('air', 'hazeStart') * (E && !sc.indoor ? 1 - E.fog * 0.35 : 1),
    fogD: (engineSetting('air', 'hazeDistance') ?? (sc.hazeD || 34)) * 1.15 * fogK,
    tint,
    valley: walkRenderer.valley || null,
    mist: sc.mist != null ? sc.mist + (E && !sc.indoor ? E.fog * 0.18 : 0) : engineSetting('air', 'mist'),
    mistY: (walkRenderer.wlevel || 0) + engineSetting('air', 'mistHeight'),
    time: t,
    indoor: sc.indoor,
    lite: walkView.R < 0.75,
    shadow,
    lights,
    ao: ao.slice(0, 64).map(a => [a[0], a[1], a[2], a[3]]),
    curve: worldCurveArgs(),
    season: E ? E.sk : [0, 0, 0, 0],
  });
}
/* v19: the shadow map covers the ground the camera sees (plus a margin for tall things just outside), not the whole
   scene, so its texels are smaller where it matters; the radius moves in 2 m steps */
function shadowMapArea(C) {
  const sc = walkView.sc,
    full = [sc.w / 2, sc.h / 2, Math.hypot(sc.w, sc.h) / 2 + 6];
  if (!C || !engineSetting('shadows', 'fit')) return full;
  const P = walkView.pl,
    y0 = standingHeightAt(P.x, P.z),
    X = [],
    Z = [];
  for (const [sx, sy] of [
    [0, 0],
    [C.rw, 0],
    [0, C.rh],
    [C.rw, C.rh],
    [C.rw / 2, C.rh / 2],
  ]) {
    const r = screenRay(C, sx, sy);
    const t = r.d[1] < -0.02 ? Math.min(55, (y0 - r.o[1]) / r.d[1]) : 55;
    X.push(r.o[0] + r.d[0] * t);
    Z.push(r.o[2] + r.d[2] * t);
  }
  const x0 = Math.max(-6, Math.min(...X)),
    x1 = Math.min(sc.w + 6, Math.max(...X)),
    z0 = Math.max(-6, Math.min(...Z)),
    z1 = Math.min(sc.h + 6, Math.max(...Z));
  if (!(x1 > x0 && z1 > z0)) return full;
  const rad = Math.ceil((Math.hypot(x1 - x0, z1 - z0) / 2 + 6) / 2) * 2;
  return rad >= full[2] ? full : [(x0 + x1) / 2, (z0 + z1) / 2, Math.max(12, rad)];
}
/* v34: a shadow cache. Things that never move (the ground, buildings, rocks, still props) are drawn into a second
   depth map and kept there; each frame that copy is laid down first and only moving things (people, billionaires,
   swaying trees, boats) are drawn on top. The square the map covers moves in 3 m steps so the copy stays usable while
   you walk; the sun's slow travel or any change to the scene draws it again. */
/* v43: two cascades. The far map is the fitted view as before (cached for what never moves); the near map is a tight
   square round you at a finer texel, drawn every frame from the things in it, so shadows near you are crisp */
export function shadowPass(items0, sun, C) {
  gpuPass('shadowFar');
  const far = fittedShadowPass(items0, sun, C);
  if (
    !(engineSetting('shadows', 'cascades') ?? true) ||
    (walkRenderer.bt && (engineSetting('quality', 'battleLite') ?? true))
  )
    return far;
  const P = walkView.pl,
    R = engineSetting('shadows', 'nearRadius') ?? 13,
    res = Math.min(1024, engineSetting('quality', 'shadowMap')),
    gl = gpuState.gl,
    items = items0.filter(it => Math.hypot(it.x - P.x, it.z - P.z) < R + (it.w || 32) * (it.mpp || 0.03) + 3);
  gpuPass('shadowNear');
  const SH = beginSunShadow(P.x, P.z, R, sun, res, 'shadowN'),
    ca = worldCurveArgs();
  {
    const p = gpuState.P.shadowG;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
    gl.uniform3f(p.U.uCurve, ca[0], ca[1], ca[2]);
    gl.uniform1f(p.U.uCurveD0, ca[3]);
    gl.bindVertexArray(walkRenderer.mesh.vao);
    gl.drawElements(gl.TRIANGLES, walkRenderer.mesh.n, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }
  drawShadowSprites(SH, items, sun, ca);
  if (typeof drawBuildingShadows === 'function') drawBuildingShadows(SH, items);
  if (typeof drawStructureShadows === 'function') drawStructureShadows(SH);
  if (typeof drawSolidPropShadows === 'function') drawSolidPropShadows(SH, items);
  if (typeof drawPropModelShadows === 'function') drawPropModelShadows(SH, items);
  endShadow();
  SH.far = far;
  return SH;
}
/* v43: shadow maps for the two nearest lamps after dark (the ones that hang high: street lamps, lanterns, windows don't
   count). The lamps are moved to the front of the light list so the shader knows which they are. */
function lampShadowMaps(items, X, dark) {
  const n = Math.min(2, engineSetting('shadows', 'lampShadows') ?? 2);
  if (!n) return;
  const L = X.lights,
    P = walkView.pl,
    cand = L.filter(l => !l.front && l.p[1] > 1.6 && l.r >= 3 && Math.hypot(l.p[0] - P.x, l.p[2] - P.z) < 22).slice(
      0,
      n
    );
  if (!cand.length) return;
  X.lights = cand.concat(L.filter(l => !cand.includes(l)));
  X._lp = null;
  X._lc = null;
  X.lampSh = [];
  const gl = gpuState.gl,
    ca = worldCurveArgs();
  cand.forEach((l, i) => {
    gpuPass(i ? 'lamp1' : 'lamp0');
    const SH = beginLampShadow([l.p[0], l.p[1] + 0.2, l.p[2]], 512, 'lamp' + i),
      near = items.filter(
        it =>
          Math.hypot(it.x - l.p[0], it.z - l.p[2]) < 13 &&
          it.p !== l.own &&
          !(it.k === 'prop' && it.M && it.M.glow && Math.hypot(it.x - l.p[0], it.z - l.p[2]) < 0.6)
      ); /* alpha 0.4: nor its own post (it.p!==l.own): the lamp's picture turned black in its own light's shadow */
    {
      const p = gpuState.P.shadowG;
      gl.useProgram(p.p);
      gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
      gl.uniform3f(p.U.uCurve, ca[0], ca[1], ca[2]);
      gl.uniform1f(p.U.uCurveD0, ca[3]);
      gl.bindVertexArray(walkRenderer.mesh.vao);
      gl.drawElements(gl.TRIANGLES, walkRenderer.mesh.n, gl.UNSIGNED_INT, 0);
      gl.bindVertexArray(null);
    }
    drawShadowSprites(SH, near, null, ca, l.p);
    if (typeof drawBuildingShadows === 'function') drawBuildingShadows(SH, near);
    if (typeof drawSolidPropShadows === 'function') drawSolidPropShadows(SH, near);
    if (typeof drawPropModelShadows === 'function') drawPropModelShadows(SH, near);
    endShadow();
    X.lampSh.push(SH);
  });
}
/* the sprites of a shadow pass, each turned to face the sun (fixed ones and buildings as they stand); for a lamp, each turned to face the lamp */
function drawShadowSprites(SH, L, sun, ca, lamp) {
  const gl = gpuState.gl,
    p = gpuState.P.shadow,
    solid = engineSetting('shadows', 'buildings'),
    tr = sun ? sun.travel : [0, -1, 0],
    h = normalize3([tr[0], 0, tr[2]]),
    Rs0 = Math.hypot(tr[0], tr[2]) < 0.05 ? [1, 0, 0] : [-h[2], 0, h[0]];
  let Rs = Rs0;
  gl.useProgram(p.p);
  gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
  gl.uniform3f(p.U.uCurve, ca[0], ca[1], ca[2]);
  gl.uniform1f(p.U.uCurveD0, ca[3]);
  bindQuad();
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(p.U.uTex, 0);
  let miss = 0;
  for (const it of L) {
    if (it.flat || it.far || it.k === 'enc2' || it.vol || it.k === 'flag' || it.vox) continue;
    if (it.k === 'prop' && !(it.sh > 0)) continue;
    const T = imageTexture(it.im);
    if (!T) {
      miss++;
      continue;
    }
    gl.bindTexture(gl.TEXTURE_2D, T.t);
    if (it.layer && it.M.box) continue;
    if (lamp) {
      const dx = it.x - lamp[0],
        dz = it.z - lamp[2],
        l = Math.hypot(dx, dz);
      Rs = l < 0.3 ? Rs0 : [dz / l, 0, -dx / l];
    }
    if (it.bld3) {
      let F = null;
      buildingGuard(() => {
        F = imageTexture(buildingFrontPicture(it.im, it.M.build, it.M));
      });
      if (!F) miss++;
      if (F) {
        gl.bindTexture(gl.TEXTURE_2D, F.t);
        gl.uniform3fv(p.U.uRight, FIXED_RIGHT);
        setSpriteUniforms(p, it);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.uniform3fv(p.U.uRight, Rs);
      }
      continue;
    }
    if (it.plane && !(solid && it.M && it.M.box)) {
      gl.uniform3fv(p.U.uRight, FIXED_RIGHT);
      setSpriteUniforms(p, it);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.uniform3fv(p.U.uRight, Rs);
      continue;
    }
    if (solid && it.M && it.M.box) {
      gl.uniform3fv(p.U.uRight, [1, 0, 0]);
      const d = it.M.box[1] * (it.p.s || 1),
        n = 6;
      for (let i = 0; i < n; i++) {
        setSpriteUniforms(p, Object.assign({}, it, { z: it.z + (d * i) / (n - 1) }));
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      gl.uniform3fv(p.U.uRight, Rs);
      continue;
    }
    gl.uniform3fv(p.U.uRight, Rs);
    setSpriteUniforms(p, it);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  return miss;
}
function fittedShadowPass(items0, sun, C) {
  const sc = walkView.sc,
    res =
      walkView.R < 0.8 || (walkRenderer.q || 0) >= 2
        ? Math.min(1024, engineSetting('quality', 'shadowMap'))
        : engineSetting('quality', 'shadowMap'),
    gl = gpuState.gl;
  let fit = shadowMapArea(C);
  const cache = (engineSetting('quality', 'shadowCache') ?? true) && !walkRenderer.bt && !!gl.blitFramebuffer;
  if (cache) fit = [Math.round(fit[0] / 3) * 3, Math.round(fit[1] / 3) * 3, fit[2] + 3];
  const items = items0.filter(
    it => Math.hypot(it.x - fit[0], it.z - fit[1]) < fit[2] + (it.w || 32) * (it.mpp || 0.03) + 4
  );
  const SH = beginSunShadow(fit[0], fit[1], fit[2], sun, res);
  const ca = worldCurveArgs(),
    curve = P => {
      gl.uniform3f(P.U.uCurve, ca[0], ca[1], ca[2]);
      gl.uniform1f(P.U.uCurveD0, ca[3]);
    };
  const solid = engineSetting('shadows', 'buildings'),
    tr = sun.travel,
    h = normalize3([tr[0], 0, tr[2]]),
    Rs = Math.hypot(tr[0], tr[2]) < 0.05 ? [1, 0, 0] : [-h[2], 0, h[0]];
  const still = it => it.k === 'prop' && it.still && !it.vol,
    stat = cache ? items.filter(still) : items,
    dyn = cache ? items.filter(it => !still(it)) : [];
  const q = v => Math.round(v * 500);
  const key = cache
    ? [
        fit.join(','),
        q(tr[0]),
        q(tr[1]),
        q(tr[2]),
        res,
        walkView.id,
        stat.length,
        stat.length ? stat[0].x + stat[stat.length - 1].z : 0,
        walkRenderer.itemGen || 0,
        solid ? 1 : 0,
        walkRenderer.mesh && walkRenderer.mesh.n,
        sc.heights ? sc.heights.length : 0,
        typeof buildingsOn === 'function' && buildingsOn() ? 1 : 0,
        typeof buildingState !== 'undefined' ? buildingState.made || 0 : 0,
      ].join('|')
    : '';
  const SF = gpuState.fb.shadow;
  let hit = false;
  if (cache && walkRenderer.shKey === key && gpuState.fb.shadowS && gpuState.fb.shadowS.w === res) {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, gpuState.fb.shadowS.f);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, SF.f);
    gl.blitFramebuffer(0, 0, res, res, 0, 0, res, res, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, SF.f);
    hit = true;
    walkRenderer.shHit = (walkRenderer.shHit || 0) + 1;
  }
  let miss = 0;
  const sprites = L => {
    const p = gpuState.P.shadow;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
    curve(p);
    bindQuad();
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(p.U.uTex, 0);
    for (const it of L) {
      if (it.flat || it.far || it.k === 'enc2' || it.vol || it.k === 'flag' || it.vox) continue;
      if (it.k === 'prop' && !(it.sh > 0)) continue;
      const T = imageTexture(it.im);
      if (!T) {
        miss++;
        continue;
      }
      gl.bindTexture(gl.TEXTURE_2D, T.t);
      if (it.layer && it.M.box) continue;
      /* a 3D building: its front as a cut-out here, walls and roof as geometry below */
      if (it.bld3) {
        let F = null;
        buildingGuard(() => {
          F = imageTexture(buildingFrontPicture(it.im, it.M.build, it.M));
        });
        if (!F) miss++;
        if (F) {
          gl.bindTexture(gl.TEXTURE_2D, F.t);
          gl.uniform3fv(p.U.uRight, FIXED_RIGHT);
          setSpriteUniforms(p, it);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
          gl.uniform3fv(p.U.uRight, Rs);
        }
        continue;
      }
      if (it.plane && !(solid && it.M && it.M.box)) {
        gl.uniform3fv(p.U.uRight, FIXED_RIGHT);
        setSpriteUniforms(p, it);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.uniform3fv(p.U.uRight, Rs);
        continue;
      }
      if (solid && it.M && it.M.box) {
        /* a building: its front outline extruded through its depth, so the shadow has its true roof line */
        gl.uniform3fv(p.U.uRight, [1, 0, 0]);
        const d = it.M.box[1] * (it.p.s || 1),
          n = 6;
        for (let i = 0; i < n; i++) {
          setSpriteUniforms(p, Object.assign({}, it, { z: it.z + (d * i) / (n - 1) }));
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        gl.uniform3fv(p.U.uRight, Rs);
        continue;
      }
      gl.uniform3fv(p.U.uRight, Rs);
      setSpriteUniforms(p, it);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  };
  if (!hit) {
    let p = gpuState.P.shadowG;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
    curve(p);
    gl.bindVertexArray(walkRenderer.mesh.vao);
    gl.drawElements(gl.TRIANGLES, walkRenderer.mesh.n, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
    sprites(stat);
    if (typeof drawBuildingShadows === 'function') drawBuildingShadows(SH, stat);
    if (typeof drawStructureShadows === 'function') drawStructureShadows(SH);
    if (typeof drawPropModelShadows === 'function') drawPropModelShadows(SH, stat);
    if (cache) {
      const S2 = renderTarget('shadowS', res, res, { depthOnly: true });
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, SF.f);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, S2.f);
      gl.blitFramebuffer(0, 0, res, res, 0, 0, res, res, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, SF.f);
      gl.viewport(0, 0, res, res);
      walkRenderer.shKey = miss ? '' : key;
      walkRenderer.shMiss = (walkRenderer.shMiss || 0) + 1;
    }
  }
  if (cache) {
    sprites(dyn);
    if (typeof drawBuildingShadows === 'function') drawBuildingShadows(SH, dyn);
    if (typeof drawPropModelShadows === 'function') drawPropModelShadows(SH, dyn);
  }
  if (typeof drawSolidPropShadows === 'function') drawSolidPropShadows(SH, items);
  endShadow();
  return SH;
}
export function drawGround(C, X) {
  const gl = gpuState.gl,
    sc = walkView.sc,
    p = useWalkProgram('ground', C, X),
    U = p.U,
    P = GROUND_BORDER_M;
  const wa = imageTexture(artImage(walkData().sc.wallArt || 'scene/build/walls.png'), { noNormal: true });
  gl.activeTexture(gl.TEXTURE4);
  gl.bindTexture(gl.TEXTURE_2D, wa ? wa.t : gpuState.white);
  gl.uniform1i(U.uWallA, 4);
  if (!walkRenderer.wallColF) {
    walkRenderer.wallColF = new Float32Array(36);
  }
  const WC = sc.wallCol || [];
  for (let i = 0; i < 12; i++) {
    const c = WC[i] ? hexToRgb(WC[i]).map(v => v / 255) : WALL_COLORS[i];
    walkRenderer.wallColF.set(c, i * 3);
  }
  gl.uniform3fv(U.uWallCol, walkRenderer.wallColF);
  gl.uniform1f(U.uWallDef, defaultWallMaterial(sc));
  const Pq = walkRenderer.bt
    ? null
    : (() => {
        const P = walkView.pl,
          y = (P.yv ?? standingHeightAt(P.x, P.z)) + 0.9 + worldCurveDrop(P.x, P.z),
          m = C.vp,
          cx = m[0] * P.x + m[4] * y + m[8] * P.z + m[12],
          cy = m[1] * P.x + m[5] * y + m[9] * P.z + m[13],
          w = m[3] * P.x + m[7] * y + m[11] * P.z + m[15];
        return w > 0.2 ? [cx / w, cy / w, w] : null;
      })();
  gl.uniform3fv(U.uPlC, Pq || [9, 9, -1]);
  gl.uniform1f(U.uAspect, C.rw / C.rh);
  if (U.uFol) gl.uniform2f(U.uFol, 0.6, sc.indoor ? 0 : 1);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, walkRenderer.gtex);
  gl.uniform1i(U.uGround, 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, walkRenderer.ftex);
  gl.uniform1i(U.uFar, 1);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, walkRenderer.ctex);
  gl.uniform1i(U.uCliff, 2);
  gl.activeTexture(gl.TEXTURE3);
  gl.bindTexture(gl.TEXTURE_2D, walkRenderer.gntex || gpuState.flatN);
  gl.uniform1i(U.uGNrm, 3);
  gl.uniform1f(U.uGStr, engineSetting('world', 'groundBumps'));
  gl.uniform1f(U.uGShine, engineSetting('world', 'groundShine'));
  gl.uniform4f(U.uGRect, -P, sc.h + P, 1 / (sc.w + 2 * P), 1 / (sc.h + 2 * P));
  setShoreUniforms(U, sc);
  setNearRingUniforms(U, sc);
  if (U.uBed) gl.uniform3fv(U.uBed, engineColor('water', 'bed', '#74654A'));
  if (U.uGAO) {
    gl.activeTexture(gl.TEXTURE8);
    gl.bindTexture(gl.TEXTURE_2D, walkRenderer.gaoTex || gpuState.white);
    gl.bindSampler(8, null);
    gl.uniform1i(U.uGAO, 8);
    gl.uniform3f(U.uGAOR, 1 / sc.w, 1 / sc.h, walkRenderer.gaoTex ? (engineSetting('shadows', 'groundAO') ?? 1) : 0);
  }
  if (U.uWet) {
    const E = typeof environment !== 'undefined' && engineContext.env && !sc.indoor ? environment : null,
      sk = skyColors(sc);
    gl.uniform1f(U.uWet, E ? clamp((E.wet || 0) * (engineSetting('air', 'wetGround') ?? 1), 0, 1) : 0);
    gl.uniform1f(U.uRainK, E ? Math.min(1, E.rain || 0) : 0);
    gl.uniform3fv(U.uSkyW, sk[1]);
    gl.uniform1f(U.uCausW, engineSetting('water', 'wallLight') ?? 1);
  }
  if (U.uRoom) {
    const B = sc.room && (engineSetting('lights', 'roomLight') ?? true) !== false ? roomBoxOf(sc) : null;
    gl.uniform4f(U.uRoom, B ? B[0] : 0, B ? B[1] : 0, B ? B[2] : 0, B ? 1 : 0);
    if (U.uRoomY) gl.uniform1f(U.uRoomY, B ? standingHeightAt(sc.w / 2, 1.5) : 0);
  }
  gl.uniform3fv(U.uFarTint, sc.farTint ? hexToRgb(sc.farTint).map(v => v / 200) : [1, 1, 1]);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.BLEND);
  gl.bindVertexArray(walkRenderer.mesh.vao);
  gl.drawElements(gl.TRIANGLES, walkRenderer.mesh.n, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}
/* where you walked through the grass lately (16 spots, the blades spring back over four seconds) */
function grassTrail() {
  const P = walkView.pl,
    t = walkView.t,
    T = walkRenderer.trail || (walkRenderer.trail = []);
  if (walkRenderer.trailId !== walkView.id) {
    T.length = 0;
    walkRenderer.trailId = walkView.id;
  }
  const last = T[T.length - 1];
  if (P.walk && (!last || Math.hypot(last.x - P.x, last.z - P.z) > 0.3)) {
    T.push({ x: P.x, z: P.z, t });
    if (T.length > 16) T.shift();
  }
  const a = new Float32Array(48),
    E = (walkRenderer.encPos || []).slice(0, 4),
    T2 = T.slice(-(16 - E.length));
  T2.forEach((q, i) => a.set([q.x, q.z, Math.max(0, 1 - (t - q.t) / 4000)], i * 3));
  E.forEach((e, k) => a.set([e[0], e[1], 0.85], (T2.length + k) * 3));
  return a;
}
/* who else parts the grass this frame (up to 8, nearest the player first): the buddy, the wild ones hiding in it, folk,
   and in a battle on the 3D stage the billionaires themselves */
const GRASS_PUSHER_BUFFER = new Float32Array(24);
function grassPushers() {
  const A = GRASS_PUSHER_BUFFER,
    P = walkView.pl,
    L = [];
  A.fill(0);
  if (walkRenderer.bt && walkRenderer.bt.items) {
    for (const it of walkRenderer.bt.items)
      if (it.k === 'rig') L.push([it.x, it.z, Math.max(0.45, (it.aoR || 0.4) * 1.3)]);
  } else {
    if (typeof worldBillies !== 'undefined' && worldBillies.bud) L.push([worldBillies.bud.x, worldBillies.bud.z, 0.6]);
    if (walkRenderer.encPos) for (const e of walkRenderer.encPos) L.push([e[0], e[1], 0.75]);
    for (const f of walkView.folk || []) if (Math.hypot(f.x - P.x, f.z - P.z) < 14) L.push([f.x, f.z, 0.5]);
  }
  L.sort((a, b) => Math.hypot(a[0] - P.x, a[1] - P.z) - Math.hypot(b[0] - P.x, b[1] - P.z));
  for (let i = 0; i < Math.min(8, L.length); i++) {
    A[i * 3] = L[i][0];
    A[i * 3 + 1] = L[i][1];
    A[i * 3 + 2] = L[i][2];
  }
  return A;
}
/* alpha 0.4: the flowers in a place's grass, by its character: daisies and clover by the towns, poppies and cornflowers
   in the meadows, heather on the hills, teal and pink in the Meadowlands, glowing caps in the Spore Forest */
const FLOWER_COLORS = {
  town: ['#F6F2E8', '#F8E27A', '#F2C4DA', '#FFFFFF'],
  meadow: ['#E8483C', '#5A7AE8', '#F6F2E8', '#F8D040'],
  hill: ['#B87AC8', '#9A5AB8', '#E2C8EE', '#F6F2E8'],
  pastel: ['#4FC8C0', '#F07AB0', '#7ADCD2', '#F6A8CC'],
  spore: ['#7AF0E0', '#C890F8', '#9AF4B0', '#F0A0F8'],
  warm: ['#F8D040', '#F08A3C', '#F6F2E8', '#E8483C'],
  cool: ['#8AB8F0', '#E8F0F8', '#B8A0E8', '#F6F2E8'],
};
const FLOWER_SET_BY_LOCATION = {
  twinpetal: 'pastel',
  fanfare_fields: 'pastel',
  petalfall: 'pastel',
  puffcap: 'spore',
  capshade: 'spore',
  hedgerow: 'meadow',
  tallgrass_meadow: 'meadow',
  old_fairway: 'meadow',
  kitewind: 'hill',
  hornpass: 'hill',
  frostcrown: 'cool',
  mirrormere: 'cool',
  grapevine_hills: 'warm',
  goldvine: 'warm',
  badlands: 'warm',
  saltpan_flats: 'warm',
  russetwood: 'warm',
  stepstone_canyon: 'warm',
  clovercrest: 'meadow',
};
function mapFlowers(sc) {
  const id = (sc && (sc.locationId || sc.baseId)) || '',
    k = FLOWER_SET_BY_LOCATION[id] || (sc && sc.kind === 'town' ? 'town' : 'meadow');
  return { c: FLOWER_COLORS[k].map(h => hexToRgb(h).map(v => v / 255)), glow: k === 'spore' ? 0.55 : 0 };
}
export function drawGrass(C, X) {
  const gl = gpuState.gl,
    p = useWalkProgram('grass', C, X),
    U = p.U,
    sc = walkView.sc,
    P = walkView.pl;
  if (U['uFlw[0]'] || U.uFlw) {
    const F = mapFlowers(sc),
      loc = U.uFlw || U['uFlw[0]'];
    gl.uniform3fv(loc, new Float32Array(F.c.flat()));
    gl.uniform1f(U.uFlwGlow, F.glow);
  }
  if (U.uTrail) gl.uniform3fv(U.uTrail, walkRenderer.bt ? new Float32Array(48) : grassTrail());
  if (U.uPush) gl.uniform3fv(U.uPush, grassPushers());
  gl.uniform3fv(U.uRight, C.right);
  gl.uniform3f(U.uPl, P.x, 0, P.z);
  gl.uniform1f(U.uT, reducedMotion ? 0 : walkView.t);
  gl.uniform1f(U.uWind, (sc.wind ?? 1) * engineSetting('grass', 'wind'));
  gl.uniform1f(U.uGust, engineSetting('grass', 'gusts'));
  gl.uniform1f(U.uBend, engineSetting('grass', 'bend'));
  gl.uniform1f(U.uHK, engineSetting('grass', 'height'));
  gl.uniform3f(U.uCut, C.eye[0], C.eye[2], walkRenderer.bt ? (walkRenderer.bt.cut ?? 3.2) : 0);
  const g = sc.grassCol || [engineSetting('grass', 'low'), engineSetting('grass', 'high')];
  gl.uniform3fv(
    U.uGlo,
    hexToRgb(g[0]).map(v => v / 255)
  );
  gl.uniform3fv(
    U.uGhi,
    hexToRgb(g[1]).map(v => v / 255)
  );
  if (U.uFol) gl.uniform2f(U.uFol, 0.75, 1);
  gl.disable(gl.CULL_FACE);
  const G = walkRenderer.grass;
  gl.bindVertexArray(G.vao);
  if (!G.chunks || !(engineSetting('quality', 'cull') ?? true)) {
    gl.bindBuffer(gl.ARRAY_BUFFER, G.ib);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, G.n);
  } else {
    const F = computeFrustum(C.vp),
      far = (walkRenderer.q || 0) >= 3 ? 38 : 1e9,
      Pp = walkView.pl;
    gl.bindBuffer(gl.ARRAY_BUFFER, G.ib);
    let drawn = 0;
    for (const c of G.chunks) {
      if (!inFrustum(F, c.x, c.y + worldCurveDrop(c.x, c.z), c.z, c.r)) continue;
      if (far < 1e9 && Math.hypot(c.x - Pp.x, c.z - Pp.z) > far) continue;
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, c.off * 32);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, c.off * 32 + 16);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, c.n);
      drawn += c.n;
    }
    walkRenderer.grassDrawn = drawn;
  }
  gl.bindVertexArray(null);
}
/* v31: water in fountains and wells. Each solid prop built from parts gets a disc of real water on every flat part (a
   basin), a jet from its top and a curtain spilling over each upper bowl into the one below, with splashes and rings */
function gatherFountainBasins(items) {
  const L = [];
  if (typeof SOLID_PROP_PARTS === 'undefined' || (engineSetting('water', 'fountains') ?? true) === false) {
    updateBasinMeshes(L);
    return;
  }
  for (const it of items) {
    if (it.k !== 'prop' || !it.vol || it.far || it.layer || !it.p) continue;
    const parts = (it.M && it.M.parts) || SOLID_PROP_PARTS[it.p.k];
    if (!parts) continue;
    const fl = parts.filter(q => q.k === 'flat' && q.r);
    if (!fl.length) continue;
    const s = it.mpp,
      f = it.flip || 1,
      X = px => it.x + (it.ox + px) * s * f,
      Y = py => it.y - (it.oy + py) * s;
    const B = fl
      .map(q => {
        const hw = (q.r[2] - q.r[0]) / 2,
          dd = q.d != null ? q.d / 2 : hw;
        return {
          x: X((q.r[0] + q.r[2]) / 2),
          y: Y(q.y ?? q.r[3]) + 0.012,
          z: it.z,
          rx: hw * s * 0.88,
          rz: Math.min(hw, dd) * s * 0.88,
        };
      })
      .sort((a, b) => b.y - a.y);
    const tp = parts.reduce((a, q) => (q.r && (!a || q.r[1] < a.r[1]) ? q : a), null),
      well = /well/.test(it.p.k + ' ' + ((it.M && it.M.group) || ''));
    if (well)
      for (const q of B) {
        q.y -= 0.16;
        q.rx *= 0.96;
        q.rz *= 0.96;
      }
    L.push({
      p: it.p,
      B,
      well,
      spout: !well && B.length > 1 && tp ? [X((tp.r[0] + tp.r[2]) / 2), Y(tp.r[1] + 2), it.z] : null,
    });
  }
  updateBasinMeshes(L);
}
function updateBasinMeshes(L) {
  const key =
    walkView.id +
    '|' +
    L.map(b => b.B.map(q => [q.x, q.y, q.z, q.rx].map(v => v.toFixed(2)).join(',')).join(';')).join('/');
  walkRenderer.basinL = L;
  walkRenderer.basinP = new Set(L.map(b => b.p));
  if (walkRenderer.basinKey === key) return;
  walkRenderer.basinKey = key;
  freeMesh(walkRenderer.basin);
  walkRenderer.basin = null;
  if (!L.length) return;
  const V = [],
    I = [],
    N = 40,
    RS = [
      [0, 0, 0.95],
      [0.55, 0.04, 0.85],
      [0.8, 0.3, 0.65],
      [0.93, 0.62, 0.45],
      [1, 0.95, 0.3],
    ];
  for (const b of L)
    for (const q of b.B) {
      const b0 = V.length / 8;
      for (let r = 0; r < RS.length; r++) {
        const [fr, sh, dp] = RS[r];
        for (let k = 0; k < (r ? N : 1); k++) {
          const a = (k / N) * Math.PI * 2;
          V.push(
            q.x + Math.cos(a) * q.rx * fr,
            q.y,
            q.z + Math.sin(a) * q.rz * fr,
            b.well ? sh * 0.5 : sh,
            0,
            0,
            b.well ? 1 : dp,
            b.well ? 2 : 0
          );
        }
      }
      const ring = r => (r ? b0 + 1 + (r - 1) * N : b0);
      for (let k = 0; k < N; k++) {
        const k1 = (k + 1) % N;
        I.push(b0, ring(1) + k, ring(1) + k1);
        for (let r = 1; r < RS.length - 1; r++) {
          const a0 = ring(r) + k,
            a1 = ring(r) + k1,
            c0 = ring(r + 1) + k,
            c1 = ring(r + 1) + k1;
          I.push(a0, c0, a1, a1, c0, c1);
        }
      }
    }
  walkRenderer.basin = uploadMesh(
    new Float32Array(V),
    new Uint32Array(I),
    [
      ['aPos', 3, 0],
      ['aShore', 1, 12],
      ['aUV', 2, 16],
      ['aDK', 2, 24],
    ],
    32
  );
}
function drawFountainEffects(quad, t, rm, dt) {
  const L = walkRenderer.basinL;
  if (!L || !L.length) return;
  const T = t * rm,
    col = [0.93, 0.98, 1];
  for (const b of L) {
    const B = b.B;
    if (b.well) {
      if (rm && Math.random() < dt * 0.25) {
        const q = B[0],
          a = Math.random() * 6.3,
          r = Math.random() * 0.5;
        addRipple(q.x + Math.cos(a) * q.rx * r, q.z + Math.sin(a) * q.rz * r, 0.35);
      }
      continue;
    }
    if (!b.spout) continue;
    const [sx, sy, sz] = b.spout,
      u = B[0],
      lo = B[B.length - 1],
      sd = sx * 3.1 + sz * 1.7;
    /* the jet: a thin rising column, then arcs falling back into the top bowl */
    for (let n = 0; n < 6; n++) {
      const ph = (T / 700 + n / 6) % 1;
      quad(
        'spray',
        n % 4,
        sx + Math.sin(n * 2.1 + sd) * 0.02,
        sy + ph * 0.32,
        sz,
        0.1,
        0.13,
        0.9 * (1 - ph * 0.4),
        col
      );
    }
    for (let k = 0; k < 7; k++) {
      const an = (k / 7) * Math.PI * 2 + sd;
      for (let n = 0; n < 7; n++) {
        const ph = (T / 900 + n / 7 + k * 0.13) % 1,
          r = u.rx * 0.62 * ph,
          y = sy + 0.3 + 0.12 * 4 * ph * (1 - ph) - (sy + 0.3 - u.y) * ph * ph;
        quad(
          'spray',
          (n + k) % 4,
          sx + Math.cos(an) * r,
          y,
          sz + (Math.sin(an) * r * u.rz) / u.rx,
          0.09,
          0.09,
          0.9 * (1 - ph * 0.3),
          col
        );
      }
    }
    /* the curtain over each bowl's lip into the next one down, and its splashes */
    for (let i = 0; i < B.length - 1; i++) {
      const a = B[i],
        c = B[i + 1],
        H = a.y - c.y;
      for (let k = 0; k < 16; k++) {
        const an = (k / 16) * Math.PI * 2 + sd * 0.3;
        for (let n = 0; n < 5; n++) {
          const ph = (T / 650 + n / 5 + k * 0.29) % 1,
            r = 1.02 + 0.18 * ph;
          quad(
            'spray',
            (n + k) % 4,
            a.x + Math.cos(an) * a.rx * r,
            a.y - H * ph * ph,
            a.z + Math.sin(an) * a.rz * r,
            0.08,
            0.14,
            0.8,
            col
          );
        }
        const ph2 = (T / 420 + k * 0.37) % 1,
          lx = a.x + Math.cos(an) * a.rx * 1.2,
          lz = a.z + Math.sin(an) * a.rz * 1.2;
        quad(
          'spray',
          k % 4,
          lx,
          c.y + 0.02 + ph2 * 0.12,
          lz,
          0.14 + ph2 * 0.12,
          0.09 + ph2 * 0.07,
          (1 - ph2) * 0.7,
          col
        );
      }
      if (rm && Math.random() < dt * 2.2) {
        const an = Math.random() * 6.3;
        addRipple(a.x + Math.cos(an) * a.rx * 1.2, a.z + Math.sin(an) * a.rz * 1.2, 0.4);
      }
    }
    if (rm && Math.random() < dt * 1.2) {
      const an = Math.random() * 6.3;
      addRipple(u.x + Math.cos(an) * u.rx * 0.6, u.z + Math.sin(an) * u.rz * 0.6, 0.3);
    }
  }
}
/* smoke, spray, sparks, sparkles, butterflies, leaves, kicked-up grass; lamps, windows and fires as small bright cores
   (the bloom turns them into glows) */
/* v26: rain, snow and falling ash around you (environment.js says how much); drops splash on the ground and ring the water */
function drawWeather(quad, glows, U, R, Up, dt, rm) {
  const gl = gpuState.gl,
    E = environment,
    BT = walkRenderer.bt,
    P = BT ? { x: BT.center[0], z: BT.center[1] } : walkView.pl,
    k = engineSetting('air', 'weather') * (walkView.R < 0.75 ? 0.5 : 1);
  /* alpha 0.4: while a front passes, the rain is as heavy as it will be (or was) but only on its side of the curtain */
  const Cu = E.curtain,
    inC = x => !Cu || (Cu.into ? Cu.dir * (x - P.x) < Cu.e * 11 : Cu.dir * (x - P.x) > Cu.e * 11);
  const rain = Math.min(1.6, Cu ? Cu.rain : E.rain) * k,
    snow = (Cu ? Cu.snow : E.snow) * k,
    ash = (Cu ? Cu.ash : E.ash) * k;
  if (rain + snow + ash < 0.03) {
    if (walkRenderer.wx) walkRenderer.wx.p.length = 0;
    return;
  }
  const W = walkRenderer.wx || (walkRenderer.wx = { p: [], sp: [] }),
    nR = Math.round(130 * rain),
    nS = Math.round(110 * snow),
    nA = Math.round(80 * ash),
    n = nR + nS + nA,
    wind = (walkView.sc.wind || 1) * (0.35 + E.storm * 0.9),
    sp = rm ? 1 : 0.2;
  const home = q => {
    for (let t = 0; t < 6; t++) {
      q.x = P.x + (Math.random() - 0.5) * 22;
      if (inC(q.x)) break;
    }
    q.z = P.z - 5 + Math.random() * 19;
    q.y = standingHeightAt(q.x, q.z) + 3 + Math.random() * 5;
  };
  while (W.p.length < n) {
    const q = { ph: Math.random() * 6.3 };
    home(q);
    q.y -= Math.random() * 4;
    W.p.push(q);
  }
  if (W.p.length > n) W.p.length = n;
  gl.uniform3f(U.uRight, R[0], R[1], R[2]);
  const lean = normalize3([wind * 0.22, 1, 0]);
  for (let i = 0; i < n; i++) {
    const q = W.p[i],
      kd = i < nR ? 0 : i < nR + nS ? 1 : 2;
    if (Math.abs(q.x - P.x) > 12 || q.z < P.z - 6.5 || q.z > P.z + 15) home(q);
    if (Cu && !inC(q.x)) {
      home(q);
      if (!inC(q.x)) continue;
    }
    const gy = standingHeightAt(q.x, q.z);
    if (kd === 0) {
      q.y -= 9 * dt * sp;
      q.x += wind * 1.8 * dt * sp;
      if (q.y < gy) {
        if (Math.random() < 0.35 && W.sp.length < 40) W.sp.push({ x: q.x, z: q.z, y: gy, a: 0 });
        home(q);
        continue;
      }
      gl.uniform3f(U.uUp, lean[0], lean[1], lean[2]);
      quad('spray', 0, q.x, q.y, q.z, 0.04, 0.5, 0.55, [0.8, 0.86, 1]);
    } else {
      const fall = kd === 1 ? 1.05 : 0.7;
      q.y -= fall * dt * sp;
      q.x += (Math.sin(walkView.t * 0.0011 + q.ph) * 0.45 + wind * 0.5) * dt * sp;
      q.z += Math.cos(walkView.t * 0.0009 + q.ph * 1.3) * 0.2 * dt * sp;
      if (q.y < gy) {
        home(q);
        continue;
      }
      gl.uniform3f(U.uUp, Up[0], Up[1], Up[2]);
      if (kd === 1) quad('spray', 1, q.x, q.y, q.z, 0.075, 0.075, 0.9, [0.98, 0.99, 1]);
      else if (i % 7 === 0) glows.push([q.x, q.y, q.z, 0.045, [1, 0.5, 0.18], 1.4]);
      else quad('spray', 1, q.x, q.y, q.z, 0.065, 0.065, 0.75, [0.3, 0.27, 0.26]);
    }
  }
  gl.uniform3f(U.uUp, Up[0], Up[1], Up[2]);
  for (let i = W.sp.length - 1; i >= 0; i--) {
    const s = W.sp[i];
    s.a += dt;
    if (s.a > 0.28) {
      W.sp.splice(i, 1);
      continue;
    }
    const f = s.a / 0.28;
    quad('spray', 2, s.x, s.y + 0.04 + f * 0.06, s.z, 0.1 + f * 0.14, 0.05 + f * 0.05, (1 - f) * 0.45, [0.85, 0.9, 1]);
  }
  if (rain > 0 && walkRenderer.wgrid && !reducedMotion && Math.random() < dt * rain * 18) {
    const x = P.x + (Math.random() - 0.5) * 16,
      z = P.z - 3 + Math.random() * 12,
      g = waterAt(x, z);
    if (g && g.dep > 0) addRipple(x, z, 0.3);
  }
}
/* v27: footprints in snow, sand, ash and mud (and anywhere after rain): yours and the animals', fading in half a minute */
const FOOTPRINT_COLORS = {
  n: [0.62, 0.68, 0.86],
  s: [0.58, 0.46, 0.3],
  z: [0.16, 0.14, 0.14],
  u: [0.3, 0.21, 0.14],
  o: [0.3, 0.2, 0.13],
  k: [0.3, 0.28, 0.36],
  /* v47: wet sand, mud, coral sand, ember ash, salt, cloud floor */ S: [0.45, 0.36, 0.22],
  D: [0.24, 0.16, 0.1],
  N: [0.74, 0.6, 0.52],
  Z: [0.15, 0.12, 0.12],
  4: [0.78, 0.76, 0.72],
  U: [0.68, 0.74, 0.88],
};
function addFootprint(x, z, a, paw) {
  const sc = walkView.sc;
  if (!sc || (sc.indoor && sc.far !== 'cave')) return;
  let ch = terrainAt(x, z),
    col = FOOTPRINT_COLORS[ch];
  const E = typeof environment !== 'undefined' && environment.on ? environment : null;
  if (!col && E && !sc.indoor && E.sk && E.sk[3] > 0.3 && !/[wdbe]/.test(ch)) col = FOOTPRINT_COLORS.n;
  if (!col && E && !sc.indoor && E.wet > 0.5 && !/[wdb]/.test(ch)) col = [0.34, 0.36, 0.42];
  if (!col) return;
  const P = walkRenderer.prints || (walkRenderer.prints = []);
  P.push({ x, z, y: standingHeightAt(x, z), a, paw, age: 0, col });
  if (P.length > 140) P.splice(0, P.length - 140);
}
function drawFootprints(quad, U, R, Up, dt) {
  const pl = walkView.pl,
    gl = gpuState.gl;
  if (walkRenderer.printId !== walkView.id) {
    walkRenderer.printId = walkView.id;
    walkRenderer.prints = [];
    walkRenderer.lastPrint = null;
  }
  if (pl.walk && !pl.yv) {
    const L = walkRenderer.lastPrint;
    if (!L || Math.hypot(pl.x - L[0], pl.z - L[1]) > 0.36) {
      const a = L ? Math.atan2(pl.z - L[1], pl.x - L[0]) : 0,
        side = (walkRenderer.printSide = -(walkRenderer.printSide || 1));
      addFootprint(pl.x - Math.sin(a) * 0.08 * side, pl.z + Math.cos(a) * 0.08 * side, a, 0);
      walkRenderer.lastPrint = [pl.x, pl.z];
    }
  }
  if (typeof ambientLife !== 'undefined')
    for (const c of ambientLife.list) {
      const K = LIFE_KIND[c.k];
      if (!K || K.fly || c.k === 'car' || c.k === 'duck' || c.hide > 0 || c.st === 'idle') continue;
      if (!c._lp || Math.hypot(c.x - c._lp[0], c.z - c._lp[1]) > 0.3) {
        addFootprint(c.x, c.z, Math.atan2(c.tz - c.z, c.tx - c.x), 1);
        c._lp = [c.x, c.z];
      }
    }
  const P = walkRenderer.prints;
  if (!P || !P.length) return;
  for (let i = P.length - 1; i >= 0; i--) {
    if ((P[i].age += dt) > 30) P.splice(i, 1);
  }
  for (const q of P) {
    const ca = Math.cos(q.a),
      sa = Math.sin(q.a);
    gl.uniform3f(U.uRight, sa, 0, -ca);
    gl.uniform3f(U.uUp, ca, 0, sa);
    const f = Math.min(1, (30 - q.age) / 8);
    quad('print', q.paw, q.x, q.y + 0.015, q.z, q.paw ? 0.12 : 0.15, q.paw ? 0.14 : 0.22, 0.7 * f, q.col);
  }
  gl.uniform3fv(U.uRight, R);
  gl.uniform3fv(U.uUp, Up);
}
/* v47: a living world, in the effects pass. Bees round the hives by day; fireflies over the grass on warm nights
   (glowing moths in the Spore Forest); in autumn, leaves skittering along the streets in the wind. Each is a handful
   of sprites near you, so they cost next to nothing. */
function drawLifeEffects(quad, glows, t, rm, dt, sc, C0) {
  const L = walkView.life;
  if (!L) return;
  const P = walkView.pl,
    E = typeof environment !== 'undefined' && engineContext.env ? environment : null,
    night = E ? E.night : 0,
    ss = E ? E.season : 'summer';
  if (!L.hv) {
    L.hv = [];
    L.gr = [];
    for (const p of sc.props || []) {
      const M = C0.props[p.k];
      if (!M) continue;
      const g = M.group || p.k;
      if (/beehive/.test(g)) L.hv.push(p);
      else if (/tallgrass|bush|fern|flower|reeds|cattail|mushroom/.test(g)) L.gr.push(p);
    }
    L.gr = L.gr.filter((_, i) => i % 3 === 0);
  }
  /* bees */ if (night < 0.5 && !(E && E.rain > 0.3))
    L.hv.forEach((p, h) => {
      if (Math.hypot(p.x - P.x, p.z - P.z) > 18) return;
      for (let n = 0; n < 5; n++) {
        const a = (t * rm) / (380 + n * 55) + n * 1.3 + h,
          r = 0.45 + 0.35 * Math.sin((t * rm) / 900 + n * 2),
          x = p.x + Math.cos(a) * r,
          z = p.z - 0.2 + Math.sin(a * 1.3) * r * 0.6;
        quad(
          'bee',
          Math.floor((t * rm) / 60 + n) % 2,
          x,
          standingHeightAt(x, z) + 0.5 + 0.3 * Math.sin(a * 2.1 + n),
          z,
          0.15,
          0.12,
          1
        );
      }
    });
  /* fireflies (warm nights) or glowing moths (a mushroom wood) near you */ const moth = /spore|mushroom/.test(
    String(sc.biome || sc.far || '')
  );
  if (night > 0.45 && (moth || ss === 'summer' || ss === 'spring') && !(E && E.rain > 0.3) && L.gr.length) {
    const near = L.gr.filter(p => Math.abs(p.x - P.x) < 14 && Math.abs(p.z - P.z) < 12).slice(0, 14),
      k = Math.min(1, (night - 0.45) * 3);
    near.forEach((p, i) => {
      const sd = p.x * 3.1 + p.z * 1.7,
        x = p.x + Math.sin((t * rm) / 2300 + sd) * 1.2,
        z = p.z - 0.3 + Math.cos((t * rm) / 2900 + sd * 1.3) * 0.8,
        y = standingHeightAt(x, z) + 0.5 + 0.4 * Math.sin((t * rm) / 1700 + sd),
        bl = Math.max(0, Math.sin((t * rm) / (moth ? 900 : 600) + sd * 5));
      if (moth) {
        quad('moth', Math.floor((t * rm) / 90 + i) % 2, x, y + 0.2, z, 0.22, 0.16, 0.9 * k);
        glows.push([x, y + 0.2, z, 0.16, [0.55, 0.85, 1], 1.2 * k]);
      } else if (bl > 0.25) {
        glows.push([x, y, z, 0.11, [0.85, 1, 0.35], 2.2 * bl * k]);
        glows.push([x, y, z, 0.035, [1, 1, 0.7], 4 * bl * k]);
      }
    });
  }
  /* autumn leaves along the ground, blown across the paving near you */ if (ss === 'autumn' && rm && L.tr.length) {
    const W = (sc.wind || 1) * (0.7 + windGustAt(P.x, P.z, t * rm)),
      sk = L.sk || (L.sk = []);
    if (sk.length < 7 && Math.random() < dt * 1.6) {
      const a = Math.random() * 6.283,
        r = 3 + Math.random() * 7,
        x = P.x + Math.cos(a) * r,
        z = P.z + Math.sin(a) * r * 0.7;
      if (isWalkable(x, z))
        sk.push({
          x,
          z,
          life: 0,
          max: 2.5 + Math.random() * 2.5,
          vx: (0.6 + Math.random() * 0.6) * W,
          vz: (Math.random() - 0.5) * 0.25,
          fr: Math.floor(Math.random() * 3),
        });
    }
    for (let i = sk.length - 1; i >= 0; i--) {
      const q = sk[i];
      q.life += dt;
      if (q.life > q.max) {
        sk.splice(i, 1);
        continue;
      }
      const gust = 0.6 + 0.6 * Math.max(0, Math.sin(t / 700 + i * 2));
      q.x += q.vx * gust * dt;
      q.z += q.vz * dt;
      const hop = Math.max(0, Math.sin(q.life * 7 + i)) * 0.06 * gust,
        a = Math.min(1, q.life * 3, (q.max - q.life) * 2);
      quad(
        'leaf',
        (q.fr + Math.floor(q.life * 6)) % 3,
        q.x,
        standingHeightAt(q.x, q.z) + 0.04 + hop,
        q.z,
        0.15,
        0.15,
        a
      );
    }
  }
  /* v47: dust kicked up from dry ground as you walk (earth, paths, dirt, sand, gravel, scrap, ash), not when it is wet or snowy */
  {
    const ch = typeof terrainAt === 'function' ? terrainAt(P.x, P.z) : 'g',
      du = L.du || (L.du = []);
    if (P.walk && rm && /[ApusNvxzZ4]/.test(ch) && !(E && (E.wet > 0.35 || (E.sk && E.sk[3] > 0.3)))) {
      L.duT = (L.duT || 0) - dt;
      if (L.duT <= 0 && du.length < 10) {
        L.duT = 0.16 + Math.random() * 0.1;
        du.push({
          x: P.x + (Math.random() - 0.5) * 0.3,
          z: P.z - 0.05,
          a: 0,
          m: 0.55 + Math.random() * 0.3,
          c: /[zZ]/.test(ch) ? [0.62, 0.6, 0.62] : ch === 'x' ? [0.7, 0.62, 0.52] : [0.88, 0.8, 0.64],
        });
      }
    }
    for (let i = du.length - 1; i >= 0; i--) {
      const q = du[i];
      q.a += dt;
      if (q.a > q.m) {
        du.splice(i, 1);
        continue;
      }
      const f = q.a / q.m;
      quad(
        'smoke',
        Math.min(3, Math.floor(f * 4)),
        q.x,
        standingHeightAt(q.x, q.z) + 0.06 + f * 0.22,
        q.z,
        0.2 + f * 0.32,
        0.2 + f * 0.32,
        0.4 * (1 - f),
        q.c
      );
    }
  }
}
export function effectsPass(C, items, X, dark, t, dt) {
  const gl = gpuState.gl,
    p = useWalkProgram('fx', C, X),
    U = p.U,
    sc = walkView.sc,
    C0 = walkData().sc,
    rm = reducedMotion ? 0 : 1,
    R = C.right,
    Up = [0, 1, 0],
    lb = engineSetting('lights', 'brightness'),
    gk = engineSetting('lights', 'glow'),
    winDay = engineSetting('lights', 'windowsDay'),
    flick = engineSetting('lights', 'flicker');
  bindQuad();
  gl.uniform3fv(U.uRight, R);
  gl.uniform3fv(U.uUp, Up);
  gl.uniform1i(U.uTex, 0);
  gl.uniform1f(U.uLitFx, 1);
  gl.activeTexture(gl.TEXTURE0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);
  gl.enable(gl.DEPTH_TEST);
  const fxT = k => imageTexture(artImage(`scene/fx/${k}.png`), { noNormal: true }),
    quad = (k, fr, x, y, z, sw, sh, a, col) => {
      const T = fxT(k);
      if (!T) return;
      const m = EFFECT_FRAMES[k];
      gl.bindTexture(gl.TEXTURE_2D, T.t);
      gl.uniform3f(U.uP, x, y + worldCurveDrop(x, z), z);
      gl.uniform2f(U.uS, sw, sh);
      gl.uniform4f(U.uUV, ((fr % m[2]) * m[0]) / T.w, 0, m[0] / T.w, 1);
      gl.uniform4f(U.uCol, col ? col[0] : 1, col ? col[1] : 1, col ? col[2] : 1, a);
      gl.uniform1f(U.uGlow, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
  const glows = [];
  walkRenderer.fires = [];
  const RR = sc.roomRect,
    dOut =
      RR && typeof environment !== 'undefined' && engineContext.env
        ? environment.lampK || 0
        : 0; /* v46: lamps and windows outside a room laid into the place keep the outdoor hour */
  for (const it of items) {
    if (it.k !== 'prop' || it.far || it.layer) continue;
    const s = it.mpp,
      chim = it.bld3 && typeof chimneySmoke === 'function' ? chimneySmoke(it) : null,
      out = !!RR && (it.x < RR[0] || it.x > RR[0] + RR[2] || it.z < RR[1] || it.z > RR[1] + RR[3]),
      dIt = out ? (dOut > 0.4 ? dOut : 0) : dark;
    (it.M.fx || []).forEach((e, i) => {
      const dark = dIt;
      const cs = chim && e.k === 'smoke',
        x = cs ? chim[0] : it.x + R[0] * e.x * s * it.flip,
        z = cs ? chim[2] : it.z + R[2] * e.x * s * it.flip + (e.z || 0),
        y = cs ? chim[1] : it.y - e.y * s,
        sd = it.x * 13.1 + it.z * 7.7 + i,
        fl = 1 - flick * 0.2 + flick * 0.2 * Math.sin(t / 170 + sd * 3) * Math.sin(t / 97 + sd);
      if (e.k === 'smoke')
        for (let n = 0; n < 5; n++) {
          const ph = ((t * rm) / 3200 + n / 5 + sd * 0.13) % 1,
            sz = 0.35 + 0.8 * ph;
          quad(
            'smoke',
            Math.floor(ph * 4),
            x + (ph * 0.9 + 0.15 * Math.sin(ph * 6 + n + sd)) * (sc.wind || 1),
            y + ph * 2.4,
            z + ph * 0.3,
            sz,
            sz,
            0.55 * (1 - ph) * Math.min(1, ph * 6)
          );
        }
      else if (e.k === 'spray') {
        if (walkRenderer.basinP && walkRenderer.basinP.has(it.p)) return;
        for (let n = 0; n < 14; n++) {
          const ph = ((t * rm) / 1100 + n / 14) % 1,
            an = n * 2.4 + sd,
            r = ph * 0.75;
          quad(
            'spray',
            n % 4,
            x + Math.cos(an) * r,
            y + 4 * 1.05 * ph * (1 - ph) - ph * 0.15,
            z + Math.sin(an) * r * 0.5,
            0.12,
            0.12,
            (1 - ph) * 0.9
          );
        }
      } else if (e.k === 'sparkle') {
        for (let n = 0; n < 3; n++) {
          const ph = ((t * rm) / 1400 + n / 3 + sd * 0.31) % 1;
          quad(
            'sparkle',
            Math.floor(ph * 4),
            x + Math.sin(n * 2.1 + sd) * 0.4,
            y - Math.cos(n * 1.7 + sd) * 0.3,
            z,
            0.3,
            0.3,
            Math.sin(ph * Math.PI)
          );
        }
      } else if (e.k === 'fire') {
        for (let n = 0; n < 7; n++) {
          const ph = ((t * rm) / 800 + n / 7 + sd * 0.2) % 1;
          glows.push([
            x + Math.sin(n * 2.7 + t / 300 + sd) * 0.2,
            y + ph * 1.5,
            z,
            0.06,
            [1, 0.85, 0.45],
            (1 - ph) * 3,
          ]);
        }
        glows.push([x, y + 0.15, z, 0.42 * gk, [1, 0.62, 0.25], (1.6 + dark) * fl * lb]);
        /* alpha 0.4: the flames themselves, a few hand-drawn frames looped with a little variation (two tongues, out of step),
      and the fire's place for the shimmer above it */
        const sz = Math.max(0.5, s * 34 * 0.024) * (e.s || 1);
        for (let n = 0; n < 2; n++) {
          const fr = Math.floor((t * rm) / (105 + n * 23) + sd * 3 + n * 2) % 4,
            w = (n ? 0.3 : 0.42) * sz * (1 + 0.08 * Math.sin(t / 180 + n + sd));
          quad(
            'flame',
            fr,
            x + (n ? 0.12 : -0.05) * sz,
            y + (n ? 0.18 : 0.26) * sz,
            z - 0.03,
            w,
            w * 1.5,
            1,
            [1.35, 1.2, 1.05]
          );
        }
        (walkRenderer.fires || (walkRenderer.fires = [])).push([x, y + 0.8 * sz, z, sz]);
      } else if (e.k === 'window') {
        if (it.bld3 && !(sc.room && !out) && buildingState.mesh.get(it.p)) return;
        const RS = sc.room && !out ? roomSkyLight() : null;
        let k = RS ? RS.I * (1 - RS.night) * 0.9 * windowLightShare(sc) : dark ? 1 : winDay;
        if (
          !RS &&
          typeof environmentWindowLit === 'function' &&
          typeof environment !== 'undefined' &&
          engineContext.env &&
          !environmentWindowLit(x, z, environment.tod)
        )
          k *= 0.05;
        /* v47: lit one at a time */ if (k > 0.02)
          glows.push([x, y, z - 0.06, 0.32 * gk, [1, 0.82, 0.5], (0.6 + dark * 1.8) * k * fl * lb]);
      }
      /* several lamps on one prop share their light, so a four-lamp lantern isn't four times as bright */
      else if (e.k === 'glow') {
        const on = lampLit(it.x, it.z, dark),
          k = on + (1 - on) * 0.1,
          nG = it.M.fx.filter(f => f.k === 'glow').length,
          share = Math.min(1, 2.2 / nG);
        if (k > 0.02)
          glows.push([
            x,
            y,
            z - 0.06,
            (nG > 2 ? 0.26 : 0.34) * gk,
            [1, 0.9, 0.62],
            (0.5 + 0.8 * on) * share * k * fl * lb * (it.M.glowK ?? 1),
          ]);
      }
    });
    /* alpha 0.4: a 3D building's front windows glow when its window shader lights them (the same seed), not by a second guess */
    if (it.bld3 && !(sc.room && !out)) {
      const E = buildingState.mesh.get(it.p);
      if (E && E.fw) {
        const lf = litWindowFraction(),
          k = dIt ? 1 : winDay,
          fl = 1 - flick * 0.1 + flick * 0.1 * Math.sin(t / 230 + it.x);
        if (k > 0.02)
          for (const f of E.fw) {
            const w = frontWindowLight(f[3], lf);
            if (w)
              glows.push([
                f[0] + E.fn[0] * 0.06,
                f[1],
                f[2] + E.fn[1] * 0.06,
                0.5 * gk,
                w.c.map(v => v * 0.8),
                (0.2 + (dIt ? 1 : 0) * 0.45) * k * w.k * fl * lb,
              ]);
          }
      }
    }
    if (it.M.glow) {
      const g = it.M.glow,
        c = hexToRgb(g.c).map(v => v / 255),
        on = lampLit(it.x, it.z, dIt);
      /* v47: "day" sets how much of it shows by day (a neon sign's halo hardly does) */ glows.push([
        it.x,
        it.y + g.y,
        it.z - 0.08,
        0.4 * gk,
        c,
        (on * 1.6 + (1 - on) * (g.day ?? 0.3)) * lb,
      ]);
    }
  }
  if (!sc.indoor && engineSetting('air', 'particles') > 0) {
    if (!walkView.life || walkView.life.id !== walkView.id) {
      const fl = [],
        tr = [];
      for (const p of sc.props || []) {
        const M = C0.props[p.k];
        if (!M) continue;
        const g = M.group || p.k;
        if (/flower/.test(g) || /flower/.test(p.k)) fl.push(p);
        if (/tree_(oak|fruit|birch)|^tree$/.test(g) || p.k === 'tree_oak_autumn') tr.push(p);
      }
      walkView.life = {
        id: walkView.id,
        fl: fl.filter((_, i) => i % 2 === 0).slice(0, 6),
        tr: tr.filter((_, i) => i % 2 === 0).slice(0, 7),
      };
    }
    walkView.life.fl.forEach((p, i) => {
      const bx = p.x + Math.sin((t * rm) / 1500 + i * 1.7) * 1.1 + Math.sin((t * rm) / 610 + i) * 0.25,
        bz = p.z + Math.cos((t * rm) / 1900 + i * 2) * 0.7;
      quad(
        'butterfly',
        Math.floor((t * rm) / 110 + i) % 2,
        bx,
        standingHeightAt(bx, bz) + 0.55 + 0.35 * Math.sin((t * rm) / 480 + i * 3),
        bz,
        0.3,
        0.26,
        1
      );
    });
    walkView.life.tr.forEach((p, i) => {
      const M = C0.props[p.k],
        per = 6500 + i * 700,
        ph = ((t * rm) / per + i * 0.37) % 1,
        top = M ? Math.min(4, (-M.oy / 34) * (p.s || 1) * 0.75) : 3,
        bx = p.x + Math.sin(ph * 9 + i) * 0.55 + ph * (0.6 + windGustAt(p.x, p.z, t * rm) * 0.5) * (sc.wind || 1),
        bz = p.z - 0.4 - ph * 0.6;
      quad(
        'leaf',
        Math.floor((t * rm) / 220 + i) % 3,
        bx,
        standingHeightAt(bx, bz) + top * (1 - ph),
        bz,
        0.18,
        0.18,
        Math.min(1, (1 - ph) * 4) * Math.min(1, ph * 8)
      );
    });
    drawLifeEffects(quad, glows, t, rm, dt, sc, C0);
  }
  /* v18: spray and mist where water falls over a step */
  if (walkRenderer.falls && walkRenderer.falls.length) {
    const F = walkRenderer.falls,
      stp = Math.max(1, Math.ceil(F.length / 40));
    for (let k = 0; k < F.length; k += stp) {
      const [x, y, z, dh] = F[k],
        sd = k * 1.37,
        big = Math.min(1.6, 0.5 + dh * 0.4);
      for (let n = 0; n < 6; n++) {
        const ph = ((t * rm) / 900 + n / 6 + sd * 0.17) % 1,
          an = n * 2.3 + sd,
          r = ph * 0.6 * big;
        quad(
          'spray',
          n % 4,
          x + Math.cos(an) * r,
          y + 0.05 + 2.2 * big * ph * (1 - ph),
          z + Math.sin(an) * r * 0.5,
          0.13,
          0.13,
          (1 - ph) * 0.85
        );
      }
      if (k % (2 * stp) === 0) {
        const ph = ((t * rm) / 2600 + sd * 0.3) % 1;
        quad(
          'smoke',
          Math.floor(ph * 4),
          x + Math.sin(ph * 5 + sd) * 0.3,
          y + 0.15 + ph * 0.9 * big,
          z + 0.1,
          0.5 + ph * big,
          0.5 + ph * big,
          0.22 * (1 - ph) * Math.min(1, ph * 5),
          [0.92, 0.97, 1]
        );
      }
    }
  }
  /* v22: leaves riding the streams (lying flat on the water), and steam breathing off warm springs */
  if (
    walkRenderer.streamCells &&
    walkRenderer.streamCells.length &&
    engineSetting('water', 'leaves') &&
    !walkRenderer.bt
  ) {
    const S = walkRenderer.streamCells,
      n = Math.min(10, Math.ceil(S.length / 12));
    if (!walkRenderer.leaves || walkRenderer.leaves.length !== n)
      walkRenderer.leaves = Array.from({ length: n }, (_, i) => ({ age: 99, i }));
    gl.uniform3f(U.uUp, 0, 0, 1);
    for (const L of walkRenderer.leaves) {
      if (L.age > 16 || !L.ok) {
        const c = S[Math.floor(Math.random() * S.length)];
        Object.assign(L, {
          x: c[0] + Math.random() * 0.4 - 0.2,
          z: c[1] + Math.random() * 0.4 - 0.2,
          age: 0,
          fr: L.i % 3,
          sp: 0.6 + Math.random() * 0.5,
          ok: true,
        });
      }
      const f = walkRenderer.flowAt(L.x, L.z);
      L.age += dt;
      if (!rm) {
        L.x += (f[0] * L.sp + Math.sin(L.age * 1.3 + L.i) * 0.05) * dt;
        L.z += (f[1] * L.sp + Math.cos(L.age * 1.1 + L.i) * 0.05) * dt;
      }
      const g = waterAt(L.x, L.z);
      if (!g || (g.kind !== 1 && L.age > 2)) {
        L.ok = false;
        continue;
      }
      const a = Math.min(1, L.age * 2) * Math.min(1, (16 - L.age) / 2);
      gl.uniform3f(U.uRight, Math.cos(L.age * 0.4 + L.i), 0, Math.sin(L.age * 0.4 + L.i) * 0.6);
      quad('leaf', L.fr, L.x, g.y + 0.04, L.z, 0.17, 0.17, a);
    }
    gl.uniform3fv(U.uRight, R);
    gl.uniform3fv(U.uUp, Up);
  }
  if (walkRenderer.springCells && walkRenderer.springCells.length && engineSetting('water', 'steam')) {
    walkRenderer.springCells.forEach(([x, z, dp], k) => {
      const g = waterAt(x, z),
        y = g ? g.y : standingHeightAt(x, z);
      for (let n = 0; n < 2; n++) {
        const ph = ((t * rm) / 5200 + n / 2 + k * 0.37) % 1,
          sz = 0.5 + ph * 1.3;
        quad(
          'smoke',
          Math.floor(ph * 4),
          x + Math.sin(ph * 4 + k) * 0.35 * (sc.wind || 1),
          y + 0.05 + ph * 1.6,
          z + 0.1,
          sz,
          sz,
          0.16 * (1 - ph) * Math.min(1, ph * 4) * (0.6 + dp * 0.4),
          [0.94, 0.97, 1]
        );
      }
    });
  }
  if (engineContext.env && !sc.indoor && engineSetting('air', 'weather') > 0)
    drawWeather(quad, glows, U, R, Up, dt, rm);
  if (!walkRenderer.bt) drawFootprints(quad, U, R, Up, dt);
  drawFountainEffects(quad, t, rm, dt);
  drawRoomEffects(C, U, items, glows, t, rm);
  gl.uniform3fv(U.uRight, R);
  gl.uniform3fv(U.uUp, Up);
  if (typeof stampDraw === 'function') stampDraw(quad, glows, t);
  if (typeof clueDraw === 'function') clueDraw(quad, glows, t);
  if (typeof worldBillyGlows === 'function' && !walkRenderer.bt) worldBillyGlows(glows, dt);
  if (!walkRenderer.bt && walkRenderer.encPos)
    walkRenderer.encPos.forEach(([x, z, id], k) => {
      const ph = (t / 1000 + k * 1.7) % 6;
      if (ph > 1.1) return;
      const a = Math.sin((ph / 1.1) * Math.PI),
        y = standingHeightAt(x, z) + 0.38,
        ex = R[0] * 0.07,
        ez = R[2] * 0.07,
        c = [1, 0.95, 0.62];
      glows.push([x - ex, y, z - ez - 0.15, 0.035, c, 1.6 * a]);
      glows.push([x + ex, y, z + ez - 0.15, 0.035, c, 1.6 * a]);
    });
  if (walkRenderer.splash && walkRenderer.splash.length) {
    for (let i = walkRenderer.splash.length - 1; i >= 0; i--) {
      const q = walkRenderer.splash[i];
      q.a += dt;
      if (q.a > 0.7) {
        walkRenderer.splash.splice(i, 1);
        continue;
      }
      for (let n = 0; n < 8; n++) {
        const an = n * 0.785,
          r = q.a * 0.9,
          h = q.a * (2.6 - q.a * 3.4);
        quad(
          'spray',
          n % 4,
          q.x + Math.cos(an) * r,
          q.y + 0.05 + Math.max(0, h),
          q.z + Math.sin(an) * r * 0.6,
          0.1,
          0.1,
          (1 - q.a / 0.7) * 0.85,
          [0.9, 0.96, 1]
        );
      }
      /* v47: and the fish itself, arcing out and back in */ if (q.a < 0.62) {
        const k = q.a / 0.62,
          dir = q.dir || (q.dir = Math.random() < 0.5 ? -1 : 1);
        quad(
          'fish',
          k < 0.35 || k > 0.7 ? 0 : 1,
          q.x + dir * (k - 0.5) * 0.7,
          q.y + 0.08 + Math.sin(k * Math.PI) * 0.55,
          q.z - 0.05,
          0.3,
          0.17,
          1
        );
      }
    }
  }
  const PS = walkView.parts;
  for (let i = PS.length - 1; i >= 0; i--) {
    const q = PS[i];
    q.life += dt;
    if (q.life >= q.max) {
      PS.splice(i, 1);
      continue;
    }
    q.x += q.vx * dt;
    q.z += q.vz * dt;
    q.vy -= q.g * dt;
    q.y = Math.max(0, q.y + q.vy * dt);
    const a = 1 - q.life / q.max,
      gy = standingHeightAt(q.x, q.z);
    if (q.k === 'leaf') quad('leaf', q.fr, q.x, gy + q.y, q.z, 0.16, 0.16, a);
    else
      quad('smoke', 1, q.x, gy + q.y + 0.1, q.z, 0.25 + q.life * 0.6, 0.25 + q.life * 0.6, a * 0.35, [0.95, 0.9, 0.8]);
  }
  /* bright cores, added in HDR: the bloom spreads them into soft glows */
  /* battle move effects as sprites in the world: hidden behind things, blurred by depth, glowing ones bloom */
  const BP = walkRenderer.bt && walkRenderer.bt.parts;
  if (BP && BP.length) {
    gl.uniform1f(U.uLitFx, 0);
    gl.uniform1f(U.uGlow, 0);
    gl.uniform4f(U.uUV, 0, 0, 1, 1);
    for (const pass of [0, 1]) {
      if (pass) gl.blendFunc(gl.ONE, gl.ONE);
      for (const q of BP) {
        if (!!q.glow !== !!pass) continue;
        const T = imageTexture(q.im, { noNormal: true });
        if (!T) continue;
        gl.bindTexture(gl.TEXTURE_2D, T.t);
        gl.uniform3f(U.uP, q.x, q.y + worldCurveDrop(q.x, q.z), q.z);
        gl.uniform2f(U.uS, q.w, q.h);
        const k = pass ? 1.6 : 1;
        gl.uniform4f(U.uCol, k, k, k, q.a);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
    }
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.uniform1f(U.uGlow, 1);
  gl.uniform1f(U.uLitFx, 0);
  /* alpha 0.4: the whole disc (the last flame or smoke quad left its frame's strip here, which cut each halo down to an off-centre square) */ gl.uniform4f(
    U.uUV,
    0,
    0,
    1,
    1
  );
  for (const [x, y, z, r, c, a] of glows) {
    if (a <= 0.01) continue;
    gl.uniform3f(U.uP, x, y + worldCurveDrop(x, z), z);
    gl.uniform2f(U.uS, r * 2, r * 2);
    gl.uniform4f(U.uCol, c[0], c[1], c[2], a);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  gl.uniform1f(U.uGlow, 0);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
}
