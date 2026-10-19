// Phase 04d: made by tools/to-module.mjs (npm run modules), do not edit. What the debug log (debug-log.js, a classic
// script that runs before the modules) reads and wraps in the game's modules: a getter for each name in its GAME
// object, and a setter (the module's own) for each function it wraps. The last module of the game's page.
import { LOCATIONS, gameData } from './game-data.js';
import { encountersHere, setSetTrip, setTrip } from './logic/rules.js';
import { battleStageKey, newBattle, setNewBattle } from './logic/battle-engine.js';
import { activeBattle, save, saveData, setSave, uiState } from './game-state.js';
import { gpuCountSummary, gpuCounters } from './engine/gpu-counters.js';
import { frameScheduler, userFps } from './frame-scheduler.js';
import { artPixels, setArtPixels } from './art.js';
import { PERSON_ART_CACHE, personBattleFrames, setPersonBattleFrames } from './person-art.js';
import { openDressingRoom, setOpenDressingRoom } from './dressing-room.js';
import {
  battleStage,
  battleStageResize,
  battleStageStart,
  setBattleStageResize,
  setBattleStageStart,
} from './battle-stage.js';
import {
  navGrid,
  prepareMap,
  setNavGrid,
  setPrepareMap,
  setUpdateFolk,
  setUpdatePlayer,
  updateFolk,
  updatePlayer,
  walkView,
} from './walk-view.js';
import {
  ensurePrograms,
  finishProgramCompile,
  gpuState,
  makeNormalMap,
  normalMapWorkerState,
  runNormalMapJobs,
  setEnsurePrograms,
  setFinishProgramCompile,
  setMakeNormalMap,
  setRunNormalMapJobs,
} from './engine/webgl.js';
import { drawPostEffects, screenSnapshot, setDrawPostEffects, setScreenSnapshot } from './engine/post-effects.js';
import { environment } from './environment.js';
import { walkRenderer } from './walk/walk-state.js';
import { groundOcclusion, setGroundOcclusion } from './walk/ground-textures.js';
import { buildGrass, grassWork, setBuildGrass, setGrassWork } from './walk/grass-build.js';
import { buildGroundMesh, setBuildGroundMesh } from './walk/ground-mesh.js';
import { setSwapMapCache, setUpdateNearRing, swapMapCache, updateNearRing } from './walk/map-cache.js';
import {
  drawBoxFaces,
  drawGrass,
  drawGround,
  drawSprites,
  drawWater,
  effectsPass,
  gatherFrameItems,
  mountWalkView,
  reflectionPass,
  setDrawBoxFaces,
  setDrawGrass,
  setDrawGround,
  setDrawSprites,
  setDrawWater,
  setEffectsPass,
  setGatherFrameItems,
  setMountWalkView,
  setReflectionPass,
  setShadowPass,
  shadowPass,
} from './walk-view-gl.js';
import { buildingItems, buildingState, drawBuildings, setBuildingItems, setDrawBuildings } from './buildings.js';
import { drawStructures, setDrawStructures } from './structures.js';
import {
  buildSolidProp,
  buildSolidTree,
  drawSolidProps,
  setBuildSolidProp,
  setBuildSolidTree,
  setDrawSolidProps,
  solidPropState,
} from './solid-props.js';
import { drawPropModels, setDrawPropModels } from './prop-models.js';
import { ambientLife, lifeStep, setLifeStep } from './ambient-life.js';
import { paintWorkerReport } from './ground-paint-worker.js';
import { endBattle, openBattle, paintActions, setEndBattle, setOpenBattle, setPaintActions } from './battle.js';
import { setWorldMapMount, worldMapMount } from './world-map.js';
import { setWorldMapGlRender, setWorldMapMiniBuild, worldMapGlRender, worldMapMiniBuild } from './world-map-gl.js';
import { openShop, setOpenShop } from './shop.js';
import { ambience, soundEngine } from './sound.js';
import { cutsceneStart, setCutsceneStart } from './cutscene.js';
import { account } from './account.js';
import { challengesToday, stampCount } from './things-to-do.js';
import { render, renderOverlay, setRender, setRenderOverlay, toast } from './ui.js';
Object.defineProperties(GAME, {
  LOCATIONS: { get: () => LOCATIONS },
  PERSON_ART_CACHE: { get: () => PERSON_ART_CACHE },
  account: { get: () => account },
  activeBattle: { get: () => activeBattle },
  ambience: { get: () => ambience },
  ambientLife: { get: () => ambientLife },
  artPixels: { get: () => artPixels, set: setArtPixels },
  battleStage: { get: () => battleStage },
  battleStageKey: { get: () => battleStageKey },
  battleStageResize: { get: () => battleStageResize, set: setBattleStageResize },
  battleStageStart: { get: () => battleStageStart, set: setBattleStageStart },
  buildGrass: { get: () => buildGrass, set: setBuildGrass },
  buildGroundMesh: { get: () => buildGroundMesh, set: setBuildGroundMesh },
  buildSolidProp: { get: () => buildSolidProp, set: setBuildSolidProp },
  buildSolidTree: { get: () => buildSolidTree, set: setBuildSolidTree },
  buildingItems: { get: () => buildingItems, set: setBuildingItems },
  buildingState: { get: () => buildingState },
  challengesToday: { get: () => challengesToday },
  cutsceneStart: { get: () => cutsceneStart, set: setCutsceneStart },
  drawBoxFaces: { get: () => drawBoxFaces, set: setDrawBoxFaces },
  drawBuildings: { get: () => drawBuildings, set: setDrawBuildings },
  drawGrass: { get: () => drawGrass, set: setDrawGrass },
  drawGround: { get: () => drawGround, set: setDrawGround },
  drawPostEffects: { get: () => drawPostEffects, set: setDrawPostEffects },
  drawPropModels: { get: () => drawPropModels, set: setDrawPropModels },
  drawSolidProps: { get: () => drawSolidProps, set: setDrawSolidProps },
  drawSprites: { get: () => drawSprites, set: setDrawSprites },
  drawStructures: { get: () => drawStructures, set: setDrawStructures },
  drawWater: { get: () => drawWater, set: setDrawWater },
  effectsPass: { get: () => effectsPass, set: setEffectsPass },
  encountersHere: { get: () => encountersHere },
  endBattle: { get: () => endBattle, set: setEndBattle },
  ensurePrograms: { get: () => ensurePrograms, set: setEnsurePrograms },
  environment: { get: () => environment },
  finishProgramCompile: { get: () => finishProgramCompile, set: setFinishProgramCompile },
  frameScheduler: { get: () => frameScheduler },
  gameData: { get: () => gameData },
  gatherFrameItems: { get: () => gatherFrameItems, set: setGatherFrameItems },
  gpuCountSummary: { get: () => gpuCountSummary },
  gpuCounters: { get: () => gpuCounters },
  gpuState: { get: () => gpuState },
  grassWork: { get: () => grassWork, set: setGrassWork },
  groundOcclusion: { get: () => groundOcclusion, set: setGroundOcclusion },
  lifeStep: { get: () => lifeStep, set: setLifeStep },
  makeNormalMap: { get: () => makeNormalMap, set: setMakeNormalMap },
  mountWalkView: { get: () => mountWalkView, set: setMountWalkView },
  navGrid: { get: () => navGrid, set: setNavGrid },
  newBattle: { get: () => newBattle, set: setNewBattle },
  normalMapWorkerState: { get: () => normalMapWorkerState },
  openBattle: { get: () => openBattle, set: setOpenBattle },
  openDressingRoom: { get: () => openDressingRoom, set: setOpenDressingRoom },
  openShop: { get: () => openShop, set: setOpenShop },
  paintActions: { get: () => paintActions, set: setPaintActions },
  paintWorkerReport: { get: () => paintWorkerReport },
  personBattleFrames: { get: () => personBattleFrames, set: setPersonBattleFrames },
  prepareMap: { get: () => prepareMap, set: setPrepareMap },
  reflectionPass: { get: () => reflectionPass, set: setReflectionPass },
  render: { get: () => render, set: setRender },
  renderOverlay: { get: () => renderOverlay, set: setRenderOverlay },
  runNormalMapJobs: { get: () => runNormalMapJobs, set: setRunNormalMapJobs },
  save: { get: () => save, set: setSave },
  saveData: { get: () => saveData },
  screenSnapshot: { get: () => screenSnapshot, set: setScreenSnapshot },
  setTrip: { get: () => setTrip, set: setSetTrip },
  shadowPass: { get: () => shadowPass, set: setShadowPass },
  solidPropState: { get: () => solidPropState },
  soundEngine: { get: () => soundEngine },
  stampCount: { get: () => stampCount },
  swapMapCache: { get: () => swapMapCache, set: setSwapMapCache },
  toast: { get: () => toast },
  uiState: { get: () => uiState },
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
