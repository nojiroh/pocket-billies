'use strict';
/* ================= WALK SCENE on the engine (v12) =================
   The walk scene drawn by the shared WebGL engine (js/engine/*): ground with real height and cliffs, a Hollow Earth
   horizon that bends up, pixel sprites standing in 3D with gentle automatic shading, sun shadows from a shadow map
   (buildings cast solid shadows, people and trees their cut-out shape), contact shadows, lamps and windows that light
   the ground in front of them and glow through bloom, ponds that reflect, grass that sways and bends away from you,
   mist, cloud shadows, and a lens with depth of field. Every dial is an engine setting (Studio → Engine).
   Same scenes, walking and taps as js/walk-view.js (scene data, paths, the player); this file draws them. */
/* which material a prop is made of: its own "mat", else guessed from its name */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import {
  BUILDING_SHADERS,
  LIFE_KIND,
  SOLID_PROP_PARTS,
  SOLID_PROP_SHADERS,
  SPECIES,
  WORLD_ART,
  ambientLife,
  buddyItems,
  buildingFrontPicture,
  buildingGuard,
  buildingMesh,
  buildingState,
  buildingsOn,
  chimneySmoke,
  clueDraw,
  companionItems,
  drawBuildingShadows,
  drawBuildings,
  drawPropModelShadows,
  drawPropModels,
  drawSolidPropShadows,
  drawSolidProps,
  drawStructureShadows,
  drawStructures,
  friendWorldItems,
  frontWindowLight,
  lifeSprites,
  lifeStep,
  litWindowFraction,
  loadingScreen,
  noWebGL,
  propModelImageItems,
  propModelShaders,
  provide,
  reducedMotion,
  requestAsker,
  riderOf,
  saveData,
  seamlessLookTick,
  solidPropLevelOfDetail,
  soundEffectAt,
  stampDraw,
  tagPropModel,
  tagSolidProp,
  warmWorldBillies,
  wildBillyItem,
  worldBillies,
  worldBillyGlows,
  worldBillyItem,
  worldBillyLabels,
} from './hooks.js';
import { clamp } from './util.js';
import { gpuPass } from './engine/gpu-counters.js';
import { frameCount, frameTask, userFps } from './frame-scheduler.js';
import { hexToRgb, makeCanvas } from './art.js';
import { folkFrames, personBattlePose, personWalkFrames, pickWalkFrame, warmPerson } from './person-art.js';
import { drawRig, rigFrame, rigParts, rigPreload } from './skeleton-rig.js';
import {
  BOB_M,
  EFFECT_FRAMES,
  GROUND_BORDER_M,
  WALK_FRAME_M,
  actionLabel,
  actionSpot,
  approachPoint,
  artImage,
  canvasPoint,
  climbStartEnd,
  cropGrowth,
  directionOf,
  drawBubble,
  drawExitLabels,
  drawExitMarks,
  drawLabelPill,
  drawLevelTag,
  drawSpeech,
  drawTapMark,
  encounterSpot,
  ensureGround,
  flagPicturePath,
  handleWalkClick,
  hash2d,
  hitAt,
  imageReady,
  isWalkable,
  layerAsProp,
  mapById,
  mapHub,
  navGrid,
  pointAlongMapPath,
  prepareMap,
  propShown,
  propWithVariant,
  screenToGround,
  setScreenToGround,
  setStopWalkView,
  setWorldToScreen,
  stepLevelAt,
  stepRaiseAt,
  stopWalkView,
  tallGrassProps,
  terrainAt,
  updateFolk,
  updatePlayer,
  walkData,
  walkView,
  walkablePointNear,
  worldToScreen,
} from './walk-view.js';
import { PLAIN_LOOK, engineColor, engineContext, engineSetting } from './engine/settings.js';
import {
  SURFACE_MATERIALS,
  beginGpuTimer,
  bindGridQuad,
  bindQuad,
  endGpuTimer,
  ensurePrograms,
  freeMesh,
  gpuLoading,
  gpuState,
  imageTexture,
  initWebgl,
  matrix4,
  normalize3,
  pollPendingPrograms,
  precompilePrograms,
  renderTarget,
  runNormalMapJobs,
  smooth01,
  trimTextures,
  uploadMesh,
  webgl2Supported,
  windBendAt,
  windGustAt,
} from './engine/webgl.js';
import { beginLampShadow, beginSunShadow, endShadow, lightContext, pickPointLights, sunLight } from './engine/light.js';
import { POST_EFFECT_SHADERS, drawPostEffects, screenSnapshot, sunScreenPosition } from './engine/post-effects.js';
import {
  WEATHER_LOOKS,
  currentLocationMap,
  environment,
  environmentFrame,
  environmentSky,
  environmentState,
  environmentWindowLit,
} from './environment.js';
import { FIXED_BACK, FIXED_RIGHT, PREP_BUDGET_MS, walkRenderer } from './walk/walk-state.js';
import { WALL_COLORS, defaultWallMaterial, groundHeightAt, standingHeightAt } from './walk/heights.js';
import { WALK_SHADERS } from './walk/walk-shaders.js';
import { setSpriteUniforms, useWalkProgram, worldCurveArgs, worldCurveDrop } from './walk/draw-common.js';
import { WATER_KIND_LOOKS, setShoreUniforms } from './walk/water-data.js';
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
  frameBudgetLeft,
  heatHaze,
  heatSources,
  inFrustum,
} from './walk/quality-cull.js';
/* eslint-disable no-func-assign */
expose({
  ALTERNATE_PROPS: [() => ALTERNATE_PROPS],
  BOBBING_PROPS: [() => BOBBING_PROPS],
  BOX_INFO_CACHE: [() => BOX_INFO_CACHE],
  EVERGREEN_PROPS: [() => EVERGREEN_PROPS],
  FLOWER_COLORS: [() => FLOWER_COLORS],
  FLOWER_SET_BY_LOCATION: [() => FLOWER_SET_BY_LOCATION],
  FOLIAGE_PROPS: [() => FOLIAGE_PROPS],
  FOOTPRINT_COLORS: [() => FOOTPRINT_COLORS],
  GRASS_PUSHER_BUFFER: [() => GRASS_PUSHER_BUFFER],
  IMAGE_IDS: [() => IMAGE_IDS],
  NEUTRAL_LOOK: [() => NEUTRAL_LOOK],
  PROP_LOOK_CACHE: [() => PROP_LOOK_CACHE],
  PROP_VARIETY_DEFAULT: [() => PROP_VARIETY_DEFAULT],
  PROP_VARIETY_RULES: [() => PROP_VARIETY_RULES],
  SLOPE_HUGGERS: [() => SLOPE_HUGGERS],
  SLOPE_HUG_CACHE: [() => SLOPE_HUG_CACHE],
  STILL_PROP_CACHE: [() => STILL_PROP_CACHE],
  SUNKEN_FOOTPRINT_PROPS: [() => SUNKEN_FOOTPRINT_PROPS],
  WATER_KIND_UNIFORMS: [() => WATER_KIND_UNIFORMS],
  WAVING_PROPS: [() => WAVING_PROPS],
  addFootprint: [() => addFootprint, v => (addFootprint = v)],
  addHitTarget: [() => addHitTarget, v => (addHitTarget = v)],
  addRipple: [() => addRipple, v => (addRipple = v)],
  alternatePropImage: [() => alternatePropImage, v => (alternatePropImage = v)],
  askDeviceTilt: [() => askDeviceTilt, v => (askDeviceTilt = v)],
  baseStopWalkView: [() => baseStopWalkView],
  battleCamera: [() => battleCamera, v => (battleCamera = v)],
  bindGestures: [() => bindGestures, v => (bindGestures = v)],
  boxInfo: [() => boxInfo, v => (boxInfo = v)],
  cameraTurnLimit: [() => cameraTurnLimit],
  canvasForContext: [() => canvasForContext, v => (canvasForContext = v)],
  clampZoom: [() => clampZoom],
  computePropLook: [() => computePropLook, v => (computePropLook = v)],
  cutsceneCamera: [() => cutsceneCamera, v => (cutsceneCamera = v)],
  drawBoxFaces: [() => drawBoxFaces, v => setDrawBoxFaces(v)],
  drawClockHands: [() => drawClockHands, v => (drawClockHands = v)],
  drawFlatItem: [() => drawFlatItem, v => (drawFlatItem = v)],
  drawFootprints: [() => drawFootprints, v => (drawFootprints = v)],
  drawFountainEffects: [() => drawFountainEffects, v => (drawFountainEffects = v)],
  drawGrass: [() => drawGrass, v => setDrawGrass(v)],
  drawGround: [() => drawGround, v => setDrawGround(v)],
  drawLifeEffects: [() => drawLifeEffects, v => (drawLifeEffects = v)],
  drawRoomEffects: [() => drawRoomEffects, v => (drawRoomEffects = v)],
  drawRoomFront: [() => drawRoomFront, v => (drawRoomFront = v)],
  drawRotatingBlades: [() => drawRotatingBlades, v => (drawRotatingBlades = v)],
  drawShadowSprites: [() => drawShadowSprites, v => (drawShadowSprites = v)],
  drawSky: [() => drawSky, v => (drawSky = v)],
  drawSprites: [() => drawSprites, v => setDrawSprites(v)],
  drawWalkFrame: [() => drawWalkFrame, v => (drawWalkFrame = v)],
  drawWalkFrameInner: [() => drawWalkFrameInner, v => (drawWalkFrameInner = v)],
  drawWater: [() => drawWater, v => setDrawWater(v)],
  drawWeather: [() => drawWeather, v => (drawWeather = v)],
  effectsPass: [() => effectsPass, v => setEffectsPass(v)],
  ensureWalkGl: [() => ensureWalkGl, v => (ensureWalkGl = v)],
  fittedShadowPass: [() => fittedShadowPass, v => (fittedShadowPass = v)],
  foliageAmount: [() => foliageAmount, v => (foliageAmount = v)],
  freeCameraOn: [() => freeCameraOn],
  gatherFountainBasins: [() => gatherFountainBasins, v => (gatherFountainBasins = v)],
  gatherFrameItems: [() => gatherFrameItems, v => setGatherFrameItems(v)],
  grassPushers: [() => grassPushers, v => (grassPushers = v)],
  grassTrail: [() => grassTrail, v => (grassTrail = v)],
  handleCanvasClick: [() => handleCanvasClick, v => (handleCanvasClick = v)],
  hugSlope: [() => hugSlope, v => (hugSlope = v)],
  imageId: [() => imageId, v => (imageId = v)],
  imageIdCount: [() => imageIdCount, v => (imageIdCount = v)],
  labelLayer: [() => labelLayer, v => (labelLayer = v)],
  lampLit: [() => lampLit, v => (lampLit = v)],
  lampShadowMaps: [() => lampShadowMaps, v => (lampShadowMaps = v)],
  lampTexture: [() => lampTexture, v => (lampTexture = v)],
  landmarkTilt: [() => landmarkTilt, v => (landmarkTilt = v)],
  listenDeviceTilt: [() => listenDeviceTilt, v => (listenDeviceTilt = v)],
  mapFlowers: [() => mapFlowers, v => (mapFlowers = v)],
  mapSun: [() => mapSun, v => (mapSun = v)],
  mirrorInView: [() => mirrorInView, v => (mirrorInView = v)],
  mountWalkView: [() => mountWalkView, v => setMountWalkView(v)],
  onGlContextRestored: [() => onGlContextRestored, v => ((onGlContextRestored = v), provide({ onGlContextRestored }))],
  personItem: [() => personItem, v => (personItem = v)],
  propBaseHeight: [() => propBaseHeight, v => (propBaseHeight = v)],
  propCheckedAt: [() => propCheckedAt, v => (propCheckedAt = v)],
  propGrid: [() => propGrid, v => (propGrid = v)],
  propLook: [() => propLook, v => (propLook = v)],
  propLookSettings: [() => propLookSettings, v => (propLookSettings = v)],
  propMaterial: [() => propMaterial, v => (propMaterial = v)],
  propVariety: [() => propVariety, v => (propVariety = v)],
  reflectionLevel: [() => reflectionLevel, v => (reflectionLevel = v)],
  reflectionPass: [() => reflectionPass, v => setReflectionPass(v)],
  rideMountItem: [() => rideMountItem, v => (rideMountItem = v)],
  roomBoxOf: [() => roomBoxOf, v => (roomBoxOf = v)],
  roomDimming: [() => roomDimming, v => (roomDimming = v)],
  roomLamps: [() => roomLamps, v => (roomLamps = v)],
  roomLights: [() => roomLights, v => (roomLights = v)],
  roomSkyLight: [() => roomSkyLight, v => (roomSkyLight = v)],
  roomTexture: [() => roomTexture, v => (roomTexture = v)],
  screenRay: [() => screenRay, v => (screenRay = v)],
  screenToGround2d: [() => screenToGround2d],
  setMountWalkView: [() => setMountWalkView, v => (setMountWalkView = v)],
  setPropLookUniforms: [() => setPropLookUniforms, v => (setPropLookUniforms = v)],
  setWaterUniforms: [() => setWaterUniforms, v => (setWaterUniforms = v)],
  shadowMapArea: [() => shadowMapArea, v => (shadowMapArea = v)],
  shadowPass: [() => shadowPass, v => setShadowPass(v)],
  skyColors: [() => skyColors, v => (skyColors = v)],
  startTownRise: [() => startTownRise, v => (startTownRise = v)],
  stillPropState: [() => stillPropState, v => (stillPropState = v)],
  townRiseAmount: [() => townRiseAmount, v => (townRiseAmount = v)],
  updateBasinMeshes: [() => updateBasinMeshes, v => (updateBasinMeshes = v)],
  walkCamera: [() => walkCamera, v => (walkCamera = v)],
  walkLightContext: [() => walkLightContext, v => (walkLightContext = v)],
  waterAt: [() => waterAt, v => (waterAt = v)],
  waterLife: [() => waterLife, v => (waterLife = v)],
  waterNear: [() => waterNear, v => (waterNear = v)],
  windLeanAt: [() => windLeanAt, v => (windLeanAt = v)],
  windowBlocked: [() => windowBlocked, v => (windowBlocked = v)],
  windowLightShare: [() => windowLightShare, v => (windowLightShare = v)],
  windowLit: [() => windowLit, v => (windowLit = v)],
  worldMapTexture: [() => worldMapTexture, v => (worldMapTexture = v)],
  worldToScreen2d: [() => worldToScreen2d],
});
/* eslint-enable no-func-assign */
provide({ onGlContextRestored });
export function setDrawBoxFaces(v) {
  drawBoxFaces = v; // eslint-disable-line no-func-assign
  provide({ drawBoxFaces });
}
export function setDrawGrass(v) {
  drawGrass = v; // eslint-disable-line no-func-assign
  provide({ drawGrass });
}
export function setDrawGround(v) {
  drawGround = v; // eslint-disable-line no-func-assign
  provide({ drawGround });
}
export function setDrawSprites(v) {
  drawSprites = v; // eslint-disable-line no-func-assign
  provide({ drawSprites });
}
export function setDrawWater(v) {
  drawWater = v; // eslint-disable-line no-func-assign
  provide({ drawWater });
}
export function setEffectsPass(v) {
  effectsPass = v; // eslint-disable-line no-func-assign
  provide({ effectsPass });
}
export function setGatherFrameItems(v) {
  gatherFrameItems = v; // eslint-disable-line no-func-assign
  provide({ gatherFrameItems });
}
export function setReflectionPass(v) {
  reflectionPass = v; // eslint-disable-line no-func-assign
  provide({ reflectionPass });
}
export function setShadowPass(v) {
  shadowPass = v; // eslint-disable-line no-func-assign
  provide({ shadowPass });
}
/* to-module: end */
export function propMaterial(k, M) {
  if (M && M.mat && SURFACE_MATERIALS[M.mat]) return M.mat;
  const n = ((M && M.group) || '') + ' ' + k;
  if (/house|shop|clinic|lab|bunker|tent|stall|windmill|busstop|kiosk/.test(n)) return 'building';
  if (/crystal|glass|coral/.test(n)) return 'crystal';
  if (/tree|bush|hedge|flower|reed|cattail|lily|grass|crop|seaweed|cactus|mushroom|vine|plant|hay/.test(n))
    return 'foliage';
  if (/lamp|lantern|pipe|derrick|tire|scrap|bin|trash|escal|salesign|cartS|pretzel|mailbox|flag/.test(n))
    return 'metal';
  if (/rock|boulder|well|fountain|statue|stalag|mesa|stepping|planter|flowerpot|cave|arch/.test(n)) return 'stone';
  if (/fence|bench|sign|crate|barrel|log|stump|cart|picnic|table|campfire|planter_box/.test(n)) return 'wood';
  if (/mesa/.test(n)) return 'stone';
  if (/escal|bin|pretzel|derrick/.test(n)) return 'metal';
  return M && M.box ? 'building' : 'plain';
}
/* ---------- canvas plumbing: the WebGL canvas plus a 2D layer on top for labels ---------- */
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
function screenRay(C, sx, sy) {
  const nx = (sx / C.rw) * 2 - 1,
    ny = 1 - (sy / C.rh) * 2,
    inv = C.ivp,
    P = (a, b, c) => {
      const x = inv[0] * a + inv[4] * b + inv[8] * c + inv[12],
        y = inv[1] * a + inv[5] * b + inv[9] * c + inv[13],
        z = inv[2] * a + inv[6] * b + inv[10] * c + inv[14],
        w = inv[3] * a + inv[7] * b + inv[11] * c + inv[15];
      return [x / w, y / w, z / w];
    };
  const p0 = P(nx, ny, -1),
    p1 = P(nx, ny, 1),
    d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]],
    l = Math.hypot(...d);
  return { o: p0, d: d.map(v => v / l) };
}
/* ---------- input: taps (focus follows them), two-finger turn and pinch, Ctrl+wheel zoom, Q/E/R, phone tilt ---------- */
/* alpha 0.4.1: a preview that asks for a free camera (the Studio's) turns all the way round, zooms further and zooms with the plain wheel */
const freeCameraOn = () => !!(walkView.opt && walkView.opt.freeCam),
  cameraTurnLimit = () => (freeCameraOn() ? Math.PI : (engineSetting('camera', 'turn') * Math.PI) / 180),
  clampZoom = v =>
    freeCameraOn()
      ? clamp(v, 0.3, 3.2)
      : clamp(v, engineSetting('camera', 'zoomMin'), engineSetting('camera', 'zoomMax'));
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
/* ---------- camera ---------- */
function walkCamera(rw, rh, st, dt) {
  const sc = walkView.sc,
    c = sc.cam || {},
    P = walkView.pl,
    k = Math.min(1, dt * 3.2);
  walkRenderer.yaw += (walkRenderer.yawT - walkRenderer.yaw) * Math.min(1, dt * 5);
  walkRenderer.zoom += (walkRenderer.zoomT - walkRenderer.zoom) * Math.min(1, dt * 5);
  const vx = P.x - (walkRenderer.px ?? P.x),
    vz = P.z - (walkRenderer.pz ?? P.z);
  walkRenderer.px = P.x;
  walkRenderer.pz = P.z;
  const sp = Math.hypot(vx, vz) / Math.max(dt, 1e-3),
    ld = P.walk && sp < 12 ? engineSetting('camera', 'lead') : 0,
    vl = Math.max(1e-4, Math.hypot(vx, vz));
  walkRenderer.lead[0] += ((ld ? (vx / vl) * ld : 0) - walkRenderer.lead[0]) * Math.min(1, dt * 1.6);
  walkRenderer.lead[1] += ((ld ? (vz / vl) * ld : 0) - walkRenderer.lead[1]) * Math.min(1, dt * 1.6);
  const tk = engineSetting('camera', 'tilt'),
    tilt = [
      (walkRenderer.tiltX + (walkRenderer.mouse ? walkRenderer.mouse[0] * 0.35 : 0)) * tk,
      (walkRenderer.tiltY + (walkRenderer.mouse ? walkRenderer.mouse[1] * 0.25 : 0)) * tk,
    ];
  const pitch0 = engineSetting('camera', 'pitch') ?? (c.pitch || 34) + engineSetting('camera', 'pitchAdd'),
    h0 = (engineSetting('camera', 'height') ?? (c.h || 9)) * engineSetting('camera', 'distance');
  const hb = groundHeightAt(P.x, Math.min(sc.h - 0.5, P.z + 3.5)) - groundHeightAt(P.x, P.z);
  walkRenderer.upT =
    (walkRenderer.upT || 0) + (clamp((hb - 0.8) * 3.2, 0, 9) - (walkRenderer.upT || 0)) * Math.min(1, dt * 2);
  /* v47: the camera looks up at a landmark ahead of you (landmarkTilt), and settles back as you pass */
  walkRenderer.lmT = (walkRenderer.lmT || 0) + (landmarkTilt(P, sc) - (walkRenderer.lmT || 0)) * Math.min(1, dt * 2.4);
  /* v46: the camera's height and tilt glide when they change without a cut (into and out of a room laid into the place) */
  if (!walkRenderer.camT || !walkRenderer.cpe || walkView.opt.instant)
    walkRenderer.cpe = [pitch0 + (sc.indoor ? 12 : 0), h0];
  {
    const e = Math.min(1, dt * 3.2);
    walkRenderer.cpe[0] += (pitch0 + (sc.indoor ? 12 : 0) - walkRenderer.cpe[0]) * e;
    walkRenderer.cpe[1] += (h0 - walkRenderer.cpe[1]) * e;
  }
  const pe = walkRenderer.cpe[0],
    he = walkRenderer.cpe[1];
  const pitch =
      ((pe + (walkRenderer.zoom - 1) * 14 - tilt[1] * 3 + walkRenderer.upT - walkRenderer.lmT) * Math.PI) / 180,
    yaw = walkRenderer.yaw + tilt[0] * 0.07;
  let df = (he / Math.sin(((pe - (sc.indoor ? 12 : 0)) * Math.PI) / 180)) * walkRenderer.zoom;
  const visW = Math.min(sc.w * 0.95, Math.max(11, (rw / rh) * 15)) / ((c.fov || 1) * engineSetting('camera', 'fov')),
    half = visW / 2;
  let tx = P.x + walkRenderer.lead[0],
    tz = P.z + walkRenderer.lead[1];
  tx = sc.w > visW ? clamp(tx, half - 2, sc.w - half + 2) : sc.w / 2;
  tz = clamp(tz, 0, sc.h - 2) + (rw > rh ? 2.0 : 1.0);
  if (sc.room) {
    const Rr = sc.roomRect || [0, 0, sc.w, sc.h],
      rx = Rr[0] + Rr[2] / 2,
      rz = Rr[1] + Rr[3] * 0.55;
    tx = rx + (P.x - rx) * 0.25;
    tz = rz + (P.z - rz) * 0.15;
  } /* v26: a room stays framed whole */
  if (st.focus) {
    tx = st.focus.x;
    tz = st.focus.z;
  }
  if (walkRenderer.swoop) {
    tx = walkRenderer.swoop.x;
    tz = walkRenderer.swoop.z + (rw > rh ? 1 : 0.5);
  }
  if (!walkRenderer.camT || walkView.opt.instant) walkRenderer.camT = [tx, tz, standingHeightAt(tx, tz)];
  const T = walkRenderer.camT;
  T[0] += (tx - T[0]) * k;
  T[1] += (tz - T[1]) * k;
  T[2] += ((P.yv ?? standingHeightAt(P.x, P.z)) - T[2]) * k;
  /* indoors the camera stays inside the room: never farther back than just past the near wall */
  if (sc.indoor && !sc.room) {
    const back = Math.cos(pitch) * df,
      room = T[1] + 1.2;
    if (back > room) df = Math.max(4, room / Math.cos(pitch));
  }
  const bob = P.walk && !reducedMotion ? Math.sin((P.gait || 0) / BOB_M) * 0.025 * engineSetting('camera', 'sway') : 0,
    f = [Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  let tgt = [T[0], T[2] + bob, T[1]];
  /* v35: pixel-grid camera (Engine > Camera > Pixel grid, off until the new art): when you stand still the camera
    target settles onto the art grid (1/32 m), so still pictures sit on whole pixels and don't shimmer */
  if (
    engineSetting('camera', 'pixelGrid') &&
    !P.walk &&
    !P.route &&
    !st.focus &&
    !walkRenderer.swoop &&
    !reducedMotion
  ) {
    const g = 1 / 32,
      sn = v => Math.round(v / g) * g,
      dx = sn(tgt[0]) - tgt[0],
      dz = sn(tgt[2]) - tgt[2];
    if (Math.abs(dx) < g && Math.abs(dz) < g) {
      tgt = [tgt[0] + dx, sn(tgt[1]), tgt[2] + dz];
    }
  }
  const eye = [tgt[0] - f[0] * df, tgt[1] - f[1] * df, tgt[2] - f[2] * df];
  const hfov = Math.min(1.3, 2 * Math.atan((visW * walkRenderer.zoom) / 2 / df)),
    vfov = 2 * Math.atan((Math.tan(hfov / 2) * rh) / rw);
  const proj = matrix4.persp(vfov, rw / rh, 0.5, 420);
  proj[0] = -proj[0];
  const view = matrix4.look(eye, tgt, [0, 1, 0]),
    vp = matrix4.mul(proj, view);
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)],
    back = [-Math.sin(yaw), 0, -Math.cos(yaw)],
    fwd = [Math.sin(yaw), 0, Math.cos(yaw)];
  return {
    gl: 1,
    rw,
    rh,
    vp,
    ivp: matrix4.inv(vp),
    eye,
    tgt,
    right,
    back,
    fwd,
    F: rh / 2 / Math.tan(vfov / 2),
    df,
    near: 0.5,
    far: 420,
    sp: Math.sin(pitch),
    cp: Math.cos(pitch),
    yaw,
  };
}
/* the battle stage's camera (battle-stage.js battleStageProjectWith) as a matrix: a level pinhole camera with an off-center horizon, in stage pixels */
function battleCamera(rw, rh, BT) {
  const c = BT.cam,
    L = BT.L,
    O = BT.off,
    ex = c.x + O[0],
    ez = c.z + O[1],
    ey = Math.max(BT.gy + c.y, standingHeightAt(ex, ez) + 0.4),
    e = [ex, ey, ez],
    cs = Math.cos(c.yaw),
    sn = Math.sin(c.yaw),
    r = [cs, 0, -sn],
    f = [sn, 0, cs];
  const n = 0.3,
    fa = 420,
    A = (fa + n) / (fa - n),
    B = (-2 * fa * n) / (fa - n),
    ax = (2 * BT.foc) / L.LW,
    bx = (2 * L.cx) / L.LW - 1,
    ay = (2 * BT.foc) / L.LH,
    by = 1 - (2 * (L.h0 + c.hz)) / L.LH,
    re = r[0] * ex + r[2] * ez,
    fe = f[0] * ex + f[2] * ez;
  const m = new Float32Array(16),
    set = (row, a, b, cc, d) => {
      m[row] = a;
      m[4 + row] = b;
      m[8 + row] = cc;
      m[12 + row] = d;
    };
  set(0, ax * r[0] + bx * f[0], 0, ax * r[2] + bx * f[2], -(ax * re + bx * fe));
  set(1, by * f[0], ay, by * f[2], -ay * ey - by * fe);
  set(2, A * f[0], 0, A * f[2], -A * fe + B);
  set(3, f[0], 0, f[2], -fe);
  return {
    gl: 1,
    rw,
    rh,
    vp: m,
    ivp: matrix4.inv(m),
    eye: e,
    tgt: [ex + f[0] * 4, ey, ez + f[2] * 4],
    right: r,
    back: [-f[0], 0, -f[2]],
    fwd: f,
    F: (BT.foc * rh) / L.LH,
    df: 4,
    near: n,
    far: fa,
    sp: 0,
    cp: 1,
    yaw: c.yaw,
  };
}
/* a free camera for cutscenes: eye, target and vertical field of view in degrees */
function cutsceneCamera(rw, rh, K) {
  const eye = K.eye.slice(),
    tgt = K.tgt.slice(),
    df = Math.hypot(tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]) || 1,
    vfov0 = ((K.fov || 40) * Math.PI) / 180,
    vfov = K.w ? Math.max(vfov0, 2 * Math.atan(((K.w / 2 / df) * rh) / rw)) : vfov0;
  const proj = matrix4.persp(vfov, rw / rh, 0.3, 420);
  proj[0] = -proj[0];
  const view = matrix4.look(eye, tgt, [0, 1, 0]),
    vp = matrix4.mul(proj, view),
    yaw = Math.atan2(tgt[0] - eye[0], tgt[2] - eye[2]),
    pitch = Math.asin(clamp((eye[1] - tgt[1]) / df, -1, 1));
  return {
    gl: 1,
    rw,
    rh,
    vp,
    ivp: matrix4.inv(vp),
    eye,
    tgt,
    right: [Math.cos(yaw), 0, -Math.sin(yaw)],
    back: [-Math.sin(yaw), 0, -Math.cos(yaw)],
    fwd: [Math.sin(yaw), 0, Math.cos(yaw)],
    F: rh / 2 / Math.tan(vfov / 2),
    df: Math.max(16, df),
    near: 0.3,
    far: 420,
    sp: Math.sin(pitch),
    cp: Math.cos(pitch),
    yaw,
  };
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
/* ---------- what stands in the scene this frame ---------- */
/* v23: low, wide things (fences, benches, logs, rocks, hedges, planters) follow the slope they stand on: a picture's two
   ends sit on the ground (a vertical skew along its width), a solid prop tilts with the ground. Upright things (trees,
   lamps, signs, people, buildings) stay plumb. Steps of a cliff aren't a slope: anything steeper than 35° stays level. */
const SLOPE_HUGGERS =
  /fence|bench|log|rock|boulder|stone|hedge|planter|crate|pipe|rail|wall|bush|flower|hay|pumpkin|melon|crop|tire|planks|stump|vineyard/;
/* v26: how much a thing is leaves or grass (it turns with the seasons; evergreens hardly) and whether snow settles on it */
const FOLIAGE_PROPS =
    /tree_(oak|fruit|birch|maple|willow|blossom)|street_tree|^tree$|bush|hedge|tallgrass|reeds|cattail|flowers|fern|crops|vine|ivy|lily|grass/,
  EVERGREEN_PROPS = /pine|palm|cactus|dead|snow/;
export function foliageAmount(it) {
  if (!it || it.k !== 'prop' || it.person || !it.M) return [0, 0];
  const M = it.M;
  if (M._fol) return M._fol;
  const g = (M.group || '') + ' ' + ((it.p && it.p.k) || '');
  return (M._fol = [
    EVERGREEN_PROPS.test(g)
      ? 0.3
      : /tallgrass|reeds|cattail|grass|fern|flowers|crops|lily/.test(g)
        ? 0.7
        : FOLIAGE_PROPS.test(g)
          ? 1
          : 0,
    it.flat || /puddle|crosswalk|manhole|lily|fallen/.test(g) ? 0 : 1,
  ]);
}
/* alpha 0.4.1: worked out once per prop and kept (the ground doesn't move): six height samples a prop every frame were
   a quarter of gathering the frame's items in a big place; the slope across the view again only when the camera turns */
const SLOPE_HUG_CACHE = new WeakMap();
function hugSlope(it, C) {
  if (!it || it.bld3 || it.flat || !engineSetting('world', 'hugSlopes')) return;
  const M = it.M,
    p = it.p;
  if (M._hugK !== p.k) {
    M._hugK = p.k;
    const g = (M.group || '') + ' ' + p.k;
    M._hug = SLOPE_HUGGERS.test(g) && !/tree|lamp|post|sign|pole/.test(g);
  }
  if (!M._hug) return;
  const R = it.fixed ? FIXED_RIGHT : C.right,
    e = 0.45,
    h = (x, z) => groundHeightAt(x, z),
    x = it.x,
    z = it.z,
    id = walkView.id,
    ig = walkRenderer.itemGen || 0;
  let c = SLOPE_HUG_CACHE.get(p);
  if (!c || c.id !== id || c.ig !== ig || c.x !== x || c.z !== z) {
    const gx = (h(x + e, z) - h(x - e, z)) / (2 * e),
      gz = (h(x, z + e) - h(x, z - e)) / (2 * e),
      gm = Math.hypot(gx, gz);
    c = { id, ig, x, z, tilt: gm < 0.7 && gm > 0.02 ? [gx, gz] : null, rx: NaN, rz: NaN, slope: null };
    SLOPE_HUG_CACHE.set(p, c);
  }
  if (c.rx !== R[0] || c.rz !== R[2]) {
    const s = (h(x + R[0] * e, z + R[2] * e) - h(x - R[0] * e, z - R[2] * e)) / (2 * e);
    c.rx = R[0];
    c.rz = R[2];
    c.slope = Math.abs(s) > 0.02 && Math.abs(s) < 0.7 ? s : null;
  }
  if (c.slope != null) it.slope = c.slope;
  if (c.tilt) it.tilt = c.tilt;
}
/* v24: riding. On water in a riding scene you sit on your biggest Water billionaire (rules.ride), drawn from its rig,
   facing away when you head up the screen; it bobs, and leaves ripple rings behind. */
function rideMountItem(P, t) {
  const sc = walkView.sc;
  if (!sc || !sc.ride || typeof riderOf !== 'function' || typeof saveData === 'undefined' || !saveData.team)
    return null;
  const ch = terrainAt(P.x, P.z);
  if (ch !== 'w' && ch !== 'd') {
    walkRenderer.mountOn = false;
    return null;
  }
  const m =
    riderOf() || saveData.team.find(x => SPECIES[x.sp] && SPECIES[x.sp].types.includes('Water')) || saveData.team[0];
  if (!m || !SPECIES[m.sp]) return null;
  const back = P.dir === 'up',
    R = rigParts(m.sp, m.gold, back ? 2 : 1);
  if (!R) {
    if (!walkRenderer.mountLoad) {
      walkRenderer.mountLoad = 1;
      rigPreload([
        [m.sp, m.gold, 1],
        [m.sp, m.gold, 2],
      ]).then(() => {
        walkRenderer.mountLoad = 0;
      });
    }
    return null;
  }
  let cv = walkRenderer.mountCv;
  if (!cv || cv.width !== R.BW || cv.height !== R.BH) {
    cv = walkRenderer.mountCv = makeCanvas(R.BW, R.BH);
    cv.__v = 0;
  }
  const x = cv.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, cv.width, cv.height);
  x.imageSmoothingEnabled = false;
  const F = rigFrame(R, null, 0, reducedMotion ? 0 : Math.floor(t / 50) * 50, 1.7);
  if (m.build) F.build = m.build;
  drawRig(x, R, F, back ? 'back' : 'front');
  cv.__v++;
  const ht = clamp(SPECIES[m.sp].ht, 0.9, 3),
    hm = 0.75 + ht * 0.32,
    mpp = hm / Math.max(40, R.base - (R.geo && R.geo.top != null ? R.geo.top : 0)),
    bob = reducedMotion ? 0 : Math.sin(t / 420) * 0.05,
    y = standingHeightAt(P.x, P.z) + bob - 0.08;
  if (!reducedMotion && P.walk && (!walkRenderer.wakeT || t - walkRenderer.wakeT > 320)) {
    walkRenderer.wakeT = t;
    addRipple(P.x, P.z - 0.1, 0.9);
  }
  walkRenderer.mountOn = true;
  return {
    it: {
      k: 'life',
      im: cv,
      x: P.x,
      z: P.z + 0.01,
      y,
      mpp,
      ox: -R.cx,
      oy: -R.base,
      w: R.BW,
      h: R.BH,
      flip: P.dir === 'side' ? -1 : 1,
      shear: 0,
      sh: 0,
      aoR: 0,
      person: 1,
    },
    lift: hm * 0.62 + bob - 0.12,
  };
}
/* ---------- v32: every prop its own look ----------
   Variety (size, colour, a little turn and lean) and wear (dirt, moss, faded paint, cracks), from three places:
   defaults by kind of thing (below), the catalog ("vary" and "wear" on a prop in the Studio's prop editor) and each
   placed prop ("vary", "wear", "tint"), scaled by the scene ("variety", "wear") and the Engine dials (World →
   Variety, Wear and tear, Prop turning). Each placed prop draws its own values from where it stands, so a scene
   looks the same every visit. */
const PROP_VARIETY_RULES = [
  [/tree|palm|street_tree/, { size: 0.14, hue: 9, sat: 0.12, val: 0.1, rot: 0, lean: 1.5, mask: [104, 47], wear: {} }],
  [
    /bush|hedge|fern|tallgrass|reeds|cattail|crops|vine|ivy/,
    { size: 0.16, hue: 11, sat: 0.14, val: 0.1, rot: 10, lean: 2, mask: [104, 54], wear: {} },
  ],
  [/flower|lily/, { size: 0.16, hue: 22, sat: 0.1, val: 0.08, rot: 10, lean: 2, mask: null, wear: {} }],
  [
    /rock|boulder|stone|pebble|basalt|obsidian|stalag|crystal|mesa|lava_rock/,
    { size: 0.18, hue: 0, sat: 0.08, val: 0.09, rot: 22, lean: 3, mask: null, wear: { moss: 0.35, dirt: 0.1 } },
  ],
  [
    /house|shop|clinic|lab|tower|apartment|hall|villa|chalet|mart|cafe|boutique|windmill|cave_house|townhouse/,
    {
      size: 0,
      hue: 11,
      sat: 0.12,
      val: 0.06,
      rot: 0,
      lean: 0,
      mask: null,
      wear: { dirt: 0.38, moss: 0.2, fade: 0.25, crack: 0.22 },
    },
  ],
  [
    /crate|barrel|bench|fence|sign|cart|log|stump|wheelbarrow|picnic|table|chair|planter|hay|sack|firewood|beehive|birdhouse|dock_post|stall|scarecrow|laundry/,
    {
      size: 0.08,
      hue: 5,
      sat: 0.08,
      val: 0.1,
      rot: 7,
      lean: 1.5,
      mask: null,
      wear: { dirt: 0.25, moss: 0.15, fade: 0.25, crack: 0.12 },
    },
  ],
  [
    /lamp|lantern|hydrant|mailbox|bin|trash|bollard|traffic|phone|vending|newsstand|bus|bike|meter|pipe|tire|scrap|car_|food_truck|kiosk|pretzel/,
    {
      size: 0.04,
      hue: 7,
      sat: 0.08,
      val: 0.06,
      rot: 3,
      lean: 0.8,
      mask: null,
      wear: { dirt: 0.22, fade: 0.18, crack: 0.05 },
    },
  ],
  [
    /statue|fountain|well|arch|wall|column|snowman/,
    {
      size: 0.03,
      hue: 0,
      sat: 0.05,
      val: 0.06,
      rot: 0,
      lean: 0,
      mask: null,
      wear: { dirt: 0.25, moss: 0.3, crack: 0.25 },
    },
  ],
];
const PROP_VARIETY_DEFAULT = {
  size: 0.06,
  hue: 7,
  sat: 0.06,
  val: 0.06,
  rot: 5,
  lean: 1,
  mask: null,
  wear: { dirt: 0.12 },
};
export function propVariety(k, M) {
  const mk =
    M && M.vary ? JSON.stringify(M.vary) + JSON.stringify(M.wear || 0) : M && M.wear ? JSON.stringify(M.wear) : '';
  if (M && M._vy && M._vyk === mk) return M._vy;
  const g = ((M && M.group) || '') + ' ' + k;
  let d = PROP_VARIETY_DEFAULT;
  for (const [re, v] of PROP_VARIETY_RULES)
    if (re.test(g)) {
      d = v;
      break;
    }
  if (M && M.flat && !/flower|lily/.test(g)) d = Object.assign({}, d, { rot: 0, lean: 0 });
  const out = Object.assign({}, d, (M && M.vary) || {}, { wear: Object.assign({}, d.wear, (M && M.wear) || {}) });
  if (M) {
    Object.defineProperty(M, '_vy', { value: out, writable: true, configurable: true, enumerable: false });
    Object.defineProperty(M, '_vyk', { value: mk, writable: true, configurable: true, enumerable: false });
  }
  return out;
}
/* v32: a stump or log here and there is drawn with its mossy twin (same size and footprint), so a wood isn't a row of
   copies. Prop variety at 0, "Exactly as drawn" on the prop, or alt:0 on it keeps the picture as placed. */
const ALTERNATE_PROPS = { stump: ['stump_mossy'], log: ['log_mossy'] };
provide({ ALTERNATE_PROPS }); /* to-module */
function alternatePropImage(p, M, C0, sc) {
  const L = ALTERNATE_PROPS[p.k];
  if (
    !L ||
    p.v ||
    p.plain ||
    p.alt === 0 ||
    !((engineSetting('world', 'variety') ?? 1) > 0) ||
    (sc && sc.variety === 0)
  )
    return M.img;
  const h = hash2d(Math.round(p.x * 23) + 5, Math.round(p.z * 19) + 11);
  if (h > 0.38) return M.img;
  const A = C0.props[L[Math.floor((h / 0.38) * L.length) % L.length]];
  const ai = A && A.img;
  if (!ai) return M.img;
  const t = artImage(ai);
  return imageReady(t) ? ai : M.img;
}
const PROP_LOOK_CACHE = new WeakMap();
/* v34: a still prop keeps what it worked out last frame (its look, its height on the ground, its material) and only
   checks again twice a second or when it moves, so a big scene doesn't redo hundreds of string keys every frame */
const STILL_PROP_CACHE = new WeakMap();
/* when a prop checked last, rounded down to its own half-second beat (set by its place): props worked out in the same
   frame (a scene opening, the ground changing) check again spread over the next half second, not all in one frame twice
   a second, which was a regular spike on phones */
function propCheckedAt(p, t) {
  return t - ((t + hash2d(Math.round(p.x * 7) + 3, Math.round(p.z * 5) + 11) * 500) % 500);
}
function propGrid(sc) {
  const L = sc.props || [],
    G = walkRenderer.pgrid;
  /* made again only when a prop is added, moved or resized, or the ground changes (itemGen), not on a timer: a full
     rebuild every 2 s was a regular spike on phones; the signature reads every prop (cheap next to the rebuild) */
  let sig = L.length;
  for (const p of L) sig = (sig * 31 + (p.x * 7 + p.z * 13 + (p.s || 1) * 101) * 16) | 0;
  const gen = walkRenderer.itemGen || 0;
  if (G && G.sc === sc && G.sig === sig && G.gen === gen) return G;
  const S = 6,
    m = new Map();
  for (const p of L) {
    const k = Math.floor(p.x / S) + ',' + Math.floor(p.z / S);
    let c = m.get(k);
    if (!c) {
      c = { list: [], x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9, y0: 1e9, y1: -1e9 };
      m.set(k, c);
    }
    c.list.push(p);
    const r = 2.5 * (p.s || 1),
      y = typeof standingHeightAt === 'function' ? standingHeightAt(p.x, p.z) : 0;
    c.x0 = Math.min(c.x0, p.x - r);
    c.x1 = Math.max(c.x1, p.x + r);
    c.z0 = Math.min(c.z0, p.z - r);
    c.z1 = Math.max(c.z1, p.z + r);
    c.y0 = Math.min(c.y0, y);
    c.y1 = Math.max(c.y1, y + 8 * (p.s || 1));
  }
  const cells = [...m.values()].map(c => ({
    list: c.list,
    x: (c.x0 + c.x1) / 2,
    z: (c.z0 + c.z1) / 2,
    y: (c.y0 + c.y1) / 2,
    r: Math.hypot(c.x1 - c.x0, c.z1 - c.z0, c.y1 - c.y0) / 2,
  }));
  return (walkRenderer.pgrid = { sc, sig, gen, cells });
}
function stillPropState(p, M, im, sc) {
  const t = walkView.t || 0,
    s = p.s || 1,
    id = walkView.id || '',
    src = (im && im.src) || '',
    gen = walkRenderer.itemGen || 0;
  let c = STILL_PROP_CACHE.get(p);
  /* alpha 0.4.1: compared field by field (a key string was built for every prop every frame) */
  if (
    c &&
    c.k === p.k &&
    c.x === p.x &&
    c.z === p.z &&
    c.s === s &&
    c.id === id &&
    c.src === src &&
    c.gen === gen &&
    t - c.at < 500 &&
    t >= c.at
  )
    return c;
  const mat = propMaterial(p.k, M),
    at = propCheckedAt(p, t);
  c = {
    k: p.k,
    x: p.x,
    z: p.z,
    s,
    id,
    src,
    gen,
    at,
    y: propBaseHeight(p, M),
    mat,
    plane: M.face === 'fixed' || !!M.box || mat === 'wood' || mat === 'building',
    cross:
      M.face !== 'billboard' &&
      !M.flat &&
      mat === 'foliage' &&
      /tree|flower|fern|tallgrass|reed|cattail|crop/.test((M.group || '') + p.k),
    bob: BOBBING_PROPS.test(p.k),
    flag: WAVING_PROPS.test(p.k),
  };
  STILL_PROP_CACHE.set(p, c);
  return c;
}
/* alpha 0.4.1: the settings a prop's look depends on, read once a frame rather than once a prop */
function propLookSettings(sc) {
  if (walkRenderer._lsF === walkRenderer.frames && walkRenderer._lsSc === sc) return walkRenderer._ls;
  walkRenderer._lsF = walkRenderer.frames;
  walkRenderer._lsSc = sc;
  return (walkRenderer._ls =
    (engineSetting('world', 'variety') ?? 1) +
    ',' +
    (engineSetting('world', 'wear') ?? 1) +
    ',' +
    (engineSetting('world', 'propTurn') ?? 1) +
    ',' +
    (sc.variety ?? 1) +
    ',' +
    (sc.wear ?? 1) +
    ',' +
    (sc.lookSeed || 0));
}
function propLook(p, M, sc) {
  const c0 = PROP_LOOK_CACHE.get(p),
    t = walkView.t || 0,
    sg = propLookSettings(sc);
  if (
    c0 &&
    c0.at !== undefined &&
    t - c0.at < 500 &&
    t >= c0.at &&
    c0.px === p.x &&
    c0.pz === p.z &&
    c0.sg === sg &&
    c0.gen === (walkRenderer.itemGen || 0)
  )
    return c0;
  const L0 = computePropLook(p, M, sc);
  L0.at = propCheckedAt(p, t);
  L0.px = p.x;
  L0.pz = p.z;
  L0.sg = sg;
  L0.gen = walkRenderer.itemGen || 0;
  return L0;
}
function computePropLook(p, M, sc) {
  const E = [
      engineSetting('world', 'variety') ?? 1,
      engineSetting('world', 'wear') ?? 1,
      engineSetting('world', 'propTurn') ?? 1,
    ],
    key =
      p.k +
      '|' +
      p.x +
      '|' +
      p.z +
      '|' +
      JSON.stringify(p.vary || 0) +
      JSON.stringify(p.wear ?? 0) +
      (p.tint || '') +
      (p.tintAmt ?? '') +
      (p.plain ? 'P' : '') +
      '|' +
      (sc.variety ?? 1) +
      '|' +
      (sc.wear ?? 1) +
      '|' +
      (sc.lookSeed || 0) +
      '|' +
      E.join(',') +
      '|' +
      (M && M._vyk !== undefined ? M._vyk : '') +
      (M && M.vary ? JSON.stringify(M.vary) : '') +
      (M && M.wear ? JSON.stringify(M.wear) : '');
  const c = PROP_LOOK_CACHE.get(p);
  if (c && c.key === key) return c;
  const V = Object.assign({}, propVariety(p.k, M), p.vary || {}),
    sd = (sc.lookSeed || 0) * 101,
    r = n => hash2d(Math.round(p.x * 31) + n * 17 + sd, Math.round(p.z * 29) + n * 7 + sd) * 2 - 1,
    vk = p.plain ? 0 : E[0] * (sc.variety ?? 1);
  let W = Object.assign({}, V.wear);
  if (typeof p.wear === 'number') for (const k in W) W[k] *= p.wear;
  else if (p.wear && typeof p.wear === 'object') Object.assign(W, p.wear);
  const wk = E[1] * (sc.wear ?? 1),
    dry = /[sznj]/.test(sc.edge || '') || /desert|volcano|canyon/.test(sc.far || '') ? 0.25 : 1,
    jit = n => 0.55 + 0.9 * hash2d(Math.round(p.x * 13) + n * 5, Math.round(p.z * 11) + n * 3);
  const wear = [
    (W.dirt || 0) * wk * jit(1),
    (W.moss || 0) * wk * jit(2) * dry,
    (W.fade || 0) * wk * jit(3),
    (W.crack || 0) * wk * jit(4),
  ].map(v => clamp(v, 0, 1.5));
  const hue = ((V.hue || 0) / 360) * vk * r(1),
    sat = (V.sat || 0) * vk * r(2),
    val = (V.val || 0) * vk * r(3),
    on = Math.abs(hue) + Math.abs(sat) + Math.abs(val) > 0.002 ? 1 : 0;
  let tint = [1, 1, 1, 0];
  if (p.tint && p.tint !== '#000000') {
    const t = hexToRgb(p.tint);
    tint = [t[0] / 255, t[1] / 255, t[2] / 255, clamp(p.tintAmt ?? 0.6, 0, 1)];
  }
  const L = {
    key,
    hsv: [hue, sat, val, on],
    wear,
    tint,
    mask: V.mask && V.mask.length === 2 && V.mask[1] > 0 ? [V.mask[0] / 360, V.mask[1] / 360] : [0, 0],
    size: 1 + (V.size || 0) * vk * r(4) * (p.s && p.vary && p.vary.size === 0 ? 0 : 1),
    rot: p.plain ? 0 : ((V.rot || 0) * E[2] * r(5) * Math.PI) / 180,
    lean: p.plain ? 0 : ((V.lean || 0) * E[2] * r(6) * Math.PI) / 180,
  };
  PROP_LOOK_CACHE.set(p, L);
  return L;
}
const NEUTRAL_LOOK = { hsv: [0, 0, 0, 0], wear: [0, 0, 0, 0], tint: [1, 1, 1, 0], mask: [0, 0] };
export function setPropLookUniforms(U, L, bp) {
  const gl = gpuState.gl;
  if (!U.uWear) return;
  L = L || NEUTRAL_LOOK;
  gl.uniform4fv(U.uWear, L.wear);
  gl.uniform4fv(U.uHsv, L.hsv);
  gl.uniform4fv(U.uLkTint, L.tint);
  gl.uniform2fv(U.uMaskH, L.mask);
  if (U.uBP && bp) gl.uniform3fv(U.uBP, bp);
}
const BOBBING_PROPS = /sailboat|rowboat|buoy/,
  WAVING_PROPS = /banner|laundry|beach_umbrella|ski_sign/;
/* v43: one wind for every plant: a slow lean that drifts across the scene, a faster flutter, and the gust bands
   (windGustAt) that travel over the grass; the result is a lean of the top of the sprite as a fraction of its height */
export function windLeanAt(x, z, t, sc, wind) {
  const k = (sc.wind || 1) * (wind == null ? engineSetting('grass', 'wind') : wind);
  return windBendAt(x, z, t, engineSetting('grass', 'gusts')) * k;
}
export function gatherFrameItems(st, C, PPU, C0) {
  const sc = walkView.sc,
    P = walkView.pl,
    t = walkView.t,
    out = [],
    hub = mapHub(sc),
    tg = tallGrassProps(C0),
    wind = engineSetting('grass', 'wind'),
    odt = Math.min(0.1, Math.max(0, (t - (walkRenderer.owT ?? t)) / 1000)),
    ow = typeof worldBillyItem === 'function' && !st.battle && !walkRenderer.bt,
    npcPos = [];
  walkRenderer.owT = t;
  if (ow && worldBillies.warmId !== walkView.id) {
    worldBillies.warmId = walkView.id;
    warmWorldBillies();
  }
  const prop = (p, far) => {
    const M = propWithVariant(p, C0.props[p.k]);
    if (!M || !propShown(p)) return;
    const im = artImage(alternatePropImage(p, M, C0, sc));
    if (!imageReady(im)) return;
    const lk = far ? null : propLook(p, M, sc),
      /* phase 09 batch 1: a prop drawn at its own scale (ppm: pixels to the metre, 32 for the new style) */
      s = ((p.s || 1) / (M.ppm || PPU)) * (lk ? lk.size : 1) * (p.grow != null ? cropGrowth(p) : 1),
      w = im.naturalWidth || im.width,
      h = im.naturalHeight || im.height;
    const S = far ? null : stillPropState(p, M, im, sc);
    const y = far ? standingHeightAt(p.x, p.z) : S.y,
      sw = far || !M.sway ? 0 : (M.sway || 0) * windLeanAt(p.x, p.z, reducedMotion ? 0 : t, sc, wind);
    const mat = S ? S.mat : propMaterial(p.k, M);
    im.__mat = mat;
    /* v27: boats and buoys bob and roll on the water; flags, banners and washing flutter in the wind */
    let y2 = y,
      sw2 = sw;
    if (!far && !reducedMotion) {
      const ph = p.x * 1.3 + p.z * 0.7,
        gk = (sc.wind || 1) * wind;
      if (S.bob) {
        y2 += Math.sin(t / 760 + ph) * 0.05;
        sw2 += Math.sin(t / 1130 + ph) * 0.035;
      } else if (S.flag) sw2 += (Math.sin(t / 230 + ph) * 0.025 + Math.sin(t / 97 + ph * 2) * 0.012) * gk;
    }
    /* v34: a flat picture (a sign, a painted board) stands upright: no random lean, only the wind */
    out.push({
      k: far ? 'farp' : 'prop',
      still: !far && !M.sway && !S.bob && !S.flag,
      lk,
      p,
      M,
      im,
      x: p.x,
      z: p.z,
      y: y2,
      mpp: s,
      ox: M.ox,
      oy: M.oy,
      w,
      h,
      flip: p.f ? -1 : 1,
      shear: sw2 + (lk && !M.box && !M.build && !M.flat ? lk.lean : 0),
      flat: M.flat,
      sh: (M.shadow || 0) * (p.s || 1),
      far,
      fixed: M.face !== 'billboard',
      mat,
      plane: S ? S.plane : M.face === 'fixed' || !!M.box || mat === 'wood' || mat === 'building',
      cross: !far && S.cross,
      bld3: !far && !!(M.build && M.box) && typeof buildingsOn === 'function' && buildingsOn(),
    });
    if (!far) hugSlope(out[out.length - 1], C);
    /* v46: a building whose solid or front isn't made yet (a few are made per frame) shows as its picture meanwhile, never as nothing */
    if (!far) {
      const bi = out[out.length - 1];
      if (bi.bld3) {
        let E = null,
          F = null;
        buildingGuard(() => {
          E = buildingMesh(bi);
          if (E && E.walls) F = buildingFrontPicture(bi.im, M.build, M);
        });
        if (!E || !E.walls || !F) bi.bld3 = false;
      }
    }
    /* v43: a prop with a voxel recipe draws as a solid (prop-models.js); its picture layers come along as sprites */
    if (!far && M.model && typeof tagPropModel === 'function') {
      const vi = out[out.length - 1];
      tagPropModel(vi);
      if (vi.vox) propModelImageItems(vi, out);
    }
    /* v43: a flag pole is rigid; its cloth is a separate picture (the town's flag) draped from the top and waved by the wind */
    if (!far && M.flag) {
      const F = M.flag,
        fi = artImage(flagPicturePath(sc)),
        fim = imageReady(fi) ? fi : artImage('scene/flags/default.png');
      if (imageReady(fim)) {
        const fl = p.f ? -1 : 1,
          ps = p.s || 1,
          wv = reducedMotion ? 0 : windLeanAt(p.x, p.z, t, sc, wind);
        out.push({
          k: 'flag',
          p,
          M,
          im: fim,
          x: p.x + F.dx * ps * fl,
          z: p.z,
          y: y + F.h * ps,
          mpp: 1,
          ox: 0,
          oy: -F.fh * ps,
          w: F.w * ps,
          h: F.fh * ps,
          flip: fl,
          shear: 0,
          sh: 0,
          fixed: false,
          mat: 'cloth',
          wave: [0.05 + Math.abs(wv) * 1.1, t / 170 + p.x * 0.7, 0],
        });
      }
    }
    /* extra layers for depth: each one a sprite of its own, dz meters behind (or in front of) the main picture */
    if (!far && M.layers)
      for (const l of M.layers) {
        const li = l.img && artImage(l.img);
        if (!imageReady(li)) continue;
        const LM = layerAsProp(M, l);
        /* alpha 0.4: a layer that swings from a point (the rope swing on the great oak: l.pivot metres up), a slow pendulum
      pushed a little harder by the gusts: it leans one way about the pivot and moves the other, so the pivot stays put */
        let lx = p.x,
          lsh = sw * (l.sway ?? 1);
        if (l.swing && !reducedMotion) {
          const a =
            Math.sin(t / (l.swingT || 720) + p.x * 0.9 + p.z * 0.4) * l.swing * (1 + Math.min(1.5, Math.abs(sw) * 10));
          lsh -= a;
          lx += a * (l.pivot || 3) * (p.s || 1);
        }
        out.push({
          k: 'prop',
          still: !M.sway && !S.bob && !S.flag && !l.swing,
          lk,
          layer: l,
          p,
          M,
          im: li,
          x: lx,
          z: p.z + (l.dz || 0) * (p.s || 1),
          y,
          mpp: s,
          ox: LM.ox,
          oy: LM.oy,
          w: li.naturalWidth || li.width,
          h: li.naturalHeight || li.height,
          flip: p.f ? -1 : 1,
          shear: lsh,
          flat: LM.flat,
          sh: l.glow || M.box || l.shadow === 0 ? 0 : (M.shadow || 0) * (p.s || 1),
          fixed: l.face !== 'billboard',
          glow: l.glow || 0,
          mat,
          plane: l.face === 'fixed' || !!M.box || mat === 'wood' || mat === 'building',
        });
        li.__mat = mat;
      }
  };
  /* v34: props sit in a grid of 6 m squares; a square well outside the view (8 m of slack for shadows and lamp light)
    isn't looked at at all this frame */
  /* alpha 0.4: in a 3D battle too (it gathered every prop of the place each frame: 6 to 9 ms on a phone) */
  const GR = propGrid(sc),
    F = C.vp && (engineSetting('quality', 'cull') ?? true) ? computeFrustum(C.vp) : null;
  let gs = 0;
  for (const c of GR.cells) {
    if (F && !inFrustum(F, c.x, c.y + worldCurveDrop(c.x, c.z), c.z, c.r + 8)) {
      gs += c.list.length;
      continue;
    }
    for (const p of c.list) prop(p);
  }
  walkRenderer.gridSkip = gs;
  for (const p of walkRenderer.farProps) prop(p, 1);
  (st.npcs || []).forEach((n, i) => {
    let pos = walkView.npcAt[n.id];
    if (!pos && n.at) pos = walkView.npcAt[n.id] = walkablePointNear(n.at[0], n.at[1]);
    if (!pos) {
      if (!st.mode || st.mode === 'line') {
        const a = pointAlongMapPath(sc, n.t ?? 0.7 + i * 0.08);
        pos = [a.x + (n.dx || 0), a.z + (n.dz ?? 1.5)];
      } else if (n.exit) {
        const dx = hub[0] - n.exit[0],
          dz = hub[1] - n.exit[1],
          l = Math.hypot(dx, dz) || 1;
        pos = walkablePointNear(n.exit[0] + (dx / l) * 2.2, n.exit[1] + (dz / l) * 2.2);
      } else if (sc.npcSpots && sc.npcSpots[i]) pos = sc.npcSpots[i].slice();
      else {
        const a = i * 2.3 + 0.6,
          r = 3.4 + i * 0.9;
        pos = walkablePointNear(hub[0] + Math.cos(a) * r, hub[1] + Math.sin(a) * r * 0.7);
      }
      walkView.npcAt[n.id] = pos;
    }
    const fr = typeof personWalkFrames === 'function' ? personWalkFrames(n.who) : null;
    if (!fr) return;
    warmPerson(n.who);
    const dir =
      Math.hypot(P.x - pos[0], P.z - pos[1]) < 4.5 ? directionOf(P.x - pos[0], P.z - pos[1]) : n.dir || 'down';
    const nset = fr[dir] || fr.down,
      nim = typeof pickWalkFrame === 'function' ? pickWalkFrame(nset, false, 0) : nset[0];
    if (nim) out.push(personItem('npc', nim, pos[0], pos[1], C0, { n }));
    npcPos.push([n, pos]);
  });
  if (ow) {
    companionItems(out, t, npcPos);
    buddyItems(out, t, odt);
    if (typeof friendWorldItems === 'function')
      try {
        friendWorldItems(out, t, C0);
      } catch (e) {}
  }
  const used = [];
  walkRenderer.encPos = [];
  (st.enc || []).forEach(e => {
    let s = walkView.enc[e.id];
    if (!s || s.sc !== walkView.id) {
      const sp = encounterSpot(sc, e.id, used);
      s = walkView.enc[e.id] = { x: sp[0], z: sp[1], tx: sp[0], tz: sp[1], sc: walkView.id };
    }
    /* v46: they keep their spot in the tall grass until you battle them: no wandering. They stay alive in place (a bob,
     the grass swaying round them, a peek now and then, see wildBillyItem) and rustle when you come close */
    s.tx = s.x;
    s.tz = s.z;
    if (!st.battle && !reducedMotion && !walkRenderer.bt) {
      const dd = Math.min(0.1, (t - (s.lt || t)) / 1000);
      s.lt = t;
      const P = walkView.pl;
      if (P && typeof soundEffectAt === 'function' && Math.hypot(P.x - s.x, P.z - s.z) < 4 && Math.random() < dd * 0.25)
        soundEffectAt('rustle', s.x, s.z);
    }
    used.push([s.x, s.z]);
    walkRenderer.encPos.push([s.x, s.z, e.id]);
    const g = tg[Math.abs(Math.round(s.x * 7 + s.z * 3)) % tg.length];
    const im = g && artImage(g.img);
    if (!imageReady(im)) return;
    const moving = Math.hypot((s.tx ?? s.x) - s.x, (s.tz ?? s.z) - s.z) > 0.05,
      ru = moving ? 0.06 * Math.sin(t / 70 + s.x) : 0,
      wv = reducedMotion ? 0 : windLeanAt(s.x, s.z, t, sc, wind);
    out.push({
      k: 'enc',
      e,
      im,
      x: s.x + ru * 0.5,
      z: s.z,
      y: standingHeightAt(s.x, s.z),
      mpp: 1.25 / PPU,
      ox: g.ox,
      oy: g.oy,
      w: im.naturalWidth || im.width,
      h: im.naturalHeight || im.height,
      flip: 1,
      shear: wv + ru,
      sh: 0.5,
    });
    out.push({
      k: 'enc2',
      e,
      im,
      x: s.x + 0.18,
      z: s.z - 0.12,
      y: standingHeightAt(s.x, s.z),
      mpp: 1.1 / PPU,
      ox: g.ox,
      oy: g.oy,
      w: im.naturalWidth || im.width,
      h: im.naturalHeight || im.height,
      flip: -1,
      shear: -(wv * 0.8) - ru * 0.7,
      sh: 0,
    });
    if (ow) wildBillyItem(out, e, s, t, odt);
  });
  if (!st.battle)
    for (const f of walkView.folk) {
      const fr = folkFrames(f.seed);
      if (!fr) continue;
      warmPerson('folk:' + f.seed);
      const set = fr[f.dir] || fr.down;
      let fim =
        typeof pickWalkFrame === 'function'
          ? pickWalkFrame(set, f.walk, Math.floor(t / 110) % 6)
          : f.walk
            ? set.cyc
              ? set.cyc[Math.floor(t / 110) % 6]
              : set[1 + (Math.floor(t / 150) % 2)]
            : set[0];
      /* v47: a wave hello */ if (f.waveT > 0 && typeof personBattlePose === 'function') {
        const w = personBattlePose('folk:' + f.seed, 'front', 'cheer', 0, (1.4 - f.waveT) * 1000);
        if (w) fim = w;
      }
      if (fim) out.push(personItem('folk', fim, f.x, f.z, C0, { f }));
    }
  if (typeof lifeSprites === 'function')
    for (const L of lifeSprites())
      out.push({
        k: 'life',
        im: L.im,
        x: L.x,
        z: L.z,
        y: L.y,
        mpp: L.mpp,
        ox: -L.im.width / 2,
        oy: -L.im.height,
        w: L.im.width,
        h: L.im.height,
        flip: L.flip,
        shear: 0,
        sh: L.sh,
        aoR: Math.max(0.12, L.sh * 0.8),
      });
  if (typeof tagSolidProp === 'function') {
    for (const it of out) if (it.fixed !== false) tagSolidProp(it, PPU);
    if (typeof solidPropLevelOfDetail === 'function')
      solidPropLevelOfDetail(out, C); /* a solid tree has its crown in 3D: its layered crown pictures go */
    const T = new Set(out.filter(it => it.vol && it.vol.tree).map(it => it.p));
    if (T.size) for (let i = out.length - 1; i >= 0; i--) if (out[i].layer && T.has(out[i].p)) out.splice(i, 1);
  }
  if (st.who !== null && typeof personWalkFrames === 'function') {
    const fr = personWalkFrames(st.who),
      set = fr[P.dir] || fr.down;
    const me = personItem(
      'me',
      P.hop
        ? set.cyc
          ? set.cyc[2]
          : set[1]
        : P.walk
          ? set.cyc
            ? set.cyc[Math.floor((P.gait || 0) / WALK_FRAME_M) % 6]
            : set[1 + (Math.floor((P.gait || 0) / (WALK_FRAME_M * 1.36)) % 2)]
          : set[0],
      P.x,
      P.z,
      C0,
      { shear: reducedMotion ? 0 : P.lean || 0 }
    );
    if (P.yv != null && P.yId === walkView.id) me.y = P.yv;
    const mt = rideMountItem(P, t);
    if (mt) {
      out.push(mt.it);
      me.y += mt.lift;
      me.im = set[0];
      me.z -= 0.02;
    }
    out.push(me);
  }
  return out;
}
/* a prop's base height: on a slope the lowest point under it on its own terrace (so it never floats on the downhill
   side), rocks and boulders sunk a little into the ground */
/* alpha 0.2: a rock formation or a hill-built thing with a footprint stands at the lowest point under it (it sinks into the slope, it never hangs over it) */
const SUNKEN_FOOTPRINT_PROPS = /mesa|vault_door|mine_entrance|shipwreck|stilt|spore_mill/;
function propBaseHeight(p, M) {
  const y0 = standingHeightAt(p.x, p.z);
  if (M.box && SUNKEN_FOOTPRINT_PROPS.test(p.k)) {
    const s = p.s || 1,
      bw = (M.box[0] * s) / 2,
      bd = M.box[1] * s,
      lv = stepLevelAt(p.x, p.z);
    let y = y0;
    for (const [x, z] of [
      [p.x - bw, p.z - 0.05],
      [p.x + bw, p.z - 0.05],
      [p.x - bw, p.z + bd],
      [p.x + bw, p.z + bd],
    ])
      if (Math.abs(stepLevelAt(x, z) - lv) <= 0.05) y = Math.min(y, standingHeightAt(x, z));
    return y;
  }
  if (M.box || M.flat || M.walk) return y0;
  const r = Math.min(0.45, (M.shadow || 0) * 0.3 * (p.s || 1));
  if (r < 0.08) return y0;
  const s0 = stepLevelAt(p.x, p.z);
  let y = y0;
  for (const [a, b] of [
    [-r, 0],
    [r, 0],
    [0, -r * 0.6],
    [0, r * 0.6],
  ]) {
    if (Math.abs(stepLevelAt(p.x + a, p.z + b) - s0) > 0.05) continue;
    y = Math.min(y, standingHeightAt(p.x + a, p.z + b));
  }
  const g = (M.group || '') + ' ' + p.k;
  return y - (M.sink ?? (/rock|boulder|stone_|pebble|stalag/.test(g) ? 0.07 : 0));
}
export function personItem(k, im, x, z, C0, extra) {
  const mpp = (C0.person || 1.75) / 1.75 / (im.ppm || 42);
  return Object.assign(
    {
      k,
      im,
      x,
      z,
      y: standingHeightAt(x, z),
      mpp,
      ox: -(im.ax ?? 16),
      oy: -(im.ay ?? 40),
      w: im.width,
      h: im.height,
      flip: 1,
      shear: 0,
      sh: 0.38,
      person: 1,
    },
    extra
  );
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
/* v26: the scene's sky colours after the hour and the weather (environment.js) */
function skyColors(sc) {
  const s = (sc.sky || ['#8CC6E6', '#BFE3EE', '#F4E8C8']).map(c => hexToRgb(c).map(v => v / 255));
  return typeof environmentSky === 'function' && engineContext.env ? environmentSky(s, !!sc.indoor) : s;
}
function drawSky(C, sun, mirror) {
  const gl = gpuState.gl,
    sc = walkView.sc,
    p = gpuState.P.sky,
    U = p.U,
    sky = skyColors(sc);
  gl.useProgram(p.p);
  bindQuad();
  if (U.uEnv) {
    const E = typeof environment !== 'undefined' && engineContext.env ? environment : null;
    gl.uniform4f(U.uEnv, E ? E.night : 0, E ? E.flash : 0, E ? E.grey : 0, E ? (E.rainbow || 0) * (1 - E.night) : 0);
    gl.uniform3fv(U.uMoon, sun.dir);
  }
  gl.uniformMatrix4fv(U.uIVP, false, C.ivp);
  gl.uniform3fv(U.uSky0, sky[0]);
  gl.uniform3fv(U.uSky1, sky[1]);
  gl.uniform3fv(U.uSky2, sky[2]);
  gl.uniform3fv(U.uSunCol, sun.col);
  gl.uniform1f(U.uIndoor, sc.indoor ? 1 : 0);
  gl.uniform1f(U.uTime, walkView.t);
  gl.uniform1f(U.uSunPulse, sun.pulse);
  gl.uniform1f(U.uMirror, mirror);
  gl.uniform1f(U.uClouds, engineSetting('sun', 'clouds'));
  gl.uniform1f(U.uCloudSpd, engineSetting('sun', 'cloudSpeed'));
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, worldMapTexture());
  gl.uniform1i(U.uWorld, 0);
  gl.depthMask(false);
  gl.disable(gl.DEPTH_TEST);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.depthMask(true);
  gl.enable(gl.DEPTH_TEST);
}
export function worldMapTexture() {
  if (walkRenderer.wtex) return walkRenderer.wtex;
  const im = artImage(typeof WORLD_ART !== 'undefined' ? WORLD_ART : 'map/world.png');
  if (!imageReady(im)) return gpuState.white;
  const gl = gpuState.gl,
    t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.generateMipmap(gl.TEXTURE_2D);
  return (walkRenderer.wtex = t);
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
const IMAGE_IDS = new WeakMap();
let imageIdCount = 0;
function imageId(im) {
  let n = IMAGE_IDS.get(im);
  if (n === undefined) {
    n = ++imageIdCount;
    IMAGE_IDS.set(im, n);
  }
  return n;
}
/* alpha 0.4.1: the title's town springs up out of the loading screen (startTownRise from js/boot.js) */
export function startTownRise(load) {
  if (reducedMotion || typeof walkView === 'undefined') return;
  walkRenderer.rise = { t0: performance.now(), c: null, load: !!load, seen: new WeakMap() };
}
/* how far up a thing has grown (0 to a little over 1). While the game loads, a ring round the middle of the view widens
   with the loading and each thing starts to grow when the ring reaches it */
function townRiseAmount(it) {
  const R = walkRenderer.rise,
    now = performance.now();
  if (!R.c) {
    let c = null;
    try {
      const fr = walkView.director && walkView.director.frame ? walkView.director.frame() : null;
      c = fr && fr.center;
    } catch (e) {}
    R.c = c || [walkView.pl.x, walkView.pl.z];
  }
  const f = typeof loadingScreen !== 'undefined' && loadingScreen.el ? loadingScreen.f : 1,
    key = it.p || it.f || it,
    d = Math.hypot(it.x - R.c[0], it.z - R.c[1]);
  let t0 = R.seen.get(key);
  if (t0 == null) {
    if (R.load && d > 4 + f * 48) return 0;
    t0 = now + (R.load ? 0 : d * 50);
    R.seen.set(key, t0);
  }
  if (f >= 1 && !R.done) R.done = now;
  if (R.done && now - R.done > 3500) {
    walkRenderer.rise = null;
    return 1;
  }
  const t = (now - t0) / 1000;
  if (t <= 0) return 0;
  if (t >= 0.55) return 1;
  const k = t / 0.55,
    c = 1.7;
  return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
}
export function drawSprites(C, items, X, hits, labels, PPU) {
  const gl = gpuState.gl,
    p = useWalkProgram('sprite', C, X),
    U = p.U,
    P = walkView.pl,
    sc = walkView.sc,
    sun = X.sun;
  bindQuad();
  if (U.uWave) gl.uniform3f(U.uWave, 0, 0, 0);
  if (U.uSelOut) gl.uniform1f(U.uSelOut, engineSetting('color', 'outlines') ?? 1);
  const sh = normalize3([sun.dir[0], 0, sun.dir[2]]);
  gl.uniform3fv(U.uRight, C.right);
  gl.uniform3fv(U.uBack, C.back);
  gl.uniform3fv(U.uFwd, C.fwd);
  gl.uniform1f(U.uDZ, 0);
  gl.uniform3fv(U.uSunH, sh);
  gl.uniform1i(U.uTex, 0);
  gl.uniform1i(U.uNrm, 1);
  gl.uniform1f(U.uAlpha, 1);
  gl.uniform1f(U.uCurveOn, 1);
  gl.uniform1f(U.uEmit, 0);
  gl.uniform1f(U.uFlipN, 1);
  gl.uniform1f(U.uFixed, 0);
  const me = worldToScreen(C, P.x, 0.9, P.z);
  walkRenderer.bfade = new Map();
  const sd = sun.dir,
    sl = Math.hypot(sd[0] * C.right[0] + sd[2] * C.right[2], sd[1]) || 1,
    selfD = [(sd[0] * C.right[0] + sd[2] * C.right[2]) / sl, -sd[1] / sl],
    selfK =
      sd[1] > 0.05 && (engineSetting('shadows', 'selfShade') ?? 0.7) > 0
        ? (engineSetting('shadows', 'selfShade') ?? 0.7) * engineSetting('shadows', 'strength') * Math.min(1, sd[1] * 4)
        : 0;
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  /* v32: drawn grouped by picture (fewer texture switches); depth decides what is in front, so order doesn't matter */
  const L = [];
  for (const it of items) if (!(it.flat || it.vol || it.vis === false)) L.push(it);
  L.sort((a, b) => imageId(a.im) - imageId(b.im));
  for (const it of L) {
    if (it.vox) {
      if (!it.far) addHitTarget(it, C, hits, labels, PPU);
      continue;
    }
    const T = imageTexture(it.im);
    if (!T) continue;
    const s = it.mpp,
      hM = -it.oy * s;
    let fade = it.fade ?? 1;
    if (me && !walkRenderer.bt && !it.person && it.k === 'prop' && hM > 1.6) {
      const q = worldToScreen(C, it.x, 0, it.z);
      if (q && q.d < me.d - 0.3) {
        const half = it.w * s * 0.5 * q.s,
          top = q.y - hM * q.s;
        if (me.x > q.x - half && me.x < q.x + half && me.y > top && me.y < q.y) fade = 0.4;
      }
    }
    const rk = walkRenderer.rise ? townRiseAmount(it) : 1;
    if (rk < 0.002 && !it.person) continue;
    if (it.bld3) {
      walkRenderer.bfade.set(it, fade * Math.min(1, rk));
      addHitTarget(it, C, hits, labels, PPU);
      continue;
    }
    {
      const ro = it.fixed && it.lk && it.lk.rot && !it.M.box && !it.bld3 ? it.lk.rot * 0.6 : 0,
        cr = Math.cos(ro),
        sr = Math.sin(ro);
      gl.uniform3fv(U.uRight, it.fixed ? (ro ? [cr, 0, sr] : FIXED_RIGHT) : C.right);
      gl.uniform3fv(U.uBack, it.fixed ? (ro ? [sr, 0, -cr] : FIXED_BACK) : C.back);
    }
    gl.uniform1f(U.uFixed, it.fixed && it.plane ? 1 : 0);
    /* phase 09 batch 1: a tree's leaf clumps take no shadows from the shadow map (their crown's own shadow would
       stripe them); the crown shades itself instead (uSelf) */
    if (U.uNoRecv) gl.uniform1f(U.uNoRecv, it.noRecv ? 1 : 0);
    gl.uniform1f(U.uFlipN, it.flip || 1);
    setPropLookUniforms(U, it.lk);
    const mt = SURFACE_MATERIALS[it.mat] || SURFACE_MATERIALS[it.person ? 'cloth' : 'plain'];
    gl.uniform4f(U.uMat, mt.spec, mt.shin, mt.transl, mt.wrap);
    if (U.uFol) {
      const f = foliageAmount(it);
      gl.uniform2f(U.uFol, f[0], f[1]);
    }
    if (U.uSelf) {
      const k =
        selfK > 0 && it.k === 'prop' && !it.fixed && !it.far && hM > 1.2 && foliageAmount(it)[0] > 0 ? selfK : 0;
      gl.uniform3f(U.uSelf, k, selfD[0] * (it.flip || 1), selfD[1]);
    }
    gl.uniform1f(U.uEmit, it.glow ? it.glow * 1.6 : 0);
    gl.uniform1f(U.uFade, fade);
    gl.uniform1f(U.uRim, it.person ? 0.4 : 0.12);
    gl.uniform1f(U.uLit, it.glow ? Math.max(0, 1 - it.glow) : it.far ? 0.75 : 1);
    gl.uniform1f(U.uShade, it.person ? 0.45 : it.far ? 0.3 : 0.55);
    gl.uniform3f(U.uBaseP, it.x, it.y, it.z);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, T.t);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, T.n);
    setSpriteUniforms(p, rk !== 1 ? Object.assign({}, it, { oy: it.oy * rk, h: it.h * rk }) : it);
    if (it.wave) {
      gl.uniform3fv(U.uWave, it.wave);
      bindGridQuad();
      gl.drawArrays(gl.TRIANGLES, 0, gpuState.gridN);
      gl.uniform3f(U.uWave, 0, 0, 0);
      bindQuad();
      continue;
    }
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    /* trees get a second picture crossing the first, so a turned camera sees a crown, not a cut-out's edge */
    if (it.cross && Math.abs(C.yaw) > 0.04) {
      gl.uniform3f(U.uRight, 0, 0, it.flip > 0 ? 1 : -1);
      gl.uniform3f(U.uBack, -1, 0, 0);
      gl.uniform1f(U.uFixed, 0);
      gl.uniform1f(U.uFade, fade * Math.min(1, Math.abs(C.yaw) * 4));
      setSpriteUniforms(p, it);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    if (it.M && it.M.blades) {
      const b = it.M.blades,
        BT = imageTexture(artImage(b.img));
      if (BT)
        drawRotatingBlades(
          p,
          it,
          b,
          BT,
          (reducedMotion ? 0 : walkView.t / 1100) * (sc.wind || 1) * engineSetting('grass', 'wind'),
          C,
          X
        );
    }
    if (it.M && it.M.hands && !it.far && !it.layer) drawClockHands(p, it, C, X);
    if (it.far || it.layer) continue;
    addHitTarget(it, C, hits, labels, PPU);
  }
  gl.uniform3fv(U.uRight, C.right);
  gl.uniform3fv(U.uBack, C.back);
  gl.uniform1f(U.uEmit, 0);
  gl.uniform1f(U.uFade, 1);
  for (const it of items) {
    if (!it.flat || it.vis === false) continue;
    const T = imageTexture(it.im);
    if (!T) continue;
    drawFlatItem(it, T, C, X);
  }
}
/* ---------- buildings in 3D: side walls and a roof top behind the front picture ----------
   Worked out once per picture: where the walls stand at the base, which rows reach each wall (so a gable or an
   awning shapes the side), the wall colour just inside each edge and the roof colour at the eaves. */
const BOX_INFO_CACHE = new WeakMap();
function boxInfo(im) {
  let B = BOX_INFO_CACHE.get(im);
  if (B !== undefined) return B;
  B = null;
  try {
    const w = im.naturalWidth || im.width,
      h = im.naturalHeight || im.height,
      c = makeCanvas(w, h),
      x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, w, h).data,
      A = (X, Y) => d[(Y * w + X) * 4 + 3] > 127;
    const yb = Math.min(h - 1, Math.round(h * 0.88));
    let xl = 0,
      xr = w - 1;
    while (xl < w && !A(xl, yb)) xl++;
    while (xr > 0 && !A(xr, yb)) xr--;
    if (xr - xl < 8) {
      BOX_INFO_CACHE.set(im, null);
      return null;
    }
    let ye = yb;
    while (ye > 0 && A(xl + 2, ye - 1) && A(xr - 2, ye - 1)) ye--;
    const T = makeCanvas(16, h),
      tx = T.getContext('2d'),
      img = tx.createImageData(16, h),
      px = (X, Y) => {
        const k = (Y * w + X) * 4;
        return [d[k], d[k + 1], d[k + 2]];
      };
    for (let y = 0; y < h; y++)
      for (const [side, col0] of [
        [0, xl],
        [1, xr],
      ]) {
        const inX = side ? col0 - 2 : col0 + 2;
        if (inX < 0 || inX >= w || !A(inX, y)) continue;
        const c0 = px(inX, y);
        for (let i = 0; i < 8; i++) {
          const k = (y * 16 + side * 8 + i) * 4,
            shade = (i % 4 === 0 ? 0.86 : 1) * (side ? 0.92 : 0.84);
          img.data[k] = c0[0] * shade;
          img.data[k + 1] = c0[1] * shade;
          img.data[k + 2] = c0[2] * shade;
          img.data[k + 3] = 255;
        }
      }
    tx.putImageData(img, 0, 0);
    /* v32 audit: the top was one colour read just above the box's top edge, often a see-through pixel, so sofas, counters
    and kiosks had black tops. Now the top shows the picture's own top band (the rows a 3/4 drawing gives its top), the
    back edge from the top row and the front from a few rows down; see-through and outline pixels take the band's average */
    const top0 = (() => {
        const cx = Math.round((xl + xr) / 2);
        for (let y = 0; y < h; y++) if (A(cx, y)) return y;
        return ye;
      })(),
      K = Math.max(2, Math.min(10, Math.round((yb - top0) * 0.3))),
      RW = Math.max(1, xr - xl + 1),
      R = makeCanvas(RW, K),
      rx = R.getContext('2d'),
      rd = rx.createImageData(RW, K);
    let ar = 0,
      ag = 0,
      ab = 0,
      an = 0;
    const ok = (X, Y) => {
      if (X < 0 || Y < 0 || X >= w || Y >= h || !A(X, Y)) return null;
      const c0 = px(X, Y);
      return c0[0] * 0.3 + c0[1] * 0.59 + c0[2] * 0.11 > 38 ? c0 : null;
    };
    for (let j = 0; j < K; j++)
      for (let i = 0; i < RW; i++) {
        const c0 = ok(xl + i, top0 + 1 + j);
        if (c0) {
          ar += c0[0];
          ag += c0[1];
          ab += c0[2];
          an++;
        }
      }
    const avg = an ? [ar / an, ag / an, ab / an] : px(Math.round((xl + xr) / 2), Math.min(h - 1, ye + 2));
    for (let j = 0; j < K; j++)
      for (let i = 0; i < RW; i++) {
        let col0 = null;
        for (let yy = top0 + 1 + (K - 1 - j); yy < Math.min(h, top0 + 1 + K + 4) && !col0; yy++) col0 = ok(xl + i, yy);
        const c0 = col0 || avg,
          k2 = (j * RW + i) * 4,
          sh2 = 0.93;
        rd.data[k2] = c0[0] * sh2;
        rd.data[k2 + 1] = c0[1] * sh2;
        rd.data[k2 + 2] = c0[2] * sh2;
        rd.data[k2 + 3] = 255;
      }
    rx.putImageData(rd, 0, 0);
    B = { xl, xr, ye, h, side: T, roof: R };
  } catch (e) {
    B = null;
  }
  BOX_INFO_CACHE.set(im, B);
  return B;
}
export function drawBoxFaces(C, items, X) {
  const gl = gpuState.gl;
  let p = null;
  for (const it of items) {
    if (
      it.k !== 'prop' ||
      it.layer ||
      it.far ||
      it.bld3 ||
      !it.M ||
      !it.M.box ||
      it.flat ||
      it.mat !== 'building' ||
      it.vis === false ||
      it.vol ||
      it.vox /* phase 09: a prop drawn as a 3D model gets no box made from its picture */
    )
      continue;
    if (walkRenderer.bt && walkRenderer.bt.hide && walkRenderer.bt.hide.has(it.p)) continue;
    if (!BOX_INFO_CACHE.has(it.im) && !frameBudgetLeft()) continue;
    const B = boxInfo(it.im);
    if (!B) continue;
    if (!p) {
      p = useWalkProgram('face', C, X);
      bindQuad();
      gl.uniform1i(p.U.uTex, 0);
      gl.activeTexture(gl.TEXTURE0);
    }
    const s = it.mpp,
      f = it.flip,
      D = it.M.box[1] * (it.p.s || 1),
      xa = it.x + (it.ox + B.xl) * s * f,
      xb = it.x + (it.ox + B.xr + 1) * s * f,
      XL = Math.min(xa, xb),
      XR = Math.max(xa, xb),
      top = -it.oy * s,
      H = B.h * s,
      eave = (-it.oy - B.ye) * s,
      y0 = it.y;
    const ST = imageTexture(B.side, { noNormal: true }),
      RT = imageTexture(B.roof, { noNormal: true });
    if (!ST || !RT) continue;
    const mat = SURFACE_MATERIALS.building;
    gl.uniform1f(p.U.uSpec, mat.spec * 0.5);
    setPropLookUniforms(p.U, it.lk, [it.x, it.y, it.z]);
    gl.bindTexture(gl.TEXTURE_2D, ST.t);
    /* left wall (faces -x) and right wall (faces +x); the picture's left half of the texture belongs to its left edge */
    const lu = f > 0 ? 0 : 0.5,
      ru = f > 0 ? 0.5 : 0;
    gl.uniform3f(p.U.uO, XL, y0 + top, it.z);
    gl.uniform3f(p.U.uA, 0, 0, D);
    gl.uniform3f(p.U.uB, 0, -H, 0);
    gl.uniform4f(p.U.uUV, lu, 0, 0.5, 1);
    gl.uniform3f(p.U.uN, -1, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.uniform3f(p.U.uO, XR, y0 + top, it.z);
    gl.uniform3f(p.U.uA, 0, 0, D);
    gl.uniform4f(p.U.uUV, ru, 0, 0.5, 1);
    gl.uniform3f(p.U.uN, 1, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindTexture(gl.TEXTURE_2D, RT.t);
    gl.uniform3f(p.U.uO, XL, y0 + eave, it.z);
    gl.uniform3f(p.U.uA, XR - XL, 0, 0);
    gl.uniform3f(p.U.uB, 0, 0, D);
    gl.uniform4f(p.U.uUV, f > 0 ? 0 : 1, 0, f > 0 ? 1 : -1, 1);
    gl.uniform3f(p.U.uN, 0, 1, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
export function drawRotatingBlades(p, it, b, BT, rot, C, X, lift) {
  const gl = gpuState.gl,
    s = it.mpp,
    lf = lift || 0,
    cx = it.x + C.right[0] * b.x * s * it.flip - C.fwd[0] * lf,
    cz = it.z + C.right[2] * b.x * s * it.flip - C.fwd[2] * lf,
    cy = it.y - b.y * s,
    bs = b.w * s,
    c = Math.cos(rot),
    sn = Math.sin(rot),
    fp = useWalkProgram('fx', C, X);
  const R = C.right,
    r2 = [R[0] * c, sn, R[2] * c],
    u2 = [-R[0] * sn, c, -R[2] * sn];
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, BT.t);
  gl.uniform3f(fp.U.uP, cx, cy + worldCurveDrop(it.x, it.z), cz);
  gl.uniform3fv(fp.U.uRight, r2);
  gl.uniform3fv(fp.U.uUp, u2);
  gl.uniform2f(fp.U.uS, bs, bs);
  gl.uniform4f(fp.U.uUV, 0, 0, 1, 1);
  gl.uniform4f(fp.U.uCol, 1, 1, 1, 1);
  gl.uniform1f(fp.U.uGlow, 0);
  gl.uniform1f(fp.U.uLitFx, 1);
  gl.uniform1i(fp.U.uTex, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.useProgram(p.p);
}
/* v47: a clock's hands (Sundown's clock tower), each a picture turned about its middle to the time on the surface: the
   device's own clock, so the tower is always right. Lifted a few centimetres toward the camera, off the face. */
function drawClockHands(p, it, C, X) {
  const d = new Date(),
    sec = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000;
  for (const h of it.M.hands) {
    const T = imageTexture(artImage(h.img));
    if (T) drawRotatingBlades(p, it, h, T, -((sec % h.per) / h.per) * Math.PI * 2, C, X, 0.06);
  }
}
/* v47: how far the camera tilts up for the landmarks near you: a thing marked "landmark" in the catalogue (the clock
   tower, the giant tree, the crane...) between 2 and 18 metres ahead and within 8 to the side, by how far its top
   rises above what the camera shows anyway (about 5 m); up to 11 degrees */
function landmarkTilt(P, sc) {
  if (!sc || sc.indoor || !P || reducedMotion) return 0;
  const C0 = walkData().sc;
  let L = walkRenderer.lmL;
  if (!L || L.sc !== sc)
    L = walkRenderer.lmL = {
      sc,
      list: (sc.props || []).filter(p => {
        const M = C0.props[p.k];
        return M && M.landmark;
      }),
    };
  let best = 0;
  for (const p of L.list) {
    if (typeof propShown === 'function' && !propShown(p)) continue;
    const M = C0.props[p.k],
      dz = p.z - P.z,
      dx = Math.abs(p.x - P.x);
    if (dz < 2 || dz > 18 || dx > 8) continue;
    const hm = (-M.oy / 34) * (p.s || 1),
      k = Math.min(1, (dz - 2) / 3) * Math.min(1, (18 - dz) / 6) * Math.min(1, (8 - dx) / 4);
    best = Math.max(best, k * clamp((hm - 5) * 1.6, 0, 11));
  }
  return best;
}
function drawFlatItem(it, T, C, X) {
  const gl = gpuState.gl,
    fp = useWalkProgram('fx', C, X),
    U = fp.U,
    s = it.mpp,
    w = it.w * s,
    h = it.h * s,
    cx = it.x + (it.ox * s + w / 2) * it.flip,
    cz = it.z - (it.oy * s + h / 2) * 0.95;
  /* v22: lily pads on water bob and turn a little */ const wet = /lily/.test((it.p && it.p.k) || '') && !reducedMotion,
    ph = (walkView.t || 0) / 1000 + it.x * 1.3 + it.z * 0.7,
    an = wet ? Math.sin(ph * 0.45) * 0.07 : 0,
    bob = wet ? Math.sin(ph * 1.2) * 0.012 : 0;
  gl.uniform3f(U.uP, cx, standingHeightAt(it.x, it.z) + 0.04 + bob + worldCurveDrop(it.x, it.z), cz);
  gl.uniform3f(U.uRight, it.flip * Math.cos(an), 0, Math.sin(an));
  gl.uniform3f(U.uUp, -Math.sin(an) * it.flip, 0, Math.cos(an));
  gl.uniform2f(U.uS, w, h * 0.95);
  gl.uniform4f(U.uUV, 0, 0, 1, 1);
  gl.uniform4f(U.uCol, 1, 1, 1, 1);
  gl.uniform1f(U.uGlow, 0);
  gl.uniform1f(U.uLitFx, 1);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, T.t);
  gl.uniform1i(U.uTex, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.useProgram(gpuState.P.sprite.p);
}
export function addHitTarget(it, C, hits, labels, PPU) {
  const q = worldToScreen(C, it.x, 0, it.z);
  if (!q) return;
  const s = it.mpp,
    k = q.s * s,
    box = {
      x0: q.x + Math.min(it.ox * k * it.flip, (it.ox + it.w) * k * it.flip),
      x1: q.x + Math.max(it.ox * k * it.flip, (it.ox + it.w) * k * it.flip),
      y0: q.y + it.oy * k,
      y1: q.y + 4,
    };
  /* alpha 0.4.1: a tall thing you can tap (an airship station with its mast, a tower) answers only round its foot, so a
    tap on the ground behind its mast, or under the airship moored above, walks you there instead of to the station */
  if (it.k === 'prop' && it.p.act && -it.oy * s > 3.2) {
    const ps = it.p.s || 1;
    box.y0 = Math.max(box.y0, q.y - 2.8 * ps * q.s);
    if (it.M && it.M.box) {
      const hw = ((it.M.box[0] * ps) / 2 + 0.3) * q.s;
      box.x0 = Math.max(box.x0, q.x - hw);
      box.x1 = Math.min(box.x1, q.x + hw);
    }
  }
  if (it.k === 'prop' && it.p.act) {
    const go =
      it.p.act === 'climb' && typeof climbStartEnd === 'function' ? climbStartEnd(it.p) : actionSpot(it.p, it.M, PPU);
    hits.push({ k: 'act', act: it.p.act, p: it.p, ...box, z: q.d, go, look: [it.p.x, it.p.z] });
    const lb = actionLabel(it.p, it.M);
    if (lb) labels.push({ k: 'act', x: q.x, y: box.y0 - 4, t: lb, act: lb === 'Closed' ? 'closed' : it.p.act });
  } else if (it.k === 'buddy') {
    hits.push({ k: 'buddy', ...box, z: q.d - 0.5 });
  } else if (it.k === 'pet') {
    hits.push({ k: 'npc', n: it.n, ...box, z: q.d + 0.2, go: approachPoint(it.x, it.z), look: [it.x, it.z] });
  } else if (it.k === 'encm') {
    hits.push({ k: 'enc', e: it.e, ...box, z: q.d, go: approachPoint(it.x, it.z), look: [it.x, it.z] });
    if (it.e.alpha) labels.push({ k: 'bang', x: q.x, y: box.y0 - 6, col: '#FF3B6B' });
  } else if (it.k === 'npc') {
    hits.push({
      k: 'npc',
      n: it.n,
      ...box,
      x0: q.x - 18 * k,
      x1: q.x + 18 * k,
      z: q.d,
      go: approachPoint(it.x, it.z),
      look: [it.x, it.z],
    });
    if (!it.n.done) labels.push({ k: 'bang', x: q.x, y: box.y0, col: it.n.col || '#D9434B' });
  } else if (it.k === 'folk') {
    hits.push({ k: 'folk', f: it.f, ...box, x0: q.x - 16 * k, x1: q.x + 16 * k, z: q.d });
    if (typeof requestAsker === 'function' && it.f === requestAsker() && !(it.f.sayT > 0))
      labels.push({ k: 'bang', x: q.x, y: box.y0 - 2, col: '#E2B92C' });
    if (it.f.sayT > 0) labels.push({ k: 'say', x: q.x, y: box.y0 - 2, t: it.f.say, a: Math.min(1, it.f.sayT * 3) });
  } else if (it.k === 'enc') {
    const by = box.y0 - 8 - Math.abs(Math.sin(walkView.t / 380 + it.x)) * 4;
    hits.push({
      k: 'enc',
      e: it.e,
      x0: box.x0 - 14,
      x1: box.x1 + 14,
      y0: by - 22,
      y1: q.y + 4,
      z: q.d,
      go: approachPoint(it.x, it.z),
      look: [it.x, it.z],
    });
    labels.push({ k: 'enc', x: q.x, y: by, e: it.e });
  }
}
/* alpha 0.2: is there water within 5 m to the side, 1 m in front or 9 m behind (the reflection pass asks this of
   everything it might mirror): a summed table of the view's water tiles, rebuilt when the tiles change */
function waterNear(x, z) {
  const wt = walkView.water;
  if (!wt || !wt.length) return false;
  let Q = walkRenderer.wsat;
  if (!Q || Q.src !== wt) {
    const sc = walkView.sc,
      W = Math.max(1, sc.w | 0),
      H = Math.max(1, sc.h | 0),
      R = W + 1,
      S = new Int32Array(R * (H + 1));
    for (const w of wt) {
      const i = Math.floor(w[0]),
        k = Math.floor(w[1]);
      if (i >= 0 && k >= 0 && i < W && k < H) S[(k + 1) * R + i + 1]++;
    }
    for (let k = 1; k <= H; k++)
      for (let i = 1; i <= W; i++) {
        const q = k * R + i;
        S[q] += S[q - 1] + S[q - R] - S[q - R - 1];
      }
    Q = walkRenderer.wsat = { src: wt, S, W, H };
  }
  const i0 = Math.max(0, Math.floor(x - 5.5) + 1),
    i1 = Math.min(Q.W - 1, Math.ceil(x + 4.5) - 1),
    k0 = Math.max(0, Math.floor(z - 9.5) + 1),
    k1 = Math.min(Q.H - 1, Math.ceil(z + 0.5) - 1);
  if (i0 > i1 || k0 > k1) return false;
  const S = Q.S,
    R = Q.W + 1;
  return S[(k1 + 1) * R + i1 + 1] - S[k0 * R + i1 + 1] - S[(k1 + 1) * R + i0] + S[k0 * R + i0] > 0;
}
/* alpha 0.2: would a thing's mirror image (across the water at height L) be on screen: the sphere cullItems uses, wider
   for the ripples, and without the world's curve (the reflection is drawn flat, uCurveOn 0) */
function mirrorInView(F, it, L) {
  const s = it.mpp || 0.03,
    w = (it.w || 32) * s,
    h = (it.h || 32) * s,
    b = it.M && it.M.box,
    ext = b ? Math.max(b[0], b[1]) * ((it.p && it.p.s) || 1) : 0,
    r = Math.max(w, h, ext) * 0.75 + 2,
    cy = (it.y || 0) + h * 0.5;
  return inFrustum(F, it.x, 2 * L - cy, it.z, r);
}
export function reflectionPass(items, C, rw, rh, X) {
  const gl = gpuState.gl,
    w = Math.max(32, rw >> 1),
    h = Math.max(32, rh >> 1),
    F = renderTarget('refl', w, h, { depth: true, hdr: true });
  gl.bindFramebuffer(gl.FRAMEBUFFER, F.f);
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const L = reflectionLevel(),
    mir = new Float32Array([1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 2 * L, 0, 1]),
    RC = Object.assign({}, C, { vp: matrix4.mul(C.vp, mir) });
  const p = useWalkProgram('sprite', RC, Object.assign({}, X, { shadow: null })),
    U = p.U;
  bindQuad();
  gl.uniform3fv(U.uRight, C.right);
  gl.uniform3fv(U.uBack, C.back);
  gl.uniform3fv(U.uFwd, C.fwd);
  gl.uniform1f(U.uDZ, 0);
  gl.uniform3f(U.uSunH, 0, 0, 0);
  gl.uniform1i(U.uTex, 0);
  gl.uniform1i(U.uNrm, 1);
  gl.uniform1f(U.uFade, 1);
  gl.uniform1f(U.uRim, 0);
  gl.uniform1f(U.uLit, 1);
  gl.uniform1f(U.uAlpha, 1);
  gl.uniform1f(U.uCurveOn, 0);
  gl.uniform1f(U.uShade, 0.3);
  gl.uniform1f(U.uEmit, 0);
  gl.uniform1f(U.uFlipN, 1);
  gl.uniform1f(U.uFixed, 0);
  gl.uniform4f(U.uMat, 0, 1, 0, 0.15);
  if (U.uSelOut) gl.uniform1f(U.uSelOut, 0);
  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  /* alpha 0.2: near water by a summed table (a joined view can hold thousands of water tiles, and walking them all for
    every thing cost the iPad about 10 ms a frame), and only what shows in the water: its mirror image in view */
  const FR = computeFrustum(C.vp),
    cut = engineSetting('quality', 'cull') ?? true;
  for (const it of items) {
    if (it.flat || it.far) continue;
    if (!waterNear(it.x, it.z)) continue;
    if (cut && !it.person && !mirrorInView(FR, it, L)) continue;
    const T = imageTexture(it.im);
    if (!T) continue;
    gl.uniform3fv(U.uRight, it.fixed ? FIXED_RIGHT : C.right);
    gl.uniform3f(U.uBaseP, it.x, it.y, it.z);
    setPropLookUniforms(U, it.lk);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, T.t);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, T.n);
    setSpriteUniforms(p, it);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
/* v22: the kinds' colours and the water's small lives: fish circling their deep spots, rings from ducks, fish and insects */
const WATER_KIND_UNIFORMS = {
  D: new Float32Array(27),
  S: new Float32Array(27),
  A: new Float32Array(36),
  B: new Float32Array(36),
};
WATER_KIND_LOOKS.forEach((k, i) => {
  WATER_KIND_UNIFORMS.D.set(k.deep, i * 3);
  WATER_KIND_UNIFORMS.S.set(k.shal, i * 3);
  WATER_KIND_UNIFORMS.A.set([k.clar, k.caus, k.foam, k.rip], i * 4);
  WATER_KIND_UNIFORMS.B.set([k.glow, k.murk, k.weed, k.mode || 0], i * 4);
});
export function waterAt(x, z) {
  const G = walkRenderer.wgrid;
  if (!G) return null;
  const i = Math.floor(x * 2),
    j = Math.floor(z * 2);
  if (i < 0 || j < 0 || i >= G.W2 || j >= G.H2) return null;
  const q = j * G.W2 + i;
  return G.dep[q] > 0 || G.y[q] !== 0 ? { dep: G.dep[q], kind: G.kind[q], y: G.y[q] } : null;
}
function waterLife() {
  const t = (reducedMotion ? 0 : walkView.t || 0) / 1000,
    now = performance.now() / 1000,
    dt = Math.min(0.1, Math.max(0, now - (walkRenderer.wlT || now)));
  walkRenderer.wlT = now;
  const fish = new Float32Array(16),
    rings = new Float32Array(32);
  if (engineSetting('water', 'fish'))
    (walkRenderer.fishHomes || []).forEach((h, i) => {
      const sp = 0.35 + 0.12 * Math.sin(i * 2.3),
        a = (t * sp) / Math.max(0.5, h[3]) + i * 1.9,
        r = h[3] * (0.75 + 0.25 * Math.sin(t * 0.13 + i)),
        x = h[0] + Math.cos(a) * r,
        z = h[1] + Math.sin(a) * r * 0.8;
      fish[i * 4] = x;
      fish[i * 4 + 1] = z;
      fish[i * 4 + 2] = Math.atan2(Math.cos(a) * 0.8, -Math.sin(a));
      fish[i * 4 + 3] = 0.75 + (0.25 * ((i * 7) % 3)) / 2;
      if (!walkRenderer.bt && Math.random() < dt * 0.06) addRipple(x, z, 0.7);
      /* v27: now and then one jumps clear of the water */ if (
        !walkRenderer.bt &&
        !reducedMotion &&
        Math.random() < dt * 0.012
      ) {
        addRipple(x, z, 0.9);
        (walkRenderer.splash = walkRenderer.splash || []).push({
          x,
          z,
          y: walkRenderer.wlevelR ?? walkRenderer.wlevel ?? 0,
          a: 0,
        });
        if (typeof soundEffectAt === 'function') soundEffectAt('plop', x, z);
      }
    });
  if (engineSetting('water', 'rings') && !walkRenderer.bt && !reducedMotion) {
    if (typeof ambientLife !== 'undefined')
      for (const c of ambientLife.list || [])
        if (c.k === 'duck') {
          c._rg = (c._rg || Math.random()) - dt * (c.st === 'walk' ? 1.6 : 0.35);
          if (c._rg <= 0) {
            c._rg = 1;
            addRipple(c.x, c.z, c.st === 'walk' ? 0.8 : 0.5);
          }
        }
    /* v47: rings now and then round what stands in the water: rocks, posts, reeds, the legs of a jetty */
    if (walkRenderer.wetPropsId !== walkView.id) {
      walkRenderer.wetPropsId = walkView.id;
      walkRenderer.wetProps = (walkView.sc.props || [])
        .filter(p => {
          const M = walkData().sc.props[p.k];
          return M && !M.walk && typeof waterAt === 'function' && waterAt(p.x, p.z);
        })
        .slice(0, 40);
    }
    const WP = walkRenderer.wetProps;
    if (WP && WP.length && Math.random() < dt * Math.min(2.5, WP.length * 0.35)) {
      const p = WP[Math.floor(Math.random() * WP.length)];
      addRipple(p.x + (Math.random() - 0.5) * 0.3, p.z + (Math.random() - 0.5) * 0.3, 0.45 + Math.random() * 0.25);
    }
    const G = walkRenderer.wgrid;
    if (G && Math.random() < dt * 1.4) {
      for (let k = 0; k < 6; k++) {
        const i = Math.floor(Math.random() * G.W2),
          j = Math.floor(Math.random() * G.H2),
          q = j * G.W2 + i,
          kd = G.kind[q];
        if (G.dep[q] > 0.05 && kd !== 1) {
          addRipple(
            (i + 0.5) * 0.5 + Math.random() * 0.4 - 0.2,
            (j + 0.5) * 0.5 + Math.random() * 0.4 - 0.2,
            kd === 4 ? 0.7 : 0.45
          );
          break;
        }
      }
    }
  }
  const R = walkRenderer.rings || [];
  for (const r of R) r[2] += dt;
  walkRenderer.rings = R.filter(r => r[2] < 2.4);
  walkRenderer.rings.slice(-8).forEach((r, i) => rings.set(r, i * 4));
  return { fish, rings };
}
export function addRipple(x, z, k) {
  (walkRenderer.rings = walkRenderer.rings || []).push([x, z, 0, k]);
  if (walkRenderer.rings.length > 16) walkRenderer.rings.shift();
}
function setWaterUniforms(U) {
  const gl = gpuState.gl;
  if (!U.uKD) return;
  gl.uniform3fv(U.uKD, WATER_KIND_UNIFORMS.D);
  gl.uniform3fv(U.uKS, WATER_KIND_UNIFORMS.S);
  gl.uniform4fv(U.uKA, WATER_KIND_UNIFORMS.A);
  gl.uniform4fv(U.uKB, WATER_KIND_UNIFORMS.B);
  gl.uniform1f(U.uCaus, engineSetting('water', 'caustics'));
  gl.uniform1f(U.uClar, engineSetting('water', 'clarity'));
  const L = waterLife();
  gl.uniform4fv(U.uFish, L.fish);
  gl.uniform4fv(U.uRings, L.rings);
}
function reflectionLevel() {
  const G = walkRenderer.wlevels;
  if (!G || G.length < 2) return (walkRenderer.wlevelR = walkRenderer.wlevel || 0);
  const P = walkView.pl;
  let best = null,
    bs = -1;
  for (const g of G) {
    const dx = Math.max(0, g.b[0] - P.x, P.x - g.b[2]),
      dz = Math.max(0, g.b[1] - P.z, P.z - g.b[3]),
      d2 = dx * dx + dz * dz;
    const sc = Math.sqrt(g.n) / (1 + d2 / 16);
    if (sc > bs) {
      bs = sc;
      best = g;
    }
  }
  return (walkRenderer.wlevelR = best ? best.y : walkRenderer.wlevel);
}
export function drawWater(C, X, rw, rh) {
  const gl = gpuState.gl,
    p = useWalkProgram('water', C, X),
    U = p.U,
    sc = walkView.sc,
    sky = skyColors(sc);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, walkRenderer.water && gpuState.fb.refl ? gpuState.fb.refl.c : gpuState.white);
  gl.uniform1i(U.uRefl, 0);
  gl.uniform2f(U.uRes, rw, rh);
  gl.uniform3fv(U.uDeep, engineColor('water', 'deep', '#1D4F78'));
  gl.uniform3fv(U.uShallow, engineColor('water', 'shallow', '#4FA6C0'));
  gl.uniform3fv(U.uSkyR, sky[1]);
  gl.uniform1f(U.uReflK, engineSetting('water', 'reflection'));
  gl.uniform1f(U.uRip, engineSetting('water', 'ripples'));
  gl.uniform1f(U.uFoam, engineSetting('water', 'foam'));
  gl.uniform1f(U.uGlint, engineSetting('water', 'glints'));
  gl.uniform1f(U.uLevel, walkRenderer.wlevelR ?? walkRenderer.wlevel ?? 0);
  setWaterUniforms(U);
  setShoreUniforms(U, sc);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);
  if (walkRenderer.water) {
    gl.bindVertexArray(walkRenderer.water.vao);
    gl.drawElements(gl.TRIANGLES, walkRenderer.water.n, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }
  /* v31: fountain and well basins: the same moving water, mirror off (they sit above the pond level), no shoreline */
  if (walkRenderer.basin) {
    gl.uniform1f(U.uLevel, -99);
    if (U.uShoreR) gl.uniform3f(U.uShoreR, 1, 1, 0);
    gl.bindVertexArray(walkRenderer.basin.vao);
    gl.drawElements(gl.TRIANGLES, walkRenderer.basin.n, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }
  if (walkRenderer.fallMesh) {
    const f = useWalkProgram('fall', C, X);
    gl.uniform3fv(f.U.uShallow, engineColor('water', 'shallow', '#4FA6C0'));
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(walkRenderer.fallMesh.vao);
    gl.drawElements(gl.TRIANGLES, walkRenderer.fallMesh.n, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }
  gl.depthMask(true);
  gl.disable(gl.BLEND);
}
/* v31: rooms lit from outside. The light of the town's hour and weather falls through each window: a bright patch on
   the floor with the panes' cross in it, moving with the sun (warm by day, golden at sunset, blue under the moon), a
   faint dusty shaft from the glass to the floor, the glass itself darkening at night; pendant lamps come on in the
   evening; the floor darkens toward the walls and the walls get a skirting board (in the ground shader) */
function roomBoxOf(sc) {
  if (walkRenderer.roomBoxId === walkView.id) return walkRenderer.roomBox;
  walkRenderer.roomBoxId = walkView.id;
  walkRenderer.roomBox = null;
  if (!sc.room) return null;
  const Rr = sc.roomRect || [0, 0, sc.w, sc.h],
    X0 = Rr[0],
    Z0 = Rr[1],
    W = Rr[2],
    H = Rr[3],
    hi = (x, z) => stepRaiseAt(x, z) > 1;
  let x0 = X0 + W / 2,
    x1 = X0 + W / 2,
    zb = Z0 + H * 0.5;
  while (x0 > X0 && !hi(x0 - 0.05, Z0 + H * 0.5)) x0 -= 0.05;
  while (x1 < X0 + W && !hi(x1 + 0.05, Z0 + H * 0.5)) x1 += 0.05;
  while (zb < Z0 + H && !hi(X0 + W / 2, zb + 0.05)) zb += 0.05;
  return (walkRenderer.roomBox = [x0, x1, zb]);
}
function roomSkyLight() {
  const now = performance.now();
  if (walkRenderer.roomSkyT && now - walkRenderer.roomSkyT < 500) return walkRenderer.roomSky;
  walkRenderer.roomSkyT = now;
  let st;
  try {
    st = environmentState(currentLocationMap() || walkView.sc);
  } catch (e) {
    st = { h: 13, rise: 6, set: 20, night: 0, dusk: 0, dawn: 0, wx: 'clear' };
  }
  const W = (typeof WEATHER_LOOKS !== 'undefined' && WEATHER_LOOKS[st.wx]) || {},
    grey = W.grey || 0,
    day = 1 - st.night,
    ph = clamp((st.h - st.rise) / Math.max(1, st.set - st.rise), 0, 1),
    el = Math.sin(ph * Math.PI),
    warm = Math.max(st.dusk, st.dawn * 0.8);
  const dayC = [1, 0.94 - warm * 0.26, 0.8 - warm * 0.46].map(v => v * (1 - grey * 0.78) * (0.5 + 0.5 * el)),
    moonC = [0.42, 0.54, 0.95].map(v => v * 0.42 * (1 - grey * 0.85)),
    c = dayC.map((v, i) => v * day + moonC[i] * st.night);
  const elev = (14 + 48 * el) * day + 45 * st.night,
    dx = (ph - 0.5) * 1.5 * day - 0.35 * st.night;
  return (walkRenderer.roomSky = {
    c,
    I: Math.max(...c),
    tan: Math.tan((elev * Math.PI) / 180),
    dx,
    lamp: clamp(Math.max(st.night, st.dusk * 0.75, grey * 0.55), 0, 1),
    night: st.night,
    dusk: Math.max(st.dusk, st.dawn * 0.6),
    grey,
  });
}
function roomTexture(k) {
  const key = 'roomTex_' + k;
  if (walkRenderer[key]) return walkRenderer[key];
  const N = 64,
    c = makeCanvas(N, N),
    x = c.getContext('2d'),
    d = x.createImageData(N, N);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N,
        v = (j + 0.5) / N,
        e = Math.min(u, 1 - u, v, 1 - v),
        soft = k === 'beam' ? Math.min(1, e / 0.22) : Math.min(1, e / 0.07);
      let a = soft;
      if (k === 'pane') {
        const bar = Math.abs(u - 0.5) < 0.035 || Math.abs(v - 0.44) < 0.035;
        if (bar) a *= 0.25;
      }
      if (k === 'beam') a *= 0.7 + 0.3 * Math.sin(u * 9) * 0.5 + 0.15;
      const q = (j * N + i) * 4;
      d.data[q] = d.data[q + 1] = d.data[q + 2] = 255;
      d.data[q + 3] = Math.round(clamp(a, 0, 1) * 255);
    }
  x.putImageData(d, 0, 0);
  return (walkRenderer[key] = c);
}
function lampTexture(on) {
  const key = on ? 'lampTexOn' : 'lampTex';
  if (walkRenderer[key]) return walkRenderer[key];
  const c = makeCanvas(14, 18),
    x = c.getContext('2d'),
    P = (col, a, b, w, h) => {
      x.fillStyle = col;
      x.fillRect(a, b, w, h);
    };
  P('#4A3A2A', 6, 9, 2, 7);
  P('#3A2E22', 4, 15, 6, 2);
  P('#6E5A40', 5, 14, 4, 1);
  P(on ? '#FFF1C6' : '#E9DDBE', 4, 0, 6, 1);
  P(on ? '#FFE6A8' : '#DCCBA4', 3, 1, 8, 4);
  P(on ? '#F7CF7E' : '#C9B288', 2, 5, 10, 2);
  P('#9C8052', 2, 7, 10, 1);
  P(on ? '#FFF8DA' : '#B8AA90', 5, 8, 4, 1);
  P(on ? '#FFFFFF' : '#F2EAD6', 4, 1, 2, 3);
  return (walkRenderer[key] = c);
}
/* two lamps on the back wall, one each side, where nothing hangs or stands against it */
function roomLamps(sc) {
  if (walkRenderer.lampsId === walkView.id) return walkRenderer.lamps;
  walkRenderer.lampsId = walkView.id;
  const B = roomBoxOf(sc);
  if (!B) return (walkRenderer.lamps = []);
  const W = B[1] - B[0],
    near = (sc.props || []).filter(p => p.z > B[2] - 1.6),
    free = x => near.every(p => Math.abs(p.x - x) > 0.95),
    out = [];
  for (const side of [
    [0.2, 0.28, 0.12, 0.36, 0.06],
    [0.8, 0.72, 0.88, 0.64, 0.94],
  ]) {
    const f = side.find(f => free(B[0] + W * f));
    out.push(f != null ? [B[0] + W * f, B[2] - 0.06, 2.05] : [B[0] + W * side[0], B[2] - 0.06, 2.75]);
  }
  return (walkRenderer.lamps = out);
}
/* something tall standing right in front of a window (a fridge, a shelf) keeps its light out */
function windowBlocked(sc, w) {
  const C0 = walkData().sc;
  return (sc.props || []).some(p => {
    if (p === w.p || p === w) return false;
    const M = C0.props[p.k];
    if (!M || M.flat || /^wall_|rug/.test(p.k) || -M.oy * (p.s || 1) < 40) return false;
    return Math.abs(p.x - w.x) < 0.75 && p.z < w.z - 0.02 && p.z > w.z - 1.3;
  });
}
/* alpha 0.1: a room with many windows (it shows its building's own) shares their daylight, as if it had two or so: the
   back wall doesn't wash out to white */
function windowLightShare(sc) {
  if (walkRenderer.wsP !== sc.props) {
    walkRenderer.wsP = sc.props;
    walkRenderer.ws = Math.min(1, 2.2 / Math.max(1, (sc.props || []).filter(p => /wall_window/.test(p.k)).length));
  }
  return walkRenderer.ws;
}
function roomLights(sc, L, lb) {
  if (!sc.room || (engineSetting('lights', 'roomLight') ?? true) === false) return;
  const R = roomSkyLight(),
    B = roomBoxOf(sc),
    ws = windowLightShare(sc);
  if (!B) return;
  /* alpha 0.4: the wall lamp's light a little out from the wall (it burned the wall white round it) and a soft pool of it on the floor */
  for (const [x, z, ly] of roomLamps(sc))
    if (R.lamp > 0.02) {
      L.push({
        p: [x, standingHeightAt(x, z - 0.9) + ly, z - 0.9],
        r: 6,
        c: [1.4, 1.04, 0.66].map(v => v * R.lamp * lb),
      });
      L.push({
        p: [x, standingHeightAt(x, z - 1.9) + 0.3, z - 1.9],
        r: 3.4,
        pool: 1,
        c: [0.85, 0.64, 0.4].map(v => v * R.lamp * lb),
      });
    }
  for (const p of sc.props || [])
    if (/wall_window/.test(p.k) && R.I > 0.03 && !windowBlocked(sc, p)) {
      const u = 1.9 / Math.max(0.25, R.tan);
      L.push({
        p: [p.x + R.dx * u * 0.6, 0.9, Math.max(0.6, p.z - u * 0.7)],
        r: 3.6,
        c: R.c.map(v => v * 1.25 * lb * ws),
      });
    }
}
function drawRoomEffects(C, U, items, glows, t, rm) {
  const sc = walkView.sc;
  if (!sc.room || (engineSetting('lights', 'roomLight') ?? true) === false) return;
  const gl = gpuState.gl,
    R = roomSkyLight(),
    gk = engineSetting('lights', 'glow'),
    ws = windowLightShare(sc);
  const draw = (cv, x, y, z, r, u, sw, sh, col, a) => {
    const T = imageTexture(cv, { noNormal: true });
    if (!T) return;
    gl.bindTexture(gl.TEXTURE_2D, T.t);
    gl.uniform3f(U.uP, x, y, z);
    gl.uniform3fv(U.uRight, r);
    gl.uniform3fv(U.uUp, u);
    gl.uniform2f(U.uS, sw, sh);
    gl.uniform4f(U.uCol, col[0], col[1], col[2], a);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };
  gl.uniform4f(U.uUV, 0, 0, 1, 1);
  gl.uniform1f(U.uGlow, 0);
  gl.uniform1f(U.uLitFx, 0);
  for (const it of items) {
    if (it.k !== 'prop' || !/wall_window/.test(it.p.k)) continue;
    const s = it.mpp,
      f = it.flip || 1,
      gx0 = it.x + (it.ox + 6) * s * f,
      gx1 = it.x + (it.ox + 48) * s * f,
      yt = it.y - (it.oy + 5) * s,
      yb = it.y - (it.oy + 41) * s,
      fy = standingHeightAt(it.x, it.z - 1),
      zw = it.z - 0.04,
      cx = (gx0 + gx1) / 2,
      gw = Math.abs(gx1 - gx0),
      gh = yt - yb;
    /* the glass: night, dusk and grey skies show in it */
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    if (R.night > 0.02)
      draw(
        roomTexture('glass'),
        cx,
        (yt + yb) / 2,
        zw,
        [1, 0, 0],
        [0, 1, 0],
        gw,
        gh,
        [0.05, 0.07, 0.17],
        0.78 * R.night
      );
    if (R.dusk > 0.05)
      draw(
        roomTexture('glass'),
        cx,
        (yt + yb) / 2,
        zw,
        [1, 0, 0],
        [0, 1, 0],
        gw,
        gh,
        [1, 0.5, 0.28],
        0.32 * R.dusk * (1 - R.night)
      );
    if (R.grey > 0.05)
      draw(
        roomTexture('glass'),
        cx,
        (yt + yb) / 2,
        zw,
        [1, 0, 0],
        [0, 1, 0],
        gw,
        gh,
        [0.62, 0.66, 0.72],
        0.35 * R.grey * (1 - R.night)
      );
    if (R.I < 0.03 || windowBlocked(sc, it)) continue;
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    /* where the glass's corners land on the floor along the light */
    const ut = (yt - fy) / R.tan,
      ub = (yb - fy) / R.tan,
      hit = (y, u) => [cx + R.dx * u, fy + 0.012, zw - u],
      T0 = hit(yt, ut),
      B0 = hit(yb, ub),
      vx = T0[0] - B0[0],
      vz = T0[2] - B0[2],
      L = Math.hypot(vx, vz) || 1;
    draw(
      roomTexture('pane'),
      (T0[0] + B0[0]) / 2,
      fy + 0.012,
      (T0[2] + B0[2]) / 2,
      [1, 0, 0],
      [vx / L, 0, vz / L],
      gw,
      L,
      R.c,
      0.62 * ws
    );
    /* the shaft: thin cards parallel to the glass, stepped along the light, the floor hiding what falls below it */
    const n = 9;
    for (let k = 0; k < n; k++) {
      const u = ((k + 0.5) / n) * ut;
      draw(
        roomTexture('beam'),
        cx + R.dx * u,
        (yt + yb) / 2 - R.tan * u,
        zw - u,
        [1, 0, 0],
        [0, 1, 0],
        gw,
        gh,
        R.c,
        0.055 * (1 - (k / n) * 0.5) * ws
      );
    }
    /* dust turning in the light */
    for (let k = 0; k < 12; k++) {
      const sd = k * 7.31 + it.x,
        ph = ((t * rm) / 9000 + k / 12) % 1,
        u = ut * (0.15 + 0.8 * ((k * 0.618) % 1)),
        px = cx + R.dx * u + (((k * 0.37) % 1) - 0.5) * gw * 0.8 + Math.sin(ph * 6.3 + sd) * 0.08,
        py = (yt + yb) / 2 - R.tan * u + (ph - 0.5) * gh * 0.8;
      if (py < fy + 0.05) continue;
      glows.push([
        px,
        py,
        zw - u + Math.sin(sd) * 0.1,
        0.012,
        R.c.map(v => v * 1.4 + 0.3),
        0.9 * Math.sin(ph * Math.PI),
      ]);
    }
  }
  /* daylight (or moonlight) spilling in through the open doorway */
  {
    const ex = (sc.exits && sc.exits[0]) || [sc.w / 2, 0.6],
      fy = standingHeightAt(ex[0], 0.8);
    if (R.I > 0.03) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      draw(
        roomTexture('beam'),
        ex[0] + R.dx * 0.3,
        fy + 0.012,
        0.75,
        [1, 0, 0],
        [R.dx * 0.3, 0, 1],
        2.1,
        1.5,
        R.c,
        0.42
      );
    }
  }
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  /* wall lamps, lit in the evening */
  const LT = lampTexture(R.lamp > 0.3);
  for (const [x, z, ly] of roomLamps(sc)) {
    const y = standingHeightAt(x, z - 0.5) + ly;
    draw(LT, x, y, z, [1, 0, 0], [0, 1, 0], 0.33, 0.42, [1, 1, 1], 1);
    if (R.lamp > 0.02) {
      glows.push([x, y + 0.06, z - 0.03, 0.07 * gk, [1, 0.86, 0.58], 2.4 * R.lamp]);
      glows.push([x, y + 0.25, z, 0.42 * gk, [1, 0.78, 0.45], 0.3 * R.lamp]);
    }
  }
}
/* v31: a room's front wall, cut off low like a doll's house so you see in, with the doorway left open where the exit
   is; its face runs down into the dark under the floor, so the room reads as a box that ends at its door */
function drawRoomFront(C, X) {
  const sc = walkView.sc;
  if (!sc.room || (engineSetting('lights', 'roomLight') ?? true) === false) return;
  const B = roomBoxOf(sc);
  if (!B) return;
  const gl = gpuState.gl;
  const Rr = sc.roomRect || [0, 0, sc.w, sc.h],
    ex = (sc.exits && sc.exits[0]) || [Rr[0] + Rr[2] / 2, Rr[1] + 0.6],
    dl = ex[0] - (sc.roomGap || 2) / 2,
    dr = ex[0] + (sc.roomGap || 2) / 2,
    fy = standingHeightAt(Rr[0] + Rr[2] / 2, Rr[1] + 1.5),
    hw = 0.36,
    th = 0.2,
    deep = sc.roomRect ? 0.4 : 3.2,
    zf = Rr[1] - 0.001,
    x0 = B[0] - 0.25,
    x1 = B[1] + 0.25;
  if (walkRenderer.frontKey !== walkView.id) {
    walkRenderer.frontKey = walkView.id;
    const wc = hexToRgb((sc.wallCol || [])[10] || '#D9B79C'),
      c = makeCanvas(1, 32),
      x = c.getContext('2d'),
      rows = 32,
      top = Math.round((hw / (hw + deep)) * rows);
    for (let i = 0; i < rows; i++) {
      const k =
        i < 1 ? 1.4 : i < top ? 1.2 : i < top + 1 ? 0.35 : Math.max(0.05, 0.24 * (1 - (i - top) / (rows - top)));
      x.fillStyle = `rgb(${(wc[0] * k) | 0},${(wc[1] * k) | 0},${(wc[2] * k) | 0})`;
      x.fillRect(0, i, 1, 1);
    }
    const t = makeCanvas(4, 4),
      tx = t.getContext('2d');
    tx.fillStyle = '#6A5848';
    tx.fillRect(0, 0, 4, 4);
    tx.fillStyle = '#8A7662';
    tx.fillRect(0, 0, 4, 1);
    walkRenderer.frontTex = [c, t];
  }
  const F = imageTexture(walkRenderer.frontTex[0], { noNormal: true }),
    T = imageTexture(walkRenderer.frontTex[1], { noNormal: true });
  if (!F || !T) return;
  const p = useWalkProgram('face', C, X);
  bindQuad();
  setPropLookUniforms(p.U, null, [0, 0, 0]);
  gl.uniform1i(p.U.uTex, 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform1f(p.U.uSpec, 0.05);
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  gl.disable(gl.CULL_FACE);
  const segs = [
    [x0, dl],
    [dr, x1],
  ].filter(q => q[1] - q[0] > 0.05);
  for (const [a, b] of segs) {
    gl.bindTexture(gl.TEXTURE_2D, F.t);
    gl.uniform4f(p.U.uUV, 0, 0, 1, 1);
    gl.uniform3f(p.U.uO, a, fy + hw, zf);
    gl.uniform3f(p.U.uA, b - a, 0, 0);
    gl.uniform3f(p.U.uB, 0, -(hw + deep), 0);
    gl.uniform3f(p.U.uN, 0, 0, -1);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindTexture(gl.TEXTURE_2D, T.t);
    gl.uniform3f(p.U.uO, a, fy + hw, zf);
    gl.uniform3f(p.U.uA, b - a, 0, 0);
    gl.uniform3f(p.U.uB, 0, 0, th);
    gl.uniform3f(p.U.uN, 0, 1, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    /* the wall's end at the doorway */
    const e = a < ex[0] ? b : a;
    gl.bindTexture(gl.TEXTURE_2D, F.t);
    gl.uniform3f(p.U.uO, e, fy + hw, zf);
    gl.uniform3f(p.U.uA, 0, 0, th);
    gl.uniform3f(p.U.uB, 0, -hw, 0);
    gl.uniform4f(p.U.uUV, 0, 0, 1, hw / (hw + deep));
    gl.uniform3f(p.U.uN, a < ex[0] ? 1 : -1, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  /* the threshold: a worn stone sill across the doorway */
  gl.bindTexture(gl.TEXTURE_2D, T.t);
  gl.uniform4f(p.U.uUV, 0, 0, 1, 1);
  gl.uniform3f(p.U.uO, dl, fy + 0.025, zf);
  gl.uniform3f(p.U.uA, dr - dl, 0, 0);
  gl.uniform3f(p.U.uB, 0, 0, 0.16);
  gl.uniform3f(p.U.uN, 0, 1, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
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
