'use strict';
/* ================= BATTLES ON THE ENGINE =================
   A battle happens where you stand: the walk scene's canvas moves into the battle stage and keeps rendering the same
   world through the battle camera (battle-stage.js keeps directing it: battleStage.V, focus, punches and shakes). The billionaires and
   trainers become lit sprites in that world, with sun shadows and contact shadows; props standing in the way are
   hidden; glowing move effects light the ground. battle-stage.js still draws the move effects themselves on its canvas
   above. phase 06-3: the only stage (the painted one is gone); a battle waits until the walk scene is ready. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { activeBattle, fieldState, provide, reducedMotion } from './hooks.js';
import { $, clamp } from './util.js';
import { hexToRgb } from './art.js';
import {
  FOCAL_LENGTH,
  actionCenter,
  actorBuffer,
  actorMetersPerPixel,
  actorPositions,
  actorWorldPoint,
  battleStage,
  particleSprite,
  trainerBattleFrame,
  trainerMetersPerPixel,
} from './battle-stage.js';
import { stopWalkView, walkData, walkView } from './walk-view.js';
import { gpuState } from './engine/webgl.js';
import { walkRenderer } from './walk/walk-state.js';
import { standingHeightAt } from './walk/heights.js';
/* eslint-disable no-func-assign */
expose({
  battle3d: [() => battle3d],
  battle3dAttach: [() => battle3dAttach, v => (battle3dAttach = v)],
  battle3dFrame: [() => battle3dFrame, v => (battle3dFrame = v)],
  battle3dLayout: [() => battle3dLayout, v => ((battle3dLayout = v), provide({ battle3dLayout }))],
  battle3dStart: [() => battle3dStart, v => ((battle3dStart = v), provide({ battle3dStart }))],
  battle3dStop: [() => battle3dStop, v => ((battle3dStop = v), provide({ battle3dStop }))],
  battle3dWanted: [() => battle3dWanted, v => (battle3dWanted = v)],
});
/* eslint-enable no-func-assign */
provide({ battle3dLayout, battle3dStart, battle3dStop });
/* to-module: end */
export const battle3d = { on: false, off: [0, 0], gy: 0, hide: null, items: [], lights: [] };
export function battle3dWanted() {
  if (
    typeof walkRenderer === 'undefined' ||
    !walkRenderer.on ||
    !walkView.cv ||
    !walkView.ready ||
    (typeof gpuState !== 'undefined' && gpuState.lost)
  )
    return false;
  /* v43: whatever walk scene is on screen and ready is the stage. phase 06-3: rooms too, and nothing else: the
     painted stage and the Settings choice are gone */
  return !!walkView.id && !!walkView.sc;
}
function battle3dStart() {
  if (!battle3dWanted()) return false;
  return battle3dAttach();
}
/* the walk scene that's running (walkView) becomes the stage; o.detach removes its canvas afterwards (the Studio preview) */
export function battle3dAttach(o = {}) {
  const cv = walkView.cv,
    host = $('#camWorld');
  if (!host || !cv) return false;
  battle3d.detach = !!o.detach;
  const sc = walkView.sc,
    P = walkView.pl,
    C0 = walkData().sc,
    ax = clamp(P.x, 3.5, Math.max(3.5, sc.w - 3.5)),
    az = clamp(P.z, 2.5, Math.max(2.5, sc.h - 3));
  battle3d.off = [ax - actionCenter.x, az - actionCenter.z];
  battle3d.gy = standingHeightAt(ax, az);
  /* clear the lane between the camera and the two billionaires */
  const hide = new Set();
  for (const p of sc.props || []) {
    const M = C0.props[p.k];
    if (!M || M.flat) continue;
    const bx = p.x - battle3d.off[0],
      bz = p.z - battle3d.off[1],
      bw = M.box ? (M.box[0] * (p.s || 1)) / 2 : 0,
      bd = M.box ? M.box[1] * (p.s || 1) : 0;
    const zMax = Math.max(...actorPositions.map(q => q.z)) + 1.6,
      xMin = Math.min(...actorPositions.map(q => q.x)) - 2.4,
      xMax = Math.max(...actorPositions.map(q => q.x)) + 2.2;
    if (bz > -2.5 && bz - bd < zMax && bx + bw > xMin && bx - bw < xMax) hide.add(p);
  }
  battle3d.hide = hide;
  host.insertBefore(cv, host.firstChild);
  cv.classList.add('dio-battle');
  cv.hidden = false;
  if (walkRenderer.ui) walkRenderer.ui.hidden = true;
  battleStage.leafy = [];
  battleStage.glint = [];
  walkView.battle = { frame: battle3dFrame };
  battle3d.on = true;
  if (typeof debugLog !== 'undefined') debugLog.add('battle', '3D stage in ' + walkView.id);
  return true;
}
export function battle3dLayout() {
  const cv = walkView.cv,
    ref = battleStage.cv;
  if (!battle3d.on || !cv || !ref) return;
  for (const k of ['left', 'top', 'width', 'height']) cv.style[k] = ref.style[k];
}
export function battle3dStop() {
  if (!battle3d.on) return;
  battle3d.on = false;
  walkView.battle = null;
  walkRenderer.bt = null;
  walkRenderer.camT = null;
  walkRenderer.focus = null;
  const cv = walkView.cv;
  if (battle3d.detach) {
    if (cv) {
      stopWalkView();
      cv.remove();
    }
    return;
  }
  if (cv) {
    cv.classList.remove('dio-battle');
    for (const k of ['left', 'top', 'width', 'height']) cv.style[k] = '';
    document.body.prepend(cv);
  }
  if (walkRenderer.ui) {
    walkRenderer.ui.hidden = false;
    if (cv) cv.after(walkRenderer.ui);
  }
}
/* what the engine draws this frame, in walk-scene meters (battle space shifted by battle3d.off) */
function battle3dFrame() {
  if (!battleStage.on || !battleStage.L) return null;
  const O = battle3d.off,
    items = battle3d.items,
    lights = battle3d.lights;
  items.length = 0;
  lights.length = 0;
  for (let i = 0; i < battleStage.s.length; i++) {
    const B = actorBuffer(i);
    if (!B) continue;
    const w = actorWorldPoint(i),
      x = w.x + O[0],
      z = w.z + O[1],
      gy = standingHeightAt(x, z),
      mpp = (actorMetersPerPixel[i] * B.s.sc * (B.s.big || 1) * (B.s.fs || 1)) / B.R.k,
      G = B.R.geo;
    items.push({
      k: 'rig',
      im: B.buf,
      x,
      z,
      y: gy + Math.max(0, w.y),
      mpp,
      ox: -G.cx,
      oy: -G.base,
      w: B.R.BW,
      h: B.R.BH,
      flip: 1,
      shear: 0,
      sh: B.ak === 'faint' || B.s.a < 0.5 ? 0 : Math.max(0.3, G.hw * mpp),
      aoR: Math.max(0.3, G.hw * mpp * 0.9),
      fade: B.s.a,
      person: 1,
    });
  }
  for (let i = 0; i < 2; i++) {
    const T = battleStage.tr[i];
    if (!T.show || !T.who || T.a <= 0) continue;
    const f = trainerBattleFrame(i);
    if (!f) continue;
    const x = actorPositions[i].x + (i === 0 ? -1.15 : 1.25) + T.x * actorMetersPerPixel[i] + O[0],
      z = actorPositions[i].z + (i === 0 ? 0.25 : 0.4) + O[1],
      mpp = trainerMetersPerPixel(i);
    items.push({
      k: 'rig',
      im: f,
      x,
      z,
      y: standingHeightAt(x, z),
      mpp,
      ox: -(f.ax ?? f.width / 2),
      oy: -(f.ay ?? f.height),
      w: f.width,
      h: f.height,
      flip: 1,
      shear: 0,
      sh: 0.38,
      aoR: 0.34,
      fade: T.a,
      person: 1,
    });
  }
  /* v33: a warm light picks out the one choosing */
  if (battleStage.sel != null && battleStage.s[battleStage.sel] && battleStage.s[battleStage.sel].show) {
    const w = actorWorldPoint(battleStage.sel),
      k = 0.5 + 0.12 * Math.sin(battleStage.t / 300);
    lights.push({ p: [w.x + O[0], battle3d.gy + 1.4, w.z + O[1]], r: 2.2, c: [1.1 * k, 0.9 * k, 0.45 * k] });
  }
  /* v33: an Alpha glows from below */
  for (let i = 0; i < battleStage.s.length; i++) {
    const s = battleStage.s[i];
    if (!s.boss || !s.show || s.a < 0.4) continue;
    const w = actorWorldPoint(i),
      k = 0.55 + 0.2 * Math.sin(battleStage.t / 260);
    lights.push({ p: [w.x + O[0], battle3d.gy + 0.5, w.z + O[1]], r: 3.2, c: [1.2 * k, 0.25 * k, 0.45 * k] });
    /* v34: its shield, while it holds: a gold light round it */ const fv =
      typeof fieldState === 'function' && typeof activeBattle !== 'undefined' && activeBattle
        ? (() => {
            try {
              return fieldState(i);
            } catch (e) {
              return null;
            }
          })()
        : null;
    if (fv && fv.shield > 0)
      lights.push({ p: [w.x + O[0], battle3d.gy + 1.2, w.z + O[1] - 0.6], r: 2.6, c: [1.3 * k, 1.05 * k, 0.35 * k] });
  }
  /* glowing move effects light what's around them */
  for (let i = battleStage.parts.length - 1; i >= 0 && lights.length < 6; i--) {
    const p = battleStage.parts[i];
    if (!p.glow || typeof p.col !== 'string' || p.col[0] !== '#') continue;
    const k = Math.max(0, 1 - p.age / p.life),
      c = hexToRgb(p.col);
    lights.push({
      p: [p.x + O[0], battle3d.gy + Math.max(0.1, p.y), p.z + O[1]],
      r: 2.4,
      c: [(c[0] / 255) * 1.1 * k, (c[1] / 255) * 1.1 * k, (c[2] / 255) * 1.1 * k],
    });
  }
  /* icon particles (sparks, stars, coins of effect) live in the world */
  const parts = battle3d.parts || (battle3d.parts = []);
  parts.length = 0;
  for (const p of battleStage.parts) {
    if (!p.spr) continue;
    let a = p.fade === false ? 1 : 1 - p.age / p.life;
    if (p.twinkle) a *= 0.5 + 0.5 * Math.sin(p.age / 120);
    const im = particleSprite(p.spr);
    if (!im || a <= 0.01) continue;
    const s = (p.k || 1) / 30;
    parts.push({
      im,
      x: p.x + O[0],
      y: battle3d.gy + p.y,
      z: p.z + O[1],
      w: im.width * s,
      h: im.height * s,
      a: clamp(a, 0, 1),
      glow: !!p.glow,
    });
  }
  const d = battleStage.dof;
  return {
    parts,
    cam: battleStage.V,
    L: battleStage.L,
    foc: FOCAL_LENGTH,
    off: O,
    gy: battle3d.gy,
    items,
    hide: battle3d.hide,
    lights,
    focus: d.zf,
    blur: reducedMotion ? 0 : clamp(d.ap / 1.35, 0, 1) * 0.8,
    center: [actionCenter.x + O[0], actionCenter.z + O[1]],
  };
}
