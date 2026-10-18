'use strict';
/* ================= WALK SCENE on the engine (v12) =================
   The walk scene drawn by the shared WebGL engine (js/engine/*): ground with real height and cliffs, a Hollow Earth
   horizon that bends up, pixel sprites standing in 3D with gentle automatic shading, sun shadows from a shadow map
   (buildings cast solid shadows, people and trees their cut-out shape), contact shadows, lamps and windows that light
   the ground in front of them and glow through bloom, ponds that reflect, grass that sways and bends away from you,
   mist, cloud shadows, and a lens with depth of field. Every dial is an engine setting (Studio → Engine).
   Same scenes, walking and taps as js/walk-view.js (scene data, paths, the player); this file draws them. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import {
  BLD,
  BLD_SH,
  GD,
  LD,
  LIFE,
  LIFE_KIND,
  P3D_PARTS,
  P3D_SH,
  RM,
  S,
  SP,
  WORLD_ART,
  bldDraw,
  bldFacade,
  bldGuard,
  bldLitF,
  bldMeshFor,
  bldOn,
  bldShadow,
  bldSmoke,
  bldWinLit,
  buddyItems,
  clueDraw,
  companionItems,
  drawPropModelShadows,
  drawPropModels,
  flushPropModelMeshes,
  frWorldItems,
  lifeSprites,
  lifeStep,
  noWebGL,
  p3dDraw,
  p3dLod,
  p3dShadow,
  p3dTag,
  propModelImageItems,
  propModelShaders,
  provide,
  pwAll,
  pwOn,
  pwPaint,
  reqAsker,
  riderOf,
  seamlessLookTick,
  sfxAt,
  solidPropState,
  stampDraw,
  strDraw,
  strShadow,
  tagPropModel,
  warmWorldBillies,
  wildBillyItem,
  worldBillies,
  worldBillyGlows,
  worldBillyItem,
  worldBillyLabels,
} from './hooks.js';
import { clamp } from './util.js';
import { FRAME, frameCount, frameTask, userFps } from './frame-scheduler.js';
import { cnv, hexA } from './art.js';
import { folkFrames, humanPose, owFrames, trPick, trWarm } from './person-art.js';
import { drawRig, rigFrame, rigParts, rigPreload } from './skeleton-rig.js';
import {
  EFFECT_FRAMES,
  GROUND_BORDER_M,
  GROUND_CACHE,
  PAINT_WORKER_WAIT,
  actionLabel,
  actionSpot,
  approachPoint,
  artImage,
  bigTilePath,
  bigTilesOn,
  bridgeAt,
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
  groundKey,
  handleWalkClick,
  hash2d,
  hitAt,
  imageReady,
  isWalkable,
  layerAsProp,
  mapById,
  mapHub,
  mapMoodName,
  navGrid,
  paintGroundSteps,
  pointAlongMapPath,
  prepareMap,
  propShown,
  propWithVariant,
  screenToGround,
  setNavGrid,
  setScreenToGround,
  setStopWalkView,
  setWorldToScreen,
  shapedStepCornerHeight,
  stepCellAt,
  stepEdgeShape,
  stepGrid,
  stepGridCorners,
  stepLevelAt,
  stepRaiseAt,
  stopWalkView,
  tallGrassProps,
  terrainAt,
  updateFolk,
  updatePlayer,
  valueNoise2d,
  walkData,
  walkView,
  walkablePointNear,
  worldToScreen,
} from './walk-view.js';
import { ENG_CTX, eng, engHex } from './engine/settings.js';
import {
  EGL,
  EGL_GLSL_COMMON,
  EGL_GLSL_LIGHT,
  EGL_GLSL_LOOK,
  EGL_MATS,
  M4,
  eglBindGrid,
  eglBindQuad,
  eglFree,
  eglGpuBegin,
  eglGpuEnd,
  eglImg,
  eglInit,
  eglMesh,
  eglNormWork,
  eglOK,
  eglPendPoll,
  eglPrecompile,
  eglPrograms,
  eglTarget,
  eglTexParams,
  eglTexTrim,
  eglWind,
  eglWindBend,
  smooth01,
  v3n,
} from './engine/webgl.js';
import {
  eglLampShadowBegin,
  eglLightCtx,
  eglLightU,
  eglPickLights,
  eglShadowBegin,
  eglShadowEnd,
  eglSun,
} from './engine/light.js';
import { EGL_POST_SH, eglPost, eglSnapshot, eglSunScreen } from './engine/post-effects.js';
import {
  WEATHER_LOOKS,
  environment,
  environmentFrame,
  environmentHere,
  environmentSky,
  environmentState,
  environmentWindowLit,
} from './environment.js';
/* eslint-disable no-func-assign */
expose({
  ALTERNATE_PROPS: [() => ALTERNATE_PROPS],
  BOBBING_PROPS: [() => BOBBING_PROPS],
  BORDER_M: [() => BORDER_M],
  BOX_INFO_CACHE: [() => BOX_INFO_CACHE],
  EVERGREEN_PROPS: [() => EVERGREEN_PROPS],
  FIXED_FACING: [() => FIXED_FACING],
  FIXED_FACING_BACK: [() => FIXED_FACING_BACK],
  FLOWER_COLORS: [() => FLOWER_COLORS],
  FLOWER_SET_BY_LOCATION: [() => FLOWER_SET_BY_LOCATION],
  FOLIAGE_PROPS: [() => FOLIAGE_PROPS],
  FOOTPRINT_COLORS: [() => FOOTPRINT_COLORS],
  FRUSTUM_PLANES: [() => FRUSTUM_PLANES],
  GRASS_KINDS: [() => GRASS_KINDS],
  GRASS_PUSHER_BUFFER: [() => GRASS_PUSHER_BUFFER],
  IMAGE_IDS: [() => IMAGE_IDS],
  MAP_CACHE_KEYS: [() => MAP_CACHE_KEYS],
  NEAR_RING_CHUNK_M: [() => NEAR_RING_CHUNK_M],
  NEAR_RING_SIZE: [() => NEAR_RING_SIZE],
  NEUTRAL_LOOK: [() => NEUTRAL_LOOK],
  NEUTRAL_MOOD: [() => NEUTRAL_MOOD],
  NO_PAD_PROPS: [() => NO_PAD_PROPS],
  PREP_BUDGET_MS: [() => PREP_BUDGET_MS],
  PROP_LOOK_CACHE: [() => PROP_LOOK_CACHE],
  PROP_MATERIALS: [() => PROP_MATERIALS],
  PROP_VARIETY_DEFAULT: [() => PROP_VARIETY_DEFAULT],
  PROP_VARIETY_RULES: [() => PROP_VARIETY_RULES],
  SLOPE_HUGGERS: [() => SLOPE_HUGGERS],
  SLOPE_HUG_CACHE: [() => SLOPE_HUG_CACHE],
  STILL_PROP_CACHE: [() => STILL_PROP_CACHE],
  SUNKEN_FOOTPRINT_PROPS: [() => SUNKEN_FOOTPRINT_PROPS],
  TERRAIN_MATERIALS: [() => TERRAIN_MATERIALS],
  WALK_SHADERS: [() => WALK_SHADERS],
  WALL_COLORS: [() => WALL_COLORS],
  WALL_MATERIALS: [() => WALL_MATERIALS],
  WATER_KIND_INDEX: [() => WATER_KIND_INDEX],
  WATER_KIND_LOOKS: [() => WATER_KIND_LOOKS],
  WATER_KIND_UNIFORMS: [() => WATER_KIND_UNIFORMS],
  WAVING_PROPS: [() => WAVING_PROPS],
  abortGroundPrep: [() => abortGroundPrep, v => (abortGroundPrep = v)],
  adaptQuality: [() => adaptQuality, v => setAdaptQuality(v)],
  addFootprint: [() => addFootprint, v => (addFootprint = v)],
  addHitTarget: [() => addHitTarget, v => (addHitTarget = v)],
  addRipple: [() => addRipple, v => (addRipple = v)],
  alternatePropImage: [() => alternatePropImage, v => (alternatePropImage = v)],
  askDeviceTilt: [() => askDeviceTilt, v => (askDeviceTilt = v)],
  baseNavGrid: [() => baseNavGrid],
  baseStopWalkView: [() => baseStopWalkView],
  battleCamera: [() => battleCamera, v => (battleCamera = v)],
  bindGestures: [() => bindGestures, v => (bindGestures = v)],
  boxInfo: [() => boxInfo, v => (boxInfo = v)],
  buildFarProps: [() => buildFarProps, v => (buildFarProps = v)],
  buildGrass: [() => buildGrass, v => setBuildGrass(v)],
  buildGroundMesh: [() => buildGroundMesh, v => (buildGroundMesh = v)],
  buildGroundSteps: [() => buildGroundSteps, v => (buildGroundSteps = v)],
  buildingPads: [() => buildingPads, v => (buildingPads = v)],
  cameraTurnLimit: [() => cameraTurnLimit],
  canvasForContext: [() => canvasForContext, v => (canvasForContext = v)],
  clampZoom: [() => clampZoom],
  computeFrustum: [() => computeFrustum, v => (computeFrustum = v)],
  computePropLook: [() => computePropLook, v => (computePropLook = v)],
  cullItems: [() => cullItems, v => (cullItems = v)],
  cutsceneCamera: [() => cutsceneCamera, v => (cutsceneCamera = v)],
  defaultWallMaterial: [() => defaultWallMaterial, v => ((defaultWallMaterial = v), provide({ defaultWallMaterial }))],
  drawBoxFaces: [() => drawBoxFaces, v => (drawBoxFaces = v)],
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
  easedMood: [() => easedMood, v => (easedMood = v)],
  effectsPass: [() => effectsPass, v => setEffectsPass(v)],
  fittedShadowPass: [() => fittedShadowPass, v => (fittedShadowPass = v)],
  foliageAmount: [() => foliageAmount, v => (foliageAmount = v)],
  frameBudgetLeft: [() => frameBudgetLeft, v => ((frameBudgetLeft = v), provide({ frameBudgetLeft }))],
  freeCameraOn: [() => freeCameraOn],
  freeMapCache: [() => freeMapCache, v => (freeMapCache = v)],
  freeNearRing: [() => freeNearRing, v => (freeNearRing = v)],
  gatherFountainBasins: [() => gatherFountainBasins, v => (gatherFountainBasins = v)],
  gatherFrameItems: [() => gatherFrameItems, v => setGatherFrameItems(v)],
  grassPushers: [() => grassPushers, v => (grassPushers = v)],
  grassTrail: [() => grassTrail, v => (grassTrail = v)],
  grassWork: [() => grassWork, v => setGrassWork(v)],
  groundCacheKey: [() => groundCacheKey, v => (groundCacheKey = v)],
  groundHeightAt: [() => groundHeightAt, v => ((groundHeightAt = v), provide({ groundHeightAt }))],
  groundNormalTexture: [() => groundNormalTexture, v => (groundNormalTexture = v)],
  groundOcclusion: [() => groundOcclusion, v => setGroundOcclusion(v)],
  groundOcclusionSteps: [() => groundOcclusionSteps, v => (groundOcclusionSteps = v)],
  groundOcclusionTexture: [() => groundOcclusionTexture, v => (groundOcclusionTexture = v)],
  groundOcclusionWork: [() => groundOcclusionWork, v => (groundOcclusionWork = v)],
  groundPixelNormal: [() => groundPixelNormal, v => (groundPixelNormal = v)],
  groundPrepWork: [() => groundPrepWork, v => (groundPrepWork = v)],
  handleCanvasClick: [() => handleCanvasClick, v => (handleCanvasClick = v)],
  heatHaze: [() => heatHaze, v => (heatHaze = v)],
  heatSources: [() => heatSources, v => (heatSources = v)],
  heightGrid: [() => heightGrid, v => (heightGrid = v)],
  hugSlope: [() => hugSlope, v => (hugSlope = v)],
  imageId: [() => imageId, v => (imageId = v)],
  imageIdCount: [() => imageIdCount, v => (imageIdCount = v)],
  inFrustum: [() => inFrustum, v => (inFrustum = v)],
  isGroundPrepared: [() => isGroundPrepared, v => (isGroundPrepared = v)],
  labelLayer: [() => labelLayer, v => (labelLayer = v)],
  lampLit: [() => lampLit, v => (lampLit = v)],
  lampShadowMaps: [() => lampShadowMaps, v => (lampShadowMaps = v)],
  lampTexture: [() => lampTexture, v => (lampTexture = v)],
  landmarkTilt: [() => landmarkTilt, v => (landmarkTilt = v)],
  listenDeviceTilt: [() => listenDeviceTilt, v => (listenDeviceTilt = v)],
  makeTextureMipmaps: [() => makeTextureMipmaps, v => (makeTextureMipmaps = v)],
  mapFlowers: [() => mapFlowers, v => (mapFlowers = v)],
  mapSun: [() => mapSun, v => (mapSun = v)],
  mirrorInView: [() => mirrorInView, v => (mirrorInView = v)],
  mountWalkView: [() => mountWalkView, v => setMountWalkView(v)],
  newNearRing: [() => newNearRing, v => (newNearRing = v)],
  onGlContextRestored: [() => onGlContextRestored, v => ((onGlContextRestored = v), provide({ onGlContextRestored }))],
  paintRingChunk: [() => paintRingChunk, v => (paintRingChunk = v)],
  personItem: [() => personItem, v => (personItem = v)],
  prepareMapGround: [() => prepareMapGround, v => (prepareMapGround = v)],
  propBaseHeight: [() => propBaseHeight, v => (propBaseHeight = v)],
  propGrid: [() => propGrid, v => (propGrid = v)],
  propLook: [() => propLook, v => (propLook = v)],
  propLookSettings: [() => propLookSettings, v => (propLookSettings = v)],
  propMaterial: [() => propMaterial, v => (propMaterial = v)],
  propVariety: [() => propVariety, v => (propVariety = v)],
  rawHeightAt: [() => rawHeightAt, v => ((rawHeightAt = v), provide({ rawHeightAt }))],
  rebuildFromSettings: [() => rebuildFromSettings, v => ((rebuildFromSettings = v), provide({ rebuildFromSettings }))],
  reflectionLevel: [() => reflectionLevel, v => (reflectionLevel = v)],
  reflectionPass: [() => reflectionPass, v => setReflectionPass(v)],
  repeatingTexture: [() => repeatingTexture, v => (repeatingTexture = v)],
  rideMountItem: [() => rideMountItem, v => (rideMountItem = v)],
  ringHasChunk: [() => ringHasChunk, v => (ringHasChunk = v)],
  ringMissingCount: [() => ringMissingCount, v => (ringMissingCount = v)],
  ringSlot: [() => ringSlot],
  roomBoxOf: [() => roomBoxOf, v => (roomBoxOf = v)],
  roomDimming: [() => roomDimming, v => (roomDimming = v)],
  roomLamps: [() => roomLamps, v => (roomLamps = v)],
  roomLights: [() => roomLights, v => (roomLights = v)],
  roomSkyLight: [() => roomSkyLight, v => (roomSkyLight = v)],
  roomTexture: [() => roomTexture, v => (roomTexture = v)],
  screenRay: [() => screenRay, v => (screenRay = v)],
  screenToGround2d: [() => screenToGround2d],
  setAdaptQuality: [() => setAdaptQuality, v => (setAdaptQuality = v)],
  setMountWalkView: [() => setMountWalkView, v => (setMountWalkView = v)],
  setNearRingUniforms: [() => setNearRingUniforms, v => (setNearRingUniforms = v)],
  setPropLookUniforms: [() => setPropLookUniforms, v => (setPropLookUniforms = v)],
  setShoreUniforms: [() => setShoreUniforms, v => (setShoreUniforms = v)],
  setSpriteUniforms: [() => setSpriteUniforms, v => (setSpriteUniforms = v)],
  setWaterUniforms: [() => setWaterUniforms, v => (setWaterUniforms = v)],
  shadowMapArea: [() => shadowMapArea, v => (shadowMapArea = v)],
  shadowPass: [() => shadowPass, v => setShadowPass(v)],
  shoreAt: [() => shoreAt, v => (shoreAt = v)],
  shoreField: [() => shoreField, v => (shoreField = v)],
  skyColors: [() => skyColors, v => (skyColors = v)],
  standingHeightAt: [() => standingHeightAt, v => ((standingHeightAt = v), provide({ standingHeightAt }))],
  startTownRise: [() => startTownRise, v => (startTownRise = v)],
  stillPropState: [() => stillPropState, v => (stillPropState = v)],
  swapMapCache: [() => swapMapCache, v => (swapMapCache = v)],
  townRiseAmount: [() => townRiseAmount, v => (townRiseAmount = v)],
  updateBasinMeshes: [() => updateBasinMeshes, v => (updateBasinMeshes = v)],
  updateNearRing: [() => updateNearRing, v => setUpdateNearRing(v)],
  uploadTextureStrips: [() => uploadTextureStrips, v => (uploadTextureStrips = v)],
  useWalkProgram: [() => useWalkProgram, v => (useWalkProgram = v)],
  walkCamera: [() => walkCamera, v => (walkCamera = v)],
  walkGlContext: [() => walkGlContext, v => (walkGlContext = v)],
  walkLightContext: [() => walkLightContext, v => (walkLightContext = v)],
  walkRenderer: [() => walkRenderer],
  wantedRingChunks: [() => wantedRingChunks, v => (wantedRingChunks = v)],
  waterAt: [() => waterAt, v => (waterAt = v)],
  waterFlowField: [() => waterFlowField, v => (waterFlowField = v)],
  waterKindLookup: [() => waterKindLookup, v => (waterKindLookup = v)],
  waterLife: [() => waterLife, v => (waterLife = v)],
  waterNear: [() => waterNear, v => (waterNear = v)],
  windLeanAt: [() => windLeanAt, v => (windLeanAt = v)],
  windowBlocked: [() => windowBlocked, v => (windowBlocked = v)],
  windowLightShare: [() => windowLightShare, v => (windowLightShare = v)],
  windowLit: [() => windowLit, v => (windowLit = v)],
  worldCurveArgs: [() => worldCurveArgs, v => (worldCurveArgs = v)],
  worldCurveDrop: [() => worldCurveDrop, v => (worldCurveDrop = v)],
  worldMapTexture: [() => worldMapTexture, v => (worldMapTexture = v)],
  worldToScreen2d: [() => worldToScreen2d],
});
/* eslint-enable no-func-assign */
provide({
  defaultWallMaterial,
  frameBudgetLeft,
  groundHeightAt,
  onGlContextRestored,
  rawHeightAt,
  rebuildFromSettings,
  standingHeightAt,
});
export function setBuildGrass(v) {
  buildGrass = v; // eslint-disable-line no-func-assign
  provide({ buildGrass });
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
export function setGrassWork(v) {
  grassWork = v; // eslint-disable-line no-func-assign
  provide({ grassWork });
}
export function setGroundOcclusion(v) {
  groundOcclusion = v; // eslint-disable-line no-func-assign
  provide({ groundOcclusion });
}
export function setReflectionPass(v) {
  reflectionPass = v; // eslint-disable-line no-func-assign
  provide({ reflectionPass });
}
export function setShadowPass(v) {
  shadowPass = v; // eslint-disable-line no-func-assign
  provide({ shadowPass });
}
export function setUpdateNearRing(v) {
  updateNearRing = v; // eslint-disable-line no-func-assign
  provide({ updateNearRing });
}
/* to-module: end */
export const walkRenderer = {
  on: false,
  ui: null,
  gkey: '',
  hkey: '',
  mesh: null,
  water: null,
  grass: null,
  yaw: 0,
  yawT: 0,
  zoom: 1,
  zoomT: 1,
  tiltX: 0,
  tiltY: 0,
  lead: [0, 0],
  focus: null,
  focusT: null,
  frames: 0,
  farProps: [],
  orient: null,
  drag: null,
  snapReq: 0,
  int: 0,
  adaptT: 0,
  fail: 0,
  lost: 0,
};
provide({ walkRenderer }); /* to-module */
/* v46: how long a frame may spend getting the next view ready (ms) */
const PREP_BUDGET_MS = /Android|iPhone|iPad/.test(navigator.userAgent) ? 4 : 6;
const BORDER_M = GROUND_BORDER_M,
  FIXED_FACING = [1, 0, 0],
  FIXED_FACING_BACK = [0, 0, -1];
/* which material a prop is made of: its own "mat", else guessed from its name */
export const PROP_MATERIALS = EGL_MATS;
export function propMaterial(k, M) {
  if (M && M.mat && EGL_MATS[M.mat]) return M.mat;
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
/* ---------- heights ---------- */
/* alpha 0.2: the land between the metre corners is a smooth curve (Catmull-Rom, kept between its four corners so it
   never overshoots) instead of a straight blend, so there is no crease at every metre and the light flows over hills.
   Before that, the ground is levelled under buildings, benches, stalls and the like (buildingPads): flat under the
   footprint, easing back into the land around it, so nothing stands on a slope with a corner in the air. */
const NO_PAD_PROPS =
  /fence|hedge|log|wall|rail|pipe|vineyard|shipwreck|yacht|boat|mesa|derrick|vault_door|mine_entrance|stilt|ferris|festival_stage/;
function buildingPads(sc) {
  const C = walkData().sc,
    ppu = C.ppu || 34,
    out = [];
  if (walkView.noPads) return out;
  for (const p of sc.props || []) {
    const M = C.props[p.k];
    if (!M || !M.box || M.flat || M.walk || NO_PAD_PROPS.test(p.k)) continue;
    const s = p.s || 1,
      bw = (M.box[0] * s) / 2,
      bd = M.box[1] * s,
      bld = !!(M.build || M.door != null);
    out.push({
      x0: p.x - bw,
      x1: p.x + bw,
      z0: p.z - 0.1,
      z1: p.z + bd,
      m: bld ? 1.5 : 0.9,
      ax: p.x,
      az: p.z,
      bld,
      a: bw * bd,
    });
  }
  return out.sort((a, b) => b.a - a.a);
}
function heightGrid(sc) {
  const H = sc.heights;
  if (!H || !H.length) return null;
  const now = performance.now(),
    c = sc._hg;
  if (c && now - c.t < 120 && c.H === H) return c;
  const CP = walkData().sc.props;
  let sig = (sc._hv || 0) + '|' + (sc.props ? sc.props.length : 0);
  if (sc.props)
    for (const p of sc.props) {
      const M = CP[p.k];
      if (M && M.box) sig += ',' + Math.round(p.x * 10) + ':' + Math.round(p.z * 10) + ':' + (p.s || 1);
    }
  if (c && c.H === H && c.sig === sig) {
    c.t = now;
    return c;
  }
  const W = sc.w,
    Hh = sc.h,
    G = new Float32Array((W + 1) * (Hh + 1));
  for (let b = 0; b <= Hh; b++) {
    const r = H[Hh - b];
    for (let a = 0; a <= W; a++) G[b * (W + 1) + a] = r ? +r[a] || 0 : 0;
  }
  const wet = (a, b) => {
    for (const [da, db] of [
      [0, 0],
      [-1, 0],
      [0, -1],
      [-1, -1],
    ]) {
      const i = a + da,
        j = Hh - 1 - (b + db);
      const ch = i >= 0 && j >= 0 && i < W && j < Hh ? ((sc.tiles || [])[j] || '')[i] : null;
      if (ch === 'w' || ch === 'd') return true;
    }
    return false;
  };
  const bil = (x, z) => {
    const fx = clamp(x, 0, W),
      fz = clamp(z, 0, Hh),
      i = Math.min(W - 1, Math.floor(fx)),
      j = Math.min(Hh - 1, Math.floor(fz)),
      u = fx - i,
      v = fz - j,
      g = (a, b) => G[b * (W + 1) + a];
    return (g(i, j) * (1 - u) + g(i + 1, j) * u) * (1 - v) + (g(i, j + 1) * (1 - u) + g(i + 1, j + 1) * u) * v;
  };
  for (const P of buildingPads(sc)) {
    const tg = bil(P.ax, P.az);
    for (let b = Math.max(0, Math.floor(P.z0 - P.m)); b <= Math.min(Hh, Math.ceil(P.z1 + P.m)); b++)
      for (let a = Math.max(0, Math.floor(P.x0 - P.m)); a <= Math.min(W, Math.ceil(P.x1 + P.m)); a++) {
        const dx = Math.max(0, P.x0 - a, a - P.x1),
          dz = Math.max(0, P.z0 - b, b - P.z1),
          d = Math.hypot(dx, dz);
        if (d >= P.m || wet(a, b)) continue;
        const w = d <= 0 ? 1 : 1 - smooth01(d / P.m),
          q = b * (W + 1) + a;
        G[q] += (tg - G[q]) * w;
      }
  }
  return (sc._hg = { H, sig, t: now, G, W, Hh });
}
export function rawHeightAt(sc, x, z) {
  const Q = heightGrid(sc);
  if (!Q) return 0;
  const W = Q.W,
    Hh = Q.Hh,
    G = Q.G,
    fx = clamp(x, 0, W),
    fz = clamp(z, 0, Hh),
    i = Math.min(W - 1, Math.floor(fx)),
    j = Math.min(Hh - 1, Math.floor(fz)),
    u = fx - i,
    v = fz - j;
  const g = (a, b) => G[clamp(b, 0, Hh) * (W + 1) + clamp(a, 0, W)],
    cr = (p0, p1, p2, p3, t) =>
      p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  const r0 = cr(g(i - 1, j - 1), g(i, j - 1), g(i + 1, j - 1), g(i + 2, j - 1), u),
    r1 = cr(g(i - 1, j), g(i, j), g(i + 1, j), g(i + 2, j), u),
    r2 = cr(g(i - 1, j + 1), g(i, j + 1), g(i + 1, j + 1), g(i + 2, j + 1), u),
    r3 = cr(g(i - 1, j + 2), g(i, j + 2), g(i + 1, j + 2), g(i + 2, j + 2), u);
  const a = g(i, j),
    b = g(i + 1, j),
    c = g(i, j + 1),
    d = g(i + 1, j + 1);
  return clamp(cr(r0, r1, r2, r3, v), Math.min(a, b, c, d), Math.max(a, b, c, d));
}
/* the visible ground (smooth land plus the terrace, cliff or stair raise of its half-metre cell) and the height you
   stand at (a bridge deck where there is one; a little lower in water) */
export function groundHeightAt(x, z) {
  const sc = walkView.sc;
  if (!sc) return 0;
  return rawHeightAt(sc, x, z) + stepRaiseAt(x, z, sc);
}
export function standingHeightAt(x, z) {
  const sc = walkView.sc;
  if (!sc) return 0;
  if (sc.bridges) {
    const b = bridgeAt(x, z, sc);
    if (b != null) return b;
  }
  let h = groundHeightAt(x, z);
  const ch = terrainAt(x, z);
  if (ch === 'w' || ch === 'd') h -= 0.12;
  return h;
}
/* the scene's wall materials (index → colour; 0 means the scene's own rock) */
export const WALL_MATERIALS = [
  'Scene rock',
  'Rock',
  'Layered sandstone',
  'Cave rock',
  'Brick',
  'Dressed stone',
  'Hedge',
  'Wooden boards',
  'Stone steps',
  'Mossy rock',
  'Concrete',
  'Dark slate',
];
export const WALL_COLORS = [
  [0.47, 0.45, 0.42],
  [0.5, 0.48, 0.45],
  [0.8, 0.58, 0.38],
  [0.38, 0.35, 0.44],
  [0.69, 0.38, 0.3],
  [0.69, 0.66, 0.62],
  [0.3, 0.52, 0.28],
  [0.58, 0.4, 0.27],
  [0.64, 0.62, 0.57],
  [0.42, 0.47, 0.36],
  [0.62, 0.62, 0.6],
  [0.32, 0.33, 0.38],
];
export function defaultWallMaterial(sc) {
  if (sc.cliffMat) return sc.cliffMat;
  if (sc.far === 'canyon') return 2;
  if (sc.indoor && sc.far === 'cave') return 3;
  if (sc.indoor) return 10;
  if (/city|town/.test(sc.far || '') && sc.folk > 6) return 5;
  return 1;
}
/* walking: too steep is blocked (worked out once per scene, with the rest of the walking grid) */
const baseNavGrid = navGrid;
setNavGrid(function () {
  const sc = walkView.sc,
    fresh = !(
      walkView.nav &&
      walkView.navSc === sc &&
      walkView.navG === walkView.gkey &&
      walkView.navP === (sc.props || []).length
    ),
    n = baseNavGrid();
  if (!fresh || !sc.heights || !sc.heights.length || n._hk) return n;
  const { N, gw, gh, blk } = n;
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      const x = (i + 0.5) / N,
        z = (j + 0.5) / N,
        e = 0.3,
        gx = (rawHeightAt(sc, x + e, z) - rawHeightAt(sc, x - e, z)) / (2 * e),
        gz = (rawHeightAt(sc, x, z + e) - rawHeightAt(sc, x, z - e)) / (2 * e);
      if (Math.hypot(gx, gz) > 1.05) blk[j * gw + i] = 1;
    }
  n._hk = 1;
  return n;
});
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
  const useGL = !EGL.fail && eglOK();
  cv = canvasForContext(cv, 'gl');
  if (!useGL) {
    walkRenderer.on = false;
    if (walkRenderer.ui) walkRenderer.ui.hidden = true;
    walkView.ready = false;
    walkView.err = new Error('WebGL 2 is not available');
    if (typeof noWebGL === 'function') noWebGL(EGL.fail ? 'failed' : '');
    return Promise.resolve();
  }
  walkView.cv = cv;
  walkView.opt = opt;
  if (walkView.id !== id) {
    walkView.id = id;
    walkView.cam = null;
    Object.assign(walkView.pl, { t: -1, fresh: true, pk: '', route: null, goal: null, line: null, walk: 0 });
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
  cv.classList.add('gl');
  if (!walkGlContext(cv)) return mountWalkView(cv, id, opt);
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
export function walkGlContext(cv) {
  if (EGL.cv === cv && EGL.gl) {
    if (!EGL.lost)
      try {
        eglPrograms(WALK_SHADERS);
      } catch (e) {
        console.error(e);
        EGL.fail = 1;
        return false;
      }
    return true;
  }
  if (!eglInit(cv)) {
    EGL.fail = 1;
    return false;
  }
  try {
    eglPrograms(WALK_SHADERS);
    eglPrograms(EGL_POST_SH);
    for (const d of [
      typeof BLD_SH !== 'undefined' && BLD_SH,
      typeof P3D_SH !== 'undefined' && P3D_SH,
      typeof propModelShaders === 'function' && propModelShaders(),
    ])
      if (d)
        eglPrecompile(
          d
        ); /* alpha 0.4: the low-poly props' too (they were built on first use, in the first place with props) */
  } catch (e) {
    console.error(e);
    EGL.fail = 1;
    if (typeof NWLOG !== 'undefined') NWLOG.add('webgl', 'shader failed: ' + e.message);
    return false;
  }
  walkRenderer.gkey = '';
  walkRenderer.farKey = '';
  walkRenderer.sceneCache = null;
  walkRenderer.wtex = null;
  for (const k of MAP_CACHE_KEYS) walkRenderer[k] = null;
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
export function worldCurveArgs() {
  const sc = walkView.sc;
  return [sc.w / 2, sc.h / 2, eng('world', 'curve'), Math.max(sc.w, sc.h) * 0.55 + 4];
}
export function worldCurveDrop(x, z) {
  const sc = walkView.sc;
  if (!sc) return 0;
  const c = worldCurveArgs(),
    d = Math.max(0, Math.hypot(x - c[0], z - c[1]) - c[3]);
  return c[2] * d * d;
}
/* ---------- input: taps (focus follows them), two-finger turn and pinch, Ctrl+wheel zoom, Q/E/R, phone tilt ---------- */
/* alpha 0.4.1: a preview that asks for a free camera (the Studio's) turns all the way round, zooms further and zooms with the plain wheel */
const freeCameraOn = () => !!(walkView.opt && walkView.opt.freeCam),
  cameraTurnLimit = () => (freeCameraOn() ? Math.PI : (eng('camera', 'turn') * Math.PI) / 180),
  clampZoom = v => (freeCameraOn() ? clamp(v, 0.3, 3.2) : clamp(v, eng('camera', 'zoomMin'), eng('camera', 'zoomMax')));
function handleCanvasClick(ev) {
  if (walkView.battle || walkView.director || !walkView.ready || (walkView.opt.active && !walkView.opt.active()))
    return;
  if (typeof S !== 'undefined') askDeviceTilt();
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
    const p = (typeof S !== 'undefined' && S && S.preferences) || {};
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
      const p = (S && S.preferences) || {};
      if (p.tilt === false) return;
      DeviceOrientationEvent.requestPermission().catch(() => {});
    }
  } catch (e) {}
}
/* ---------- shaders ---------- */
export const WALK_SHADERS = {
  ground: [
    `#version 300 es
precision highp float;in vec3 aPos;in vec3 aNrm;layout(location=2) in vec3 aWall;uniform mat4 uVP;out vec3 vW;out vec3 vN;out vec3 vWall;out vec4 vClip;${EGL_GLSL_COMMON}
void main(){vec3 p=aPos;p.y+=curveY(p.xz);vW=p;vN=aNrm;vWall=aWall;gl_Position=uVP*vec4(p,1.);vClip=gl_Position;}`,
    `#version 300 es
precision highp float;in vec3 vW;in vec3 vN;in vec3 vWall;in vec4 vClip;out vec4 o;uniform sampler2D uGround,uFar,uCliff,uGNrm,uWallA;uniform vec4 uGRect;uniform vec3 uFarTint;uniform float uGStr,uGShine,uWallDef,uAspect;uniform vec3 uWallCol[12];uniform vec3 uPlC;uniform sampler2D uShore;uniform vec3 uShoreR,uBed;uniform vec4 uRoom;uniform float uRoomY;uniform sampler2D uGAO;uniform vec3 uGAOR,uSkyW;uniform float uWet,uRainK,uCausW;uniform sampler2D uRing,uRingN;uniform vec2 uRingC[16];uniform vec4 uRingBox;uniform vec3 uCanvas;${EGL_GLSL_LIGHT}
/* v46: the near ring: the 16 m squares round you at full size (4 x 4 of them in one texture, each in the slot its
   position mod 4 gives); the view's whole ground is the small distant picture. 0 = not in the ring */
float ringAt(vec2 cc,out vec2 ruv){ruv=vec2(0.);if(uCanvas.z<.5)return 0.;vec2 ch=floor(cc/16.),s=mod(ch,4.);int si=int(s.x+.5)+int(s.y+.5)*4;vec2 h=uRingC[si];if(abs(h.x-ch.x)>.5||abs(h.y-ch.y)>.5)return 0.;
 ruv=(s*16.+(cc-ch*16.))/64.;vec2 e=min(cc-uRingBox.xy,uRingBox.zw-cc);return clamp(min(e.x,e.y)/3.,0.,1.);}
vec3 rampW(vec3 b,float t){vec3 d0=mix(b*.55,vec3(.235,.165,.439),.30),d1=mix(b*.79,vec3(.376,.29,.596),.17),l3=mix(b,vec3(1.,.957,.769),.30),l4=mix(b,vec3(1.,.988,.918),.60);return t<.5?d0:t<1.5?d1:t<2.5?b:t<3.5?l3:l4;}
float bayerG(vec2 p){ivec2 i=ivec2(mod(p,4.));int b[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);return (float(b[i.y*4+i.x])+.5)/16.;}
void main(){vec3 n=normalize(vN);vec2 rcc=vec2((vW.x-uGRect.x)*uGRect.z,(uGRect.y-vW.z)*uGRect.w)*uCanvas.xy,rdx=dFdx(rcc)/64.,rdy=dFdy(rcc)/64.;vec2 ruv;float rw=ringAt(rcc,ruv);
 if(vWall.z>0.){/* a wall: between the camera and you it thins out so you stay in view */vec2 nd=vClip.xy/vClip.w;if(vClip.w<uPlC.z-.6&&length((nd-uPlC.xy)*vec2(uAspect,1.))<.26&&bayerG(gl_FragCoord.xy)<.62)discard;
  int m=int((vWall.x<.5?uWallDef:vWall.x)+.5);m=clamp(m,0,11);vec2 tc=abs(n.x)>abs(n.z)?vec2(vW.z,-vW.y):vec2(vW.x,-vW.y);vec2 gg=tc*.5,cell=vec2(float(m%4),float(m/4));
  vec2 aa=(cell+fract(gg))/vec2(4.,3.);float lv=textureGrad(uWallA,aa,dFdx(gg)/vec2(4.,3.),dFdy(gg)/vec2(4.,3.)).r*4.;vec3 a=rampW(uWallCol[m],floor(lv+.5));
  float hy=vWall.y*vWall.z,top=vWall.z-hy;a*=(top<.06?1.22:1.)*mix(.7,1.,clamp(hy/.7,0.,1.));
  /* v31: a room's walls: a skirting board along the floor, a little darker toward the corners */
  if(uRoom.w>.5&&m==10){if(hy<.18){a=vec3(.6,.4,.26)*(hy>.158?1.7:hy>.142?.62:hy<.02?.7:1.15)*(.93+.07*fract(sin(floor(tc.x*1.5)*91.7)*437.5));}else if(hy<.22)a*=.8;float cd=min(abs(vW.x-uRoom.x),abs(vW.x-uRoom.y));a*=mix(.8,1.,smoothstep(0.,.9,cd));
   /* v47: a corner trim where the back wall meets a side wall: a plain wooden post at wall height closes the joint */
   float dc=abs(n.x)>.5?abs(uRoom.z-vW.z):cd;if(dc<.07&&top>.005)a=vec3(.6,.4,.26)*(dc>.055?.62:dc<.02?1.28:1.08)*(top<.04?1.2:1.);}
  if((m<4||m==9)&&vWall.z>.3){float u=floor(tc.x*16.)/16.,rag=.09+.12*fract(sin(u*127.1)*43758.5)+.04*sin(u*4.7);vec2 gt=vec2((vW.x-n.x*.14-uGRect.x)*uGRect.z,(uGRect.y-(vW.z-n.z*.14))*uGRect.w);
   if(top<rag)a=texture(uGround,gt).rgb*(top>rag-.03?.78:1.);else if(top<rag+.05)a*=.62;}
  /* scree: pebbles fallen at the foot */
  if((m<4||m==9)&&hy<.12){float sp=fract(sin(dot(floor(vec2(tc.x,hy)*16.),vec2(12.9898,78.233)))*43758.5);if(sp>.72)a=mix(a,vec3(.62,.58,.52)*(.8+.4*sp),.6);}
  float sh=shadowAtN(vW+n*.04,n,.0012),ao=mix(contactAO(vW),1.,clamp(hy/.6,0.,1.));if(uRoom.w>.5&&m==10)ao=mix(ao,1.,.6);vec3 lit=shade(a,n,vW,sh,ao,vec4(0.,1.,0.,.25),0.);
  /* v32: sunlight thrown up off water in front of a wall: thin wandering bright lines near its foot */
  vec3 caw=vec3(0.);if(uShoreR.z>.5&&uCausW>0.){vec2 su=(vW.xz+n.xz*.7)*uShoreR.xy;if(su.x>0.&&su.y>0.&&su.x<1.&&su.y<1.){float sf=texture(uShore,su).r;if(sf>.5){vec2 q=floor(vec2(dot(vW.xz,vec2(n.z,-n.x)),vW.y)*16.)/16.;float t=uTime*.001;
   float k=sin(q.x*5.1+t*1.3+sin(q.y*3.7-t)*1.4)+sin(q.x*3.3-t*.9+q.y*4.2);float cl=pow(clamp(1.-abs(k)*.55,0.,1.),6.);caw=uSunCol*cl*.35*uCausW*smoothstep(.5,.66,sf)*(1.-smoothstep(.2,1.8,hy))*sh;}}}
  o=vec4(fogit(lit+caw,vW),0.);return;}
 /* v31: in a room, past the front edge: the floor boards' cut edge, then the dark under the floor */
 if(uRoom.w>.5&&vW.z<-.001){float d=uRoomY-vW.y;vec3 sec=d<.07?vec3(.42,.3,.2)*(d<.015?1.25:1.):d<.13?vec3(.16,.12,.1):mix(vec3(.1,.08,.09),vec3(.02,.02,.03),smoothstep(.13,1.4,d));o=vec4(fogit(sec,vW),0.);return;}
 vec2 g=vec2((vW.x-uGRect.x)*uGRect.z,(uGRect.y-vW.z)*uGRect.w);vec3 a;float spec=0.;float st=1.-n.y,c=smoothstep(.28,.5,st);
 if(g.x>0.&&g.y>0.&&g.x<1.&&g.y<1.){a=texture(uGround,g).rgb;if(rw>0.)a=mix(a,textureGrad(uRing,ruv,rdx,rdy).rgb,rw);/* v24: snow reads white, not grey */{float lm=dot(a,vec3(.3,.59,.11));a*=1.+.3*smoothstep(.74,.9,lm)*clamp(1.-abs(a.r-a.b)*4.,0.,1.);}vec4 gm=texture(uGNrm,g);if(rw>0.)gm=mix(gm,textureGrad(uRingN,ruv,rdx,rdy),rw);n=normalize(n+vec3(gm.r*2.-1.,0.,gm.g*2.-1.)*uGStr*(1.-c));spec=gm.a;
  /* v31: the shore: water tile art becomes a sandy-muddy bed, and a wet rim darkens the bank along the curved edge */
  if(uRoom.w>.5){float dw=min(min(vW.x-uRoom.x,uRoom.y-vW.x),uRoom.z-vW.z);a*=mix(.7,1.,smoothstep(0.,.75,dw));}
  if(uShoreR.z>.5){vec2 su=(floor(vW.xz*16.)+.5)/16.*uShoreR.xy;if(su.x>0.&&su.y>0.&&su.x<1.&&su.y<1.){float sf=texture(uShore,su).r;
   float blu=smoothstep(.02,.1,a.b-max(a.r,a.g)*.9)*step(.12,sf);vec3 bed=uBed*(.82+.3*lnoise(floor(vW.xz*16.)*.21))*mix(1.,.7,smoothstep(.55,.9,sf));
   /* v47: pebbles on the bed, one to a cell of an eighth of a metre (most cells), lit on their far side, on the pixel grid */
   {vec2 pq=(floor(vW.xz*32.)+.5)/32.*8.,pc=floor(pq),pf=fract(pq);vec3 ph=fract(sin(vec3(dot(pc,vec2(127.1,311.7)),dot(pc,vec2(269.5,183.3)),dot(pc,vec2(419.2,371.9))))*43758.55);
    vec2 pd=pf-(.3+ph.xy*.4);float pr=.16+ph.z*.17;if(ph.z>.28&&length(pd*vec2(1.,1.25))<pr){bed=mix(bed,vec3(.6,.58,.54)*(.7+.5*ph.x),.55)*(pd.y>pr*.25?1.18:pd.y<-pr*.4?.82:1.);}}a=mix(a,bed,max(blu,smoothstep(.5,.75,sf)*.65));
   float wet=smoothstep(.2,.46,sf);a*=1.-.26*wet;a=mix(a,a*vec3(.9,.95,1.04),wet*.5);spec=max(spec,wet*(1.-smoothstep(.5,.6,sf))*.55);n=normalize(mix(n,vec3(0.,1.,0.),wet*.6));}}}
 else a=texture(uFar,vW.xz).rgb*uFarTint*(.82+.36*lnoise(vW.xz*.11))*(.9+.2*lnoise(vW.xz*.37+7.));
 /* v32: after rain the ground is darker and a little shiny, with puddles on level paths and paving that mirror the sky */
 float pud=0.;if(uWet>0.&&g.x>0.&&g.y>0.&&g.x<1.&&g.y<1.){float grs=smoothstep(.015,.07,a.g-max(a.r,a.b));a*=1.-uWet*(.2-grs*.08);spec=max(spec,uWet*(1.-grs)*.45);
  vec2 pq=floor(vW.xz*16.)/16.;pud=smoothstep(.56,.72,lnoise(pq*.38+3.1)*.75+lnoise(pq*1.4+7.)*.3)*uWet*smoothstep(.985,.997,normalize(vN).y)*(1.-grs)*(1.-c);}
 a=snowOn(seasonal(a,vW),vW,normalize(vN).y);
if(c>0.){vec3 cx=texture(uCliff,vec2(vW.z,-vW.y)*.9).rgb,cz=texture(uCliff,vec2(vW.x,-vW.y)*.9).rgb;vec3 cl=mix(cz,cx,abs(n.x)/(abs(n.x)+abs(n.z)+.001));a=mix(a,cl*(.78+.2*n.y),c);}
 float bias=.0008+.0025*(1.-max(dot(n,uSunDir),0.));float sh=shadowAtN(vW+n*.03,n,bias);float ao=contactAO(vW);float occ=min(sh,ao);
 /* v32: soft shade baked in round the feet of trees, buildings, rocks and walls */
 float gao=1.;if(uGAOR.z>0.){vec2 gu=vW.xz*uGAOR.xy;if(gu.x>0.&&gu.y>0.&&gu.x<1.&&gu.y<1.)gao=mix(1.,texture(uGAO,gu).r,uGAOR.z);}
 if(pud>0.){vec3 vv=normalize(uEye-vW);float fr=.35+.6*pow(1.-max(vv.y,0.),3.);float rr=0.;if(uRainK>0.){vec2 cq=floor(vW.xz*16.)/16.*2.2,ci=floor(cq),cf=fract(cq)-.5;float ph=fract(uTime*.0011+fract(sin(dot(ci,vec2(12.9,78.2)))*437.5));rr=(1.-smoothstep(0.,.06,abs(length(cf)-ph*.5)))*(1.-ph)*uRainK;}
  float rim=smoothstep(.15,.4,pud)*(1.-smoothstep(.45,.75,pud));a=mix(a,mix(a*.3,uSkyW*1.3+.04,fr*.85)+rr*.3,smoothstep(.35,.7,pud)*.9);a*=1.-rim*.35;n=normalize(mix(n,vec3(0.,1.,0.),pud));spec=max(spec,pud*1.6);}
 vec3 lit=shade(a*mix(1.,gao,.35),n,vW,sh,mix(1.,ao,.7)*gao,vec4(spec*uGShine*.9,24.,0.,0.),0.);
 /* v47: alpha 0 marks the ground for the post pass: no ink outlines on it */o=vec4(fogit(lit,vW),0.);}`,
  ],
  sprite: [
    `#version 300 es
precision highp float;in vec2 aC;uniform mat4 uVP;uniform vec3 uBase,uRight;uniform vec4 uOff;uniform vec4 uUV;uniform float uFlip,uShear,uCurveOn,uDZ,uSlope;uniform vec3 uFwd,uWave;out vec2 vUV;out vec3 vW;out float vH;out float vPx;out float vRip;${EGL_GLSL_COMMON}
void main(){vRip=0.;float px=(uOff.x+aC.x*uOff.z),py=(uOff.y+aC.y*uOff.w);float h=-py;float fh=clamp(h/max(.01,-uOff.y),0.,1.),sh=uShear*h*(.25+.75*fh);/* v43: the bend grows toward the top, like a stem */vec3 p=uBase+uFwd*uDZ+uRight*(px*uFlip+sh)+vec3(0.,h+uSlope*px*uFlip-abs(sh)*.35*fh,0.);
 /* v43: a flag: cloth that ripples from the hoist (aC.x = 0) to the free end, lifting, dipping and trailing in the wind */
 if(uWave.x>0.){float ph=aC.x*6.5-uWave.y,a=uWave.x*aC.x;p+=vec3(0.,sin(ph+.8)*a*.45,0.)+uRight*(-(aC.x*aC.x)*uWave.x*.35*(.5+.5*sin(ph-1.2)))*uFlip+uFwd*sin(ph)*a*.5;vRip=cos(ph)*a*2.2;}
 p.y+=curveY(uBase.xz)*uCurveOn;vW=p;vPx=px*uFlip+sh;vH=clamp(h/max(.01,-uOff.y),0.,1.);vUV=vec2(uUV.x+aC.x*uUV.z,uUV.y+aC.y*uUV.w);gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec2 vUV;in vec3 vW;in float vH;in float vPx;in float vRip;out vec4 o;uniform sampler2D uTex,uNrm;uniform vec3 uRight,uBack,uSunH,uBaseP;uniform float uFade,uRim,uLit,uAlpha,uShade,uEmit,uFlipN,uFixed,uSelOut;uniform vec4 uMat,uUV;uniform vec3 uSelf;${EGL_GLSL_LIGHT}${EGL_GLSL_LOOK}
float bayer(vec2 p){ivec2 i=ivec2(mod(p,4.));int b[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);return (float(b[i.y*4+i.x])+.5)/16.;}
void main(){vec4 c=texture(uTex,vUV);if(c.a<.5)discard;if(uFade<.99&&bayer(gl_FragCoord.xy)>uFade)discard;
 /* v47: one outline rule: a near-black texel on the picture's edge takes a deep shade of the colour beside it, so
    outlines are coloured, as the newer art draws them (the pictures themselves are not changed) */
 if(uSelOut>0.&&dot(c.rgb,vec3(.3,.59,.11))<.17){vec2 ts=1./vec2(textureSize(uTex,0));vec4 q[4]=vec4[4](texture(uTex,vUV+vec2(ts.x,0.)),texture(uTex,vUV-vec2(ts.x,0.)),texture(uTex,vUV+vec2(0.,ts.y)),texture(uTex,vUV-vec2(0.,ts.y)));
  float ed=0.,n=0.;vec3 s=vec3(0.);for(int i=0;i<4;i++){if(q[i].a<.5)ed+=1.;else if(dot(q[i].rgb,vec3(.3,.59,.11))>=.17){s+=q[i].rgb;n+=1.;}}
  if(ed>0.&&n>0.)c.rgb=mix(c.rgb,s/n*vec3(.5,.45,.56),uSelOut);}
 vec3 nn=texture(uNrm,vUV).xyz*2.-1.;vec3 n=normalize(uRight*nn.x*uFlipN+vec3(0.,-nn.y,0.)+uBack*max(nn.z,.2));c.rgb=lookOn(c.rgb,floor(vUV*vec2(textureSize(uTex,0))),vH,uBaseP);c.rgb=snowOn(seasonal(c.rgb,uBaseP),vW,n.y);
 /* shadows from other things. A picture that stays put in the world is itself in the shadow map, so it is looked up
    just in front of its own plane; one that turns to face the camera is looked up a little toward the sun instead */
 vec3 sp=uFixed>.5?vW+uBack*.06+vec3(0.,.03,0.):vW+uSunH*(abs(vPx)*.9+.35)+vec3(0.,.05,0.);
 float sh=shadowAt(sp,uFixed>.5?.0009:.0015);
 /* alpha 0.4.1: a tree shades itself. From each texel a short march toward the sun across its own picture: leaves
    above (or beside, when the sun is low) put the trunk and the lower and inner leaves in shade, the crown stays lit */
 if(uSelf.x>0.){vec2 tz=vec2(textureSize(uTex,0)),d=uSelf.yz*uUV.w*tz.y*.045/tz;vec2 q=vUV+d*1.5;float hit=0.,wt=0.;
  for(int i=0;i<10;i++){q+=d;if(q.x<uUV.x||q.y<uUV.y||q.x>uUV.x+uUV.z||q.y>uUV.y+uUV.w)break;float w=1.-float(i)*.05;hit+=step(.5,texture(uTex,q).a)*w;wt+=w;}
  sh=min(sh,1.-uSelf.x*smoothstep(1.2,4.2,hit));}float ao=mix(contactAO(uBaseP),1.,clamp(vH*3.,0.,1.));float occ=min(sh,ao);
 float nl=dot(n,uSunDir),wr=(nl+uMat.w)/(1.+uMat.w);float dif=mix(1.,max(wr,0.)*.75+.45,uShade);vec3 v=normalize(uEye-vW);float rim=pow(1.-max(dot(n,v),0.),3.)*uRim;
 float spc=pow(max(dot(n,normalize(uSunDir+v)),0.),uMat.y)*uMat.x*occ;
 /* light coming through leaves and cloth from behind */
 float trn=uMat.z*(pow(max(dot(-v,uSunDir),0.),2.)*.8+max(-nl,0.)*.35)*sh;
 /* v43: shade() with the sprite's soft terminator (uShade) as the wrap: a picture already carries its shading, the light only tilts it */
 vec3 lit=shade(c.rgb,normalize(vec3(n.x,max(n.y,.25),n.z)),vW,sh,ao,vec4(uMat.x,uMat.y,0.,mix(4.,uMat.w,uShade)),0.)+c.rgb*rim*uSunCol*sh;
 vec3 col=mix(c.rgb,lit+c.rgb*uSunCol*trn,uLit)+c.rgb*uEmit;col*=1.+vRip;o=vec4(fogit(col,vW),uAlpha);}`,
  ],
  shadow: [
    `#version 300 es
precision highp float;in vec2 aC;uniform mat4 uVP;uniform vec3 uBase,uRight;uniform vec4 uOff,uUV;uniform float uFlip,uShear;out vec2 vUV;${EGL_GLSL_COMMON}
void main(){float px=(uOff.x+aC.x*uOff.z),py=(uOff.y+aC.y*uOff.w);float h=-py;float fh=clamp(h/max(.01,-uOff.y),0.,1.),sh=uShear*h*(.25+.75*fh);vec3 p=uBase+uRight*(px*uFlip+sh)+vec3(0.,h+curveY(uBase.xz)-abs(sh)*.35*fh,0.);vUV=vec2(uUV.x+aC.x*uUV.z,uUV.y+aC.y*uUV.w);gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec2 vUV;uniform sampler2D uTex;out vec4 o;void main(){if(texture(uTex,vUV).a<.5)discard;o=vec4(1.);}`,
  ],
  shadowG: [
    `#version 300 es
precision highp float;in vec3 aPos;uniform mat4 uVP;${EGL_GLSL_COMMON}
void main(){vec3 p=aPos;p.y+=curveY(p.xz);gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;out vec4 o;void main(){o=vec4(1.);}`,
  ],
  sky: [
    `#version 300 es
precision highp float;in vec2 aC;out vec2 vP;void main(){vP=aC*2.-1.;gl_Position=vec4(vP,.9999,1.);}`,
    `#version 300 es
precision highp float;in vec2 vP;out vec4 o;uniform mat4 uIVP;uniform vec3 uSky0,uSky1,uSky2,uSunCol,uSunDir;uniform float uIndoor,uTime,uSunPulse,uMirror,uClouds,uCloudSpd;uniform sampler2D uWorld;uniform vec4 uEnv;uniform vec3 uMoon;
float hsh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x),mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vn(p);p*=2.03;a*=.5;}return s;}
void main(){vec4 a=uIVP*vec4(vP,-1.,1.),b=uIVP*vec4(vP,1.,1.);vec3 d=normalize(b.xyz/b.w-a.xyz/a.w);if(uMirror>.5)d.y=-d.y;float e=d.y;
 vec3 c=e<.18?mix(uSky2,uSky1,smoothstep(-.05,.18,e)):mix(uSky1,uSky0,smoothstep(.18,.75,e));
 if(uIndoor<.5){vec2 q=d.xz/max(.12,d.y+.25);float cl=smoothstep(1.-uClouds*.5,1.3-uClouds*.5,fbm(q*.9+vec2(uTime,uTime*.5)*.000012*uCloudSpd)+.25);
  /* v26: clouds take the light of the hour: grey in bad weather, dark at night */
  vec3 cc=mix(vec3(1.,.99,.96),mix(uSky1,uSky0,.3)*1.25+.06,clamp(uEnv.z*.7+uEnv.x*.85,0.,1.));c=mix(c,cc,cl*.8*smoothstep(-.02,.2,e));
  /* alpha 0.4: after rain, a rainbow opposite the sun (42 degrees round the point opposite it, red outside) */
  if(uEnv.w>.01){float th=degrees(acos(clamp(dot(d,-normalize(uMoon)),-1.,1.))),r=(th-40.4)/2.2;if(r>0.&&r<1.&&e>-.03){float hu=(1.-r)*.78;vec3 rb=clamp(abs(fract(vec3(hu)+vec3(0.,.6667,.3333))*6.-3.)-1.,0.,1.);
   c=mix(c,c*.6+rb*.75,uEnv.w*.42*smoothstep(0.,.12,r)*smoothstep(1.,.88,r)*smoothstep(-.03,.1,e));}}
  /* v32: a high thin layer drifting the other way, bright rims on the low clouds, and a glow along the horizon */
  float cl2=smoothstep(.58,.92,fbm(q*.32+vec2(-uTime,uTime*.4)*.000007*uCloudSpd+11.))*uClouds*.6;c=mix(c,cc*1.04+.03,cl2*.45*smoothstep(.05,.35,e)*(1.-cl));
  c+=uSunCol*cl*(1.-cl)*4.*.06*(1.-uEnv.x)*(1.-uEnv.z)*smoothstep(-.02,.2,e);c=mix(c,uSky2*1.06+.02,exp(-abs(e-.02)*16.)*.22*(1.-uEnv.x*.6));
  float lon=atan(d.z,d.x),lat=asin(clamp(d.y,-1.,1.));vec3 far=texture(uWorld,vec2(lon/6.2832+.5,.5-lat/3.1416)).rgb*(1.-uEnv.x*.8);c=mix(c,mix(far,uSky1,.55),smoothstep(.45,.95,e)*.45);
  /* stars and the moon */
  if(uEnv.x>.02){vec2 sq=vec2(lon*70.,lat*70.);vec2 ce=floor(sq);float h=hsh(ce);if(h>.972){vec2 f=fract(sq)-.5-(vec2(hsh(ce+3.1),hsh(ce+7.7))-.5)*.6;float st=smoothstep(.16,0.,length(f))*(.55+.45*sin(uTime*.002+h*97.));c+=vec3(.92,.94,1.)*st*uEnv.x*(1.-cl)*smoothstep(.02,.2,e)*(.6+.8*fract(h*37.));}
   float md=dot(d,normalize(uMoon));c+=vec3(.96,.95,.86)*smoothstep(.9986,.9991,md)*uEnv.x*(1.-cl*.8)+vec3(.45,.5,.7)*pow(max(md,0.),90.)*.35*uEnv.x;}
  float sun=pow(max(e,0.),28.)*uSunPulse*(1.-uEnv.x);c+=uSunCol*(sun*2.2+pow(max(e,0.),6.)*.3*uSunPulse);c+=uEnv.y*vec3(.55,.58,.7)*smoothstep(-.1,.4,e);}
 else{c*=.8+.2*fbm(d.xz*3./max(.2,abs(d.y)));}
 o=vec4(c,1.);}`,
  ],
  water: [
    `#version 300 es
precision highp float;in vec3 aPos;in float aShore;layout(location=2) in vec2 aFlow;layout(location=3) in vec2 aDK;uniform mat4 uVP;out vec3 vW;out float vS;out vec2 vF;out vec2 vDK;${EGL_GLSL_COMMON}
void main(){vec3 p=aPos;p.y+=curveY(p.xz);vW=p;vS=aShore;vF=aFlow;vDK=aDK;gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec3 vW;in float vS;in vec2 vF;in vec2 vDK;out vec4 o;uniform sampler2D uRefl;uniform vec2 uRes;uniform vec3 uDeep,uShallow,uSkyR;uniform float uReflK,uRip,uFoam,uGlint,uLevel,uCaus,uClar;
uniform vec3 uKD[9],uKS[9];uniform vec4 uKA[9],uKB[9];uniform vec4 uFish[4];uniform vec4 uRings[8];uniform sampler2D uShore;uniform vec3 uShoreR;${EGL_GLSL_LIGHT}
/* sunlight focused by the ripples onto the bed: thin bright lines that wander */
float caust(vec2 p,float t){vec2 q=p+vec2(lnoise(p*.7+t*.21),lnoise(p.yx*.7-t*.17))*1.6;float a=sin(q.x*4.1+t*.9)+sin(q.y*3.7-t*.7)+sin((q.x+q.y)*2.9+t*.5);return pow(clamp(1.-abs(a)*.42,0.,1.),5.);}
void main(){float t=uTime*.001;int K=int(vDK.y+.5);vec4 ka=uKA[K],kb=uKB[K];float dep=clamp(vDK.x,0.,1.);
 vec2 wp=floor(vW.xz*16.)/16.;vec2 w=wp-vF*t*1.4;float flowing=clamp(length(vF),0.,1.);float rk=ka.w*uRip;
 /* v31: fill to the curved shoreline, lapping a little in still water */
 float vS2=vS;if(uShoreR.z>.5){vec2 su=(wp+1./32.)*uShoreR.xy;float sf=(su.x>0.&&su.y>0.&&su.x<1.&&su.y<1.)?texture(uShore,su).r:1.;float lap=(1.-flowing)*.016*sin(t*1.2+dot(wp,vec2(2.3,1.7)));if(sf<.5+lap)discard;vS2=max(vS,1.-smoothstep(.5,.68,sf-lap));}
 float r1=lnoise(w*2.3+vec2(t*.6,t*.4)*rk),r2=lnoise(w*3.7-vec2(t*.5,t*.7)*rk);vec2 rip=(vec2(r1,r2)-.5)*.035*rk;
 /* ripple rings: from ducks, fish and insects */
 float ring=0.;for(int i=0;i<8;i++){vec4 R=uRings[i];if(R.w<=0.)continue;float d=length(wp-R.xy),r=.08+R.z*.55;float band=1.-smoothstep(.0,.06,abs(d-r));ring+=band*R.w*clamp(1.-R.z/2.4,0.,1.)*step(d,r+.1);}
 rip+=vec2(ring*.012);
 vec2 s=gl_FragCoord.xy/uRes+rip;vec4 rf=texture(uRefl,s);rf.a*=clamp(1.-abs(vW.y-uLevel)*3.,0.,1.);vec3 v=normalize(uEye-vW);float fr=(.3+.55*pow(1.-max(v.y,0.),2.))*uReflK*(1.-kb.y*.75);
 vec3 shal=uShallow*uKS[K],deep=uDeep*uKD[K];vec3 base=mix(shal,deep,clamp(dep*.92+(1.-vS2)*.08,0.,1.));float sh=shadowAt(vW,.002);
 /* fish: dark shapes under the surface, only where it is deep enough to hide them */
 float fishK=0.;for(int i=0;i<4;i++){vec4 F=uFish[i];if(F.w<=0.)continue;vec2 d=wp-F.xy;vec2 fw=vec2(cos(F.z),sin(F.z));float lx=dot(d,fw)/F.w,ly=dot(d,vec2(-fw.y,fw.x))/F.w;
  float wig=sin(t*9.+F.x*3.)*.04*(lx<0.?-lx*4.:0.);ly+=wig;float body=step(lx*lx/.09+ly*ly/.0081,1.);float tail=step(-.42,lx)*step(lx,-.24)*step(abs(ly),(-lx-.22)*.7);fishK=max(fishK,max(body,tail));}
 base*=1.-fishK*.45*smoothstep(.2,.45,dep);
 base*=mix(uShTint*.85,vec3(1.),sh)*(.55+.45*uAmbK);
 /* light on the bed, brightest in the clear shallows */
 float cz=caust(wp*1.5,t*(.6+.4*rk))*(1.-dep)*ka.y*uCaus;base+=uSunCol*cz*.32*sh;
 base+=shal*kb.x*(.6+.4*sin(t*1.3+wp.x*1.7+wp.y));
 vec3 refl=mix(uSkyR,rf.rgb,rf.a);vec3 c=mix(base,refl,clamp(fr,0.,1.));
 float foam=(smoothstep(.75,1.,vS2+(r1-.5)*.35)*(.6+.4*sin(t*2.+w.x*3.))+flowing*smoothstep(.6,.9,r2)*.5)*uFoam*ka.z;c=mix(c,vec3(.95,.98,1.),clamp(foam,0.,1.));
 c=mix(c,vec3(.94,.97,1.),clamp(ring*.45,0.,.6));
 /* duckweed and scum: little green specks drifting together in still, murky water */
 if(kb.z>0.){vec2 dw=wp+vec2(sin(t*.05),cos(t*.04))*.4;float pch=smoothstep(.55,.75,lnoise(dw*.7)+(1.-dep)*.3);float speck=step(.45,fract(sin(dot(floor(dw*16.),vec2(12.9898,78.233)))*43758.5));
  float wd=pch*speck*kb.z;c=mix(c,mix(vec3(.36,.5,.16),vec3(.55,.66,.24),speck*fract(dw.x*3.1))*(.55+.45*sh)*(.6+.4*uAmbK),clamp(wd,0.,1.));}
 /* v47: whitecaps on the open sea: small crests that come and go, only out where it is deep */
 if(K==6){vec2 q=w*vec2(2.1,4.6)+vec2(t*.21,t*.09);float wc=lnoise(q)*lnoise(q*1.9+vec2(5.2,1.3)-vec2(t*.17,0.));wc=smoothstep(.46,.52,wc)*smoothstep(.45,.85,dep)*uFoam;c=mix(c,vec3(.95,.98,1.)*(.75+.25*sh),clamp(wc*.65,0.,.65));}
 float n3=lnoise(w*9.+vec2(t*1.3,-t*.9))*lnoise(w*7.3-vec2(t*.8,t*1.1));float gl=pow(max(n3-.55,0.)*2.2,3.)*2.2*uGlint*(1.-kb.y);c+=uSunCol*gl*sh;
 /* v24: lava glows under a cracked dark crust that drifts with the flow; ice is white-blue with cracks and a sheen */
 if(kb.w>.5&&kb.w<1.5){vec2 q=wp*1.3-vF*t*.5;float n1=lnoise(q*1.7+vec2(t*.05,0.)),n2=lnoise(q*4.1-vec2(0.,t*.07));float crust=smoothstep(.45,.62,n1*.7+n2*.3);
  vec3 hot=mix(vec3(1.,.42,.08),vec3(1.,.82,.35),smoothstep(.55,.2,n1))*(1.6+.5*sin(t*2.+n2*6.));c=mix(hot*1.3,vec3(.16,.1,.1)*(.6+.4*sh)*(.55+.45*uAmbK),crust*.85);
  o=vec4(fogit(c,vW),1.);return;}
 if(kb.w>1.5){vec2 q=wp*2.;float cr=abs(lnoise(q)-.5),cr2=abs(lnoise(q*2.3+7.)-.5);float line=1.-smoothstep(.0,.03,min(cr,cr2*1.3));
  vec3 ic=mix(shal,vec3(.94,.97,1.),.55+.3*lnoise(wp*.6));ic*=mix(uShTint*.9,vec3(1.),sh)*(.6+.4*uAmbK);ic=mix(ic,ic*.72,line*.7);
  vec3 icr=mix(ic,mix(uSkyR,rf.rgb,rf.a*.5),clamp(fr*.6,0.,.5));icr+=uSunCol*pow(max(lnoise(wp*5.+t*.02)-.6,0.)*2.5,3.)*1.5*sh;
  o=vec4(fogit(icr,vW),.97);return;}
 /* the shallows let the bed show; murky water never does */
 float a=mix(clamp(ka.x/max(uClar,.05),0.,1.),.94,smoothstep(0.,.8,dep));a=mix(a,.97,kb.y*.6);a=max(a,clamp(foam,0.,1.)*.9);
 o=vec4(fogit(c,vW),a);}`,
  ],
  fall: [
    `#version 300 es
precision highp float;in vec3 aPos;in float aShore;layout(location=2) in vec2 aFl;uniform mat4 uVP;out vec3 vW;out vec2 vT;${EGL_GLSL_COMMON}
out float vH;void main(){vec3 p=aPos;p.y+=curveY(p.xz);vW=p;vT=vec2(aFl.y,aShore*aFl.x);vH=aFl.x;gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec3 vW;in vec2 vT;in float vH;out vec4 o;uniform vec3 uShallow;${EGL_GLSL_LIGHT}
void main(){float t=uTime*.001,x=vT.x*7.,y=vT.y;float s=lnoise(vec2(x,y*2.2-t*4.5))*.6+lnoise(vec2(x*2.3+5.,y*4.-t*6.))*.4;
 vec3 c=mix(uShallow*1.1,vec3(.92,.97,1.),smoothstep(.45,.8,s));float foot=smoothstep(.3,0.,vH-y);c=mix(c,vec3(.97,.99,1.),foot*.7+smoothstep(.12,0.,y)*.4);
 float sh=shadowAt(vW,.002);vec3 L=ambient(vec3(0,0,-1),1.,sh)*1.2+uSunCol*.6*sh;o=vec4(fogit(c*L,vW),.82+foot*.15);}`,
  ],
  grass: [
    `#version 300 es
precision highp float;in vec2 aC;in vec4 aI;in vec4 aCol;uniform mat4 uVP;uniform vec3 uRight,uPl;uniform float uT,uWind,uGust,uBend,uHK;uniform vec3 uCut;uniform vec3 uTrail[16];uniform vec3 uPush[8];out vec4 vK;out vec3 vW;out float vY;${EGL_GLSL_COMMON}
void main(){vec2 b=aI.xy;float kind=aCol.x,h=aI.z*uHK*(uCut.z>0.?smoothstep(uCut.z*.55,uCut.z,length(b-uCut.xy)):1.),ph=aI.w;float y=aC.y;
 /* alpha 0.4: the place's one wind (windBend), the same that moves the props and the trees, a blade only a little its own */
 float gust=windGust(b,uT)*uGust;float sw=(windBend(b,uT,uGust)*2.6+sin(uT*.0041+ph*6.28)*.016)*uWind*(kind>4.5?1.3:kind>1.5&&kind<2.5?.3:1.);
 vec2 away=b-uPl.xz;float dl=length(away),pu=clamp(1.-dl/.85,0.,1.)*uBend;vec2 push=dl>.001?away/dl*pu*.75:vec2(0.);
 /* the trail you leave: blades you walked through lie flat and stand up again over a few seconds */
 for(int i=0;i<16;i++){vec3 tr=uTrail[i];if(tr.z<=0.)continue;vec2 d2=b-tr.xy;float l=length(d2),f=clamp(1.-l/.42,0.,1.)*tr.z*uBend;if(f>pu){pu=f;push=(l>.001?d2/l:vec2(.7,.7))*f*.8;}}
 /* v33: your buddy, folk and the billionaires hiding in it part the grass too (z: how far they reach) */
 for(int i=0;i<8;i++){vec3 q=uPush[i];if(q.z<=0.)continue;vec2 d2=b-q.xy;float l=length(d2),f=clamp(1.-l/q.z,0.,1.)*uBend;if(f>pu){pu=f;push=(l>.001?d2/l:vec2(.7,.7))*f*.75;}}
 float wid=kind<.5?.07:kind<1.5?.13:kind<2.5?.11:kind<3.5?.06:kind<4.5?.07:.09;
 float bend=y*y;vec3 p=vec3(b.x,0.,b.y)+uRight*((aC.x-.5)*wid*(1.-y*(kind>1.5&&kind<2.5?.3:1.)));p.x+=(sw*.9+push.x)*bend*h;p.z+=(sw*.25+push.y)*bend*h;p.y=aCol.z+y*h*(1.-pu*.6);
 p.y+=curveY(p.xz);vW=p;vY=y;vK=vec4(kind,aCol.y,aCol.w,gust);gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec4 vK;in vec3 vW;in float vY;out vec4 o;uniform vec3 uGlo,uGhi;uniform vec3 uFlw[4];uniform float uFlwGlow;${EGL_GLSL_LIGHT}
void main(){float kind=vK.x,rn=vK.y,tint=vK.z;vec3 c=mix(uGlo,uGhi,vY)*(.86+rn*.28);vec3 dry=vec3(.78,.7,.38)*mix(.72,1.05,vY);
 if(tint>0.)c=mix(c,dry,tint*.6);else c*=vec3(1.+tint*.2,1.+tint*.06,1.+tint*.12);
 if(kind>2.5&&kind<3.5)c=mix(c,dry,.75);
 /* alpha 0.4: the flowers in the grass are the place's own (uFlw: four colours; uFlwGlow: they glow at night, as the Spore Forest's caps do) */
 if(kind>3.5&&kind<4.5&&vY>.8){int f=int(rn*4.);c=f==0?uFlw[0]:f==1?uFlw[1]:f==2?uFlw[2]:uFlw[3];if(vY>.93&&f<2)c=mix(c,vec3(1.,.9,.4),.5);}
 if(kind>4.5){c*=vec3(.8,.9,.76);c=mix(c,vec3(.82,.78,.42),smoothstep(.7,1.,vY)*.3);}
 c*=1.+vK.w*.09;c=seasonal(c,vW);if(uSeason.w>0.)c=mix(c,vec3(.9,.93,.98),uSeason.w*smoothstep(.55,1.,vY)*.7);
 float sh=shadowAt(vW,.002);float ao=contactAO(vW);float occ=min(sh,ao);vec3 L=ambient(vec3(0,1,0),ao,occ)+uSunCol*(.55+.45*vY)*occ+points(vW,vec3(0,1,0));o=vec4(fogit(c*L+(kind>3.5&&kind<4.5&&vY>.8?c*uFlwGlow:vec3(0.)),vW),0.);}`,
  ],
  face: [
    `#version 300 es
precision highp float;in vec2 aC;uniform mat4 uVP;uniform vec3 uO,uA,uB;uniform vec4 uUV;out vec2 vUV;out vec3 vW;${EGL_GLSL_COMMON}
void main(){vec3 p=uO+uA*aC.x+uB*aC.y;p.y+=curveY(uO.xz);vW=p;vUV=vec2(uUV.x+aC.x*uUV.z,uUV.y+aC.y*uUV.w);gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec2 vUV;in vec3 vW;out vec4 o;uniform sampler2D uTex;uniform vec3 uN;uniform float uSpec;uniform vec3 uBP;${EGL_GLSL_LIGHT}${EGL_GLSL_LOOK}
void main(){vec4 c=texture(uTex,vUV);if(c.a<.5)discard;c.rgb=lookOn(c.rgb,floor(vec2(dot(vW.xz,vec2(1.)),vW.y)*16.),clamp((vW.y-uBP.y)/3.,0.,1.),uBP);vec3 n=normalize(uN);float sh=shadowAtN(vW+n*.05,n,.0012),ao=contactAO(vW),occ=min(sh,ao);
 vec3 v=normalize(uEye-vW);float sp=pow(max(dot(n,normalize(uSunDir+v)),0.),30.)*uSpec*occ;
 o=vec4(fogit(shade(c.rgb,n,vW,sh,ao,vec4(0.,1.,0.,.2),0.)+uSunCol*sp,vW),1.);}`,
  ],
  fx: [
    `#version 300 es
precision highp float;in vec2 aC;uniform mat4 uVP;uniform vec3 uP,uRight,uUp;uniform vec2 uS;uniform vec4 uUV;out vec2 vUV;out vec3 vW;
void main(){vec2 c=aC-.5;vec3 p=uP+uRight*c.x*uS.x+uUp*(-c.y)*uS.y;vW=p;vUV=vec2(uUV.x+aC.x*uUV.z,uUV.y+aC.y*uUV.w);gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec2 vUV;in vec3 vW;out vec4 o;uniform sampler2D uTex;uniform vec4 uCol;uniform float uGlow,uLitFx;${EGL_GLSL_LIGHT}
void main(){vec4 c;if(uGlow>.5){vec2 q=vUV*2.-1.;float d=dot(q,q);if(d>1.)discard;float f=(1.-d);c=vec4(uCol.rgb*f*f*f*uCol.a,1.);}else{c=texture(uTex,vUV)*uCol;if(c.a<.02)discard;if(uLitFx>.5)c.rgb*=mix(uAmbTop,vec3(1.),.5)+uSunCol*.4;c.rgb=fogit(c.rgb,vW);}o=c;}`,
  ],
};
/* ---------- ground mesh: the scene at half-meter resolution, then a coarse ring of distant land curving up ---------- */
/* v46: the ground of a scene, built a slice at a time into T. With T = walkRenderer it runs to the end at once (opening a scene);
   with a fresh T it runs a few milliseconds a frame for the view that comes next (prepareMapGround), so walking from one view
   to the next finds everything ready: the textures go up to the card in strips, the mesh and water are built in slices */
function* buildGroundSteps(sc, G, T) {
  const gl = EGL.gl,
    W = sc.w,
    H = sc.h,
    P = BORDER_M,
    res = 0.5,
    ter = (x, z) => {
      const i = Math.floor(x),
        j = sc.h - 1 - Math.floor(z);
      return i < 0 || j < 0 || i >= sc.w || j >= sc.h ? sc.edge : ((sc.tiles || [])[j] || '')[i] || sc.edge;
    };
  walkRenderer.builds = (walkRenderer.builds || 0) + 1;
  if (T.gtex) gl.deleteTexture(T.gtex);
  T.gtex = null;
  T.gtex = yield* uploadTextureStrips(G.width, G.height, G._px || G, { nearest: true });
  if (T.ring) freeNearRing(T.ring);
  T.ring = null; /* v46: the near ring starts empty (updateNearRing, or the preparation fills it) */
  const C0 = walkData().sc,
    tile = k => {
      const T = C0.terrains[k];
      if (!T) return null;
      if (typeof bigTilesOn === 'function' && bigTilesOn()) {
        const n = artImage(bigTilePath(T.tile)[0]);
        if (imageReady(n)) return n;
      }
      return artImage(T.tile);
    };
  const fe = tile(sc.edge) || tile('g'),
    cl = tile(sc.cliff || (sc.indoor ? 'k' : 'r')) || fe;
  T.ftex = repeatingTexture(fe, T.ftex);
  T.ctex = repeatingTexture(cl, T.ctex);
  if (T.gntex && T.gntex !== EGL.flatN) gl.deleteTexture(T.gntex);
  T.gntex = null;
  T.gntex = G._nrm ? yield* uploadTextureStrips(G.width, G.height, G._nrm, {}) : groundNormalTexture(G, null, sc);
  yield;
  const water = (x, z) => {
      const c = ter(x, z);
      return c === 'w' || c === 'd';
    },
    hAt = (x, z) => {
      let h = rawHeightAt(sc, x, z);
      let n = 0;
      for (const [a, b] of [
        [-0.3, -0.3],
        [0.3, -0.3],
        [-0.3, 0.3],
        [0.3, 0.3],
      ])
        if (water(x + a, z + b)) n++;
      return h - n * 0.12;
    };
  const hk = eng('world', 'farHills'),
    farH = (x, z) => {
      const dx = Math.max(0, -x, x - W),
        dz = Math.max(0, -z, z - H),
        out = Math.hypot(dx, dz);
      if (out <= 0) return rawHeightAt(sc, x, z);
      const e = rawHeightAt(sc, clamp(x, 0, W), clamp(z, 0, H));
      if (sc.flatFar) return e - 0.25 - smooth01(out / 30) * 0.3;
      const k = smooth01(out / 12),
        n = (valueNoise2d(x * 0.06, z * 0.06) - 0.4) * 7 + (valueNoise2d(x * 0.17 + 5, z * 0.17) - 0.5) * 2.5;
      if (sc.room && !sc.roomRect && z < 0 && x > -2 && x < W + 2) return e - 3.2;
      /* v31: a room's floor ends at its front edge (the door); below is the cut */ return sc.indoor && !sc.roomRect
        ? e + smooth01((out - 1.5) / 5) * 16 + n * 0.6 * k
        : e + n * k * hk * (sc.far === 'mountains' || sc.far === 'canyon' ? 2.2 : 1);
    };
  /* v18: one set of corners per half-metre cell, so cells on different terraces don't share corners; a vertical wall
    joins them (cliffs, terrace fronts, stair risers). Normals come from the smooth land. */
  const E = stepGrid(sc),
    stp = (x, z) => (E ? E.H[stepCellAt(clamp(x, 0, W - 0.01), clamp(z, 0, H - 0.01), E)] : 0),
    stm = (x, z) => (E ? E.M[stepCellAt(clamp(x, 0, W - 0.01), clamp(z, 0, H - 0.01), E)] & 15 : 0);
  const base = (x, z) => (x >= 0 && z >= 0 && x <= W && z <= H ? hAt(x, z) : farH(x, z));
  const x0 = -P,
    z0 = -P,
    nx = Math.round((W + 2 * P) / res),
    nz = Math.round((H + 2 * P) / res),
    CB = new Float32Array((nx + 1) * (nz + 1)),
    CN = new Float32Array((nx + 1) * (nz + 1) * 3);
  for (let j = 0; j <= nz; j++) {
    if (j % 12 === 11) yield;
    for (let i = 0; i <= nx; i++) {
      const x = x0 + i * res,
        z = z0 + j * res,
        q = j * (nx + 1) + i,
        e = 0.25;
      CB[q] = base(x, z);
      const gx = (base(x + e, z) - base(x - e, z)) / (2 * e),
        gz = (base(x, z + e) - base(x, z - e)) / (2 * e),
        n = v3n([-gx, 1, -gz]);
      CN[q * 3] = n[0];
      CN[q * 3 + 1] = n[1];
      CN[q * 3 + 2] = n[2];
    }
  }
  const V = [],
    I = [];
  let nv = 0;
  const vtx = (x, y, z, n0, n1, n2, m, f, h) => {
    V.push(x, y, z, n0, n1, n2, m, f, h);
    return nv++;
  };
  const cst = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    if (j % 24 === 23) yield;
    for (let i = 0; i < nx; i++) cst[j * nx + i] = stp(x0 + (i + 0.5) * res, z0 + (j + 0.5) * res);
  }
  /* v23: a cell's corner height: ramps (step flag 32) lean between their neighbours, everything else is flat */
  if (E) stepGridCorners(E);
  const SHP = E ? stepEdgeShape(sc, E) : null,
    sl = !!(E && (E.sl || SHP)),
    cc = (i, j, ci, cj) => {
      if (!sl) return cst[j * nx + i];
      const ei = Math.floor((x0 + (i + 0.5) * res) * 2),
        ej = Math.floor((z0 + (j + 0.5) * res) * 2);
      return ei < 0 || ej < 0 || ei >= E.w || ej >= E.h
        ? cst[j * nx + i]
        : shapedStepCornerHeight(E, ej * E.w + ei, ci, cj, SHP);
    };
  /* alpha 0.2: natural cliffs. Where a terrace or cliff of rock (not a wall someone built: brick, dressed stone, boards,
    steps, concrete, hedge) drops away, its top edge is pulled back and rounded down a little and its foot pushed out,
    so the face leans like rock instead of standing as a straight wall; the line it follows wavers. Every corner moves
    by a rule of its own position and level only, so neighbouring cells and the wall between them stay joined.
    Walking still follows the half-metre cells (the moves are a quarter of a metre at most). */
  const NAT = new Set([1, 2, 3, 9, 11]),
    wdef = defaultWallMaterial(sc),
    cm = new Uint8Array(nx * nz),
    crf = new Uint8Array(nx * nz);
  if (E)
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const x = x0 + (i + 0.5) * res,
          z = z0 + (j + 0.5) * res,
          q = E.M[stepCellAt(clamp(x, 0, W - 0.01), clamp(z, 0, H - 0.01), E)];
        let m = q & 15;
        if (!m) m = wdef;
        cm[j * nx + i] = NAT.has(m) ? 1 : 0;
        crf[j * nx + i] = q & 32 || m === 8 ? 1 : 0;
      }
  const hsh = (a, b, s) => {
      const v = Math.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453;
      return v - Math.floor(v);
    },
    NO = [0, 0, 0, 0];
  const disp = (I, J, h) => {
    if (!E) return NO;
    let lo = 0,
      hi = 0,
      ldx = 0,
      ldz = 0,
      hdx = 0,
      hdz = 0,
      lmin = 1e9,
      hmax = -1e9,
      hcm = 0,
      rmp = 0;
    for (const [di, dj, ox, oz] of [
      [-1, -1, -1, -1],
      [0, -1, 1, -1],
      [-1, 0, -1, 1],
      [0, 0, 1, 1],
    ]) {
      const ci = I + di,
        cj = J + dj;
      if (ci < 0 || cj < 0 || ci >= nx || cj >= nz) continue;
      const q = cj * nx + ci,
        hk = cst[q];
      if (crf[q]) rmp = 1;
      if (hk < h - 0.3) {
        lo++;
        ldx += ox;
        ldz += oz;
        lmin = Math.min(lmin, hk);
      } else if (hk > h + 0.3) {
        hi++;
        hdx += ox;
        hdz += oz;
        if (hk > hmax) {
          hmax = hk;
          hcm = cm[q];
        }
      }
    }
    if (rmp || (!lo && !hi)) return NO;
    const own = (() => {
      for (const [di, dj] of [
        [-1, -1],
        [0, -1],
        [-1, 0],
        [0, 0],
      ]) {
        const ci = I + di,
          cj = J + dj;
        if (ci < 0 || cj < 0 || ci >= nx || cj >= nz) continue;
        const q = cj * nx + ci;
        if (Math.abs(cst[q] - h) <= 0.3) return cm[q];
      }
      return 0;
    })();
    const n1 = hsh(I, J, 1),
      wx = (hsh(I, J, 3) - 0.5) * 0.16,
      wz = (hsh(I, J, 4) - 0.5) * 0.16;
    if (lo) {
      if (!own) return NO;
      const L = Math.hypot(ldx, ldz);
      if (L < 0.01) return NO;
      const d = h - lmin,
        k = Math.min(0.24, 0.06 + 0.05 * d) * (0.75 + 0.5 * n1);
      return [(-ldx / L) * k + wx, (-ldz / L) * k + wz, -Math.min(0.16, 0.035 * d) * (0.6 + 0.8 * n1), 1];
    }
    if (!hcm) return NO;
    const L = Math.hypot(hdx, hdz);
    if (L < 0.01) return NO;
    const d = hmax - h,
      k = Math.min(0.26, 0.07 + 0.06 * d) * (0.75 + 0.5 * hsh(I, J, 2));
    return [(-hdx / L) * k + wx, (-hdz / L) * k + wz, 0, -1];
  };
  for (let j = 0; j < nz; j++) {
    if (j % 12 === 11) yield;
    for (let i = 0; i < nx; i++) {
      const q = [j * (nx + 1) + i, j * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i, (j + 1) * (nx + 1) + i + 1],
        xs = [0, 1, 0, 1],
        zs = [0, 0, 1, 1];
      const h0 = cst[j * nx + i],
        ids = q.map((c, k) => {
          const D = disp(i + xs[k], j + zs[k], h0);
          let n0 = CN[c * 3],
            n1 = CN[c * 3 + 1],
            n2 = CN[c * 3 + 2];
          if (D[3] > 0) {
            const L = Math.hypot(D[0], D[2]) || 1,
              nn = v3n([n0 - (D[0] / L) * 0.45, n1, n2 - (D[1] / L) * 0.45]);
            n0 = nn[0];
            n1 = nn[1];
            n2 = nn[2];
          }
          return vtx(
            x0 + (i + xs[k]) * res + D[0],
            CB[c] + cc(i, j, xs[k], zs[k]) + D[2],
            z0 + (j + zs[k]) * res + D[1],
            n0,
            n1,
            n2,
            0,
            0,
            0
          );
        });
      I.push(ids[0], ids[2], ids[1], ids[1], ids[2], ids[3]);
    }
  }
  /* walls */
  /* a wall between two cells, from the lower to the higher corner at each end (they differ where a ramp meets a cliff) */
  const wall = (ax, az, bx, bz, ca, cb, la, ha, lb, hb, nrm, mat, IA, JA, IB, JB, hl, hh) => {
    const dl0 = disp(IA, JA, hl),
      dl1 = disp(IB, JB, hl),
      dh0 = disp(IA, JA, hh),
      dh1 = disp(IB, JB, hh);
    const P0 = [ax + dl0[0], CB[ca] + la + dl0[2], az + dl0[1]],
      P1 = [bx + dl1[0], CB[cb] + lb + dl1[2], bz + dl1[1]],
      P2 = [ax + dh0[0], CB[ca] + ha + dh0[2], az + dh0[1]],
      P3 = [bx + dh1[0], CB[cb] + hb + dh1[2], bz + dh1[1]];
    /* alpha 0.2: the face's own normal (it leans where the cliff is natural), facing the low side */
    let N = nrm;
    if (dl0 !== NO || dl1 !== NO || dh0 !== NO || dh1 !== NO) {
      const e1 = [P1[0] - P0[0], P1[1] - P0[1], P1[2] - P0[2]],
        e2 = [
          (P2[0] + P3[0] - P0[0] - P1[0]) / 2,
          (P2[1] + P3[1] - P0[1] - P1[1]) / 2,
          (P2[2] + P3[2] - P0[2] - P1[2]) / 2,
        ];
      let c = v3n([e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]);
      if (c[0] * nrm[0] + c[2] * nrm[2] < 0) c = [-c[0], -c[1], -c[2]];
      if (Math.abs(c[0]) + Math.abs(c[2]) > 0.2) N = c;
    }
    const v0 = vtx(...P0, ...N, mat, 0, ha - la),
      v1 = vtx(...P1, ...N, mat, 0, hb - lb),
      v2 = vtx(...P2, ...N, mat, 1, ha - la),
      v3 = vtx(...P3, ...N, mat, 1, hb - lb);
    I.push(v0, v2, v1, v1, v2, v3);
  };
  for (let j = 0; j < nz; j++) {
    if (j % 12 === 11) yield;
    for (let i = 0; i < nx; i++) {
      const a = cst[j * nx + i],
        cx = x0 + (i + 0.5) * res,
        cz = z0 + (j + 0.5) * res;
      if (i < nx - 1) {
        const b = cst[j * nx + i + 1],
          A0 = cc(i, j, 1, 0),
          A1 = cc(i, j, 1, 1),
          B0 = cc(i + 1, j, 0, 0),
          B1 = cc(i + 1, j, 0, 1);
        if (Math.abs(A0 - B0) > 0.03 || Math.abs(A1 - B1) > 0.03) {
          const X = x0 + (i + 1) * res,
            za = z0 + j * res,
            zb = za + res,
            c0 = j * (nx + 1) + i + 1,
            c1 = (j + 1) * (nx + 1) + i + 1,
            hiA = a > b;
          wall(
            X,
            za,
            X,
            zb,
            c0,
            c1,
            Math.min(A0, B0),
            Math.max(A0, B0),
            Math.min(A1, B1),
            Math.max(A1, B1),
            hiA ? [1, 0, 0] : [-1, 0, 0],
            hiA ? stm(cx, cz) : stm(cx + res, cz),
            i + 1,
            j,
            i + 1,
            j + 1,
            Math.min(a, b),
            Math.max(a, b)
          );
        }
      }
      if (j < nz - 1) {
        const b = cst[(j + 1) * nx + i],
          A0 = cc(i, j, 0, 1),
          A1 = cc(i, j, 1, 1),
          B0 = cc(i, j + 1, 0, 0),
          B1 = cc(i, j + 1, 1, 0);
        if (Math.abs(A0 - B0) > 0.03 || Math.abs(A1 - B1) > 0.03) {
          const Z = z0 + (j + 1) * res,
            xa = x0 + i * res,
            xb = xa + res,
            c0 = (j + 1) * (nx + 1) + i,
            c1 = (j + 1) * (nx + 1) + i + 1,
            hiA = a > b;
          wall(
            xa,
            Z,
            xb,
            Z,
            c0,
            c1,
            Math.min(A0, B0),
            Math.max(A0, B0),
            Math.min(A1, B1),
            Math.max(A1, B1),
            hiA ? [0, 0, 1] : [0, 0, -1],
            hiA ? stm(cx, cz) : stm(cx, cz + res),
            i,
            j + 1,
            i + 1,
            j + 1,
            Math.min(a, b),
            Math.max(a, b)
          );
        }
      }
    }
  }
  /* the distant land around the scene, coarser */
  const R = 2,
    fx0 = -70,
    fx1 = W + 70,
    fz0 = -40,
    fz1 = H + 130,
    fnx = Math.round((fx1 - fx0) / R),
    fnz = Math.round((fz1 - fz0) / R),
    fb = nv;
  for (let j = 0; j <= fnz; j++) {
    if (j % 12 === 11) yield;
    for (let i = 0; i <= fnx; i++) {
      const x = fx0 + i * R,
        z = fz0 + j * R,
        h = farH(x, z) + stp(x, z) - 0.02,
        e = 1,
        gx = (farH(x + e, z) - farH(x - e, z)) / (2 * e),
        gz = (farH(x, z + e) - farH(x, z - e)) / (2 * e),
        n = v3n([-gx, 1, -gz]);
      vtx(x, h, z, n[0], n[1], n[2], 0, 0, 0);
    }
  }
  for (let j = 0; j < fnz; j++)
    for (let i = 0; i < fnx; i++) {
      const x = fx0 + i * R,
        z = fz0 + j * R;
      if (x >= x0 && x + R <= x0 + nx * res && z >= z0 && z + R <= z0 + nz * res) continue;
      const a = fb + j * (fnx + 1) + i,
        b = a + 1,
        c = a + fnx + 1,
        d = c + 1;
      I.push(a, c, b, b, c, d);
    }
  yield;
  eglFree(T.mesh);
  T.mesh = eglMesh(
    new Float32Array(V),
    new Uint32Array(I),
    [
      ['aPos', 3, 0],
      ['aNrm', 3, 12],
      ['aUV', 3, 24],
    ],
    36
  );
  /* v23: a gorge or valley floor well below where you walk gathers mist (Engine: Air, Mist in low ground) */
  T.valley = null;
  if (E && !sc.indoor) {
    let lo = 1e9,
      sum = 0,
      n = 0;
    for (let j = 0; j < E.h; j += 2)
      for (let i = 0; i < E.w; i += 2) {
        const y = rawHeightAt(sc, (i + 0.5) / 2, (j + 0.5) / 2) + E.H[j * E.w + i];
        if (y < lo) lo = y;
        sum += y;
        n++;
      }
    const mean = sum / Math.max(1, n);
    if (mean - lo > 1.8) T.valley = [lo + Math.min(1.6, (mean - lo) * 0.45), 1];
  }
  /* water per half-metre cell at its own level: stepped pools, and a falling sheet wherever one pool spills into a lower one.
    v22: each cell also carries how deep it is (distance from the shore) and its kind of water, so the shader can show
    the bed through the shallows, darken the middle, and give ponds, streams, canals, springs, swamps and lakes their own look */
  const isW = (x, z) => {
      const c = ter(x, z);
      return c === 'w' || c === 'd';
    },
    wlev = (x, z) => rawHeightAt(sc, x, z) + stp(x, z) - 0.12,
    flowAt = waterFlowField(sc);
  const W2 = W * 2,
    H2 = H * 2,
    wd = new Float32Array(W2 * H2).fill(-2),
    wk = new Uint8Array(W2 * H2),
    wy = new Float32Array(W2 * H2),
    kindAt = waterKindLookup(sc),
    Q = [];
  for (let j = 0; j < H2; j++) {
    if (j % 12 === 11) yield;
    for (let i = 0; i < W2; i++) {
      const cx = (i + 0.5) * 0.5,
        cz = (j + 0.5) * 0.5;
      if (!isW(cx, cz)) continue;
      const q = j * W2 + i;
      wd[q] = -1;
      wy[q] = wlev(cx, cz);
      const fw = flowAt(cx, cz);
      wk[q] = kindAt(cx, cz, fw[0] !== 0 || fw[1] !== 0);
      let edge = false;
      for (const [a, b] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const ii = i + a,
          jj = j + b;
        if (ii < 0 || jj < 0 || ii >= W2 || jj >= H2) continue;
        if (!isW((ii + 0.5) * 0.5, (jj + 0.5) * 0.5)) {
          edge = true;
          break;
        }
      }
      if (edge) {
        wd[q] = 1;
        Q.push(q);
      }
    }
  }
  /* v31: still water on one terrace lies at one level (cells at their own height left hairline seams on sloping beds) */
  {
    const seen = new Uint8Array(W2 * H2),
      still = q => {
        const i = q % W2,
          j = (q - i) / W2,
          f = flowAt((i + 0.5) * 0.5, (j + 0.5) * 0.5);
        return f[0] === 0 && f[1] === 0;
      };
    for (let q0 = 0; q0 < wd.length; q0++) {
      if (wd[q0] === -2 || seen[q0] || !still(q0)) continue;
      const comp = [q0],
        s0 = stp(((q0 % W2) + 0.5) * 0.5, (Math.floor(q0 / W2) + 0.5) * 0.5);
      seen[q0] = 1;
      let sum = 0;
      for (let h = 0; h < comp.length; h++) {
        const q = comp[h],
          i = q % W2,
          j = (q - i) / W2;
        sum += wy[q];
        for (const [a, b] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const ii = i + a,
            jj = j + b;
          if (ii < 0 || jj < 0 || ii >= W2 || jj >= H2) continue;
          const n = jj * W2 + ii;
          if (wd[n] === -2 || seen[n] || !still(n) || Math.abs(stp((ii + 0.5) * 0.5, (jj + 0.5) * 0.5) - s0) > 0.05)
            continue;
          seen[n] = 1;
          comp.push(n);
        }
      }
      const lv = sum / comp.length;
      for (const q of comp) wy[q] = lv;
    }
  }
  /* distance from the shore in half-metre steps */
  for (let h = 0; h < Q.length; h++) {
    const q = Q[h],
      i = q % W2,
      j = (q - i) / W2;
    for (const [a, b] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const ii = i + a,
        jj = j + b;
      if (ii < 0 || jj < 0 || ii >= W2 || jj >= H2) continue;
      const n = jj * W2 + ii;
      if (wd[n] === -1) {
        wd[n] = wd[q] + 1;
        Q.push(n);
      }
    }
  }
  for (let q = 0; q < wd.length; q++) if (wd[q] === -1) wd[q] = 8;
  const depth = q => {
    const d = wd[q];
    if (d < 0) return 0;
    const K = WATER_KIND_LOOKS[wk[q]],
      i = q % W2,
      j = (q - i) / W2,
      deep = ter((i + 0.5) * 0.5, (j + 0.5) * 0.5) === 'd' ? 0.3 : 0;
    return Math.min(1, (1 - Math.exp((-(d - 0.5) * 0.5) / K.r)) * K.top + deep);
  };
  const dep = new Float32Array(W2 * H2);
  for (let q = 0; q < dep.length; q++) dep[q] = depth(q);
  T.wgrid = { W2, H2, dep, kind: wk, y: wy };
  /* v31: the shoreline: the water mask at 8 samples a metre, softened twice and nudged by noise, so the water's edge
    curves round corners instead of following the tiles; the water shader fills to its 0.5 line, the ground shader
    darkens a wet rim just outside it and paints a bed under it */
  shoreField(sc, isW, T);
  yield;
  if (T === walkRenderer) groundOcclusion(sc);
  else {
    const r = yield* groundOcclusionSteps(sc);
    if (r) T.gaoTex = groundOcclusionTexture(r);
  }
  /* rocks standing in the water throw foam around themselves */
  const C1 = walkData().sc,
    rocks = [];
  for (const p of sc.props || []) {
    const M = C1.props[p.k];
    if (!M) continue;
    if (/rock|boulder|stone|pebble/.test(p.k + ' ' + (M.group || '')) && isW(p.x, p.z))
      rocks.push([p.x, p.z, 0.45 + (0.25 * (M.w || 32)) / 32]);
  }
  const rockFoam = (x, z) => {
    let f = 0;
    for (const r of rocks) {
      const d = Math.hypot(x - r[0], z - r[1]);
      if (d < r[2] + 0.6) f = Math.max(f, 1 - Math.max(0, d - r[2]) / 0.6);
    }
    return f;
  };
  const wv = [],
    wi = [],
    lvC = new Map(),
    fv = [],
    fi = [];
  T.falls = [];
  let wn = 0;
  const stream = [],
    spring = [];
  for (let j = 0; j < H2; j++) {
    if (j % 12 === 11) yield;
    for (let i = 0; i < W2; i++) {
      const cx = (i + 0.5) * 0.5,
        cz = (j + 0.5) * 0.5;
      if (!isW(cx, cz)) continue;
      const q = j * W2 + i,
        y = wy[q],
        kd = wk[q];
      wn++;
      const key = Math.round(y * 10);
      {
        const e = lvC.get(key) || [0, 0, 1e9, 1e9, -1e9, -1e9];
        e[0]++;
        e[1] += y;
        e[2] = Math.min(e[2], cx);
        e[3] = Math.min(e[3], cz);
        e[4] = Math.max(e[4], cx);
        e[5] = Math.max(e[5], cz);
        lvC.set(key, e);
      }
      const b0 = wv.length / 8,
        fw = flowAt(cx, cz);
      if (kd === 1 && (i + j * 3) % 2 === 0) stream.push([cx, cz]);
      if (kd === 3) spring.push([cx, cz, dep[q]]);
      /* running water follows the slope of its bed (one smooth surface down a stream); still water lies level */
      const run = fw[0] !== 0 || fw[1] !== 0,
        sc0 = stp(cx, cz);
      for (const [a, c] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ]) {
        const vx = i * 0.5 + a * 0.5,
          vz = j * 0.5 + c * 0.5;
        let sh = 0,
          dd = 0;
        for (const [p, q2] of [
          [-0.25, -0.25],
          [0.25, -0.25],
          [-0.25, 0.25],
          [0.25, 0.25],
        ]) {
          const ii = Math.floor((vx + p) * 2),
            jj = Math.floor((vz + q2) * 2);
          if (!isW(vx + p, vz + q2)) sh++;
          else if (ii >= 0 && jj >= 0 && ii < W2 && jj < H2) dd += dep[jj * W2 + ii];
        }
        const rf = rocks.length && (kd === 1 || kd === 5 || kd === 0) ? rockFoam(vx, vz) : 0;
        wv.push(
          vx,
          run ? rawHeightAt(sc, vx, vz) + sc0 - 0.12 : y,
          vz,
          T.shoreF ? rf * (kd === 1 ? 1 : 0.6) : Math.max(Math.min(1, sh / 2), rf * (kd === 1 ? 1 : 0.6)),
          fw[0],
          fw[1],
          dd / 4,
          kd
        );
      }
      wi.push(b0, b0 + 2, b0 + 1, b0 + 1, b0 + 2, b0 + 3);
      /* spilling into a lower neighbour: a sheet of falling water down the step */
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx2 = cx + di * 0.5,
          nz2 = cz + dj * 0.5;
        if (!isW(nx2, nz2)) continue;
        const nq2 = (j + dj) * W2 + (i + di);
        let yt = y,
          y2 = i + di >= 0 && j + dj >= 0 && i + di < W2 && j + dj < H2 ? wy[nq2] : wlev(nx2, nz2);
        if (run) {
          if (sc0 - stp(nx2, nz2) < 0.15) continue;
          const eh = rawHeightAt(sc, cx + di * 0.25, cz + dj * 0.25);
          yt = eh + sc0 - 0.12;
          y2 = eh + stp(nx2, nz2) - 0.12;
        } else if (y - y2 < 0.15) continue;
        const ex = cx + di * 0.25,
          ez = cz + dj * 0.25,
          px = -dj,
          pz = di,
          fb0 = fv.length / 6;
        for (const [s2, t2] of [
          [-1, 0],
          [1, 0],
          [-1, 1],
          [1, 1],
        ]) {
          fv.push(ex + px * 0.25 * s2, t2 ? y2 : yt + 0.02, ez + pz * 0.25 * s2, t2, yt - y2, s2 * 0.5 + 0.5);
        }
        fi.push(fb0, fb0 + 2, fb0 + 1, fb0 + 1, fb0 + 2, fb0 + 3);
        T.falls.push([ex + di * 0.12, y2 + 0.05, ez + dj * 0.12, yt - y2]);
      }
    }
  }
  /* v31: the half-metre land cells around the water get a skin at their neighbour's level, so a rounded shoreline can
    reach past the tile edge (the shader keeps only what lies inside the line; the bank hides the rest) */
  if (wn && T.shoreF)
    for (let j = 0; j < H2; j++) {
      if (j % 12 === 11) yield;
      for (let i = 0; i < W2; i++) {
        const cx = (i + 0.5) * 0.5,
          cz = (j + 0.5) * 0.5;
        if (isW(cx, cz)) continue;
        let nq = -1;
        for (const [a, b] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [-1, 1],
          [1, -1],
          [-1, -1],
        ]) {
          const ii = i + a,
            jj = j + b;
          if (ii < 0 || jj < 0 || ii >= W2 || jj >= H2) continue;
          if (wd[jj * W2 + ii] > 0) {
            nq = jj * W2 + ii;
            break;
          }
        }
        if (nq < 0) continue;
        const ni = nq % W2,
          nj = (nq - ni) / W2,
          ncx = (ni + 0.5) * 0.5,
          ncz = (nj + 0.5) * 0.5,
          s0 = stp(ncx, ncz);
        if (stp(cx, cz) < s0 - 0.05) continue;
        const fw = flowAt(ncx, ncz),
          run = fw[0] !== 0 || fw[1] !== 0,
          b0 = wv.length / 8;
        for (const [a, c] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ]) {
          const vx = i * 0.5 + a * 0.5,
            vz = j * 0.5 + c * 0.5;
          wv.push(vx, run ? rawHeightAt(sc, vx, vz) + s0 - 0.12 : wy[nq], vz, 0, fw[0], fw[1], 0, wk[nq]);
        }
        wi.push(b0, b0 + 2, b0 + 1, b0 + 1, b0 + 2, b0 + 3);
      }
    }
  /* v24: out at sea the water runs on past the edges of the scene to the horizon */
  if (sc.flatFar && wn) {
    const kd = kindAt(-1, -1, false),
      y = -0.12,
      F = 90,
      quad = (x0, z0, x1, z1) => {
        const b0 = wv.length / 8;
        for (const [a, c] of [
          [x0, z0],
          [x1, z0],
          [x0, z1],
          [x1, z1],
        ])
          wv.push(a, y, c, 0, 0, 0, 1, kd);
        wi.push(b0, b0 + 2, b0 + 1, b0 + 1, b0 + 2, b0 + 3);
      };
    quad(-F, -F, 0, H + F);
    quad(W, -F, W + F, H + F);
    quad(0, -F, W, 0);
    quad(0, H, W, H + F);
  }
  eglFree(T.water);
  T.water = wn
    ? eglMesh(
        new Float32Array(wv),
        new Uint32Array(wi),
        [
          ['aPos', 3, 0],
          ['aShore', 1, 12],
          ['aUV', 2, 16],
          ['aDK', 2, 24],
        ],
        32
      )
    : null;
  /* fish live where the water is deep all round; leaves start on streams; springs steam */
  const homes = [];
  for (let j = 0; j < H2; j++)
    for (let i = 0; i < W2; i++) {
      const q = j * W2 + i;
      if (wd[q] < 4 || !WATER_KIND_LOOKS[wk[q]].fish) continue;
      const x = (i + 0.5) * 0.5,
        z = (j + 0.5) * 0.5;
      if (homes.every(h => Math.hypot(h[0] - x, h[1] - z) > 3.2))
        homes.push([x, z, wy[q], Math.min(1.3, (wd[q] - 2.5) * 0.5)]);
    }
  T.fishHomes = homes.slice(0, 4);
  T.streamCells = stream;
  T.springCells = spring.filter((_, i) => i % 3 === 0).slice(0, 10);
  T.flowAt = flowAt;
  T.leaves = null;
  T.rings = [];
  /* v22: one mirror plane per body of water level (buckets a few cm apart that overlap are one pool); the reflections use
    the one nearest you, so a high canal doesn't steal the mirror from the pond you're standing by */
  const lv = [...lvC.values()]
      .map(e => ({ n: e[0], y: e[1] / e[0], b: [e[2], e[3], e[4], e[5]] }))
      .sort((a, b) => a.y - b.y),
    grp = [];
  for (const e of lv) {
    const g = grp[grp.length - 1],
      ov = g && e.b[0] <= g.b[2] + 1 && e.b[2] >= g.b[0] - 1 && e.b[1] <= g.b[3] + 1 && e.b[3] >= g.b[1] - 1;
    if (g && ov && e.y - g.y < 0.25) {
      g.y = (g.y * g.n + e.y * e.n) / (g.n + e.n);
      g.n += e.n;
      g.b = [Math.min(g.b[0], e.b[0]), Math.min(g.b[1], e.b[1]), Math.max(g.b[2], e.b[2]), Math.max(g.b[3], e.b[3])];
    } else grp.push({ ...e, b: [...e.b] });
  }
  T.wlevels = grp;
  let bk = 0;
  T.wlevel = 0;
  for (const g of grp)
    if (g.n > bk) {
      bk = g.n;
      T.wlevel = g.y;
    }
  T.wlevelR = T.wlevel;
  eglFree(T.fallMesh);
  T.fallMesh = fv.length
    ? eglMesh(
        new Float32Array(fv),
        new Uint32Array(fi),
        [
          ['aPos', 3, 0],
          ['aShore', 1, 12],
          ['aUV', 2, 16],
        ],
        24
      )
    : null;
  if (T === walkRenderer) {
    buildGrass();
    T.farKey = '';
  }
}
function buildGroundMesh() {
  const it = buildGroundSteps(walkView.sc, walkView.ground, walkRenderer);
  let r = it.next();
  while (!r.done) r = it.next();
}
/* v46: a big texture goes up to the card a strip at a time (about 1 MB a strip), then its mipmaps are made on the card */
function* uploadTextureStrips(w, h, data, o = {}) {
  const gl = EGL.gl,
    t = gl.createTexture();
  if (!(data instanceof Uint8Array)) {
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
    makeTextureMipmaps(t, o);
    return t;
  }
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texStorage2D(gl.TEXTURE_2D, Math.floor(Math.log2(Math.max(w, h))) + 1, gl.RGBA8, w, h);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  const rows = Math.max(8, Math.floor(262144 / w));
  for (let y = 0; y < h; y += rows) {
    const n = Math.min(rows, h - y);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      y,
      w,
      n,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data.subarray(y * w * 4, (y + n) * w * 4)
    );
    if (y + n < h) yield;
  }
  makeTextureMipmaps(t, o);
  return t;
}
function makeTextureMipmaps(t, o) {
  const gl = EGL.gl;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    o.nearest ? gl.NEAREST_MIPMAP_LINEAR : gl.LINEAR_MIPMAP_LINEAR
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, o.nearest ? gl.NEAREST : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.generateMipmap(gl.TEXTURE_2D);
}
/* v46: the near ring. The ground under and round you is painted at full size (32 px a metre) in 16 m squares, a few
   ms a frame, nearest first, as you walk; the 4 x 4 squares round the camera's focus sit in one texture (2048 px), each
   in the slot its position mod 4 gives, so moving on repaints only the row or column that comes into range. Beyond it
   the view's small distant picture (8 px a metre) shows, faded in over the ring's last 3 m. */
const NEAR_RING_SIZE = 4,
  NEAR_RING_CHUNK_M = 16;
function newNearRing() {
  const gl = EGL.gl,
    TP = bigTilesOn() ? 32 : 16,
    S = NEAR_RING_SIZE * NEAR_RING_CHUNK_M * TP,
    mk = (sz, lin) => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texStorage2D(gl.TEXTURE_2D, Math.log2(sz) + 1, gl.RGBA8, sz, sz);
      /* alpha 0.4: a square's small sizes are made with it (on the helper thread) and only those of a square are used, so
     the whole texture's mipmaps aren't rebuilt for every square */ gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MAX_LEVEL,
        Math.log2(sz / NEAR_RING_SIZE)
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, lin ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, lin ? gl.LINEAR : gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
  return {
    TP,
    S,
    tex: mk(S, 0),
    ntex: mk(S / 2, 1),
    C: new Float32Array(32).fill(-9999),
    box: [0, 0, 0, 0],
    c0: null,
    job: null,
    want: [],
    n: 0,
  };
}
function freeNearRing(R) {
  if (!R) return;
  const gl = EGL.gl;
  for (const J of R.jobs || [])
    try {
      J.it.return();
    } catch (e) {}
  R.jobs = [];
  try {
    gl.deleteTexture(R.tex);
    gl.deleteTexture(R.ntex);
  } catch (e) {}
  R.tex = R.ntex = null;
}
/* which squares are wanted: the 4 x 4 round the focus (a little ahead of it, the way the camera looks) */
function wantedRingChunks(R, sc, fx, fz) {
  const P = BORDER_M,
    cx = fx + P,
    cy = sc.h + P - fz,
    tx = cx / NEAR_RING_CHUNK_M,
    ty = cy / NEAR_RING_CHUNK_M - 0.4,
    nx = Math.ceil((sc.w + 2 * P) / NEAR_RING_CHUNK_M),
    ny = Math.ceil((sc.h + 2 * P) / NEAR_RING_CHUNK_M);
  let c0 = [Math.round(tx - 2), Math.round(ty - 2)];
  if (R.c0 && Math.abs(tx - 2 - R.c0[0]) < 0.75 && Math.abs(ty - 2 - R.c0[1]) < 0.75) c0 = R.c0;
  if (!R.c0 || R.c0[0] !== c0[0] || R.c0[1] !== c0[1]) {
    R.c0 = c0;
    R.box = [
      c0[0] * NEAR_RING_CHUNK_M,
      c0[1] * NEAR_RING_CHUNK_M,
      (c0[0] + NEAR_RING_SIZE) * NEAR_RING_CHUNK_M,
      (c0[1] + NEAR_RING_SIZE) * NEAR_RING_CHUNK_M,
    ];
    const L = [];
    for (let j = c0[1]; j < c0[1] + NEAR_RING_SIZE; j++)
      for (let i = c0[0]; i < c0[0] + NEAR_RING_SIZE; i++) {
        if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
        L.push([i, j, Math.hypot(i + 0.5 - tx, j + 0.5 - ty)]);
      }
    L.sort((a, b) => a[2] - b[2]);
    R.want = L;
    /* squares that left the ring are dropped at once (their slot is someone else's now) */ for (
      let s = 0;
      s < 16;
      s++
    ) {
      const ci = R.C[s * 2],
        cj = R.C[s * 2 + 1];
      if (ci < -999) continue;
      if (ci < c0[0] || cj < c0[1] || ci >= c0[0] + NEAR_RING_SIZE || cj >= c0[1] + NEAR_RING_SIZE) {
        R.C[s * 2] = -9999;
        R.C[s * 2 + 1] = -9999;
      }
    }
  }
  return R.want;
}
const ringSlot = (ci, cj) =>
  (((ci % NEAR_RING_SIZE) + NEAR_RING_SIZE) % NEAR_RING_SIZE) +
  (((cj % NEAR_RING_SIZE) + NEAR_RING_SIZE) % NEAR_RING_SIZE) * NEAR_RING_SIZE;
function ringHasChunk(R, ci, cj) {
  const s = ringSlot(ci, cj);
  return R.C[s * 2] === ci && R.C[s * 2 + 1] === cj;
}
function ringMissingCount(R) {
  let n = 0;
  for (const [i, j] of R.want) if (!ringHasChunk(R, i, j)) n++;
  return n;
}
/* paint and upload one square (a generator: the painting is sliced; the upload is at the end) */
function* paintRingChunk(R, sc, ci, cj, pr) {
  const s = ringSlot(ci, cj);
  R.C[s * 2] = -9999;
  R.C[s * 2 + 1] = -9999;
  const o = {
    TP: R.TP,
    rect: [ci * NEAR_RING_CHUNK_M, cj * NEAR_RING_CHUNK_M, NEAR_RING_CHUNK_M, NEAR_RING_CHUNK_M],
    margin: 2,
    nhalf: true,
    mips: 1,
    pr: pr || 0,
  };
  const r = yield* typeof pwPaint === 'function' ? pwPaint(sc, o) : paintGroundSteps(sc, o);
  if (!R.tex) return;
  const gl = EGL.gl,
    px = R.TP * NEAR_RING_CHUNK_M,
    sx = s % NEAR_RING_SIZE,
    sy = (s / NEAR_RING_SIZE) | 0;
  gl.bindTexture(gl.TEXTURE_2D, R.tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, sx * px, sy * px, px, px, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(r.px.buffer));
  /* alpha 0.4: the square's own small sizes, made with it on the helper thread (else the texture's, here) */
  if (r.mips)
    r.mips.forEach((L, k) => {
      const q = px >> (k + 1);
      if (q >= 1) gl.texSubImage2D(gl.TEXTURE_2D, k + 1, sx * q, sy * q, q, q, gl.RGBA, gl.UNSIGNED_BYTE, L);
    });
  else gl.generateMipmap(gl.TEXTURE_2D);
  if (r.nrm) {
    const h = px >> 1;
    gl.bindTexture(gl.TEXTURE_2D, R.ntex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, sx * h, sy * h, h, h, gl.RGBA, gl.UNSIGNED_BYTE, r.nrm);
    if (r.nmips)
      r.nmips.forEach((L, k) => {
        const q = h >> (k + 1);
        if (q >= 1) gl.texSubImage2D(gl.TEXTURE_2D, k + 1, sx * q, sy * q, q, q, gl.RGBA, gl.UNSIGNED_BYTE, L);
      });
    else gl.generateMipmap(gl.TEXTURE_2D);
  }
  R.C[s * 2] = ci;
  R.C[s * 2 + 1] = cj;
  R.n++;
}
/* each frame: keep the ring round the camera's focus, painting what is missing a few ms at a time (more while the
   squares right round you are still missing, so a scene never opens blurred for long) */
export function updateNearRing(sc, fx, fz, budget) {
  if (!walkRenderer.on || !sc) return;
  let R = walkRenderer.ring;
  if (!R) {
    if (!walkRenderer.gtex) return;
    R = walkRenderer.ring = newNearRing();
  }
  const W = wantedRingChunks(R, sc, fx, fz);
  const t0 = performance.now();
  const near = W.slice(0, 4).some(([i, j]) => !ringHasChunk(R, i, j));
  if (near) budget = Math.max(budget, R.n === 0 ? 30 : 12);
  /* alpha 0.4: with the helper thread painting, a few squares are asked for at once (nearest first) and this frame only
    puts the finished ones on the card; without it, one square at a time, painted here a slice at a time */
  const K = typeof pwOn === 'function' && pwOn() ? 3 : 1;
  R.jobs = (R.jobs || []).filter(J => {
    if (W.some(([i, j]) => i === J.ci && j === J.cj)) return true;
    try {
      J.it.return();
    } catch (e) {}
    return false;
  }); /* (squares that left the ring before they were done) */
  while (performance.now() - t0 < budget) {
    for (; R.jobs.length < K;) {
      const nx = W.find(([i, j]) => !ringHasChunk(R, i, j) && !R.jobs.some(J => J.ci === i && J.cj === j));
      if (!nx) break;
      R.jobs.push({ ci: nx[0], cj: nx[1], it: paintRingChunk(R, sc, nx[0], nx[1], nx[2]) });
    }
    if (!R.jobs.length) break;
    let moved = false;
    for (let k = R.jobs.length - 1; k >= 0; k--) {
      const r = R.jobs[k].it.next();
      if (r.done) {
        R.jobs.splice(k, 1);
        moved = true;
      } else if (r.value !== PAINT_WORKER_WAIT) moved = true;
    }
    if (!moved) break;
  }
}
function setNearRingUniforms(U, sc) {
  if (!U.uRing) return;
  const gl = EGL.gl,
    R = walkRenderer.ring,
    on = !!(R && R.tex);
  gl.activeTexture(gl.TEXTURE9);
  gl.bindTexture(gl.TEXTURE_2D, on ? R.tex : EGL.white);
  gl.bindSampler(9, null);
  gl.uniform1i(U.uRing, 9);
  gl.activeTexture(gl.TEXTURE14);
  gl.bindTexture(gl.TEXTURE_2D, on ? R.ntex : EGL.flatN);
  gl.bindSampler(14, null);
  gl.uniform1i(U.uRingN, 14);
  gl.activeTexture(gl.TEXTURE0);
  const P = BORDER_M;
  gl.uniform3f(U.uCanvas, sc.w + 2 * P, sc.h + 2 * P, on ? 1 : 0);
  if (on) {
    gl.uniform2fv(U.uRingC, R.C);
    gl.uniform4f(U.uRingBox, R.box[0], R.box[1], R.box[2], R.box[3]);
  }
}
function groundOcclusionTexture(r) {
  const gl = EGL.gl,
    { FW, FH, d } = r,
    t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, FW, FH, 0, gl.RED, gl.UNSIGNED_BYTE, d);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  eglTexParams({ linear: true });
  return t;
}
/* v46: the frame's key for a view's ground (its mesh, water and textures are kept under it, swapMapCache) */
function groundCacheKey(id, sc, gkey) {
  return (
    id +
    '|' +
    gkey +
    '|' +
    (sc.props || []).length +
    '|' +
    (sc.heights ? sc.heights.length : 0) +
    '|' +
    JSON.stringify(sc.waters || 0) +
    (sc.waterKind || '') +
    (eng('water', 'kinds') ? 1 : 0) +
    (sc.flatFar ? 'F' : '') +
    (sc.ride ? 'R' : '')
  );
}
/* v46: get a view's ground ready before it is shown: built a few ms a frame (groundPrepWork) and kept with the scenes you
   left (walkRenderer.sceneCache), so the switch to it is a swap of a few references. Returns true when it is ready. */
export function isGroundPrepared(id, sc, gkey) {
  const M = walkRenderer.sceneCache;
  return !!(M && M.has(groundCacheKey(id, sc, gkey || groundKey(sc))));
}
export function prepareMapGround(id, sc, G, urgent, focus) {
  if (!walkRenderer.on || !G) return false;
  const gkey = groundKey(sc),
    hk = groundCacheKey(id, sc, gkey);
  if (walkRenderer.sceneCache && walkRenderer.sceneCache.has(hk)) return true;
  if (walkRenderer.hkey === hk) return true;
  if (walkRenderer.prep) {
    if (walkRenderer.prep.hk === hk) {
      if (urgent) walkRenderer.prep.urgent = 1;
      return false;
    }
    if (!urgent || walkRenderer.prep.urgent) return false;
    abortGroundPrep();
  }
  /* a view needed now goes first; one only looked ahead to waits its turn */ const T = {
    prepared: 1,
    grass: null,
    grassKey: null,
  };
  walkRenderer.prep = {
    hk,
    id,
    T,
    it: (function* () {
      yield* buildGroundSteps(sc, G, T);
      /* v46: and the squares round where you will come in */ if (focus) {
        T.ring = newNearRing();
        const W = wantedRingChunks(T.ring, sc, focus[0], focus[1]),
          Q = W.slice(0, 9).map(([i, j, d]) => paintRingChunk(T.ring, sc, i, j, 6 + d));
        /* alpha 0.4: all nine on the helper together; painted here, one after another */ if (
          typeof pwOn === 'function' &&
          pwOn()
        )
          yield* pwAll(Q);
        else for (const g of Q) yield* g;
      }
    })(),
    t0: performance.now(),
    ms: 0,
    urgent: urgent ? 1 : 0,
  };
  return false;
}
function abortGroundPrep() {
  const J = walkRenderer.prep;
  if (!J) return;
  walkRenderer.prep = null;
  try {
    J.it.return();
  } catch (e) {}
  freeMapCache(J.T);
}
function groundPrepWork(budget) {
  const J = walkRenderer.prep;
  if (!J) return;
  if (walkRenderer.hkey === J.hk) {
    abortGroundPrep();
    return;
  }
  if (J.urgent && budget) budget *= 2 * (walkRenderer.prepBoost || 1);
  const t0 = performance.now();
  try {
    while (performance.now() - t0 < budget) {
      const r = J.it.next();
      if (!r.done && r.value === PAINT_WORKER_WAIT) break;
      /* (waiting on the helper thread) */ if (r.done) {
        walkRenderer.prep = null;
        J.ms += performance.now() - t0;
        const M = walkRenderer.sceneCache || (walkRenderer.sceneCache = new Map()),
          keep = eng('quality', 'keepScenes') ?? 3;
        M.delete(J.hk);
        M.set(J.hk, J.T);
        for (const k of [...M.keys()]) {
          if (M.size <= Math.max(1, keep - 1)) break;
          if (k !== J.hk) {
            freeMapCache(M.get(k));
            M.delete(k);
          }
        }
        if (typeof NWLOG !== 'undefined')
          NWLOG.add(
            'scene',
            `prepared ${J.id} on the card (${Math.round(J.ms)} ms of work over ${Math.round(performance.now() - J.t0)} ms)`
          );
        return;
      }
    }
  } catch (e) {
    walkRenderer.prep = null;
    freeMapCache(J.T);
    if (typeof NWLOG !== 'undefined') NWLOG.add('webgl', 'preparing ' + J.id + ' failed: ' + ((e && e.message) || e));
    return;
  }
  J.ms += performance.now() - t0;
}
/* which way water flows: along the scene's streams (sc.streams: [{pts:[[x,z],…]}]), still everywhere else */
/* v22: kinds of water. r = how quickly it deepens away from the shore (m), top = how deep the middle gets; colours multiply
   the Look's water colours; clarity = how much bed shows in the shallows; caus = light patterns on the bed */
export const WATER_KIND_LOOKS = [
  {
    k: 'pond',
    r: 1.6,
    top: 1,
    deep: [1, 1, 1],
    shal: [1, 1.02, 0.98],
    clar: 0.5,
    caus: 0.8,
    foam: 0.7,
    rip: 1,
    glow: 0,
    murk: 0,
    weed: 0,
    fish: 1,
  },
  {
    k: 'stream',
    r: 0.8,
    top: 0.7,
    deep: [0.86, 1.05, 1],
    shal: [1.08, 1.12, 1.06],
    clar: 0.42,
    caus: 1.1,
    foam: 1.5,
    rip: 1.7,
    glow: 0,
    murk: 0,
    weed: 0,
    fish: 0,
  },
  {
    k: 'canal',
    r: 0.6,
    top: 0.9,
    deep: [0.62, 0.8, 0.7],
    shal: [0.6, 0.78, 0.68],
    clar: 0.85,
    caus: 0.25,
    foam: 0.25,
    rip: 0.6,
    glow: 0,
    murk: 0.45,
    weed: 0.12,
    fish: 1,
  },
  {
    k: 'spring',
    r: 1.2,
    top: 0.85,
    deep: [0.36, 1.12, 1.18],
    shal: [0.42, 1.28, 1.2],
    clar: 0.32,
    caus: 1.3,
    foam: 0.25,
    rip: 0.45,
    glow: 0.3,
    murk: 0.1,
    weed: 0,
    fish: 0,
  },
  {
    k: 'swamp',
    r: 2.4,
    top: 0.7,
    deep: [0.42, 0.5, 0.24],
    shal: [0.5, 0.58, 0.3],
    clar: 0.92,
    caus: 0.05,
    foam: 0.12,
    rip: 0.35,
    glow: 0,
    murk: 0.85,
    weed: 0.75,
    fish: 0,
  },
  {
    k: 'lake',
    r: 2.6,
    top: 1,
    deep: [0.7, 0.82, 1.08],
    shal: [0.96, 1, 1.04],
    clar: 0.58,
    caus: 0.6,
    foam: 1,
    rip: 1.45,
    glow: 0,
    murk: 0,
    weed: 0,
    fish: 1,
  },
  /* v24: the open sea, molten lava (mode 1: glowing, crusted, no reflections) and ice (mode 2: frozen, cracked) */
  {
    k: 'sea',
    r: 3.2,
    top: 1,
    deep: [0.58, 0.72, 1.06],
    shal: [0.92, 1.06, 1.06],
    clar: 0.55,
    caus: 0.7,
    foam: 1.3,
    rip: 1.9,
    glow: 0,
    murk: 0,
    weed: 0,
    fish: 1,
  },
  {
    k: 'lava',
    r: 0.8,
    top: 1,
    deep: [2.6, 0.55, 0.12],
    shal: [3.1, 0.95, 0.22],
    clar: 1,
    caus: 0,
    foam: 0,
    rip: 0.25,
    glow: 1.4,
    murk: 1,
    weed: 0,
    fish: 0,
    mode: 1,
  },
  {
    k: 'ice',
    r: 1.5,
    top: 0.6,
    deep: [1.7, 1.2, 1.12],
    shal: [2.6, 1.42, 1.26],
    clar: 1,
    caus: 0,
    foam: 0,
    rip: 0,
    glow: 0,
    murk: 0.3,
    weed: 0,
    fish: 0,
    mode: 2,
  },
];
const WATER_KIND_INDEX = Object.fromEntries(WATER_KIND_LOOKS.map((w, i) => [w.k, i]));
/* which kind each spot of water is: painted rectangles (sc.waters, Studio's water tool) win; then running water is a
   stream (except in a canal town, where canals flow slowly); then the scene's own kind (sc.waterKind), or a guess from the setting (caves have springs, towns have canals) */
/* v32: soft shade on the ground round the feet of buildings, trees, rocks and walls, worked out once per scene at
   four samples a metre (an R8 texture the ground shader multiplies its sky light by) */
/* v34: worked out a slice at a time (a few ms per frame) instead of all at once when a scene opens: it was the cause of
   almost every slow frame in the v33 log (up to 243 ms). The cliff-foot pass reads each spot's height once into a grid
   instead of asking the terrain nine times per texel. Until it's done the ground simply isn't darkened. */
export function groundOcclusion(sc) {
  const gl = EGL.gl;
  if (walkRenderer.gaoTex) {
    walkRenderer.gaoTex = null;
  }
  walkRenderer.gaoJob = null;
  if ((eng('shadows', 'groundAO') ?? 1) <= 0) return;
  walkRenderer.gaoJob = { sc, it: groundOcclusionSteps(sc) };
}
function groundOcclusionWork(budget = 4) {
  const J = walkRenderer.gaoJob;
  if (!J) return;
  if (J.sc !== walkView.sc) {
    walkRenderer.gaoJob = null;
    return;
  }
  const t0 = performance.now();
  while (performance.now() - t0 < budget) {
    const r = J.it.next();
    if (r.done) {
      walkRenderer.gaoJob = null;
      if (r.value) walkRenderer.gaoTex = groundOcclusionTexture(r.value);
      return;
    }
  }
}
function* groundOcclusionSteps(sc) {
  const W = sc.w,
    H = sc.h,
    R = 4,
    FW = W * R,
    FH = H * R,
    A = new Float32Array(FW * FH).fill(1),
    C0 = walkData().sc;
  const dark = (x0, z0, x1, z1, f) => {
    const i0 = Math.max(0, Math.floor(x0 * R)),
      i1 = Math.min(FW - 1, Math.ceil(x1 * R)),
      j0 = Math.max(0, Math.floor(z0 * R)),
      j1 = Math.min(FH - 1, Math.ceil(z1 * R));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const v = f((i + 0.5) / R, (j + 0.5) / R);
        if (v < A[j * FW + i]) A[j * FW + i] = v;
      }
  };
  let n = 0;
  for (const p of sc.props || []) {
    const M = C0.props[p.k];
    if (!M || M.flat) continue;
    const s = p.s || 1,
      g = (M.group || '') + ' ' + p.k;
    if (M.box) {
      const w = (M.box[0] * s) / 2,
        d = M.box[1] * s,
        k = /house|shop|clinic|lab|tower|apartment|hall|villa|chalet|mart|cafe|boutique|windmill/.test(g) ? 0.5 : 0.32,
        x0 = p.x - w,
        x1 = p.x + w,
        z0 = p.z - 0.1,
        z1 = p.z + d;
      dark(x0 - 1.2, z0 - 1.2, x1 + 1.2, z1 + 1.2, (x, z) => {
        const dx = Math.max(x0 - x, 0, x - x1),
          dz = Math.max(z0 - z, 0, z - z1),
          dd = Math.hypot(dx, dz);
        return 1 - k * (1 - smooth01(dd / 1.1));
      });
    } else {
      const sh = (M.shadow || 0) * s;
      if (sh < 0.15) continue;
      const tree = /tree|palm/.test(g),
        r = Math.max(0.3, sh * (tree ? 0.62 : 0.5)),
        k = tree ? 0.42 : /rock|boulder|stump|barrel|crate|well|fountain|statue/.test(g) ? 0.38 : 0.28;
      dark(p.x - r * 1.8, p.z - r * 1.8, p.x + r * 1.8, p.z + r * 1.8, (x, z) => {
        const dd = Math.hypot(x - p.x, (z - p.z) * 1.15);
        return 1 - k * (1 - smooth01((dd - r * 0.35) / (r * 1.35)));
      });
    }
    if (++n % 24 === 0) yield;
  }
  /* at the foot of cliffs, terrace walls and steps: heights read once per texel, neighbours looked up in the grid */
  const E = stepGrid(sc);
  if (E) {
    const S = new Float32Array(FW * FH);
    for (let j = 0; j < FH; j++) {
      for (let i = 0; i < FW; i++)
        S[j * FW + i] = stepRaiseAt(clamp((i + 0.5) / R, 0, W - 0.01), clamp((j + 0.5) / R, 0, H - 0.01), sc);
      if (j % 6 === 5) yield;
    }
    const at = (i, j) => S[clamp(j, 0, FH - 1) * FW + clamp(i, 0, FW - 1)],
      NB = [
        [2, 0, 1],
        [-2, 0, 1],
        [0, 2, 1],
        [0, -2, 1],
        [3, 0, 0.55],
        [-3, 0, 0.55],
        [0, 3, 0.55],
        [0, -3, 0.55],
      ];
    for (let j = 0; j < FH; j++) {
      for (let i = 0; i < FW; i++) {
        const h0 = S[j * FW + i];
        let best = 0;
        for (const [a, b, near] of NB) {
          const up = at(i + a, j + b) - h0;
          if (up > 0.35) best = Math.max(best, near * Math.min(1, up / 1.2));
        }
        if (best > 0) A[j * FW + i] = Math.min(A[j * FW + i], 1 - 0.4 * best);
      }
      if (j % 12 === 11) yield;
    }
  }
  /* one soft blur, then into an R8 texture */
  const d = new Uint8Array(FW * FH);
  for (let j = 0; j < FH; j++) {
    for (let i = 0; i < FW; i++) {
      let s2 = 0,
        c = 0;
      for (let b = -1; b <= 1; b++)
        for (let a = -1; a <= 1; a++) {
          const ii = i + a,
            jj = j + b;
          if (ii < 0 || jj < 0 || ii >= FW || jj >= FH) continue;
          s2 += A[jj * FW + ii];
          c++;
        }
      d[j * FW + i] = Math.round(clamp(s2 / c, 0, 1) * 255);
    }
    if (j % 24 === 23) yield;
  }
  return { FW, FH, d };
}
function shoreField(sc, isW, T = walkRenderer) {
  const gl = EGL.gl,
    W = sc.w,
    H = sc.h,
    R = 8,
    FW = W * R,
    FH = H * R;
  let any = false;
  const m = new Float32Array(FW * FH);
  /* per tile, then filled in (v32: was asked per sample) */ for (let tj = 0; tj < H; tj++)
    for (let ti = 0; ti < W; ti++) {
      if (!isW(ti + 0.5, tj + 0.5)) continue;
      any = true;
      for (let j = tj * R; j < tj * R + R; j++) m.fill(1, j * FW + ti * R, j * FW + ti * R + R);
    }
  T.shoreF = null;
  if (!any || !(eng('water', 'shore') ?? true)) {
    if (T.shoreTex) {
      gl.deleteTexture(T.shoreTex);
      T.shoreTex = null;
    }
    return;
  }
  /* two box blurs of 7 samples (about 0.4 m) each way: straight banks stay where they were, corners round off */
  const tmp = new Float32Array(FW * FH),
    r = 3,
    n = 2 * r + 1,
    blur = (src, dst, dx) => {
      /* a running sum along each row or column */ const L = dx ? FW : FH,
        M2 = dx ? FH : FW,
        at = dx ? (a, b) => b * FW + a : (a, b) => a * FW + b;
      for (let b = 0; b < M2; b++) {
        let sum = 0;
        for (let k = -r; k <= r; k++) sum += src[at(clamp(k, 0, L - 1), b)];
        for (let a2 = 0; a2 < L; a2++) {
          dst[at(a2, b)] = sum / n;
          sum += src[at(Math.min(L - 1, a2 + r + 1), b)] - src[at(Math.max(0, a2 - r), b)];
        }
      }
    };
  for (let n = 0; n < 2; n++) {
    blur(m, tmp, 1);
    blur(tmp, m, 0);
  }
  const d = new Uint8Array(FW * FH);
  for (let j = 0; j < FH; j++)
    for (let i = 0; i < FW; i++) {
      const q = j * FW + i,
        f = m[q],
        x = (i + 0.5) / R,
        z = (j + 0.5) / R;
      /* the bank wanders a little: only near the edge, so open water and dry land stay as they are */
      const e = f * (1 - f) * 4,
        nz = (valueNoise2d(x * 1.1 + 3.7, z * 1.1) - 0.5) * 0.34 + (valueNoise2d(x * 3.3, z * 3.3 + 9.1) - 0.5) * 0.12;
      d[q] = Math.round(clamp(f + nz * e, 0, 1) * 255);
    }
  if (!T.shoreTex) T.shoreTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, T.shoreTex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, FW, FH, 0, gl.RED, gl.UNSIGNED_BYTE, d);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  T.shoreF = { W, H, d, FW, FH };
}
/* the shoreline value at a spot (0 dry ... 0.5 the water's edge ... 1 open water); 1 where there is no field */
function setShoreUniforms(U, sc) {
  if (!U.uShoreR) return;
  const gl = EGL.gl,
    on = !!(walkRenderer.shoreF && walkRenderer.shoreTex);
  gl.activeTexture(gl.TEXTURE5);
  gl.bindTexture(gl.TEXTURE_2D, on ? walkRenderer.shoreTex : EGL.white);
  gl.bindSampler(5, null);
  gl.uniform1i(U.uShore, 5);
  gl.uniform3f(U.uShoreR, 1 / sc.w, 1 / sc.h, on ? 1 : 0);
}
function shoreAt(x, z) {
  const F = walkRenderer.shoreF;
  if (!F) return 1;
  const i = clamp(Math.floor(x * 8), 0, F.FW - 1),
    j = clamp(Math.floor(z * 8), 0, F.FH - 1);
  return F.d[j * F.FW + i] / 255;
}
function waterKindLookup(sc) {
  if (!eng('water', 'kinds')) return () => 0;
  const R = sc.waters || [],
    def = WATER_KIND_INDEX[sc.waterKind] ?? (sc.indoor && sc.far === 'cave' ? 3 : sc.far === 'town' ? 2 : 0);
  return (x, z, run) => {
    for (let i = R.length - 1; i >= 0; i--) {
      const r = R[i];
      if (x >= r.x && z >= r.z && x < r.x + r.w && z < r.z + r.h) return WATER_KIND_INDEX[r.k] ?? def;
    }
    return run && def !== 2 && !WATER_KIND_LOOKS[def].mode ? 1 : def;
  };
}
function waterFlowField(sc) {
  const S = sc.streams || [];
  if (!S.length) return () => [0, 0];
  return (x, z) => {
    let best = null,
      bd = 2.5;
    for (const st of S) {
      const p = st.pts || [];
      for (let k = 0; k < p.length - 1; k++) {
        const a = p[k],
          b = p[k + 1],
          vx = b[0] - a[0],
          vz = b[1] - a[1],
          l2 = vx * vx + vz * vz || 1e-9,
          t = clamp(((x - a[0]) * vx + (z - a[1]) * vz) / l2, 0, 1),
          d = Math.hypot(a[0] + vx * t - x, a[1] + vz * t - z);
        if (d < bd) {
          bd = d;
          const l = Math.sqrt(l2);
          best = [(vx / l) * (st.speed || 1), (vz / l) * (st.speed || 1)];
        }
      }
    }
    return best || [0, 0];
  };
}
/* the ground's normal map and shine, from the painted ground: brighter pixels stand proud, by how bumpy each terrain
   is (cobbles and rock a lot, grass a little); shine in alpha (wet-looking plaza and mall floors, dull grass) */
/* [bumpiness, shine, built]: a built surface (boards, floors, slabs, bricks, steps, asphalt) is flat; only its seams
   catch the light (v31: planks used to look rounded, because the shading painted on each plank became a curve) */
/* v46: the twelve new kinds: clover, moss, mud, wet sand, pebbles, cobblestone, leaf litter, heather, marsh, marble, ice, crystal */
export const TERRAIN_MATERIALS = {
  C: [0.7, 0.02],
  M: [0.6, 0.06],
  D: [0.5, 0.35],
  S: [0.5, 0.3],
  P: [1.1, 0.12],
  K: [1, 0.1, 1],
  L: [0.8, 0.03],
  H: [0.75, 0.02],
  R: [0.6, 0.25],
  T: [0.6, 0.45, 1],
  I: [0.3, 0.7],
  X: [1, 0.35],
  g: [0.7, 0.02],
  G: [0.7, 0.02],
  f: [0.7, 0.03],
  t: [0.7, 0.02],
  p: [0.8, 0.05],
  o: [0.9, 0.04],
  s: [0.6, 0.08],
  c: [1, 0.22],
  b: [0.9, 0.14, 1],
  m: [0.35, 0.5, 1],
  r: [1.2, 0.12],
  k: [1, 0.18],
  x: [1, 0.28],
  n: [0.5, 0.32],
  w: [0, 0],
  d: [0, 0],
  a: [0.55, 0.1, 1],
  q: [0.9, 0.14, 1],
  h: [1.05, 0.1, 1],
  v: [1.15, 0.05],
  u: [0.8, 0.04],
  y: [0.85, 0.03],
  e: [1.1, 0.12, 1],
  l: [0.55, 0.03],
  /* v47: the 22 new kinds */
  A: [0.9, 0.04],
  B: [0.7, 0.02],
  E: [0.7, 0.03],
  F: [0.8, 0.03],
  J: [0.7, 0.08],
  N: [0.6, 0.08],
  U: [0.4, 0.15],
  V: [1, 0.14, 1],
  W: [1.1, 0.2],
  Y: [0.9, 0.14, 1],
  Z: [0.5, 0.06],
  i: [0.5, 0.08, 1],
  1: [0.4, 0.05, 1],
  2: [1, 0.3],
  3: [1.1, 0.22],
  4: [0.4, 0.2],
  5: [0.9, 0.14, 1],
  6: [0.3, 0, 1],
  7: [0.3, 0, 1],
  8: [0.6, 0.3, 1],
  9: [0.35, 0.5, 1],
  0: [0.4, 0.3, 1],
};
provide({ TERRAIN_MATERIALS }); /* to-module */
/* the tilt one ground pixel gets from the brightness around it */
function groundPixelNormal(gx, gy, m) {
  if (m[2]) {
    const g = Math.hypot(gx, gy);
    if (g < 0.07) return [0, 0];
    const k = (Math.min(1, (g - 0.07) * 6) * 0.45) / g;
    return [clamp(-gx * k, -0.45, 0.45), clamp(gy * k, -0.45, 0.45)];
  }
  return [clamp(-gx * m[0] * 1.4, -0.8, 0.8), clamp(gy * m[0] * 1.4, -0.8, 0.8)];
}
function groundNormalTexture(G, old, sc = walkView.sc) {
  const gl = EGL.gl,
    TP = G._TP || walkData().sc.tile || 16,
    P = BORDER_M,
    w = G.width,
    h = G.height,
    rows = sc.tiles || [];
  let d;
  if (G._nrm) {
    const t = old && old !== EGL.flatN ? old : gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, G._nrm);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    return t;
  }
  try {
    d = G._px || G.getContext('2d').getImageData(0, 0, w, h).data;
  } catch (e) {
    return old || EGL.flatN;
  }
  const L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
  const out = new Uint8Array(w * h * 4),
    mat = (X, Y) => {
      const i = Math.floor(X / TP) - P,
        j = Math.floor(Y / TP) - P,
        ch = i < 0 || j < 0 || i >= sc.w || j >= sc.h ? sc.edge : (rows[j] || '')[i] || sc.edge;
      return TERRAIN_MATERIALS[ch] || [1, 0.05];
    };
  for (let Y = 0; Y < h; Y++) {
    let m = mat(0, Y),
      mx = 0;
    for (let X = 0; X < w; X++) {
      if (X >= mx) {
        m = mat(X, Y);
        mx = (Math.floor(X / TP) + 1) * TP;
      }
      const i = Y * w + X,
        l = k => L[clamp(k, 0, w * h - 1)];
      const gx = (L[Y * w + Math.min(w - 1, X + 1)] - L[Y * w + Math.max(0, X - 1)]) * 0.5,
        gy = (L[Math.min(h - 1, Y + 1) * w + X] - L[Math.max(0, Y - 1) * w + X]) * 0.5;
      /* world x follows the picture's x; world z runs up the picture */
      const [nx, nz] = groundPixelNormal(gx, gy, m);
      out[i * 4] = (nx * 0.5 + 0.5) * 255;
      out[i * 4 + 1] = (nz * 0.5 + 0.5) * 255;
      out[i * 4 + 2] = 255;
      out[i * 4 + 3] = m[1] * 255;
    }
  }
  const t = old && old !== EGL.flatN ? old : gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, out);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.generateMipmap(gl.TEXTURE_2D);
  return t;
}
function repeatingTexture(im, old) {
  const gl = EGL.gl;
  if (!imageReady(im)) return EGL.white;
  const t = old && old !== EGL.white ? old : gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
  eglTexParams({ repeat: true });
  return t;
}
/* grass blades: many little triangles on grassy tiles, denser in tall grass, none on paths or under things */
/* v22: grass with variety. Every blade has a kind (thin, broad, clover, dry straw, flower head, tall hiding grass) and
   a tint: patches of lush and dry grass follow a slow noise, it is darker and greener near water, shorter where paths
   and doors wear it down, taller round fences, rocks and tree trunks, and tufts creep onto the edges of paths */
const GRASS_KINDS = {
  g: [
    [0, 0.66],
    [1, 0.2],
    [2, 0.1],
    [4, 0.04],
  ],
  G: [
    [0, 0.55],
    [1, 0.3],
    [4, 0.08],
    [3, 0.07],
  ],
  f: [
    [0, 0.55],
    [4, 0.3],
    [2, 0.15],
  ],
  l: [
    [0, 0.68],
    [2, 0.3],
    [4, 0.02],
  ],
  y: [
    [1, 0.5],
    [0, 0.35],
    [3, 0.15],
  ],
  t: [[5, 1]],
  B: [
    [3, 0.6],
    [0, 0.3],
    [1, 0.1],
  ],
  E: [
    [0, 0.45],
    [4, 0.45],
    [1, 0.1],
  ],
}; /* v47: sunburnt grass (mostly dry straw), wildflower meadow (flower heads) */
/* v39: planting is spread over frames: each frame plants rows for a few milliseconds (grassWork), and the blades
   appear when the last row is in, so a big meadow no longer costs one long frame when the scene opens */
export function buildGrass() {
  const gl = EGL.gl,
    sc = walkView.sc;
  walkRenderer.grassDrawn = 0;
  /* v46: a room has none (the count used to carry over from the last place) */ if (walkRenderer.grass) {
    gl.deleteVertexArray(walkRenderer.grass.vao);
    gl.deleteBuffer(walkRenderer.grass.ib);
    gl.deleteBuffer(walkRenderer.grass.vb);
  }
  walkRenderer.grass = null;
  walkRenderer.grassJob = null;
  walkRenderer.grassKey = eng('grass', 'density');
  if (sc.indoor && !sc.grass) return;
  /* alpha 0.4: the blades go straight into a growing Float32Array (8 numbers each) instead of a plain array of numbers:
    planting a big place made several MB of garbage, and a phone's clean-up of it was the worst hitch on arrival */
  const dk = eng('grass', 'density'),
    rnd = (a, b) => hash2d(a * 7 + 3, b * 13 + 5),
    dens = { t: 30, g: 4, G: 7, f: 5, l: 3, y: 2, C: 5, H: 6, R: 9, M: 1, L: 1, B: 6, E: 7, F: 1 };
  navGrid();
  const J = { sc, j: 0, k: 0, I: new Float32Array(8 * 4096), n: 0 };
  const C0 = walkData().sc,
    rows = sc.tiles || [];
  const W2 = sc.w * 2,
    H2 = sc.h * 2,
    occ = new Uint8Array(W2 * H2 + W2 * 2),
    tall = new Uint8Array(W2 * H2 + W2 * 2);
  for (const p of sc.props || []) {
    const M = C0.props[p.k],
      g = ((M && M.group) || '') + ' ' + p.k,
      big = /fence|rock|boulder|tree|post|stump|log|sign|lamp|well|wall/.test(g);
    for (let a = -3; a <= 3; a++)
      for (let b = -3; b <= 3; b++) {
        const ii = Math.floor(p.x * 2) + a,
          jj = Math.floor(p.z * 2) + b;
        if (ii < 0 || jj < 0 || ii >= W2 || jj >= H2) continue;
        if (Math.abs(a) <= 1 && Math.abs(b) <= 1) occ[jj * W2 + ii] = 1;
        else if (big) tall[jj * W2 + ii] = 1;
      }
  }
  const ter = (x, z) => {
    const i = Math.floor(x),
      j = sc.h - 1 - Math.floor(z);
    return i < 0 || j < 0 || i >= sc.w || j >= sc.h ? sc.edge : (rows[j] || '')[i] || sc.edge;
  };
  const near = (x, z, r, set) => {
    for (const [a, b] of [
      [r, 0],
      [-r, 0],
      [0, r],
      [0, -r],
      [r * 0.7, r * 0.7],
      [-r * 0.7, r * 0.7],
      [r * 0.7, -r * 0.7],
      [-r * 0.7, -r * 0.7],
    ])
      if (set.includes(ter(x + a, z + b))) return true;
    return false;
  };
  const pick = (ch, r) => {
    const L = GRASS_KINDS[ch] || GRASS_KINDS.g;
    let a = 0;
    for (const [kk, w] of L) {
      a += w;
      if (r < a) return kk;
    }
    return L[0][0];
  };
  const add = (x, z, h, kind, tint) => {
    if ((J.n + 1) * 8 > J.I.length) {
      const b = new Float32Array(J.I.length * 2);
      b.set(J.I);
      J.I = b;
    }
    const I = J.I,
      o = J.n * 8;
    I[o] = x;
    I[o + 1] = z;
    I[o + 2] = h;
    I[o + 3] = rnd(J.k, 5);
    I[o + 4] = kind;
    I[o + 5] = rnd(J.k, 6);
    I[o + 6] = rawHeightAt(sc, x, z) + stepRaiseAt(x, z, sc);
    I[o + 7] = tint;
    J.n++;
  };
  J.row = j => {
    for (let i = 0; i < sc.w; i++) {
      const ch = (rows[j] || '')[i];
      const d = Math.round((dens[ch] || 0) * dk),
        z0 = sc.h - j - 1;
      if (!d) {
        /* tufts at the edge of a path next to grass */ if ('puv'.includes(ch)) {
          for (let n = 0; n < Math.round(3 * dk); n++) {
            J.k++;
            const x = i + rnd(J.k, 1),
              z = z0 + rnd(J.k, 2);
            if (!near(x, z, 0.35, 'gGflt')) continue;
            if (!isWalkable(x, z) || occ[Math.floor(z * 2) * W2 + Math.floor(x * 2)]) continue;
            add(x, z, 0.08 + rnd(J.k, 4) * 0.1, 0, (valueNoise2d(x * 0.18, z * 0.18) - 0.5) * 1.2);
          }
        }
        continue;
      }
      for (let n = 0; n < d; n++) {
        J.k++;
        const x = i + rnd(J.k, 1),
          z = z0 + rnd(J.k, 2);
        if (!isWalkable(x, z) && ch !== 't') continue;
        const q = Math.floor(z * 2) * W2 + Math.floor(x * 2);
        if (occ[q]) continue;
        const kind = pick(ch, rnd(J.k, 7));
        let h =
          ch === 't' ? 0.45 + rnd(J.k, 3) * 0.35 : kind === 2 ? 0.06 + rnd(J.k, 4) * 0.06 : 0.12 + rnd(J.k, 4) * 0.18;
        if (ch !== 't' && near(x, z, 0.55, 'puvcqhab')) h *= 0.5;
        if (tall[q]) h *= 1.4;
        let tint = (valueNoise2d(x * 0.16 + 3, z * 0.16 + 7) - 0.45) * 1.5;
        if (near(x, z, 1.4, 'wd')) tint = Math.min(tint, 0) - 0.7;
        add(x, z, h, kind, clamp(tint, -1, 1));
      }
    }
  };
  J.done = () => {
    const N = J.n,
      A = J.I;
    if (!N) return;
    /* v32: blades sorted into 8 m squares, so only the squares in view are drawn (alpha 0.4: a counting sort into one
    typed array: two passes, no array per square) */
    const CS = 8,
      cw = Math.ceil(sc.w / CS) + 1,
      ch = Math.ceil(sc.h / CS) + 1,
      NB = cw * ch,
      key = new Int32Array(N),
      cnt = new Int32Array(NB),
      y0 = new Float32Array(NB).fill(1e9),
      y1 = new Float32Array(NB).fill(-1e9);
    for (let b = 0; b < N; b++) {
      const q = b * 8,
        ci = Math.min(cw - 1, Math.max(0, Math.floor(A[q] / CS))),
        cj = Math.min(ch - 1, Math.max(0, Math.floor(A[q + 1] / CS))),
        k = cj * cw + ci;
      key[b] = k;
      cnt[k]++;
      const y = A[q + 6];
      if (y < y0[k]) y0[k] = y;
      if (y + A[q + 2] > y1[k]) y1[k] = y + A[q + 2];
    }
    const start = new Int32Array(NB),
      chunks = [];
    let at = 0;
    for (let k = 0; k < NB; k++) {
      start[k] = at;
      if (cnt[k]) {
        const ci = k % cw,
          cj = (k - ci) / cw;
        chunks.push({
          x: (ci + 0.5) * CS,
          z: (cj + 0.5) * CS,
          y: (y0[k] + y1[k]) / 2,
          r: CS * 0.75 + (y1[k] - y0[k]) / 2 + 0.8,
          off: at,
          n: cnt[k],
        });
      }
      at += cnt[k];
    }
    const I = new Float32Array(N * 8);
    for (let b = 0; b < N; b++) {
      const k = key[b],
        d = start[k] * 8,
        q = b * 8;
      for (let t = 0; t < 8; t++) I[d + t] = A[q + t];
      start[k]++;
    }
    J.I = null;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0.5, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ib);
    gl.bufferData(gl.ARRAY_BUFFER, I, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);
    walkRenderer.grass = { vao, vb, ib, n: I.length / 8, chunks };
  };
  walkRenderer.grassJob = J;
  grassWork(12);
}
export function grassWork(ms = 4) {
  const J = walkRenderer.grassJob;
  if (!J) return;
  if (J.sc !== walkView.sc) {
    walkRenderer.grassJob = null;
    return;
  }
  const t0 = performance.now(),
    sc = J.sc;
  while (J.j < sc.h && performance.now() - t0 < ms) {
    J.row(J.j);
    J.j++;
  }
  if (J.j >= sc.h) {
    walkRenderer.grassJob = null;
    J.done();
  }
}

/* distant trees, rocks or cacti scattered on the land around the scene (taken from the scene's own props) */
function buildFarProps() {
  const sc = walkView.sc,
    C0 = walkData().sc,
    pool = [],
    count = Math.round(eng('world', 'farProps'));
  walkRenderer.farKey = walkView.id + '|' + count;
  for (const p of sc.props || []) {
    const M = C0.props[p.k];
    if (!M || M.flat || M.box || M.door) continue;
    const g = M.group || p.k;
    if (
      /tree|pine|oak|birch|boulder|rock|cactus|stalag|mesa|crystal|mushroom_giant|scrap|tires/.test(g) ||
      /tree|cactus|mesa|stalag/.test(p.k)
    )
      pool.push(p.k);
  }
  walkRenderer.farProps = [];
  if (!pool.length) return;
  const W = sc.w,
    H = sc.h;
  let k = 0;
  for (let n = 0; n < (sc.indoor ? Math.min(40, count) : count); n++) {
    k++;
    const a = hash2d(k, 11),
      b = hash2d(k, 17),
      side = hash2d(k, 23);
    let x, z;
    if (side < 0.45) {
      x = -4 + a * (W + 8);
      z = H + 2 + b * b * 34;
    } else if (side < 0.72) {
      x = -3 - b * b * 30;
      z = -2 + a * (H + 30);
    } else {
      x = W + 3 + b * b * 30;
      z = -2 + a * (H + 30);
    }
    if (z < -1) continue;
    walkRenderer.farProps.push({
      k: pool[Math.floor(hash2d(k, 29) * pool.length) % pool.length],
      x,
      z,
      s: 0.9 + hash2d(k, 31) * 0.6,
      f: hash2d(k, 37) < 0.5 ? 1 : 0,
      far: 1,
    });
  }
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
    ld = P.walk && sp < 12 ? eng('camera', 'lead') : 0,
    vl = Math.max(1e-4, Math.hypot(vx, vz));
  walkRenderer.lead[0] += ((ld ? (vx / vl) * ld : 0) - walkRenderer.lead[0]) * Math.min(1, dt * 1.6);
  walkRenderer.lead[1] += ((ld ? (vz / vl) * ld : 0) - walkRenderer.lead[1]) * Math.min(1, dt * 1.6);
  const tk = eng('camera', 'tilt'),
    tilt = [
      (walkRenderer.tiltX + (walkRenderer.mouse ? walkRenderer.mouse[0] * 0.35 : 0)) * tk,
      (walkRenderer.tiltY + (walkRenderer.mouse ? walkRenderer.mouse[1] * 0.25 : 0)) * tk,
    ];
  const pitch0 = eng('camera', 'pitch') ?? (c.pitch || 34) + eng('camera', 'pitchAdd'),
    h0 = (eng('camera', 'height') ?? (c.h || 9)) * eng('camera', 'distance');
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
  const visW = Math.min(sc.w * 0.95, Math.max(11, (rw / rh) * 15)) / ((c.fov || 1) * eng('camera', 'fov')),
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
  const bob = P.walk && !RM ? Math.sin(walkView.t / 170) * 0.025 * eng('camera', 'sway') : 0,
    f = [Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  let tgt = [T[0], T[2] + bob, T[1]];
  /* v35: pixel-grid camera (Engine > Camera > Pixel grid, off until the new art): when you stand still the camera
    target settles onto the art grid (1/32 m), so still pictures sit on whole pixels and don't shimmer */
  if (eng('camera', 'pixelGrid') && !P.walk && !P.route && !st.focus && !walkRenderer.swoop && !RM) {
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
  const proj = M4.persp(vfov, rw / rh, 0.5, 420);
  proj[0] = -proj[0];
  const view = M4.look(eye, tgt, [0, 1, 0]),
    vp = M4.mul(proj, view);
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)],
    back = [-Math.sin(yaw), 0, -Math.cos(yaw)],
    fwd = [Math.sin(yaw), 0, Math.cos(yaw)];
  return {
    gl: 1,
    rw,
    rh,
    vp,
    ivp: M4.inv(vp),
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
/* the battle stage's camera (battle-stage.js stageProjectWith) as a matrix: a level pinhole camera with an off-center horizon, in stage pixels */
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
    ivp: M4.inv(m),
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
  const proj = M4.persp(vfov, rw / rh, 0.3, 420);
  proj[0] = -proj[0];
  const view = M4.look(eye, tgt, [0, 1, 0]),
    vp = M4.mul(proj, view),
    yaw = Math.atan2(tgt[0] - eye[0], tgt[2] - eye[2]),
    pitch = Math.asin(clamp((eye[1] - tgt[1]) / df, -1, 1));
  return {
    gl: 1,
    rw,
    rh,
    vp,
    ivp: M4.inv(vp),
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
  if (!walkView.ready || EGL.lost) return;
  const w0 = performance.now(),
    gl = EGL.gl,
    sc = walkView.sc;
  ENG_CTX.look = sc.look || null;
  EGL.fr = (EGL.fr || 0) + 1;
  if (EGL.fr % 120 === 0) eglTexTrim();
  eglNormWork(walkView.warm ? 40 : 3);
  eglPendPoll(1);
  groundOcclusionWork();
  groundPrepWork(walkRenderer.bt ? 0 : PREP_BUDGET_MS);
  const cssW = cv.clientWidth,
    cssH = cv.clientHeight;
  if (!cssW || !cssH) return;
  const R0 = Math.min(devicePixelRatio || 1, 1.75) * eng('quality', 'resolution'),
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
  ENG_CTX.env = typeof environment !== 'undefined' && (environment.on || !!environment.force);
  if (ENG_CTX.env) environmentFrame(sc, dt);
  const gq = eglGpuBegin();
  try {
    drawWalkFrameInner(ts, dt, dtm, t, C0, PPU, rw, rh, w0);
  } finally {
    ENG_CTX.env = false;
    eglGpuEnd(gq);
  }
}
function drawWalkFrameInner(ts, dt, dtm, t, C0, PPU, rw, rh, w0) {
  if (typeof seamlessLookTick === 'function') seamlessLookTick();
  const gl = EGL.gl,
    sc = walkView.sc,
    cv = walkView.cv;
  ensureGround();
  const hk = groundCacheKey(walkView.id, sc, walkView.gkey);
  if (walkRenderer.gkey !== walkView.gkey || walkRenderer.hkey !== hk) {
    const old = walkRenderer.hkey;
    walkRenderer.gkey = walkView.gkey;
    walkRenderer.hkey = hk;
    walkView.nav = null;
    navGrid();
    swapMapCache(old, hk);
  }
  navGrid();
  if (walkRenderer.grassKey !== eng('grass', 'density')) buildGrass();
  else grassWork(4);
  if (walkRenderer.farKey !== walkView.id + '|' + Math.round(eng('world', 'farProps'))) buildFarProps();
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
  const sun = mapSun(sc, eglSun(!!sc.indoor));
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
  let items = gatherFrameItems(st, C, PPU, C0);
  const hits = [],
    labels = [];
  if (BT) {
    items = items.filter(it => !(it.k === 'prop' && BT.hide && BT.hide.has(it.p)));
    for (const it of BT.items) items.push(it);
  } else walkView.hits = hits;
  cullItems(items, C);
  const dark0 = sc.tint && sc.tint !== '#000000' ? 1 : sc.indoor ? 0.7 : 0,
    lk = ENG_CTX.env && !sc.indoor ? environment.lampK : 0,
    dark = Math.max(dark0, lk > 0.4 ? lk : 0);
  /* shadow map (every other frame when the device is struggling) */
  const QE = Math.max(walkRenderer.q || 0, BT && (eng('quality', 'battleLite') ?? true) ? 2 : 0);
  walkRenderer.qe = QE;
  let shadow = walkRenderer.lastShadow || null;
  if (!((walkView.R < 0.7 || QE >= 2) && walkRenderer.frames % 2 && shadow)) {
    shadow = shadowPass(items, sun, C);
    walkRenderer.lastShadow = shadow;
  }
  const X = walkLightContext(C, sun, dark, items, shadow, BT);
  walkRenderer.X = X;
  if (dark > 0.3 && !BT && shadow) lampShadowMaps(items, X, dark);
  if (walkRenderer.water && !(QE >= 2 && walkRenderer.frames % 2 && EGL.fb.refl)) reflectionPass(items, C, rw, rh, X);
  const S = eglTarget('scene', rw, rh, { depth: true, hdr: true });
  gl.bindFramebuffer(gl.FRAMEBUFFER, S.f);
  gl.viewport(0, 0, rw, rh);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const D = walkRenderer.dbg || {};
  drawSky(C, sun, 0);
  drawGround(C, X);
  drawRoomFront(C, X);
  if (walkRenderer.grass && !D.noGrass) drawGrass(C, X);
  drawSprites(C, items, X, hits, labels, PPU);
  if (typeof p3dDraw === 'function') p3dDraw(C, items, X, hits, labels, PPU);
  if (typeof drawPropModels === 'function') drawPropModels(C, items, X, null, null, PPU);
  drawBoxFaces(C, items, X);
  if (typeof bldDraw === 'function') bldDraw(C, X, items, walkRenderer.bfade);
  if (typeof strDraw === 'function') strDraw(C, X);
  gatherFountainBasins(items);
  if (walkRenderer.water || walkRenderer.basin) drawWater(C, X, rw, rh);
  effectsPass(C, items, X, dark, t, dt);
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
    dir = v3n([C.tgt[0] - C.eye[0], C.tgt[1] - C.eye[1], C.tgt[2] - C.eye[2]]),
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
    eglPost(S, C, walkRenderer.focus, rw, rh, {
      blur: BT ? BT.blur : (sc.blur ?? 1) * (walkView.opt.blur ?? 1) * (st.focusY != null ? 0.6 : 1),
      fast: walkView.R < 0.75 || QE >= 1,
      noAO: QE >= 1,
      noRays: QE >= 3,
      bloomN: QE >= 3 ? 3 : 5,
      noDof: QE >= 4,
      heat: heatHaze(sc),
      heatS: heatSources(C),
      mood: easedMood(sc),
      sun: sc.indoor ? null : eglSunScreen(C, sun.dir, 300),
      X,
      ivp: C.ivp,
      noVol: QE >= 3 || (!!sc.indoor && !dark),
      volDens: sc.indoor ? 0.5 : 1 + (ENG_CTX.env ? environment.fog * 1.5 + environment.rain * 0.4 : 0),
    });
  /* labels and markers stay sharp on the layer above */
  const x = walkView.x;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, rw, rh);
  if (!BT && !(walkView.opt.active && !walkView.opt.active())) {
    drawExitMarks(C, st, t);
    drawTapMark(C, t);
    if (typeof worldBillyLabels === 'function' && !BT) worldBillyLabels(C, labels);
    for (const l of labels) {
      if (l.k === 'enc') drawLevelTag(x, l.x, l.y, l.e);
      else if (l.k === 'bang') drawBubble(x, l.x, l.y, '!', l.col);
      else if (l.k === 'say') drawSpeech(x, l.x, l.y, l.t, l.a);
      else if (l.k === 'act' && l.y > rh * 0.1)
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
      cb(eglSnapshot(rw, rh, null, 2048));
    } catch (e) {
      cb(null);
    }
  }
  if (walkRenderer.snapReq && typeof NWLOG !== 'undefined') {
    walkRenderer.snapReq = 0;
    try {
      const c = eglSnapshot(rw, rh, walkRenderer.ui);
      NWLOG.shot = { t: NWLOG.now(), what: walkView.id, jpeg: c.toDataURL('image/jpeg', 0.72) };
    } catch (e) {
      NWLOG.shot = { t: NWLOG.now(), error: String(e.message || e) };
    }
  }
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
/* v32: the last few scenes' ground, water and grass stay on the graphics card, so walking out of a house (or back
   from a trip) doesn't rebuild them; the oldest is let go when a fourth arrives */
const MAP_CACHE_KEYS = [
  'ring',
  'gaoTex',
  'gtex',
  'ftex',
  'ctex',
  'gntex',
  'mesh',
  'valley',
  'wgrid',
  'shoreF',
  'shoreTex',
  'water',
  'fallMesh',
  'falls',
  'fishHomes',
  'streamCells',
  'springCells',
  'flowAt',
  'wlevels',
  'wlevel',
  'grass',
  'grassKey',
];
/* alpha 0.4.1: everything built from the settings once (the ground and its relief, the grass, far props, solid props and
   trees) made again, for a dial changed in the Studio (or Settings) that those depend on */
export function rebuildFromSettings() {
  if (typeof walkRenderer === 'undefined' || !walkRenderer.on) return;
  try {
    if (walkRenderer.sceneCache) {
      for (const e of walkRenderer.sceneCache.values()) freeMapCache(e);
      walkRenderer.sceneCache.clear();
    }
    if (walkRenderer.mesh) {
      const e = {};
      for (const k of MAP_CACHE_KEYS) {
        e[k] = walkRenderer[k];
        walkRenderer[k] = null;
      }
      freeMapCache(e);
    }
    if (walkRenderer.prep) abortGroundPrep();
  } catch (e) {
    console.warn(e);
  }
  walkRenderer.hkey = '';
  walkRenderer.gkey = '';
  walkRenderer.farKey = '';
  walkRenderer.grass = null;
  walkRenderer.grassKey = null;
  walkRenderer.itemGen = (walkRenderer.itemGen || 0) + 1;
  walkView.gkey = '';
  if (typeof GROUND_CACHE !== 'undefined') GROUND_CACHE.clear();
  if (typeof solidPropState !== 'undefined' && solidPropState.meshes) solidPropState.meshes = new WeakMap();
  if (typeof flushPropModelMeshes === 'function') flushPropModelMeshes();
}
function swapMapCache(oldKey, key) {
  walkRenderer.swapT = performance.now();
  const M = walkRenderer.sceneCache || (walkRenderer.sceneCache = new Map()),
    keep = eng('quality', 'keepScenes') ?? 3;
  if (oldKey && walkRenderer.mesh && keep > 0) {
    const e = {};
    for (const k of MAP_CACHE_KEYS) {
      e[k] = walkRenderer[k];
      walkRenderer[k] = null;
    }
    if (e.ring) {
      freeNearRing(e.ring);
      e.ring = null;
    }
    /* v46: a view you left keeps its ground but not its near ring (26 MB); it is painted again if you come back */ M.delete(
      oldKey
    );
    M.set(oldKey, e);
  } else if (walkRenderer.ring) {
    freeNearRing(walkRenderer.ring);
    walkRenderer.ring = null;
  }
  const hit = M.get(key);
  if (walkRenderer.prep && walkRenderer.prep.hk === key) abortGroundPrep(); /* v46: about to build it anyway */
  if (hit && (hit.prepared || hit.grassKey === eng('grass', 'density'))) {
    M.delete(key);
    for (const k of MAP_CACHE_KEYS) walkRenderer[k] = hit[k];
    walkRenderer.rings = [];
    walkRenderer.leaves = null;
    walkRenderer.wlevelR = null;
    walkRenderer.farKey = '';
    walkRenderer.basinKey = null;
    if (!walkRenderer.gaoTex && walkView.sc) groundOcclusion(walkView.sc);
    /* v46: a view prepared ahead plants its grass now (sliced, a few ms a frame) */ if (hit.prepared) {
      walkRenderer.grass = null;
      walkRenderer.grassKey = null;
    }
  } else {
    if (hit) {
      M.delete(key);
      freeMapCache(hit);
    }
    buildGroundMesh();
  }
  while (M.size > Math.max(0, keep - 1)) {
    const k0 = M.keys().next().value;
    freeMapCache(M.get(k0));
    M.delete(k0);
  }
}
function freeMapCache(e) {
  const gl = EGL.gl;
  if (!e) return;
  if (e.ring) {
    freeNearRing(e.ring);
    e.ring = null;
  }
  try {
    for (const k of ['gtex', 'ftex', 'ctex', 'gntex', 'shoreTex', 'gaoTex'])
      if (e[k] && e[k] !== EGL.white && e[k] !== EGL.flatN) gl.deleteTexture(e[k]);
    for (const k of ['mesh', 'water', 'fallMesh']) if (e[k]) eglFree(e[k]);
    if (e.grass) {
      gl.deleteVertexArray(e.grass.vao);
      gl.deleteBuffer(e.grass.ib);
      gl.deleteBuffer(e.grass.vb);
    }
  } catch (err) {}
}
/* v32: only what the camera can see is drawn. The six sides of the view are taken from the camera matrix once a
   frame; each thing is a ball round its middle (lifted by the horizon curve the shaders apply) tested against them.
   Things just outside still cast shadows in (the shadow pass keeps everything near the shadow map's square). */
const FRUSTUM_PLANES = new Float32Array(24);
function computeFrustum(m) {
  const F = FRUSTUM_PLANES;
  for (let i = 0; i < 6; i++) {
    const r = i >> 1,
      sg = i & 1 ? -1 : 1,
      a = m[3] + sg * m[r],
      b = m[7] + sg * m[4 + r],
      c = m[11] + sg * m[8 + r],
      d = m[15] + sg * m[12 + r],
      l = Math.hypot(a, b, c) || 1;
    F[i * 4] = a / l;
    F[i * 4 + 1] = b / l;
    F[i * 4 + 2] = c / l;
    F[i * 4 + 3] = d / l;
  }
  return F;
}
function inFrustum(F, x, y, z, r) {
  for (let i = 0; i < 6; i++) {
    if (i === 5) continue;
    /* no far side: the haze hides the far end anyway */ if (
      F[i * 4] * x + F[i * 4 + 1] * y + F[i * 4 + 2] * z + F[i * 4 + 3] <
      -r
    )
      return false;
  }
  return true;
}
function cullItems(items, C) {
  const F = computeFrustum(C.vp);
  let n = 0,
    k = 0;
  const on = eng('quality', 'cull') ?? true;
  for (const it of items) {
    if (!on || it.person || it.k === 'enc' || it.k === 'enc2') {
      it.vis = true;
      continue;
    }
    const s = it.mpp || 0.03,
      w = (it.w || 32) * s,
      h = (it.h || 32) * s,
      b = it.M && it.M.box,
      ext = b ? Math.max(b[0], b[1]) * ((it.p && it.p.s) || 1) : 0;
    const r = Math.max(w, h, ext) * 0.6 + 0.4,
      cy = (it.y || 0) + h * 0.5 + worldCurveDrop(it.x, it.z);
    it.vis = inFrustum(F, it.x, cy, it.z, r);
    k++;
    if (!it.vis) n++;
  }
  walkRenderer.culled = n;
  walkRenderer.cullOf = k;
}
/* v32: a per-frame time budget for one-off work (solid bodies, outlines of buildings): past it, things stay pictures
   for a frame or two instead of freezing the scene while they are worked out */
export function frameBudgetLeft() {
  return performance.now() - (walkRenderer.budT || 0) < (walkRenderer.budMs ?? 7);
}
/* v32: how much heat shimmer: over lava always, over desert sand and canyons in the heat of the day */
/* v47: a mood per place (warm late afternoon in Sundown, cool and misty in the Thicket, hazy heat in the canyon...):
   saturation, contrast, warmth and tints for the darks and the lights, from the data's presets (moods). It eases over
   about two seconds when you walk from one place into the next, and is off with the setting off */
const NEUTRAL_MOOD = { sat: 1, con: 1, warm: 0, lift: [0, 0, 0], gain: [0, 0, 0], sh: [0, 0, 0], hi: [0, 0, 0] };
function easedMood(sc) {
  const on = (eng('world', 'moods') ?? 1) > 0,
    Mo = (typeof GD !== 'undefined' && GD.moods) || {},
    T0 = on && sc ? Mo[sc.mood || mapMoodName(sc)] : null,
    k = eng('world', 'moods') ?? 1;
  const T = Object.assign({}, NEUTRAL_MOOD);
  if (T0)
    for (const f of ['sat', 'con', 'warm']) if (T0[f] != null) T[f] = f === 'warm' ? T0[f] * k : 1 + (T0[f] - 1) * k;
  if (T0) for (const f of ['lift', 'gain', 'sh', 'hi']) if (T0[f]) T[f] = T0[f].map(v => v * k);
  const M = walkRenderer.mood || (walkRenderer.mood = JSON.parse(JSON.stringify(T))),
    now = performance.now(),
    dt = Math.min(0.1, (now - (walkRenderer.moodT || now)) / 1000);
  walkRenderer.moodT = now;
  const e = 1 - Math.exp(-dt * 1.6);
  for (const f of ['sat', 'con', 'warm']) M[f] += (T[f] - M[f]) * e;
  for (const f of ['lift', 'gain', 'sh', 'hi']) for (let i = 0; i < 3; i++) M[f][i] += (T[f][i] - M[f][i]) * e;
  return M;
}
/* alpha 0.4: where the fires are on screen, for the small shimmer above each (up to six, nearest first in the list) */
function heatSources(C) {
  const F = walkRenderer.fires || [];
  if (!F.length || !C || !C.vp) return null;
  const m = C.vp,
    out = [];
  for (const [x, y, z, s] of F) {
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12],
      cy = m[1] * x + m[5] * y + m[9] * z + m[13],
      w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (w <= 0.1) continue;
    const u = (cx / w) * 0.5 + 0.5,
      v = (cy / w) * 0.5 + 0.5;
    if (u < -0.1 || u > 1.1 || v < -0.1 || v > 1.1) continue;
    const r = Math.min(0.14, (1.5 * s) / w);
    out.push(u, v, r * 0.55, r);
    if (out.length >= 24) break;
  }
  return out.length ? out : null;
}
function heatHaze(sc) {
  if (sc.indoor) return 0;
  if (sc.waterKind === 'lava' || sc.far === 'volcano') return 0.9;
  const hot =
    sc.climate === 'dry' ||
    /canyon|desert|mesa/.test((sc.far || '') + ' ' + (sc.name || '').toLowerCase()) ||
    (sc.edge === 's' && !sc.flatFar);
  if (!hot) return 0;
  const E = typeof environment !== 'undefined' && ENG_CTX.env ? environment : null;
  return E ? 0.55 * (1 - E.night) * (1 - E.grey) * (1 - Math.min(1, E.rain)) : 0.4;
}
/* lower the resolution when frames come late (whatever the cause), raise it again when there's room */
/* v32: a ladder. When frames come late the costliest extras go first, one step at a time (1: quicker depth of field,
   no ambient occlusion; 2: smaller shadow map, shadows and reflections every other frame; 3: fewer bloom levels, no
   light shafts, no grass far away; 4: no depth of field); only then the resolution drops. With room to spare it climbs
   back: resolution first, then the extras. Frames held back on purpose (a window open, another screen) don't count. */
export function adaptQuality(dtm, work) {
  if (!eng('quality', 'auto')) {
    walkView.R = 1;
    walkRenderer.q = 0;
    return;
  }
  const cap = walkView.opt.cap ? walkView.opt.cap() : 60;
  if (cap < 30 || walkView.warm) {
    walkRenderer.int = 0;
    return;
  }
  /* alpha 0.1: the picture stays sharp at 60 frames a second; only Smoothest (preferences.aim) trades sharpness for more */
  const smooth = typeof S !== 'undefined' && S && S.preferences && S.preferences.aim === 'smooth',
    target = 1000 / Math.min(cap, FRAME.hz || 60, smooth ? 999 : 60);
  walkRenderer.int = walkRenderer.int ? walkRenderer.int * 0.92 + dtm * 0.08 : dtm;
  /* alpha 0.4: in every log the picture sat on the lowest step outdoors most of the time: a place's first seconds
    (its ground painting, its grass planting) pushed it down, and it only came back up on frames under 8 ms of work,
    which a phone outdoors rarely has. Now the first 3 s after a view changes don't push it down, it comes back up
    while the frames keep the beat with work under 60% of a frame, and a step that proved too much is held off for
    half a minute (no see-sawing) */
  const slow = walkRenderer.int > target * 1.3 || walkView.slow > target * 0.85,
    room = walkRenderer.int < target * 1.1 && walkView.slow < target * 0.6;
  const now = performance.now();
  if (now - (walkRenderer.adaptT || 0) < (slow ? 1200 : 900)) return;
  walkRenderer.adaptT = now;
  walkRenderer.q = walkRenderer.q || 0;
  /* alpha 0.4.1: when the frame's own work on the main thread is what holds it back (a big place in a wide window, the
    laptop in the diagnostics), taking away god rays, bloom steps, depth of field or resolution doesn't help: those cost
    the graphics chip. Then only the steps that save work here are taken (shadows and reflections every other frame,
    steps 1-2), and the ones above come back. Before, such a machine sat on the lowest step with the effects off. */
  const cpu = walkView.slow > target * 0.7;
  if (slow && cpu) {
    if (walkRenderer.q > 2) {
      walkRenderer.q = 2;
      walkRenderer.raiseT = now;
    } else if (walkRenderer.q < 2 && now - (walkRenderer.swapT || 0) >= 3000) walkRenderer.q++;
    walkRenderer.roomN = 0;
    if (walkView.R < 1) walkView.R = Math.min(1, walkView.R + 0.1);
    return;
  }
  if (slow) {
    if (now - (walkRenderer.swapT || 0) < 3000) return;
    if (now - (walkRenderer.raiseT || -1e9) < 5000) walkRenderer.holdT = now + 30000;
    walkRenderer.roomN = 0;
    if (walkRenderer.q < 4) walkRenderer.q++;
    else if (walkView.R > 0.55) walkView.R = Math.max(0.5, walkView.R - 0.1);
  } else if (room && now > (walkRenderer.holdT || 0)) {
    if (walkView.R < 1) {
      walkView.R = Math.min(1, walkView.R + 0.1);
      walkRenderer.raiseT = now;
    } else if (walkRenderer.q > 0 && (walkRenderer.roomN = (walkRenderer.roomN || 0) + 1) >= 2) {
      walkRenderer.q--;
      walkRenderer.roomN = 0;
      walkRenderer.raiseT = now;
    }
  }
}
/* phase 04d: the Studio swaps in its own (studio/js/engine-editor.js and viewport.js) */
export function setAdaptQuality(v) {
  adaptQuality = v; // eslint-disable-line no-func-assign
  provide({ adaptQuality });
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
  if (!it || it.bld3 || it.flat || !eng('world', 'hugSlopes')) return;
  const M = it.M,
    p = it.p;
  if (M._hugK !== p.k) {
    M._hugK = p.k;
    const g = (M.group || '') + ' ' + p.k;
    M._hug = SLOPE_HUGGERS.test(g) && !/tree|lamp|post|sign|pole/.test(g);
  }
  if (!M._hug) return;
  const R = it.fixed ? FIXED_FACING : C.right,
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
  if (!sc || !sc.ride || typeof riderOf !== 'function' || typeof S === 'undefined' || !S.team) return null;
  const ch = terrainAt(P.x, P.z);
  if (ch !== 'w' && ch !== 'd') {
    walkRenderer.mountOn = false;
    return null;
  }
  const m = riderOf() || S.team.find(x => SP[x.sp] && SP[x.sp].types.includes('Water')) || S.team[0];
  if (!m || !SP[m.sp]) return null;
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
    cv = walkRenderer.mountCv = cnv(R.BW, R.BH);
    cv.__v = 0;
  }
  const x = cv.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, cv.width, cv.height);
  x.imageSmoothingEnabled = false;
  drawRig(x, R, rigFrame(R, null, 0, RM ? 0 : Math.floor(t / 50) * 50, 1.7), back ? 'back' : 'front');
  cv.__v++;
  const ht = clamp(SP[m.sp].ht, 0.9, 3),
    hm = 0.75 + ht * 0.32,
    mpp = hm / Math.max(40, R.base - (R.geo && R.geo.top != null ? R.geo.top : 0)),
    bob = RM ? 0 : Math.sin(t / 420) * 0.05,
    y = standingHeightAt(P.x, P.z) + bob - 0.08;
  if (!RM && P.walk && (!walkRenderer.wakeT || t - walkRenderer.wakeT > 320)) {
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
  if (!L || p.v || p.plain || p.alt === 0 || !((eng('world', 'variety') ?? 1) > 0) || (sc && sc.variety === 0))
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
function propGrid(sc) {
  const L = sc.props || [],
    G = walkRenderer.pgrid;
  let sig = L.length;
  for (let i = 0; i < L.length; i += Math.max(1, L.length >> 4))
    sig = (sig * 31 + ((L[i].x * 7 + L[i].z * 13) | 0)) | 0;
  if (G && G.sc === sc && G.sig === sig && (walkView.t || 0) - G.at < 2000 && (walkView.t || 0) >= G.at) return G;
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
  return (walkRenderer.pgrid = { sc, sig, at: walkView.t || 0, cells });
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
  const mat = propMaterial(p.k, M);
  c = {
    k: p.k,
    x: p.x,
    z: p.z,
    s,
    id,
    src,
    gen,
    at: t,
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
    (eng('world', 'variety') ?? 1) +
    ',' +
    (eng('world', 'wear') ?? 1) +
    ',' +
    (eng('world', 'propTurn') ?? 1) +
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
  L0.at = t;
  L0.px = p.x;
  L0.pz = p.z;
  L0.sg = sg;
  L0.gen = walkRenderer.itemGen || 0;
  return L0;
}
function computePropLook(p, M, sc) {
  const E = [eng('world', 'variety') ?? 1, eng('world', 'wear') ?? 1, eng('world', 'propTurn') ?? 1],
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
    const t = hexA(p.tint);
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
  const gl = EGL.gl;
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
   (eglWind) that travel over the grass; the result is a lean of the top of the sprite as a fraction of its height */
export function windLeanAt(x, z, t, sc, wind) {
  const k = (sc.wind || 1) * (wind == null ? eng('grass', 'wind') : wind);
  return eglWindBend(x, z, t, eng('grass', 'gusts')) * k;
}
export function gatherFrameItems(st, C, PPU, C0) {
  const sc = walkView.sc,
    P = walkView.pl,
    t = walkView.t,
    out = [],
    hub = mapHub(sc),
    tg = tallGrassProps(C0),
    wind = eng('grass', 'wind'),
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
      s = ((p.s || 1) / PPU) * (lk ? lk.size : 1) * (p.grow != null ? cropGrowth(p) : 1),
      w = im.naturalWidth || im.width,
      h = im.naturalHeight || im.height;
    const S = far ? null : stillPropState(p, M, im, sc);
    const y = far ? standingHeightAt(p.x, p.z) : S.y,
      sw = far || !M.sway ? 0 : (M.sway || 0) * windLeanAt(p.x, p.z, RM ? 0 : t, sc, wind);
    const mat = S ? S.mat : propMaterial(p.k, M);
    im.__mat = mat;
    /* v27: boats and buoys bob and roll on the water; flags, banners and washing flutter in the wind */
    let y2 = y,
      sw2 = sw;
    if (!far && !RM) {
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
      bld3: !far && !!(M.build && M.box) && typeof bldOn === 'function' && bldOn(),
    });
    if (!far) hugSlope(out[out.length - 1], C);
    /* v46: a building whose solid or front isn't made yet (a few are made per frame) shows as its picture meanwhile, never as nothing */
    if (!far) {
      const bi = out[out.length - 1];
      if (bi.bld3) {
        let E = null,
          F = null;
        bldGuard(() => {
          E = bldMeshFor(bi);
          if (E && E.walls) F = bldFacade(bi.im, M.build, M);
        });
        if (!E || !E.walls || !F) bi.bld3 = false;
      }
    }
    /* v43: a prop with a voxel recipe draws as a solid (prop-models.js); its picture layers come along as sprites */
    if (!far && M.vox && typeof tagPropModel === 'function') {
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
          wv = RM ? 0 : windLeanAt(p.x, p.z, t, sc, wind);
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
        if (l.swing && !RM) {
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
    F = C.vp && (eng('quality', 'cull') ?? true) ? computeFrustum(C.vp) : null;
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
    const fr = typeof owFrames === 'function' ? owFrames(n.who) : null;
    if (!fr) return;
    trWarm(n.who);
    const dir =
      Math.hypot(P.x - pos[0], P.z - pos[1]) < 4.5 ? directionOf(P.x - pos[0], P.z - pos[1]) : n.dir || 'down';
    const nset = fr[dir] || fr.down,
      nim = typeof trPick === 'function' ? trPick(nset, false, 0) : nset[0];
    if (nim) out.push(personItem('npc', nim, pos[0], pos[1], C0, { n }));
    npcPos.push([n, pos]);
  });
  if (ow) {
    companionItems(out, t, npcPos);
    buddyItems(out, t, odt);
    if (typeof frWorldItems === 'function')
      try {
        frWorldItems(out, t, C0);
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
    if (!st.battle && !RM && !walkRenderer.bt) {
      const dd = Math.min(0.1, (t - (s.lt || t)) / 1000);
      s.lt = t;
      const P = walkView.pl;
      if (P && typeof sfxAt === 'function' && Math.hypot(P.x - s.x, P.z - s.z) < 4 && Math.random() < dd * 0.25)
        sfxAt('rustle', s.x, s.z);
    }
    used.push([s.x, s.z]);
    walkRenderer.encPos.push([s.x, s.z, e.id]);
    const g = tg[Math.abs(Math.round(s.x * 7 + s.z * 3)) % tg.length];
    const im = g && artImage(g.img);
    if (!imageReady(im)) return;
    const moving = Math.hypot((s.tx ?? s.x) - s.x, (s.tz ?? s.z) - s.z) > 0.05,
      ru = moving ? 0.06 * Math.sin(t / 70 + s.x) : 0,
      wv = RM ? 0 : windLeanAt(s.x, s.z, t, sc, wind);
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
      trWarm('folk:' + f.seed);
      const set = fr[f.dir] || fr.down;
      let fim =
        typeof trPick === 'function'
          ? trPick(set, f.walk, Math.floor(t / 110) % 6)
          : f.walk
            ? set.cyc
              ? set.cyc[Math.floor(t / 110) % 6]
              : set[1 + (Math.floor(t / 150) % 2)]
            : set[0];
      /* v47: a wave hello */ if (f.waveT > 0 && typeof humanPose === 'function') {
        const w = humanPose('folk:' + f.seed, 'front', 'cheer', 0, (1.4 - f.waveT) * 1000);
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
  if (typeof p3dTag === 'function') {
    for (const it of out) if (it.fixed !== false) p3dTag(it, PPU);
    if (typeof p3dLod === 'function')
      p3dLod(out, C); /* a solid tree has its crown in 3D: its layered crown pictures go */
    const T = new Set(out.filter(it => it.vol && it.vol.tree).map(it => it.p));
    if (T.size) for (let i = out.length - 1; i >= 0; i--) if (out[i].layer && T.has(out[i].p)) out.splice(i, 1);
  }
  if (st.who !== null && typeof owFrames === 'function') {
    const fr = owFrames(st.who),
      set = fr[P.dir] || fr.down;
    const me = personItem(
      'me',
      P.hop
        ? set.cyc
          ? set.cyc[2]
          : set[1]
        : P.walk
          ? set.cyc
            ? set.cyc[Math.floor(t / 110) % 6]
            : set[1 + (Math.floor(t / 150) % 2)]
          : set[0],
      P.x,
      P.z,
      C0,
      { shear: RM ? 0 : P.lean || 0 }
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
  if (!sc || !sc.room || (eng('lights', 'roomLight') ?? true) === false) return sun;
  const Rk = roomSkyLight(),
    wd = v3n([Rk.dx * 0.45, 0.6, -0.7]);
  return Object.assign({}, sun, {
    dir: wd,
    travel: [-wd[0], -wd[1], -wd[2]],
    col: Rk.c.map(v => v * Math.max(0.25, Rk.I) * 0.3 * (eng('lights', 'windowLight') ?? 1) * eng('sun', 'strength')),
    indoor: true,
    room: true,
  });
}
/* v46: inside a building laid into the place (seamless-world.js seamlessRoomMap) the town around the room dims over 0.6 s; walking
   out it brightens again over 0.7 s, as your eyes adjust */
export function roomDimming(sc) {
  const now = performance.now(),
    k0 = eng('world', 'roomDim') ?? 0.68;
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
function lampLit(x, z, dark) {
  const sc = walkView.sc,
    E = typeof environment !== 'undefined' && ENG_CTX.env && !sc.indoor ? environment : null;
  if (!E || (sc.tint && sc.tint !== '#000000')) return dark ? 1 : 0;
  const th = 0.16 + 0.3 * hash2d(Math.round(x * 7), Math.round(z * 11));
  return Math.min(1, Math.max(0, (E.lampK - th) / 0.07));
}
/* an old (picture-only) house's window: lit at this hour or not (environment.js environmentWindowLit) */
function windowLit(x, z) {
  return typeof environmentWindowLit === 'function' && typeof environment !== 'undefined' && ENG_CTX.env
    ? environmentWindowLit(x, z, environment.tod)
    : true;
}
function walkLightContext(C, sun, dark, items, shadow, BT) {
  const dark0L = dark;
  const sc = walkView.sc,
    t = walkView.t,
    R = C.right,
    P = BT ? { x: BT.center[0], z: BT.center[1] } : walkView.pl,
    lb = eng('lights', 'brightness'),
    flick = eng('lights', 'flicker'),
    winDay = eng('lights', 'windowsDay');
  const L = [],
    ao = [],
    RR = sc.roomRect,
    dOut = RR && typeof environment !== 'undefined' && ENG_CTX.env ? environment.lampK || 0 : 0;
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
      pk = (eng('lights', 'pools') ?? 1) * lb,
      G = [],
      inRoom = !!sc.room && !out,
      E = it.bld3 && typeof BLD !== 'undefined' ? BLD.mesh.get(it.p) : null;
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
      const lf = bldLitF();
      for (const f of E.fw) if (f[1] - it.y < 2.6 && bldWinLit(f[3], lf)) (W || (W = [])).push(f);
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
      const c = hexA(M.glow.c),
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
  const E = typeof environment !== 'undefined' && ENG_CTX.env ? environment : null,
    cave = (sc.dark ?? (sc.indoor && sc.far === 'cave' ? 1 : 0)) * eng('air', 'caveDark'),
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
  const lights = eglPickLights(L, P.x, P.z, 16),
    sky = skyColors(sc);
  let hz = hexA(eng('air', 'haze') || sc.haze || (sc.sky || [])[2] || '#EAD9C0').map(v => v / 255);
  if (E && !sc.indoor) hz = environmentSky([hz, hz, hz], false)[2];
  const tint = sc.tint && sc.tint !== '#000000' ? hexA(sc.tint).map(v => 0.35 + (v / 255) * 1.3) : null;
  let ambTop = sc.indoor
      ? [0.62, 0.58, 0.52]
      : [0.3 + sky[0][0] * 0.24, 0.32 + sky[0][1] * 0.24, 0.36 + sky[0][2] * 0.28],
    ambBot = sc.indoor ? [0.38, 0.31, 0.25] : [0.3, 0.32, 0.24];
  /* v43: a room is lit by its windows: the daylight comes in from the front at a slant (roomSkyLight says how bright and from which side), warm walls and a dark floor make the ambient, no sun lobe; the lamps do the rest after dark */
  let roomSH = null;
  if (sc.room && (eng('lights', 'roomLight') ?? true) !== false) {
    const Rk = roomSkyLight();
    const wc = sc.wallCol && sc.wallCol[0] ? hexA(sc.wallCol[0]).map(v => v / 255) : [0.78, 0.7, 0.58];
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
  return eglLightCtx({
    roomB: RD ? RD.b : null,
    roomDim: RD ? RD.dim : 0,
    eye: C.eye,
    sun,
    ambTop,
    ambBot,
    ambHor,
    noSunLobe: !!roomSH,
    haze: hz,
    fogStart: C.df * eng('air', 'hazeStart') * (E && !sc.indoor ? 1 - E.fog * 0.35 : 1),
    fogD: (eng('air', 'hazeDistance') ?? (sc.hazeD || 34)) * 1.15 * fogK,
    tint,
    valley: walkRenderer.valley || null,
    mist: sc.mist != null ? sc.mist + (E && !sc.indoor ? E.fog * 0.18 : 0) : eng('air', 'mist'),
    mistY: (walkRenderer.wlevel || 0) + eng('air', 'mistHeight'),
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
/* ---------- passes ---------- */
export function useWalkProgram(name, C, X) {
  const gl = EGL.gl,
    p = EGL.P[name];
  gl.useProgram(p.p);
  if (p.U.uVP && C) gl.uniformMatrix4fv(p.U.uVP, false, C.vp);
  if (X) eglLightU(p, X);
  return p;
}
function setSpriteUniforms(p, it, uv) {
  const gl = EGL.gl,
    U = p.U,
    s = it.mpp;
  gl.uniform3f(U.uBase, it.x, it.y, it.z);
  gl.uniform4f(U.uOff, it.ox * s, it.oy * s, it.w * s, it.h * s);
  gl.uniform4fv(U.uUV, uv || [0, 0, 1, 1]);
  gl.uniform1f(U.uFlip, it.flip);
  if (U.uSlope) gl.uniform1f(U.uSlope, it.slope || 0);
  gl.uniform1f(U.uShear, it.shear || 0);
}
/* v19: the shadow map covers the ground the camera sees (plus a margin for tall things just outside), not the whole
   scene, so its texels are smaller where it matters; the radius moves in 2 m steps */
function shadowMapArea(C) {
  const sc = walkView.sc,
    full = [sc.w / 2, sc.h / 2, Math.hypot(sc.w, sc.h) / 2 + 6];
  if (!C || !eng('shadows', 'fit')) return full;
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
  const far = fittedShadowPass(items0, sun, C);
  if (!(eng('shadows', 'cascades') ?? true) || (walkRenderer.bt && (eng('quality', 'battleLite') ?? true))) return far;
  const P = walkView.pl,
    R = eng('shadows', 'nearRadius') ?? 13,
    res = Math.min(1024, eng('quality', 'shadowMap')),
    gl = EGL.gl,
    items = items0.filter(it => Math.hypot(it.x - P.x, it.z - P.z) < R + (it.w || 32) * (it.mpp || 0.03) + 3);
  const SH = eglShadowBegin(P.x, P.z, R, sun, res, 'shadowN'),
    ca = worldCurveArgs();
  {
    const p = EGL.P.shadowG;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
    gl.uniform3f(p.U.uCurve, ca[0], ca[1], ca[2]);
    gl.uniform1f(p.U.uCurveD0, ca[3]);
    gl.bindVertexArray(walkRenderer.mesh.vao);
    gl.drawElements(gl.TRIANGLES, walkRenderer.mesh.n, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }
  drawShadowSprites(SH, items, sun, ca);
  if (typeof bldShadow === 'function') bldShadow(SH, items);
  if (typeof strShadow === 'function') strShadow(SH);
  if (typeof p3dShadow === 'function') p3dShadow(SH, items);
  if (typeof drawPropModelShadows === 'function') drawPropModelShadows(SH, items);
  eglShadowEnd();
  SH.far = far;
  return SH;
}
/* v43: shadow maps for the two nearest lamps after dark (the ones that hang high: street lamps, lanterns, windows don't
   count). The lamps are moved to the front of the light list so the shader knows which they are. */
function lampShadowMaps(items, X, dark) {
  const n = Math.min(2, eng('shadows', 'lampShadows') ?? 2);
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
  const gl = EGL.gl,
    ca = worldCurveArgs();
  cand.forEach((l, i) => {
    const SH = eglLampShadowBegin([l.p[0], l.p[1] + 0.2, l.p[2]], 512, 'lamp' + i),
      near = items.filter(
        it =>
          Math.hypot(it.x - l.p[0], it.z - l.p[2]) < 13 &&
          it.p !== l.own &&
          !(it.k === 'prop' && it.M && it.M.glow && Math.hypot(it.x - l.p[0], it.z - l.p[2]) < 0.6)
      ); /* alpha 0.4: nor its own post (it.p!==l.own): the lamp's picture turned black in its own light's shadow */
    {
      const p = EGL.P.shadowG;
      gl.useProgram(p.p);
      gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
      gl.uniform3f(p.U.uCurve, ca[0], ca[1], ca[2]);
      gl.uniform1f(p.U.uCurveD0, ca[3]);
      gl.bindVertexArray(walkRenderer.mesh.vao);
      gl.drawElements(gl.TRIANGLES, walkRenderer.mesh.n, gl.UNSIGNED_INT, 0);
      gl.bindVertexArray(null);
    }
    drawShadowSprites(SH, near, null, ca, l.p);
    if (typeof bldShadow === 'function') bldShadow(SH, near);
    if (typeof p3dShadow === 'function') p3dShadow(SH, near);
    if (typeof drawPropModelShadows === 'function') drawPropModelShadows(SH, near);
    eglShadowEnd();
    X.lampSh.push(SH);
  });
}
/* the sprites of a shadow pass, each turned to face the sun (fixed ones and buildings as they stand); for a lamp, each turned to face the lamp */
function drawShadowSprites(SH, L, sun, ca, lamp) {
  const gl = EGL.gl,
    p = EGL.P.shadow,
    solid = eng('shadows', 'buildings'),
    tr = sun ? sun.travel : [0, -1, 0],
    h = v3n([tr[0], 0, tr[2]]),
    Rs0 = Math.hypot(tr[0], tr[2]) < 0.05 ? [1, 0, 0] : [-h[2], 0, h[0]];
  let Rs = Rs0;
  gl.useProgram(p.p);
  gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
  gl.uniform3f(p.U.uCurve, ca[0], ca[1], ca[2]);
  gl.uniform1f(p.U.uCurveD0, ca[3]);
  eglBindQuad();
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(p.U.uTex, 0);
  let miss = 0;
  for (const it of L) {
    if (it.flat || it.far || it.k === 'enc2' || it.vol || it.k === 'flag' || it.vox) continue;
    if (it.k === 'prop' && !(it.sh > 0)) continue;
    const T = eglImg(it.im);
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
      bldGuard(() => {
        F = eglImg(bldFacade(it.im, it.M.build, it.M));
      });
      if (!F) miss++;
      if (F) {
        gl.bindTexture(gl.TEXTURE_2D, F.t);
        gl.uniform3fv(p.U.uRight, FIXED_FACING);
        setSpriteUniforms(p, it);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.uniform3fv(p.U.uRight, Rs);
      }
      continue;
    }
    if (it.plane && !(solid && it.M && it.M.box)) {
      gl.uniform3fv(p.U.uRight, FIXED_FACING);
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
        ? Math.min(1024, eng('quality', 'shadowMap'))
        : eng('quality', 'shadowMap'),
    gl = EGL.gl;
  let fit = shadowMapArea(C);
  const cache = (eng('quality', 'shadowCache') ?? true) && !walkRenderer.bt && !!gl.blitFramebuffer;
  if (cache) fit = [Math.round(fit[0] / 3) * 3, Math.round(fit[1] / 3) * 3, fit[2] + 3];
  const items = items0.filter(
    it => Math.hypot(it.x - fit[0], it.z - fit[1]) < fit[2] + (it.w || 32) * (it.mpp || 0.03) + 4
  );
  const SH = eglShadowBegin(fit[0], fit[1], fit[2], sun, res);
  const ca = worldCurveArgs(),
    curve = P => {
      gl.uniform3f(P.U.uCurve, ca[0], ca[1], ca[2]);
      gl.uniform1f(P.U.uCurveD0, ca[3]);
    };
  const solid = eng('shadows', 'buildings'),
    tr = sun.travel,
    h = v3n([tr[0], 0, tr[2]]),
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
        typeof bldOn === 'function' && bldOn() ? 1 : 0,
        typeof BLD !== 'undefined' ? BLD.made || 0 : 0,
      ].join('|')
    : '';
  const SF = EGL.fb.shadow;
  let hit = false;
  if (cache && walkRenderer.shKey === key && EGL.fb.shadowS && EGL.fb.shadowS.w === res) {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, EGL.fb.shadowS.f);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, SF.f);
    gl.blitFramebuffer(0, 0, res, res, 0, 0, res, res, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, SF.f);
    hit = true;
    walkRenderer.shHit = (walkRenderer.shHit || 0) + 1;
  }
  let miss = 0;
  const sprites = L => {
    const p = EGL.P.shadow;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
    curve(p);
    eglBindQuad();
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(p.U.uTex, 0);
    for (const it of L) {
      if (it.flat || it.far || it.k === 'enc2' || it.vol || it.k === 'flag' || it.vox) continue;
      if (it.k === 'prop' && !(it.sh > 0)) continue;
      const T = eglImg(it.im);
      if (!T) {
        miss++;
        continue;
      }
      gl.bindTexture(gl.TEXTURE_2D, T.t);
      if (it.layer && it.M.box) continue;
      /* a 3D building: its front as a cut-out here, walls and roof as geometry below */
      if (it.bld3) {
        let F = null;
        bldGuard(() => {
          F = eglImg(bldFacade(it.im, it.M.build, it.M));
        });
        if (!F) miss++;
        if (F) {
          gl.bindTexture(gl.TEXTURE_2D, F.t);
          gl.uniform3fv(p.U.uRight, FIXED_FACING);
          setSpriteUniforms(p, it);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
          gl.uniform3fv(p.U.uRight, Rs);
        }
        continue;
      }
      if (it.plane && !(solid && it.M && it.M.box)) {
        gl.uniform3fv(p.U.uRight, FIXED_FACING);
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
    let p = EGL.P.shadowG;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
    curve(p);
    gl.bindVertexArray(walkRenderer.mesh.vao);
    gl.drawElements(gl.TRIANGLES, walkRenderer.mesh.n, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
    sprites(stat);
    if (typeof bldShadow === 'function') bldShadow(SH, stat);
    if (typeof strShadow === 'function') strShadow(SH);
    if (typeof drawPropModelShadows === 'function') drawPropModelShadows(SH, stat);
    if (cache) {
      const S2 = eglTarget('shadowS', res, res, { depthOnly: true });
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
    if (typeof bldShadow === 'function') bldShadow(SH, dyn);
    if (typeof drawPropModelShadows === 'function') drawPropModelShadows(SH, dyn);
  }
  if (typeof p3dShadow === 'function') p3dShadow(SH, items);
  eglShadowEnd();
  return SH;
}
/* v26: the scene's sky colours after the hour and the weather (environment.js) */
function skyColors(sc) {
  const s = (sc.sky || ['#8CC6E6', '#BFE3EE', '#F4E8C8']).map(c => hexA(c).map(v => v / 255));
  return typeof environmentSky === 'function' && ENG_CTX.env ? environmentSky(s, !!sc.indoor) : s;
}
function drawSky(C, sun, mirror) {
  const gl = EGL.gl,
    sc = walkView.sc,
    p = EGL.P.sky,
    U = p.U,
    sky = skyColors(sc);
  gl.useProgram(p.p);
  eglBindQuad();
  if (U.uEnv) {
    const E = typeof environment !== 'undefined' && ENG_CTX.env ? environment : null;
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
  gl.uniform1f(U.uClouds, eng('sun', 'clouds'));
  gl.uniform1f(U.uCloudSpd, eng('sun', 'cloudSpeed'));
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
  if (!imageReady(im)) return EGL.white;
  const gl = EGL.gl,
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
  const gl = EGL.gl,
    sc = walkView.sc,
    p = useWalkProgram('ground', C, X),
    U = p.U,
    P = BORDER_M;
  const wa = eglImg(artImage(walkData().sc.wallArt || 'scene/build/walls.png'), { noNormal: true });
  gl.activeTexture(gl.TEXTURE4);
  gl.bindTexture(gl.TEXTURE_2D, wa ? wa.t : EGL.white);
  gl.uniform1i(U.uWallA, 4);
  if (!walkRenderer.wallColF) {
    walkRenderer.wallColF = new Float32Array(36);
  }
  const WC = sc.wallCol || [];
  for (let i = 0; i < 12; i++) {
    const c = WC[i] ? hexA(WC[i]).map(v => v / 255) : WALL_COLORS[i];
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
  gl.bindTexture(gl.TEXTURE_2D, walkRenderer.gntex || EGL.flatN);
  gl.uniform1i(U.uGNrm, 3);
  gl.uniform1f(U.uGStr, eng('world', 'groundBumps'));
  gl.uniform1f(U.uGShine, eng('world', 'groundShine'));
  gl.uniform4f(U.uGRect, -P, sc.h + P, 1 / (sc.w + 2 * P), 1 / (sc.h + 2 * P));
  setShoreUniforms(U, sc);
  setNearRingUniforms(U, sc);
  if (U.uBed) gl.uniform3fv(U.uBed, engHex('water', 'bed', '#74654A'));
  if (U.uGAO) {
    gl.activeTexture(gl.TEXTURE8);
    gl.bindTexture(gl.TEXTURE_2D, walkRenderer.gaoTex || EGL.white);
    gl.bindSampler(8, null);
    gl.uniform1i(U.uGAO, 8);
    gl.uniform3f(U.uGAOR, 1 / sc.w, 1 / sc.h, walkRenderer.gaoTex ? (eng('shadows', 'groundAO') ?? 1) : 0);
  }
  if (U.uWet) {
    const E = typeof environment !== 'undefined' && ENG_CTX.env && !sc.indoor ? environment : null,
      sk = skyColors(sc);
    gl.uniform1f(U.uWet, E ? clamp((E.wet || 0) * (eng('air', 'wetGround') ?? 1), 0, 1) : 0);
    gl.uniform1f(U.uRainK, E ? Math.min(1, E.rain || 0) : 0);
    gl.uniform3fv(U.uSkyW, sk[1]);
    gl.uniform1f(U.uCausW, eng('water', 'wallLight') ?? 1);
  }
  if (U.uRoom) {
    const B = sc.room && (eng('lights', 'roomLight') ?? true) !== false ? roomBoxOf(sc) : null;
    gl.uniform4f(U.uRoom, B ? B[0] : 0, B ? B[1] : 0, B ? B[2] : 0, B ? 1 : 0);
    if (U.uRoomY) gl.uniform1f(U.uRoomY, B ? standingHeightAt(sc.w / 2, 1.5) : 0);
  }
  gl.uniform3fv(U.uFarTint, sc.farTint ? hexA(sc.farTint).map(v => v / 200) : [1, 1, 1]);
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
  twofold: 'pastel',
  festival: 'pastel',
  blossom: 'pastel',
  sporeholder: 'spore',
  marketcap: 'spore',
  hedgerow: 'meadow',
  longgrass: 'meadow',
  golf: 'meadow',
  ridge: 'hill',
  pass: 'hill',
  summit: 'cool',
  lake: 'cool',
  vintage: 'warm',
  bullion: 'warm',
  badlands: 'warm',
  flattax: 'warm',
  fall: 'warm',
  canyon: 'warm',
  farm: 'meadow',
};
function mapFlowers(sc) {
  const id = (sc && (sc.place || sc.baseId)) || '',
    k = FLOWER_SET_BY_LOCATION[id] || (sc && sc.kind === 'town' ? 'town' : 'meadow');
  return { c: FLOWER_COLORS[k].map(h => hexA(h).map(v => v / 255)), glow: k === 'spore' ? 0.55 : 0 };
}
export function drawGrass(C, X) {
  const gl = EGL.gl,
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
  gl.uniform1f(U.uT, RM ? 0 : walkView.t);
  gl.uniform1f(U.uWind, (sc.wind ?? 1) * eng('grass', 'wind'));
  gl.uniform1f(U.uGust, eng('grass', 'gusts'));
  gl.uniform1f(U.uBend, eng('grass', 'bend'));
  gl.uniform1f(U.uHK, eng('grass', 'height'));
  gl.uniform3f(U.uCut, C.eye[0], C.eye[2], walkRenderer.bt ? (walkRenderer.bt.cut ?? 3.2) : 0);
  const g = sc.grassCol || [eng('grass', 'low'), eng('grass', 'high')];
  gl.uniform3fv(
    U.uGlo,
    hexA(g[0]).map(v => v / 255)
  );
  gl.uniform3fv(
    U.uGhi,
    hexA(g[1]).map(v => v / 255)
  );
  if (U.uFol) gl.uniform2f(U.uFol, 0.75, 1);
  gl.disable(gl.CULL_FACE);
  const G = walkRenderer.grass;
  gl.bindVertexArray(G.vao);
  if (!G.chunks || !(eng('quality', 'cull') ?? true)) {
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
  if (RM || typeof walkView === 'undefined') return;
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
  const f = typeof LD !== 'undefined' && LD.el ? LD.f : 1,
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
  const gl = EGL.gl,
    p = useWalkProgram('sprite', C, X),
    U = p.U,
    P = walkView.pl,
    sc = walkView.sc,
    sun = X.sun;
  eglBindQuad();
  if (U.uWave) gl.uniform3f(U.uWave, 0, 0, 0);
  if (U.uSelOut) gl.uniform1f(U.uSelOut, eng('color', 'outlines') ?? 1);
  const sh = v3n([sun.dir[0], 0, sun.dir[2]]);
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
      sd[1] > 0.05 && (eng('shadows', 'selfShade') ?? 0.7) > 0
        ? (eng('shadows', 'selfShade') ?? 0.7) * eng('shadows', 'strength') * Math.min(1, sd[1] * 4)
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
    const T = eglImg(it.im);
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
      gl.uniform3fv(U.uRight, it.fixed ? (ro ? [cr, 0, sr] : FIXED_FACING) : C.right);
      gl.uniform3fv(U.uBack, it.fixed ? (ro ? [sr, 0, -cr] : FIXED_FACING_BACK) : C.back);
    }
    gl.uniform1f(U.uFixed, it.fixed && it.plane ? 1 : 0);
    gl.uniform1f(U.uFlipN, it.flip || 1);
    setPropLookUniforms(U, it.lk);
    const mt = EGL_MATS[it.mat] || EGL_MATS[it.person ? 'cloth' : 'plain'];
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
      eglBindGrid();
      gl.drawArrays(gl.TRIANGLES, 0, EGL.gridN);
      gl.uniform3f(U.uWave, 0, 0, 0);
      eglBindQuad();
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
        BT = eglImg(artImage(b.img));
      if (BT)
        drawRotatingBlades(p, it, b, BT, (RM ? 0 : walkView.t / 1100) * (sc.wind || 1) * eng('grass', 'wind'), C, X);
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
    const T = eglImg(it.im);
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
      c = cnv(w, h),
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
    const T = cnv(16, h),
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
      R = cnv(RW, K),
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
function drawBoxFaces(C, items, X) {
  const gl = EGL.gl;
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
      it.vol
    )
      continue;
    if (walkRenderer.bt && walkRenderer.bt.hide && walkRenderer.bt.hide.has(it.p)) continue;
    if (!BOX_INFO_CACHE.has(it.im) && !frameBudgetLeft()) continue;
    const B = boxInfo(it.im);
    if (!B) continue;
    if (!p) {
      p = useWalkProgram('face', C, X);
      eglBindQuad();
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
    const ST = eglImg(B.side, { noNormal: true }),
      RT = eglImg(B.roof, { noNormal: true });
    if (!ST || !RT) continue;
    const mat = EGL_MATS.building;
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
  const gl = EGL.gl,
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
    const T = eglImg(artImage(h.img));
    if (T) drawRotatingBlades(p, it, h, T, -((sec % h.per) / h.per) * Math.PI * 2, C, X, 0.06);
  }
}
/* v47: how far the camera tilts up for the landmarks near you: a thing marked "landmark" in the catalogue (the clock
   tower, the giant tree, the crane...) between 2 and 18 metres ahead and within 8 to the side, by how far its top
   rises above what the camera shows anyway (about 5 m); up to 11 degrees */
function landmarkTilt(P, sc) {
  if (!sc || sc.indoor || !P || RM) return 0;
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
  const gl = EGL.gl,
    fp = useWalkProgram('fx', C, X),
    U = fp.U,
    s = it.mpp,
    w = it.w * s,
    h = it.h * s,
    cx = it.x + (it.ox * s + w / 2) * it.flip,
    cz = it.z - (it.oy * s + h / 2) * 0.95;
  /* v22: lily pads on water bob and turn a little */ const wet = /lily/.test((it.p && it.p.k) || '') && !RM,
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
  gl.useProgram(EGL.P.sprite.p);
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
    if (typeof reqAsker === 'function' && it.f === reqAsker() && !(it.f.sayT > 0))
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
  const gl = EGL.gl,
    w = Math.max(32, rw >> 1),
    h = Math.max(32, rh >> 1),
    F = eglTarget('refl', w, h, { depth: true, hdr: true });
  gl.bindFramebuffer(gl.FRAMEBUFFER, F.f);
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const L = reflectionLevel(),
    mir = new Float32Array([1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 2 * L, 0, 1]),
    RC = Object.assign({}, C, { vp: M4.mul(C.vp, mir) });
  const p = useWalkProgram('sprite', RC, Object.assign({}, X, { shadow: null })),
    U = p.U;
  eglBindQuad();
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
    cut = eng('quality', 'cull') ?? true;
  for (const it of items) {
    if (it.flat || it.far) continue;
    if (!waterNear(it.x, it.z)) continue;
    if (cut && !it.person && !mirrorInView(FR, it, L)) continue;
    const T = eglImg(it.im);
    if (!T) continue;
    gl.uniform3fv(U.uRight, it.fixed ? FIXED_FACING : C.right);
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
  const t = (RM ? 0 : walkView.t || 0) / 1000,
    now = performance.now() / 1000,
    dt = Math.min(0.1, Math.max(0, now - (walkRenderer.wlT || now)));
  walkRenderer.wlT = now;
  const fish = new Float32Array(16),
    rings = new Float32Array(32);
  if (eng('water', 'fish'))
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
      /* v27: now and then one jumps clear of the water */ if (!walkRenderer.bt && !RM && Math.random() < dt * 0.012) {
        addRipple(x, z, 0.9);
        (walkRenderer.splash = walkRenderer.splash || []).push({
          x,
          z,
          y: walkRenderer.wlevelR ?? walkRenderer.wlevel ?? 0,
          a: 0,
        });
        if (typeof sfxAt === 'function') sfxAt('plop', x, z);
      }
    });
  if (eng('water', 'rings') && !walkRenderer.bt && !RM) {
    if (typeof LIFE !== 'undefined')
      for (const c of LIFE.list || [])
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
  const gl = EGL.gl;
  if (!U.uKD) return;
  gl.uniform3fv(U.uKD, WATER_KIND_UNIFORMS.D);
  gl.uniform3fv(U.uKS, WATER_KIND_UNIFORMS.S);
  gl.uniform4fv(U.uKA, WATER_KIND_UNIFORMS.A);
  gl.uniform4fv(U.uKB, WATER_KIND_UNIFORMS.B);
  gl.uniform1f(U.uCaus, eng('water', 'caustics'));
  gl.uniform1f(U.uClar, eng('water', 'clarity'));
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
  const gl = EGL.gl,
    p = useWalkProgram('water', C, X),
    U = p.U,
    sc = walkView.sc,
    sky = skyColors(sc);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, walkRenderer.water && EGL.fb.refl ? EGL.fb.refl.c : EGL.white);
  gl.uniform1i(U.uRefl, 0);
  gl.uniform2f(U.uRes, rw, rh);
  gl.uniform3fv(U.uDeep, engHex('water', 'deep', '#1D4F78'));
  gl.uniform3fv(U.uShallow, engHex('water', 'shallow', '#4FA6C0'));
  gl.uniform3fv(U.uSkyR, sky[1]);
  gl.uniform1f(U.uReflK, eng('water', 'reflection'));
  gl.uniform1f(U.uRip, eng('water', 'ripples'));
  gl.uniform1f(U.uFoam, eng('water', 'foam'));
  gl.uniform1f(U.uGlint, eng('water', 'glints'));
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
    gl.uniform3fv(f.U.uShallow, engHex('water', 'shallow', '#4FA6C0'));
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
    st = environmentState(environmentHere() || walkView.sc);
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
    c = cnv(N, N),
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
  const c = cnv(14, 18),
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
  if (!sc.room || (eng('lights', 'roomLight') ?? true) === false) return;
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
  if (!sc.room || (eng('lights', 'roomLight') ?? true) === false) return;
  const gl = EGL.gl,
    R = roomSkyLight(),
    gk = eng('lights', 'glow'),
    ws = windowLightShare(sc);
  const draw = (cv, x, y, z, r, u, sw, sh, col, a) => {
    const T = eglImg(cv, { noNormal: true });
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
  if (!sc.room || (eng('lights', 'roomLight') ?? true) === false) return;
  const B = roomBoxOf(sc);
  if (!B) return;
  const gl = EGL.gl;
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
    const wc = hexA((sc.wallCol || [])[10] || '#D9B79C'),
      c = cnv(1, 32),
      x = c.getContext('2d'),
      rows = 32,
      top = Math.round((hw / (hw + deep)) * rows);
    for (let i = 0; i < rows; i++) {
      const k =
        i < 1 ? 1.4 : i < top ? 1.2 : i < top + 1 ? 0.35 : Math.max(0.05, 0.24 * (1 - (i - top) / (rows - top)));
      x.fillStyle = `rgb(${(wc[0] * k) | 0},${(wc[1] * k) | 0},${(wc[2] * k) | 0})`;
      x.fillRect(0, i, 1, 1);
    }
    const t = cnv(4, 4),
      tx = t.getContext('2d');
    tx.fillStyle = '#6A5848';
    tx.fillRect(0, 0, 4, 4);
    tx.fillStyle = '#8A7662';
    tx.fillRect(0, 0, 4, 1);
    walkRenderer.frontTex = [c, t];
  }
  const F = eglImg(walkRenderer.frontTex[0], { noNormal: true }),
    T = eglImg(walkRenderer.frontTex[1], { noNormal: true });
  if (!F || !T) return;
  const p = useWalkProgram('face', C, X);
  eglBindQuad();
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
  if (typeof P3D_PARTS === 'undefined' || (eng('water', 'fountains') ?? true) === false) {
    updateBasinMeshes(L);
    return;
  }
  for (const it of items) {
    if (it.k !== 'prop' || !it.vol || it.far || it.layer || !it.p) continue;
    const parts = (it.M && it.M.parts) || P3D_PARTS[it.p.k];
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
  eglFree(walkRenderer.basin);
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
  walkRenderer.basin = eglMesh(
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
  const gl = EGL.gl,
    E = environment,
    BT = walkRenderer.bt,
    P = BT ? { x: BT.center[0], z: BT.center[1] } : walkView.pl,
    k = eng('air', 'weather') * (walkView.R < 0.75 ? 0.5 : 1);
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
  const lean = v3n([wind * 0.22, 1, 0]);
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
  if (rain > 0 && walkRenderer.wgrid && !RM && Math.random() < dt * rain * 18) {
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
    gl = EGL.gl;
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
  if (typeof LIFE !== 'undefined')
    for (const c of LIFE.list) {
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
    E = typeof environment !== 'undefined' && ENG_CTX.env ? environment : null,
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
    const W = (sc.wind || 1) * (0.7 + eglWind(P.x, P.z, t * rm)),
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
  const gl = EGL.gl,
    p = useWalkProgram('fx', C, X),
    U = p.U,
    sc = walkView.sc,
    C0 = walkData().sc,
    rm = RM ? 0 : 1,
    R = C.right,
    Up = [0, 1, 0],
    lb = eng('lights', 'brightness'),
    gk = eng('lights', 'glow'),
    winDay = eng('lights', 'windowsDay'),
    flick = eng('lights', 'flicker');
  eglBindQuad();
  gl.uniform3fv(U.uRight, R);
  gl.uniform3fv(U.uUp, Up);
  gl.uniform1i(U.uTex, 0);
  gl.uniform1f(U.uLitFx, 1);
  gl.activeTexture(gl.TEXTURE0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);
  gl.enable(gl.DEPTH_TEST);
  const fxT = k => eglImg(artImage(`scene/fx/${k}.png`), { noNormal: true }),
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
      RR && typeof environment !== 'undefined' && ENG_CTX.env
        ? environment.lampK || 0
        : 0; /* v46: lamps and windows outside a room laid into the place keep the outdoor hour */
  for (const it of items) {
    if (it.k !== 'prop' || it.far || it.layer) continue;
    const s = it.mpp,
      chim = it.bld3 && typeof bldSmoke === 'function' ? bldSmoke(it) : null,
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
        if (it.bld3 && !(sc.room && !out) && BLD.mesh.get(it.p)) return;
        const RS = sc.room && !out ? roomSkyLight() : null;
        let k = RS ? RS.I * (1 - RS.night) * 0.9 * windowLightShare(sc) : dark ? 1 : winDay;
        if (
          !RS &&
          typeof environmentWindowLit === 'function' &&
          typeof environment !== 'undefined' &&
          ENG_CTX.env &&
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
      const E = BLD.mesh.get(it.p);
      if (E && E.fw) {
        const lf = bldLitF(),
          k = dIt ? 1 : winDay,
          fl = 1 - flick * 0.1 + flick * 0.1 * Math.sin(t / 230 + it.x);
        if (k > 0.02)
          for (const f of E.fw) {
            const w = bldWinLit(f[3], lf);
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
        c = hexA(g.c).map(v => v / 255),
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
  if (!sc.indoor && eng('air', 'particles') > 0) {
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
        bx = p.x + Math.sin(ph * 9 + i) * 0.55 + ph * (0.6 + eglWind(p.x, p.z, t * rm) * 0.5) * (sc.wind || 1),
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
  if (walkRenderer.streamCells && walkRenderer.streamCells.length && eng('water', 'leaves') && !walkRenderer.bt) {
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
  if (walkRenderer.springCells && walkRenderer.springCells.length && eng('water', 'steam')) {
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
  if (ENG_CTX.env && !sc.indoor && eng('air', 'weather') > 0) drawWeather(quad, glows, U, R, Up, dt, rm);
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
        const T = eglImg(q.im, { noNormal: true });
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
