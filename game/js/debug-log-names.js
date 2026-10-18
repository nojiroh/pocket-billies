// Phase 04d: made by tools/to-module.mjs (npm run modules), do not edit. What the debug log (debug-log.js, a classic
// script that runs before the modules) reads and wraps in the game's modules: a getter for each name in its GAME
// object, and a setter (the module's own) for each function it wraps. The last module of the game's page.
import { GD, ROUTE } from './game-data.js';
import { B, S, U, save, setSave, setSetTrip, setTrip } from './game-state.js';
import { FRAME, userFps } from './frame-scheduler.js';
import { artPixels, setArtPixels } from './art.js';
import { TR_CACHE, humanFrames, setHumanFrames } from './person-art.js';
import { openDressing, setOpenDressing } from './dressing-room.js';
import { SC, scResize, scStart, setScResize, setScStart } from './battle-stage.js';
import {
  dioFolkTick,
  dioPlayer,
  dioPrepare,
  setDioFolkTick,
  setDioPlayer,
  setDioPrepare,
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
import { ENV } from './environment.js';
import {
  DGL,
  dglBuildGrass,
  dglFxPass,
  dglGrass,
  dglGrassWork,
  dglGround,
  dglGroundAO,
  dglItems,
  dglReflPass,
  dglRingUpdate,
  dglShadowPass,
  dglSprites,
  dglWater,
  dioMount,
  setDglBuildGrass,
  setDglFxPass,
  setDglGrass,
  setDglGrassWork,
  setDglGround,
  setDglGroundAO,
  setDglItems,
  setDglReflPass,
  setDglRingUpdate,
  setDglShadowPass,
  setDglSprites,
  setDglWater,
  setDioMount,
} from './walk-view-gl.js';
import { BLD, bldDraw, bldItems, setBldDraw, setBldItems } from './buildings.js';
import { P3D, p3dBuild, p3dDraw, p3dTreeBuild, setP3dBuild, setP3dDraw, setP3dTreeBuild } from './solid-props.js';
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
import { mapMount, setMapMount } from './world-map.js';
import { mglRender, mmBuild, setMglRender, setMmBuild } from './world-map-gl.js';
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
  BLD: { get: () => BLD },
  DGL: { get: () => DGL },
  EGL: { get: () => EGL },
  EGL_NW: { get: () => EGL_NW },
  ENV: { get: () => ENV },
  FRAME: { get: () => FRAME },
  GD: { get: () => GD },
  LIFE: { get: () => LIFE },
  P3D: { get: () => P3D },
  ROUTE: { get: () => ROUTE },
  S: { get: () => S },
  SC: { get: () => SC },
  TR_CACHE: { get: () => TR_CACHE },
  U: { get: () => U },
  areaKey: { get: () => areaKey },
  artPixels: { get: () => artPixels, set: setArtPixels },
  bldDraw: { get: () => bldDraw, set: setBldDraw },
  bldItems: { get: () => bldItems, set: setBldItems },
  chalToday: { get: () => chalToday },
  csStart: { get: () => csStart, set: setCsStart },
  dglBuildGrass: { get: () => dglBuildGrass, set: setDglBuildGrass },
  dglFxPass: { get: () => dglFxPass, set: setDglFxPass },
  dglGrass: { get: () => dglGrass, set: setDglGrass },
  dglGrassWork: { get: () => dglGrassWork, set: setDglGrassWork },
  dglGround: { get: () => dglGround, set: setDglGround },
  dglGroundAO: { get: () => dglGroundAO, set: setDglGroundAO },
  dglItems: { get: () => dglItems, set: setDglItems },
  dglReflPass: { get: () => dglReflPass, set: setDglReflPass },
  dglRingUpdate: { get: () => dglRingUpdate, set: setDglRingUpdate },
  dglShadowPass: { get: () => dglShadowPass, set: setDglShadowPass },
  dglSprites: { get: () => dglSprites, set: setDglSprites },
  dglWater: { get: () => dglWater, set: setDglWater },
  dioFolkTick: { get: () => dioFolkTick, set: setDioFolkTick },
  dioMount: { get: () => dioMount, set: setDioMount },
  dioPlayer: { get: () => dioPlayer, set: setDioPlayer },
  dioPrepare: { get: () => dioPrepare, set: setDioPrepare },
  eglFinish: { get: () => eglFinish, set: setEglFinish },
  eglNormWork: { get: () => eglNormWork, set: setEglNormWork },
  eglNormal: { get: () => eglNormal, set: setEglNormal },
  eglPost: { get: () => eglPost, set: setEglPost },
  eglPrograms: { get: () => eglPrograms, set: setEglPrograms },
  endBattle: { get: () => endBattle, set: setEndBattle },
  humanFrames: { get: () => humanFrames, set: setHumanFrames },
  lifeStep: { get: () => lifeStep, set: setLifeStep },
  mapMount: { get: () => mapMount, set: setMapMount },
  mglRender: { get: () => mglRender, set: setMglRender },
  mmBuild: { get: () => mmBuild, set: setMmBuild },
  newBattle: { get: () => newBattle, set: setNewBattle },
  openBattle: { get: () => openBattle, set: setOpenBattle },
  openDressing: { get: () => openDressing, set: setOpenDressing },
  openShop: { get: () => openShop, set: setOpenShop },
  p3dBuild: { get: () => p3dBuild, set: setP3dBuild },
  p3dDraw: { get: () => p3dDraw, set: setP3dDraw },
  p3dTreeBuild: { get: () => p3dTreeBuild, set: setP3dTreeBuild },
  paintActions: { get: () => paintActions, set: setPaintActions },
  pwState: { get: () => pwState },
  render: { get: () => render, set: setRender },
  renderOv: { get: () => renderOv, set: setRenderOv },
  save: { get: () => save, set: setSave },
  scResize: { get: () => scResize, set: setScResize },
  scStart: { get: () => scStart, set: setScStart },
  setTrip: { get: () => setTrip, set: setSetTrip },
  stampCount: { get: () => stampCount },
  toast: { get: () => toast },
  userFps: { get: () => userFps },
  walkView: { get: () => walkView },
});
