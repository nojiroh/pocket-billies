'use strict';
/* ================= WALK STATE =================
   Phase 20 (stage B): the walk renderer's shared state, moved from walk-view-gl.js as it was. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
expose({
  FIXED_BACK: [() => FIXED_BACK],
  FIXED_RIGHT: [() => FIXED_RIGHT],
  PREP_BUDGET_MS: [() => PREP_BUDGET_MS],
  walkRenderer: [() => walkRenderer],
});
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
  /* CAM-1: the camera's follow (logic/camera-follow.js) and what it is doing (the debug log, the Studio's guides) */
  fol: null,
  camInfo: null,
  /* CAM-2: when a battle let go of the camera (walkView.t), for the pull back out */
  leaveAt: null,
  /* CAM-2: the scene's points of interest (walk/sprites.js interestPoints) */
  intL: null,
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
export const PREP_BUDGET_MS = /Android|iPhone|iPad/.test(navigator.userAgent) ? 4 : 6;
export const FIXED_RIGHT = [1, 0, 0],
  FIXED_BACK = [0, 0, -1];
