// Phase 04d: made by tools/to-module.mjs (npm run modules), do not edit. What the debug log (debug-log.js, a classic
// script that runs before the modules) reads and wraps in the game's modules: a getter for each name in its GAME
// object, and a setter (the module's own) for each function it wraps. The last module of the game's page.
import { GD, ROUTE } from './game-data.js';
import { B, S, U, save, setSave, setSetTrip, setTrip } from './game-state.js';
import { FRAME, userFps } from './frame-scheduler.js';
import { artPixels, setArtPixels } from './art.js';
import { TR_CACHE, humanFrames, setHumanFrames } from './person-art.js';
import { openDressing, setOpenDressing } from './dressing-room.js';
import {
  battleStage,
  battleStageResize,
  battleStageStart,
  setBattleStageResize,
  setBattleStageStart,
} from './battle-stage.js';
import {
  prepareMap,
  setPrepareMap,
  setUpdateFolk,
  setUpdatePlayer,
  updateFolk,
  updatePlayer,
  walkView,
} from './walk-view.js';
import {
  EGL,
  EGL_NW,
  eglFinish,
  eglNormWork,
  eglNormal,
  eglPrograms,
  setEglFinish,
  setEglNormWork,
  setEglNormal,
  setEglPrograms,
} from './engine/webgl.js';
import { eglPost, setEglPost } from './engine/post-effects.js';
import { environment } from './environment.js';
import {
  buildGrass,
  drawGrass,
  drawGround,
  drawSprites,
  drawWater,
  effectsPass,
  gatherFrameItems,
  grassWork,
  groundOcclusion,
  mountWalkView,
  reflectionPass,
  setBuildGrass,
  setDrawGrass,
  setDrawGround,
  setDrawSprites,
  setDrawWater,
  setEffectsPass,
  setGatherFrameItems,
  setGrassWork,
  setGroundOcclusion,
  setMountWalkView,
  setReflectionPass,
  setShadowPass,
  setUpdateNearRing,
  shadowPass,
  updateNearRing,
  walkRenderer,
} from './walk-view-gl.js';
import { bldDraw, bldItems, buildingState, setBldDraw, setBldItems } from './buildings.js';
import {
  buildSolidProp,
  buildSolidTree,
  drawSolidProps,
  setBuildSolidProp,
  setBuildSolidTree,
  setDrawSolidProps,
  solidPropState,
} from './solid-props.js';
import { LIFE, lifeStep, setLifeStep } from './ambient-life.js';
import { pwState } from './ground-paint-worker.js';
import {
  areaKey,
  endBattle,
  newBattle,
  openBattle,
  paintActions,
  setEndBattle,
  setNewBattle,
  setOpenBattle,
  setPaintActions,
} from './battle.js';
import { setWorldMapMount, worldMapMount } from './world-map.js';
import { setWorldMapGlRender, setWorldMapMiniBuild, worldMapGlRender, worldMapMiniBuild } from './world-map-gl.js';
import { openShop, setOpenShop } from './shop.js';
import { AMB, AUD } from './sound.js';
import { csStart, setCsStart } from './cutscene.js';
import { ACC } from './account.js';
import { chalToday, stampCount } from './things-to-do.js';
import { render, renderOv, setRender, setRenderOv, toast } from './ui.js';
Object.defineProperties(GAME, {
  ACC: { get: () => ACC },
  AMB: { get: () => AMB },
  AUD: { get: () => AUD },
  B: { get: () => B },
  EGL: { get: () => EGL },
  EGL_NW: { get: () => EGL_NW },
  FRAME: { get: () => FRAME },
  GD: { get: () => GD },
  LIFE: { get: () => LIFE },
  ROUTE: { get: () => ROUTE },
  S: { get: () => S },
  TR_CACHE: { get: () => TR_CACHE },
  U: { get: () => U },
  areaKey: { get: () => areaKey },
  artPixels: { get: () => artPixels, set: setArtPixels },
  battleStage: { get: () => battleStage },
  battleStageResize: { get: () => battleStageResize, set: setBattleStageResize },
  battleStageStart: { get: () => battleStageStart, set: setBattleStageStart },
  bldDraw: { get: () => bldDraw, set: setBldDraw },
  bldItems: { get: () => bldItems, set: setBldItems },
  buildGrass: { get: () => buildGrass, set: setBuildGrass },
  buildSolidProp: { get: () => buildSolidProp, set: setBuildSolidProp },
  buildSolidTree: { get: () => buildSolidTree, set: setBuildSolidTree },
  buildingState: { get: () => buildingState },
  chalToday: { get: () => chalToday },
  csStart: { get: () => csStart, set: setCsStart },
  drawGrass: { get: () => drawGrass, set: setDrawGrass },
  drawGround: { get: () => drawGround, set: setDrawGround },
  drawSolidProps: { get: () => drawSolidProps, set: setDrawSolidProps },
  drawSprites: { get: () => drawSprites, set: setDrawSprites },
  drawWater: { get: () => drawWater, set: setDrawWater },
  effectsPass: { get: () => effectsPass, set: setEffectsPass },
  eglFinish: { get: () => eglFinish, set: setEglFinish },
  eglNormWork: { get: () => eglNormWork, set: setEglNormWork },
  eglNormal: { get: () => eglNormal, set: setEglNormal },
  eglPost: { get: () => eglPost, set: setEglPost },
  eglPrograms: { get: () => eglPrograms, set: setEglPrograms },
  endBattle: { get: () => endBattle, set: setEndBattle },
  environment: { get: () => environment },
  gatherFrameItems: { get: () => gatherFrameItems, set: setGatherFrameItems },
  grassWork: { get: () => grassWork, set: setGrassWork },
  groundOcclusion: { get: () => groundOcclusion, set: setGroundOcclusion },
  humanFrames: { get: () => humanFrames, set: setHumanFrames },
  lifeStep: { get: () => lifeStep, set: setLifeStep },
  mountWalkView: { get: () => mountWalkView, set: setMountWalkView },
  newBattle: { get: () => newBattle, set: setNewBattle },
  openBattle: { get: () => openBattle, set: setOpenBattle },
  openDressing: { get: () => openDressing, set: setOpenDressing },
  openShop: { get: () => openShop, set: setOpenShop },
  paintActions: { get: () => paintActions, set: setPaintActions },
  prepareMap: { get: () => prepareMap, set: setPrepareMap },
  pwState: { get: () => pwState },
  reflectionPass: { get: () => reflectionPass, set: setReflectionPass },
  render: { get: () => render, set: setRender },
  renderOv: { get: () => renderOv, set: setRenderOv },
  save: { get: () => save, set: setSave },
  setTrip: { get: () => setTrip, set: setSetTrip },
  shadowPass: { get: () => shadowPass, set: setShadowPass },
  solidPropState: { get: () => solidPropState },
  stampCount: { get: () => stampCount },
  toast: { get: () => toast },
  updateFolk: { get: () => updateFolk, set: setUpdateFolk },
  updateNearRing: { get: () => updateNearRing, set: setUpdateNearRing },
  updatePlayer: { get: () => updatePlayer, set: setUpdatePlayer },
  userFps: { get: () => userFps },
  walkRenderer: { get: () => walkRenderer },
  walkView: { get: () => walkView },
  worldMapGlRender: { get: () => worldMapGlRender, set: setWorldMapGlRender },
  worldMapMiniBuild: { get: () => worldMapMiniBuild, set: setWorldMapMiniBuild },
  worldMapMount: { get: () => worldMapMount, set: setWorldMapMount },
});
