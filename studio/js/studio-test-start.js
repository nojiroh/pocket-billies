'use strict';
/* ================= STUDIO SELF-TEST: the start (studio track ST-T) =================
   Check → Run the Studio test, and studio/?selftest (it starts once the data has loaded). The test itself
   (studio-test.js) loads only now, and gets what it reads from here: the Studio's own functions and state, and of
   the GitHub sign-in only whether it is on (never the token or the name). docs/phases/studio-self-test.md. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { $ } from '../../game/js/util.js';
import { sheetIslands } from '../../game/js/logic/sheet-slice.js';
import { mapgenParams, mapgenScene } from '../../game/js/logic/mapgen.js';
import { gpuCountBegin, gpuCountEnd } from '../../game/js/engine/gpu-counters.js';
import { frameScheduler } from '../../game/js/frame-scheduler.js';
import { gpuState } from '../../game/js/engine/webgl.js';
import { escapeHtml } from './game-stand-ins.js';
import {
  HISTORY_STEPS,
  historyBytes,
  historyDiff,
  historyPartsBytes,
  historyPartsData,
} from '../../game/js/logic/history.js';
import {
  ACTIONS,
  PANE2_REFUSED,
  SECTIONS,
  SECTION_LIST,
  api,
  commit,
  openSection,
  redo,
  restore,
  saveAll,
  setApi,
  setSaveAll,
  snapshot,
  snapshotParts,
  studioBroadcast,
  studioProbe,
  studioState,
  toast,
  undo,
  updateTopBar,
} from './studio-app.js';
import { openPixelEditor } from './sprites.js';
import { runCheck } from './check.js';
import { openSkeleton } from './skeleton.js';
import { sceneryCatalog } from './map-editor.js';
import { buildSearchIndex, findRun } from './find.js';
import { connectionsHTML } from './connections.js';
import { githubMode } from './github.js';
import { musicPlay, musicPlaying, musicStop, musicStudio } from './music-editor.js';
/* eslint-disable no-func-assign */
expose({
  startStudioTest: [() => startStudioTest, v => (startStudioTest = v)],
  studioTestHandles: [() => studioTestHandles, v => (studioTestHandles = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* the names the test reads: the tool writes their imports above */
function studioTestHandles() {
  return {
    studioState,
    studioProbe,
    SECTIONS,
    SECTION_LIST,
    PANE2_REFUSED,
    ACTIONS,
    HISTORY_STEPS,
    openSection,
    undo,
    redo,
    commit,
    snapshot,
    snapshotParts,
    historyDiff,
    historyPartsData,
    historyBytes,
    historyPartsBytes,
    restore,
    api,
    setApi,
    saveAll,
    setSaveAll,
    toast,
    updateTopBar,
    studioBroadcast,
    escapeHtml,
    runCheck,
    buildSearchIndex,
    findRun,
    connectionsHTML,
    openPixelEditor,
    openSkeleton,
    mapgenScene,
    mapgenParams,
    sceneryCatalog,
    sheetIslands,
    gpuCountBegin,
    gpuCountEnd,
    gpuState,
    frameScheduler,
    musicPlay,
    musicStop,
    musicPlaying,
    musicStudio,
    githubOn: !!githubMode.on,
  };
}
async function startStudioTest(opts = {}) {
  if (studioProbe.running) return null;
  if (!studioState.D) {
    toast('The game data hasn’t loaded yet.', 'err');
    return null;
  }
  const { runStudioTest } = await import('./studio-test.js');
  return runStudioTest(studioTestHandles(), opts);
}
ACTIONS.studioTest = () => startStudioTest();
/* studio/?selftest: once the data is in and the first section is drawn */
if (new URLSearchParams(location.search).has('selftest')) {
  const t = setInterval(() => {
    if (studioState.D && !$('#main .loading')) {
      clearInterval(t);
      startStudioTest();
    }
  }, 500);
}
