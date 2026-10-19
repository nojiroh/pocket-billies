'use strict';
/* ================= POCKET BILLIES STUDIO · free camera =================
   The Walk scenes preview's free camera: it leaves the walker and flies over the scene (the maths in
   game/js/logic/free-camera.js; the walk view draws through it as through a cutscene's camera). Like a map app:
     mouse     left-drag moves over the ground (it stays under the pointer), right-drag turns and tilts, the wheel
               zooms towards the pointer, double-click looks at that spot
     touch     one finger moves, two fingers pinch to zoom, twist to turn, slide up or down together to tilt;
               double-tap looks at that spot
     keys      (pointer over the preview) W A S D / arrows move, Q E turn, R F tilt, Page Up / Page Down rise and
               sink, Shift faster, C switches the free camera on and off
   A click without a drag still picks what is there, as before. Each scene keeps its own camera while the Studio is
   open. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { previewViewport } from '../../game/js/hooks.js';
import { canvasPoint, screenToGround, walkView } from '../../game/js/walk-view.js';
import { walkRenderer } from '../../game/js/walk/walk-state.js';
import { groundHeightAt } from '../../game/js/walk/heights.js';
import {
  freeCamAt,
  freeCamCopy,
  freeCamGlide,
  freeCamKeep,
  freeCamLook,
  freeCamMetresPerPixel,
  freeCamPan,
  freeCamRise,
  freeCamTilt,
  freeCamTurn,
  freeCamZoom,
} from '../../game/js/logic/free-camera.js';
import { ACTIONS, studioState } from './studio-app.js';
/* eslint-disable no-func-assign */
expose({
  FREE_KEYS: [() => FREE_KEYS],
  TILT_PER_PX: [() => TILT_PER_PX],
  TURN_PER_PX: [() => TURN_PER_PX],
  freeCamera: [() => freeCamera],
  freeCameraBarHTML: [() => freeCameraBarHTML, v => (freeCameraBarHTML = v)],
  freeCameraLook: [() => freeCameraLook, v => (freeCameraLook = v)],
  freeCameraSpot: [() => freeCameraSpot],
  freeCameraSwitch: [() => freeCameraSwitch, v => (freeCameraSwitch = v)],
  groundAt: [() => groundAt],
  keep: [() => keep],
  keyOf: [() => keyOf],
  metresPerPx: [() => metresPerPx],
  onPreview: [() => onPreview],
  pointerEnd: [() => pointerEnd],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const freeCamera = {
  on: false,
  cur: null,
  goal: null,
  scene: null,
  byScene: {},
  keys: {},
  drag: null,
  pts: new Map(),
  pinch: null,
  at: 0,
};
const TURN_PER_PX = 0.006,
  TILT_PER_PX = 0.25;

/* ---------- on and off ---------- */
/** switches it on (from where the walk camera looks, or this scene's last free camera) or off */
function freeCameraSwitch(on = !freeCamera.on) {
  const id = studioState.sel.scene;
  if (on && !freeCamera.on) {
    const C = walkView.C,
      kept = freeCamera.byScene[id];
    freeCamera.goal = kept
      ? freeCamCopy(kept)
      : C && C.tgt && C.sp != null
        ? {
            tgt: [C.tgt[0], C.tgt[1], C.tgt[2]],
            yaw: C.yaw || 0,
            pitch: (Math.asin(Math.max(-1, Math.min(1, C.sp))) * 180) / Math.PI,
            dist: C.df || 26,
          }
        : freeCamAt(walkView.pl.x, walkView.pl.z, groundHeightAt(walkView.pl.x, walkView.pl.z));
    freeCamera.cur = freeCamCopy(freeCamera.goal);
    freeCamera.scene = id;
  }
  if (!on && freeCamera.on && freeCamera.goal) freeCamera.byScene[id] = freeCamCopy(freeCamera.goal);
  freeCamera.on = on;
  freeCamera.at = 0;
  freeCamera.keys = {};
  freeCamera.drag = null;
  freeCamera.pts.clear();
  const bar = document.getElementById('scFreeCam');
  if (bar) bar.innerHTML = freeCameraBarHTML();
  /* the preview's own hint (viewport.js) says how to fly while it flies */
  const hint =
    document.querySelector('#scPv') && document.querySelector('#scPv').closest('.sc-pv').querySelector('.vp-hint');
  if (hint) {
    if (!hint.dataset.walk) hint.dataset.walk = hint.textContent;
    hint.textContent = on
      ? 'Free camera · drag moves · right-drag turns and tilts · wheel zooms · C: back to the walker'
      : hint.dataset.walk;
  }
}
/** the row under the preview */
export function freeCameraBarHTML() {
  const on = freeCamera.on,
    touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  return `<button class="seg ${on ? 'on' : ''}" data-act="fcOn" aria-pressed="${on}" title="Fly the camera over the scene (C)">🎥 Free camera</button>${
    on
      ? `<button class="btn sm" data-act="fcTop" title="Look straight down, like the map">Top view</button><button class="btn sm" data-act="fcRise" data-d="1" aria-label="Rise" title="Rise (Page Up)">▲</button><button class="btn sm" data-act="fcRise" data-d="-1" aria-label="Sink" title="Sink (Page Down)">▼</button><button class="btn sm" data-act="fcWalker" title="Put the walker where the camera looks">Walker here</button><button class="btn sm subtle" data-act="fcOn" title="The camera behind the walker again">Back to the walker</button><span class="hint">${
          touch
            ? 'One finger moves · pinch zooms · twist turns · two fingers up or down tilt · double-tap looks there'
            : 'Drag moves · right-drag turns and tilts · wheel zooms · double-click looks there · W A S D, Q E, R F, Page Up/Down'
        }</span>`
      : '<span class="hint">Fly over the scene to look at any corner, from any angle</span>'
  }`;
}
/* ---------- each frame: the walk view asks where to look (walkView.opt.look) ---------- */
/** @param {number} dt seconds @returns {{ eye: number[], tgt: number[], fov: number } | null} */
export function freeCameraLook(dt) {
  if (!freeCamera.on || !freeCamera.goal) return null;
  /* by the clock, not the frame's step (the view caps that at 60 ms), so it glides as fast on a slow phone */
  const now = performance.now();
  dt = Math.min(0.25, Math.max(dt, (now - (freeCamera.at || now)) / 1000));
  freeCamera.at = now;
  if (freeCamera.scene !== studioState.sel.scene) {
    freeCameraSwitch(false);
    return null;
  }
  const g = freeCamera.goal,
    K = freeCamera.keys,
    fast = K.Shift ? 3 : 1,
    step = g.dist * 0.9 * dt * fast;
  if (K.l || K.r || K.u || K.d)
    freeCamPan(g, ((K.r ? 1 : 0) - (K.l ? 1 : 0)) * step, ((K.u ? 1 : 0) - (K.d ? 1 : 0)) * step);
  if (K.tl || K.tr) freeCamTurn(g, ((K.tr ? 1 : 0) - (K.tl ? 1 : 0)) * 1.6 * dt * fast);
  if (K.up || K.down) freeCamTilt(g, ((K.down ? 1 : 0) - (K.up ? 1 : 0)) * 45 * dt * fast);
  if (K.rise || K.sink) freeCamRise(g, ((K.rise ? 1 : 0) - (K.sink ? 1 : 0)) * Math.max(2, g.dist * 0.4) * dt * fast);
  keep(g);
  freeCamGlide(freeCamera.cur, g, dt);
  keep(freeCamera.cur);
  freeCamera.byScene[freeCamera.scene] = freeCamCopy(g);
  return freeCamLook(freeCamera.cur);
}
const keep = s => {
  const sc = walkView.sc;
  if (sc && sc.w) freeCamKeep(s, sc, (x, z) => groundHeightAt(x, z));
};
/** where the camera looks, on the ground: [x, z] */
export const freeCameraSpot = () =>
  freeCamera.on && freeCamera.goal ? [freeCamera.goal.tgt[0], freeCamera.goal.tgt[2]] : null;

/* ---------- pointer and touch ----------
   Caught before the walk view's own handlers (capture on the document), only on the preview's canvas and only while
   the free camera is on; the click that ends a drag is let go of (walkRenderer.dragged), a plain click still picks. */
const onPreview = ev => freeCamera.on && ev.target && ev.target.id === 'scPv';
const groundAt = ev => {
  if (!walkView.cv) return null;
  const [sx, sy] = canvasPoint(ev),
    g = screenToGround(sx, sy);
  return g ? [g.x, g.z] : null;
};
const metresPerPx = () => {
  const cv = walkView.cv,
    C = walkView.C,
    css = cv ? cv.getBoundingClientRect() : null;
  /* from the camera as drawn (its focal length in canvas pixels), else from the field of view */
  if (C && C.F && css && css.width) return (freeCamera.cur.dist / C.F) * (cv.width / css.width);
  return freeCamMetresPerPixel(freeCamera.cur, css ? css.height : 600);
};
document.addEventListener(
  'pointerdown',
  ev => {
    if (!onPreview(ev)) return;
    ev.stopPropagation();
    try {
      ev.target.setPointerCapture(ev.pointerId);
    } catch (e) {}
    freeCamera.pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (freeCamera.pts.size === 2) {
      const [a, b] = [...freeCamera.pts.values()];
      freeCamera.pinch = {
        d: Math.hypot(a[0] - b[0], a[1] - b[1]),
        ang: Math.atan2(b[1] - a[1], b[0] - a[0]),
        my: (a[1] + b[1]) / 2,
      };
      freeCamera.drag = null;
      return;
    }
    freeCamera.drag = {
      x: ev.clientX,
      y: ev.clientY,
      turn: ev.button === 2 || (ev.button === 0 && ev.altKey),
      moved: 0,
    };
  },
  true
);
document.addEventListener(
  'pointermove',
  ev => {
    if (!freeCamera.on || !freeCamera.pts.has(ev.pointerId)) return;
    ev.stopPropagation();
    freeCamera.pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    const g = freeCamera.goal;
    if (freeCamera.pts.size === 2 && freeCamera.pinch) {
      const [a, b] = [...freeCamera.pts.values()],
        P = freeCamera.pinch,
        d = Math.hypot(a[0] - b[0], a[1] - b[1]),
        ang = Math.atan2(b[1] - a[1], b[0] - a[0]),
        my = (a[1] + b[1]) / 2;
      freeCamZoom(g, P.d / Math.max(20, d));
      let da = ang - P.ang;
      da -= Math.round(da / (2 * Math.PI)) * 2 * Math.PI;
      freeCamTurn(g, -da);
      freeCamTilt(g, (my - P.my) * TILT_PER_PX);
      freeCamera.pinch = { d, ang, my };
      walkRenderer.dragged = true;
      keep(g);
      return;
    }
    const D = freeCamera.drag;
    if (!D) return;
    const dx = ev.clientX - D.x,
      dy = ev.clientY - D.y;
    D.x = ev.clientX;
    D.y = ev.clientY;
    D.moved += Math.abs(dx) + Math.abs(dy);
    if (D.moved > 4) walkRenderer.dragged = true;
    if (D.turn) {
      freeCamTurn(g, dx * TURN_PER_PX);
      freeCamTilt(g, dy * TILT_PER_PX);
    } else {
      /* the ground stays under the pointer: the move is the difference between the ground under it before and now
         (both read through the camera as drawn); towards the horizon, where there is no ground, by the metres a
         pixel is at the target */
      const was = groundAt({ clientX: ev.clientX - dx, clientY: ev.clientY - dy }),
        now = groundAt(ev);
      if (was && now && Math.hypot(was[0] - now[0], was[1] - now[1]) < g.dist * 2) {
        g.tgt[0] += was[0] - now[0];
        g.tgt[2] += was[1] - now[1];
      } else {
        const m = metresPerPx();
        freeCamPan(g, -dx * m, dy * m);
      }
    }
    keep(g);
  },
  true
);
const pointerEnd = ev => {
  if (!freeCamera.pts.has(ev.pointerId)) return;
  freeCamera.pts.delete(ev.pointerId);
  if (freeCamera.pts.size < 2) freeCamera.pinch = null;
  if (!freeCamera.pts.size) freeCamera.drag = null;
  ev.stopPropagation();
};
document.addEventListener('pointerup', pointerEnd, true);
document.addEventListener('pointercancel', pointerEnd, true);
document.addEventListener(
  'wheel',
  ev => {
    if (!onPreview(ev)) return;
    ev.preventDefault();
    ev.stopPropagation();
    freeCamZoom(freeCamera.goal, Math.exp(ev.deltaY * 0.0015), groundAt(ev));
    keep(freeCamera.goal);
  },
  { capture: true, passive: false }
);
/* double-click or double-tap: glide to look at that spot, a little closer */
document.addEventListener(
  'dblclick',
  ev => {
    if (!onPreview(ev)) return;
    ev.stopPropagation();
    const p = groundAt(ev);
    if (!p) return;
    const g = freeCamera.goal;
    g.tgt = [p[0], groundHeightAt(p[0], p[1]), p[1]];
    freeCamZoom(g, 0.7);
    keep(g);
  },
  true
);

/* ---------- keys (while the pointer is over the preview) ---------- */
const FREE_KEYS = {
  ArrowLeft: 'l',
  ArrowRight: 'r',
  ArrowUp: 'u',
  ArrowDown: 'd',
  a: 'l',
  d: 'r',
  w: 'u',
  s: 'd',
  q: 'tl',
  e: 'tr',
  r: 'up',
  f: 'down',
  PageUp: 'rise',
  PageDown: 'sink',
  Shift: 'Shift',
};
const keyOf = ev => FREE_KEYS[ev.key.length === 1 ? ev.key.toLowerCase() : ev.key];
document.addEventListener(
  'keydown',
  ev => {
    const t = ev.target;
    if (t && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName))) return;
    if (!previewViewport.hover || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if ((ev.key === 'c' || ev.key === 'C') && document.getElementById('scPv')) {
      ev.preventDefault();
      ev.stopPropagation();
      freeCameraSwitch();
      return;
    }
    const k = freeCamera.on && keyOf(ev);
    if (!k) return;
    freeCamera.keys[k] = 1;
    ev.preventDefault();
    ev.stopPropagation();
  },
  true
);
document.addEventListener(
  'keyup',
  ev => {
    const k = keyOf(ev);
    if (k) delete freeCamera.keys[k];
  },
  true
);
addEventListener('blur', () => (freeCamera.keys = {}));

/* ---------- the bar's buttons ---------- */
ACTIONS.fcOn = () => freeCameraSwitch();
ACTIONS.fcTop = () => {
  if (!freeCamera.on) return;
  freeCamTilt(freeCamera.goal, 90);
  keep(freeCamera.goal);
};
ACTIONS.fcRise = d => {
  if (!freeCamera.on) return;
  freeCamRise(freeCamera.goal, +d.d * Math.max(2, freeCamera.goal.dist * 0.25));
  keep(freeCamera.goal);
};
