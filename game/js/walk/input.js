'use strict';
/* ================= WALK INPUT =================
   Phase 20 (stage B): taps, two-finger turn and pinch, wheel zoom and the phone's tilt, moved from walk-view-gl.js as
   they were. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { saveData } from '../hooks.js';
import { clamp } from '../util.js';
import { pinchZoom, stopPull } from '../logic/camera-zoom.js';
import { canvasPoint, handleWalkClick, screenToGround, walkView } from '../walk-view.js';
import { engineSetting } from '../engine/settings.js';
import { walkRenderer } from './walk-state.js';
import {
  cameraTurnLimit,
  clampZoom,
  cycleZoomStop,
  freeCameraOn,
  goToZoomStop,
  sceneStartStop,
  stretchZoom,
  zoomStops,
} from './camera.js';
/* eslint-disable no-func-assign */
expose({
  askDeviceTilt: [() => askDeviceTilt, v => (askDeviceTilt = v)],
  bindGestures: [() => bindGestures, v => (bindGestures = v)],
  handleCanvasClick: [() => handleCanvasClick, v => (handleCanvasClick = v)],
  listenDeviceTilt: [() => listenDeviceTilt, v => (listenDeviceTilt = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export function handleCanvasClick(ev) {
  if (walkView.battle || walkView.director || !walkView.ready || (walkView.opt.active && !walkView.opt.active()))
    return;
  if (typeof saveData !== 'undefined') askDeviceTilt();
  if (walkRenderer.dragged) {
    walkRenderer.dragged = false;
    return;
  }
  /* CAM-4b: the click a two-finger touch leaves behind is not a tap to walk */
  if (performance.now() - walkRenderer.twoAt < 400) return;
  const [sx, sy] = canvasPoint(ev),
    g = screenToGround(sx, sy);
  if (g) {
    walkRenderer.focusT = { x: g.x, z: g.z, t: walkView.t };
  }
  handleWalkClick(ev);
}
export function bindGestures(cv) {
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
        /* CAM-4b: for the two-finger tap: when, and the most the fingers have spread or slid since */
        t: performance.now(),
        moved: 0,
      };
      /* CAM-4a: the point between the fingers on the ground and the aim, for zooming toward the pinch */
      const [sx, sy] = canvasPoint({ clientX: g0.cx, clientY: (a[1] + b[1]) / 2 }),
        g = screenToGround(sx, sy),
        T = walkRenderer.camT;
      walkRenderer.pinch = g && T ? { ax: g.x, az: g.z, px: T[0], pz: T[1], z0: walkRenderer.zoom } : null;
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
      g0.moved = Math.max(g0.moved, Math.abs(d - g0.d), Math.abs(cx - g0.cx));
      walkRenderer.zoomT = stretchZoom(pinchZoom(g0.zoom, g0.d, d, engineSetting('camera', 'pinchSpeed')));
      walkRenderer.yawT = clamp(g0.yaw + (cx - g0.cx) * 0.006, -cameraTurnLimit(), cameraTurnLimit());
      walkRenderer.dragged = true;
    }
  });
  const up = ev => {
    pts.delete(ev.pointerId);
    if (pts.size < 2) {
      if (g0) {
        const set = k => engineSetting('camera', k);
        walkRenderer.twoAt = performance.now();
        if (
          !freeCameraOn() &&
          walkRenderer.twoAt - g0.t < set('stopTapTime') * 1000 &&
          g0.moved <= set('stopTapMove')
        ) {
          /* CAM-4b: a two-finger tap: the zoom and turn as they were, then the next stop */
          walkRenderer.yawT = g0.yaw;
          walkRenderer.zoomT = g0.zoom;
          cycleZoomStop();
        } else {
          /* CAM-4a: a pinch stretched past a limit springs back to it; CAM-4b: let go near a stop, it eases there */
          walkRenderer.zoomT = clampZoom(walkRenderer.zoomT);
          if (!freeCameraOn()) {
            const p = stopPull(walkRenderer.zoomT, zoomStops(), set('stopPull'));
            if (p.stop) goToZoomStop(p.stop);
          }
        }
      }
      g0 = null;
      walkRenderer.pinch = null;
    }
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
      walkRenderer.zoomT = clampZoom(
        walkRenderer.zoomT * Math.exp(ev.deltaY * 0.0012 * engineSetting('camera', 'wheelSpeed'))
      );
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
      /* CAM-4b: back to the turn and the scene's starting stop */
      walkRenderer.yawT = 0;
      if (freeCameraOn()) walkRenderer.zoomT = 1;
      else goToZoomStop(sceneStartStop(walkView.sc));
    } else if ((ev.key === 'z' || ev.key === 'Z') && !freeCameraOn()) cycleZoomStop();
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
