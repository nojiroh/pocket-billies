// Phase 04d: made by tools/to-module.mjs (npm run modules), do not edit. What the debug log (debug-log.js, a classic
// script that runs before the modules) reads and wraps in the game's modules: a getter for each name in its GAME
// object, and a setter (the module's own) for each function it wraps. The last module of the game's page.
import { LOCATIONS, gameData } from './game-data.js';
import { activeBattle, save, saveData, setSave, setSetTrip, setTrip, uiState } from './game-state.js';
import { FRAME, userFps } from './frame-scheduler.js';
import { artPixels, setArtPixels } from './art.js';
import { TR_CACHE, humanFrames, setHumanFrames } from './person-art.js';
import { openDressingRoom, setOpenDressingRoom } from './dressing-room.js';
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
import { drawPostEffects, setDrawPostEffects } from './engine/post-effects.js';
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
import { buildingItems, buildingState, drawBuildings, setBuildingItems, setDrawBuildings } from './buildings.js';
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
import { paintWorkerReport } from './ground-paint-worker.js';
import {
  battleStageKey,
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
import { cutsceneStart, setCutsceneStart } from './cutscene.js';
import { account } from './account.js';
import { chalToday, stampCount } from './things-to-do.js';
import { render, renderOverlay, setRender, setRenderOverlay, toast } from './ui.js';
Object.defineProperties(GAME, {
  AMB: { get: () => AMB },
  AUD: { get: () => AUD },
  FRAME: { get: () => FRAME },
  LIFE: { get: () => LIFE },
  LOCATIONS: { get: () => LOCATIONS },
  TR_CACHE: { get: () => TR_CACHE },
  account: { get: () => account },
  activeBattle: { get: () => activeBattle },
  artPixels: { get: () => artPixels, set: setArtPixels },
  battleStage: { get: () => battleStage },
  battleStageKey: { get: () => battleStageKey },
  battleStageResize: { get: () => battleStageResize, set: setBattleStageResize },
  battleStageStart: { get: () => battleStageStart, set: setBattleStageStart },
  buildGrass: { get: () => buildGrass, set: setBuildGrass },
  buildSolidProp: { get: () => buildSolidProp, set: setBuildSolidProp },
  buildSolidTree: { get: () => buildSolidTree, set: setBuildSolidTree },
  buildingItems: { get: () => buildingItems, set: setBuildingItems },
  buildingState: { get: () => buildingState },
  chalToday: { get: () => chalToday },
  cutsceneStart: { get: () => cutsceneStart, set: setCutsceneStart },
  drawBuildings: { get: () => drawBuildings, set: setDrawBuildings },
  drawGrass: { get: () => drawGrass, set: setDrawGrass },
  drawGround: { get: () => drawGround, set: setDrawGround },
  drawPostEffects: { get: () => drawPostEffects, set: setDrawPostEffects },
  drawSolidProps: { get: () => drawSolidProps, set: setDrawSolidProps },
  drawSprites: { get: () => drawSprites, set: setDrawSprites },
  drawWater: { get: () => drawWater, set: setDrawWater },
  effectsPass: { get: () => effectsPass, set: setEffectsPass },
  endBattle: { get: () => endBattle, set: setEndBattle },
  ensurePrograms: { get: () => ensurePrograms, set: setEnsurePrograms },
  environment: { get: () => environment },
  finishProgramCompile: { get: () => finishProgramCompile, set: setFinishProgramCompile },
  gameData: { get: () => gameData },
  gatherFrameItems: { get: () => gatherFrameItems, set: setGatherFrameItems },
  gpuState: { get: () => gpuState },
  grassWork: { get: () => grassWork, set: setGrassWork },
  groundOcclusion: { get: () => groundOcclusion, set: setGroundOcclusion },
  humanFrames: { get: () => humanFrames, set: setHumanFrames },
  lifeStep: { get: () => lifeStep, set: setLifeStep },
  makeNormalMap: { get: () => makeNormalMap, set: setMakeNormalMap },
  mountWalkView: { get: () => mountWalkView, set: setMountWalkView },
  newBattle: { get: () => newBattle, set: setNewBattle },
  normalMapWorkerState: { get: () => normalMapWorkerState },
  openBattle: { get: () => openBattle, set: setOpenBattle },
  openDressingRoom: { get: () => openDressingRoom, set: setOpenDressingRoom },
  openShop: { get: () => openShop, set: setOpenShop },
  paintActions: { get: () => paintActions, set: setPaintActions },
  paintWorkerReport: { get: () => paintWorkerReport },
  prepareMap: { get: () => prepareMap, set: setPrepareMap },
  reflectionPass: { get: () => reflectionPass, set: setReflectionPass },
  render: { get: () => render, set: setRender },
  renderOverlay: { get: () => renderOverlay, set: setRenderOverlay },
  runNormalMapJobs: { get: () => runNormalMapJobs, set: setRunNormalMapJobs },
  save: { get: () => save, set: setSave },
  saveData: { get: () => saveData },
  setTrip: { get: () => setTrip, set: setSetTrip },
  shadowPass: { get: () => shadowPass, set: setShadowPass },
  solidPropState: { get: () => solidPropState },
  stampCount: { get: () => stampCount },
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
