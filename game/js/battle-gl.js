'use strict';
/* ================= BATTLES ON THE ENGINE =================
   A battle happens where you stand: the walk scene's canvas moves into the battle stage and keeps rendering the same
   world through the battle camera (scene.js keeps directing it: SC.V, focus, punches and shakes). The billionaires and
   trainers become lit sprites in that world, with sun shadows and contact shadows; props standing in the way are
   hidden; glowing move effects light the ground. scene.js still draws the move effects themselves on its canvas
   above. The classic painted stage is used when WebGL isn't running, when the stop has no walk scene,
   or when the player picks it in Settings. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './bridge.js';
import { hexA } from './art.js';
import { ACT, FOC, POS, SC, UPP, partSpr, sideBuf, sideWorld, trainerBattleFrame, trainerMpp } from './scene.js';
import { DIO, dioData, dioStop } from './diorama.js';
import { EGL } from './engine/core.js';
import { DGL, dioH } from './diorama-gl.js';
/* eslint-disable no-func-assign */
expose({
  BGL: [() => BGL],
  battleGLAttach: [() => battleGLAttach, v => (battleGLAttach = v)],
  battleGLFrame: [() => battleGLFrame, v => (battleGLFrame = v)],
  battleGLLayout: [() => battleGLLayout, v => (battleGLLayout = v)],
  battleGLStart: [() => battleGLStart, v => (battleGLStart = v)],
  battleGLStop: [() => battleGLStop, v => (battleGLStop = v)],
  battleGLWanted: [() => battleGLWanted, v => (battleGLWanted = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const BGL = { on: false, off: [0, 0], gy: 0, hide: null, items: [], lights: [] };
export function battleGLWanted() {
  if (typeof DGL === 'undefined' || !DGL.on || !DIO.cv || !DIO.ready || (typeof EGL !== 'undefined' && EGL.lost))
    return false;
  const p = S.preferences || {};
  if (p.battleStage === 'classic') return false;
  /* v43: whatever walk scene is on screen and ready is the stage (it used to have to be the stop's own scene, so a battle on the second half of a road, or one started before the scene had opened, fell back to the painted stage) */ return (
    !!DIO.id && !!DIO.sc && !DIO.sc.room
  );
}
function battleGLStart() {
  if (!battleGLWanted()) return false;
  return battleGLAttach();
}
/* the walk scene that's running (DIO) becomes the stage; o.detach removes its canvas afterwards (the Studio preview) */
export function battleGLAttach(o = {}) {
  const cv = DIO.cv,
    host = $('#camWorld');
  if (!host || !cv) return false;
  BGL.detach = !!o.detach;
  const sc = DIO.sc,
    P = DIO.pl,
    C0 = dioData().sc,
    ax = clamp(P.x, 3.5, Math.max(3.5, sc.w - 3.5)),
    az = clamp(P.z, 2.5, Math.max(2.5, sc.h - 3));
  BGL.off = [ax - ACT.x, az - ACT.z];
  BGL.gy = dioH(ax, az);
  /* clear the lane between the camera and the two billionaires */
  const hide = new Set();
  for (const p of sc.props || []) {
    const M = C0.props[p.k];
    if (!M || M.flat) continue;
    const bx = p.x - BGL.off[0],
      bz = p.z - BGL.off[1],
      bw = M.box ? (M.box[0] * (p.s || 1)) / 2 : 0,
      bd = M.box ? M.box[1] * (p.s || 1) : 0;
    const zMax = Math.max(...POS.map(q => q.z)) + 1.6,
      xMin = Math.min(...POS.map(q => q.x)) - 2.4,
      xMax = Math.max(...POS.map(q => q.x)) + 2.2;
    if (bz > -2.5 && bz - bd < zMax && bx + bw > xMin && bx - bw < xMax) hide.add(p);
  }
  BGL.hide = hide;
  host.insertBefore(cv, host.firstChild);
  cv.classList.add('dio-battle');
  cv.hidden = false;
  if (DGL.ui) DGL.ui.hidden = true;
  SC.leafy = [];
  SC.glint = [];
  DIO.battle = { frame: battleGLFrame };
  BGL.on = true;
  if (typeof NWLOG !== 'undefined') NWLOG.add('battle', '3D stage in ' + DIO.id);
  return true;
}
export function battleGLLayout() {
  const cv = DIO.cv,
    ref = SC.cv;
  if (!BGL.on || !cv || !ref) return;
  for (const k of ['left', 'top', 'width', 'height']) cv.style[k] = ref.style[k];
}
export function battleGLStop() {
  if (!BGL.on) return;
  BGL.on = false;
  DIO.battle = null;
  DGL.bt = null;
  DGL.camT = null;
  DGL.focus = null;
  const cv = DIO.cv;
  if (BGL.detach) {
    if (cv) {
      dioStop();
      cv.remove();
    }
    return;
  }
  if (cv) {
    cv.classList.remove('dio-battle');
    for (const k of ['left', 'top', 'width', 'height']) cv.style[k] = '';
    document.body.prepend(cv);
  }
  if (DGL.ui) {
    DGL.ui.hidden = false;
    if (cv) cv.after(DGL.ui);
  }
}
/* what the engine draws this frame, in walk-scene meters (battle space shifted by BGL.off) */
function battleGLFrame() {
  if (!SC.on || !SC.L) return null;
  const O = BGL.off,
    items = BGL.items,
    lights = BGL.lights;
  items.length = 0;
  lights.length = 0;
  for (let i = 0; i < SC.s.length; i++) {
    const B = sideBuf(i);
    if (!B) continue;
    const w = sideWorld(i),
      x = w.x + O[0],
      z = w.z + O[1],
      gy = dioH(x, z),
      mpp = (UPP[i] * B.s.sc * (B.s.big || 1) * (B.s.fs || 1)) / B.R.k,
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
    const T = SC.tr[i];
    if (!T.show || !T.who || T.a <= 0) continue;
    const f = trainerBattleFrame(i);
    if (!f) continue;
    const x = POS[i].x + (i === 0 ? -1.15 : 1.25) + T.x * UPP[i] + O[0],
      z = POS[i].z + (i === 0 ? 0.25 : 0.4) + O[1],
      mpp = trainerMpp(i);
    items.push({
      k: 'rig',
      im: f,
      x,
      z,
      y: dioH(x, z),
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
  if (SC.sel != null && SC.s[SC.sel] && SC.s[SC.sel].show) {
    const w = sideWorld(SC.sel),
      k = 0.5 + 0.12 * Math.sin(SC.t / 300);
    lights.push({ p: [w.x + O[0], BGL.gy + 1.4, w.z + O[1]], r: 2.2, c: [1.1 * k, 0.9 * k, 0.45 * k] });
  }
  /* v33: an Alpha glows from below */
  for (let i = 0; i < SC.s.length; i++) {
    const s = SC.s[i];
    if (!s.boss || !s.show || s.a < 0.4) continue;
    const w = sideWorld(i),
      k = 0.55 + 0.2 * Math.sin(SC.t / 260);
    lights.push({ p: [w.x + O[0], BGL.gy + 0.5, w.z + O[1]], r: 3.2, c: [1.2 * k, 0.25 * k, 0.45 * k] });
    /* v34: its shield, while it holds: a gold light round it */ const fv =
      typeof FV === 'function' && typeof B !== 'undefined' && B
        ? (() => {
            try {
              return FV(i);
            } catch (e) {
              return null;
            }
          })()
        : null;
    if (fv && fv.shield > 0)
      lights.push({ p: [w.x + O[0], BGL.gy + 1.2, w.z + O[1] - 0.6], r: 2.6, c: [1.3 * k, 1.05 * k, 0.35 * k] });
  }
  /* glowing move effects light what's around them */
  for (let i = SC.parts.length - 1; i >= 0 && lights.length < 6; i--) {
    const p = SC.parts[i];
    if (!p.glow || typeof p.col !== 'string' || p.col[0] !== '#') continue;
    const k = Math.max(0, 1 - p.age / p.life),
      c = hexA(p.col);
    lights.push({
      p: [p.x + O[0], BGL.gy + Math.max(0.1, p.y), p.z + O[1]],
      r: 2.4,
      c: [(c[0] / 255) * 1.1 * k, (c[1] / 255) * 1.1 * k, (c[2] / 255) * 1.1 * k],
    });
  }
  /* icon particles (sparks, stars, coins of effect) live in the world */
  const parts = BGL.parts || (BGL.parts = []);
  parts.length = 0;
  for (const p of SC.parts) {
    if (!p.spr) continue;
    let a = p.fade === false ? 1 : 1 - p.age / p.life;
    if (p.twinkle) a *= 0.5 + 0.5 * Math.sin(p.age / 120);
    const im = partSpr(p.spr);
    if (!im || a <= 0.01) continue;
    const s = (p.k || 1) / 30;
    parts.push({
      im,
      x: p.x + O[0],
      y: BGL.gy + p.y,
      z: p.z + O[1],
      w: im.width * s,
      h: im.height * s,
      a: clamp(a, 0, 1),
      glow: !!p.glow,
    });
  }
  const d = SC.dof;
  return {
    parts,
    cam: SC.V,
    L: SC.L,
    foc: FOC,
    off: O,
    gy: BGL.gy,
    items,
    hide: BGL.hide,
    lights,
    focus: d.zf,
    blur: RM ? 0 : clamp(d.ap / 1.35, 0, 1) * 0.8,
    center: [ACT.x + O[0], ACT.z + O[1]],
  };
}
