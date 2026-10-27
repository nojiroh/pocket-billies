'use strict';
/* ================= BATTLES ON THE ENGINE =================
   A battle happens where you stand: the walk scene's canvas moves into the battle stage and keeps rendering the same
   world through the battle camera (battle-stage.js keeps directing it: battleStage.V, focus, punches and shakes). The billionaires and
   trainers become lit sprites in that world, with sun shadows and contact shadows; props standing in the way are
   hidden; glowing move effects light the ground. battle-stage.js still draws the move effects themselves on its canvas
   above. phase 06-3: the only stage (the painted one is gone); a battle waits until the walk scene is ready. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { PYRAMIDS, activeBattle, fieldState, provide, reducedMotion } from './hooks.js';
import { $, clamp } from './util.js';
import { battleTurnPoint, battleWaterFacing } from './logic/battle-facing.js';
import { RIBBON_CORE, ribbonEdges, ribbonTone, smearGhosts, smearRibbon } from './logic/smear.js';
import { hexToRgb, pyramidCanvas } from './art.js';
import {
  AREAS,
  FOCAL_LENGTH,
  PYRAMID_HIGH,
  PYRAMID_LIFT,
  PYRAMID_REST,
  PYRAMID_SCALE,
  PYRAMID_SIDE,
  PYRAMID_YAW,
  actionCenter,
  actorBuffer,
  actorMetersPerPixel,
  actorPositions,
  actorWorldPoint,
  battleImpact,
  battleRibbonCells,
  battleSmearCount,
  battleStage,
  battleStretch,
  particleSprite,
  trainerBattleFrame,
  trainerMetersPerPixel,
} from './battle-stage.js';
import { stopWalkView, walkData, walkView } from './walk-view.js';
import { gpuState } from './engine/webgl.js';
import { walkRenderer } from './walk/walk-state.js';
import { standingHeightAt } from './walk/heights.js';
import { loadPropModelRecipe, propModelsOn } from './prop-models.js';
/* eslint-disable no-func-assign */
expose({
  SMEAR_LOOKS: [() => SMEAR_LOOKS],
  battle3d: [() => battle3d],
  battle3dAttach: [() => battle3dAttach, v => (battle3dAttach = v)],
  battle3dFrame: [() => battle3dFrame, v => (battle3dFrame = v)],
  battle3dLayout: [() => battle3dLayout, v => ((battle3dLayout = v), provide({ battle3dLayout }))],
  battle3dStart: [() => battle3dStart, v => ((battle3dStart = v), provide({ battle3dStart }))],
  battle3dStop: [() => battle3dStop, v => ((battle3dStop = v), provide({ battle3dStop }))],
  battle3dTurnedCam: [() => battle3dTurnedCam, v => (battle3dTurnedCam = v)],
  battle3dWanted: [() => battle3dWanted, v => (battle3dWanted = v)],
  pyramidItem: [() => pyramidItem, v => (pyramidItem = v)],
  pyramidModelPath: [() => pyramidModelPath],
  pyramidWorldItem: [() => pyramidWorldItem, v => (pyramidWorldItem = v)],
  ribbonColour: [() => ribbonColour, v => ((ribbonColour = v), provide({ ribbonColour }))],
  ribbonVertices: [() => ribbonVertices, v => (ribbonVertices = v)],
  smearLook: [() => smearLook, v => (smearLook = v)],
});
/* eslint-enable no-func-assign */
provide({ battle3dLayout, battle3dStart, battle3dStop, ribbonColour });
/* to-module: end */
export const battle3d = {
  on: false,
  off: [0, 0],
  /* WA-7: the battle's turn (radians, 0 north; logic/battle-facing.js) and its turned camera */
  yaw: 0,
  cam: /** @type {any} */ (null),
  gy: 0,
  hide: null,
  items: [],
  lights: [],
};
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
  /* water track WA-7: by a lake, a river or the coast the whole battle turns round the middle of the action so the
     scene's own water lies behind it (logic/battle-facing.js); everyone and the camera stay on dry ground in the map */
  const spots = [{ x: 0, z: 0 }];
  for (let i = 0; i < battleStage.s.length; i++) spots.push(actorWorldPoint(i));
  for (let i = 0; i < 2; i++) spots.push({ x: actorPositions[i].x + (i === 0 ? -1.15 : 1.25), z: actorPositions[i].z });
  battle3d.yaw =
    AREAS[battleStage.area] && AREAS[battleStage.area].indoor
      ? 0
      : battleWaterFacing({
          water: walkView.water || [],
          w: sc.w,
          h: sc.h,
          c: actionCenter,
          off: battle3d.off,
          spots,
          blockers: (sc.props || [])
            .filter(p => C0.props[p.k] && !C0.props[p.k].flat && C0.props[p.k].box)
            .map(p => [p.x, p.z, (C0.props[p.k].box[0] * (p.s || 1)) / 2]),
        });
  const cy = Math.cos(battle3d.yaw),
    sy = Math.sin(battle3d.yaw);
  /* WA-7: the water in view and who stands in it, in battle space (battle-stage.js: glints on it, rings round them) */
  const toBattle = (/** @type {number} */ x, /** @type {number} */ z) => {
      const dx = x - battle3d.off[0] - actionCenter.x,
        dz = z - battle3d.off[1] - actionCenter.z;
      return { x: actionCenter.x + dx * cy - dz * sy, z: actionCenter.z + dx * sy + dz * cy };
    },
    wetSet = new Set((walkView.water || []).map(p => Math.floor(p[0]) + ',' + Math.floor(p[1])));
  battleStage.wet = (walkView.water || [])
    .map(p => toBattle(p[0], p[1]))
    .filter(q => q.z > 3 && q.z < 30 && Math.abs(q.x) < q.z * 0.7)
    .slice(0, 300);
  battleStage.wetFeet = [];
  for (let i = 0; i < battleStage.s.length; i++) {
    const [x, z] = battleTurnPoint(spots[i + 1].x, spots[i + 1].z, battle3d.yaw, actionCenter, battle3d.off);
    if (wetSet.has(Math.floor(x) + ',' + Math.floor(z))) battleStage.wetFeet.push(i);
  }
  /* clear the lane between the camera and the two billionaires */
  const hide = new Set();
  for (const p of sc.props || []) {
    const M = C0.props[p.k];
    if (!M || M.flat) continue;
    /* the prop in battle space (the turn undone) */
    const dx = p.x - battle3d.off[0] - actionCenter.x,
      dz = p.z - battle3d.off[1] - actionCenter.z,
      bx = actionCenter.x + dx * cy - dz * sy,
      bz = actionCenter.z + dx * sy + dz * cy,
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
  /* RF-2: the catch pyramids' models, so the first throw has them */
  if (typeof PYRAMIDS !== 'undefined') for (const k of Object.keys(PYRAMIDS)) loadPropModelRecipe(pyramidModelPath(k));
  walkView.battle = { frame: battle3dFrame };
  battle3d.on = true;
  if (typeof debugLog !== 'undefined')
    debugLog.add(
      'battle',
      '3D stage in ' +
        walkView.id +
        (battle3d.yaw ? ` facing the water (${Math.round((battle3d.yaw * 180) / Math.PI)} degrees)` : '')
    );
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
    T = (/** @type {number} */ x, /** @type {number} */ z) => battleTurnPoint(x, z, battle3d.yaw || 0, actionCenter, O),
    at3 = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ z) => {
      const q = T(x, z);
      return [q[0], y, q[1]];
    },
    items = battle3d.items,
    lights = battle3d.lights;
  items.length = 0;
  lights.length = 0;
  for (let i = 0; i < battleStage.s.length; i++) {
    const B = actorBuffer(i);
    if (!B) continue;
    const w = actorWorldPoint(i),
      [x, z] = T(w.x, w.z),
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
    const Tr = battleStage.tr[i];
    if (!Tr.show || !Tr.who || Tr.a <= 0) continue;
    const f = trainerBattleFrame(i);
    if (!f) continue;
    const [x, z] = T(
        actorPositions[i].x + (i === 0 ? -1.15 : 1.25) + Tr.x * actorMetersPerPixel[i],
        actorPositions[i].z + (i === 0 ? 0.25 : 0.4)
      ),
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
      fade: Tr.a,
      person: 1,
    });
  }
  /* v33: a warm light picks out the one choosing */
  if (battleStage.sel != null && battleStage.s[battleStage.sel] && battleStage.s[battleStage.sel].show) {
    const w = actorWorldPoint(battleStage.sel),
      k = 0.5 + 0.12 * Math.sin(battleStage.t / 300);
    lights.push({ p: at3(w.x, battle3d.gy + 1.4, w.z), r: 2.2, c: [1.1 * k, 0.9 * k, 0.45 * k] });
  }
  /* v33: an Alpha glows from below */
  for (let i = 0; i < battleStage.s.length; i++) {
    const s = battleStage.s[i];
    if (!s.boss || !s.show || s.a < 0.4) continue;
    const w = actorWorldPoint(i),
      k = 0.55 + 0.2 * Math.sin(battleStage.t / 260);
    lights.push({ p: at3(w.x, battle3d.gy + 0.5, w.z), r: 3.2, c: [1.2 * k, 0.25 * k, 0.45 * k] });
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
      lights.push({ p: at3(w.x, battle3d.gy + 1.2, w.z - 0.6), r: 2.6, c: [1.3 * k, 1.05 * k, 0.35 * k] });
  }
  /* glowing move effects light what's around them */
  for (let i = battleStage.parts.length - 1; i >= 0 && lights.length < 6; i--) {
    const p = battleStage.parts[i];
    if (!p.glow || typeof p.col !== 'string' || p.col[0] !== '#') continue;
    const k = Math.max(0, 1 - p.age / p.life),
      c = hexToRgb(p.col);
    lights.push({
      p: at3(p.x, battle3d.gy + Math.max(0.1, p.y), p.z),
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
    const [px, pz] = T(p.x, p.z);
    parts.push({
      im,
      x: px,
      y: battle3d.gy + p.y,
      z: pz,
      w: im.width * s,
      h: im.height * s,
      a: clamp(a, 0, 1),
      glow: !!p.glow,
    });
  }
  /* RF-2: the thrown pyramid, a lit 3D model; battle-stage.js draws its flat icon instead while it can't be */
  const py = battleStage.coin && battleStage.coin.show ? pyramidItem(battleStage.coin, T) : null;
  let ribbon = null;
  if (py) {
    /* VFX-2: its motion lines along the last of its arc (walk/effects.js ribbonPass) */
    ribbon = ribbonVertices(battleStage.coin, T);
    /* VFX-3: on its fastest cells its trailing side is dragged back (prop-models.js SMEAR_GLSL); the copies aren't */
    const C = battleStage.coin,
      S = battleStretch(C);
    if (S) {
      const [x0, z0] = T(C.x, C.z),
        [x1, z1] = T(C.x + S.d[0], C.z + S.d[2]);
      py.smear = { d: [x1 - x0, S.d[1], z1 - z0], seed: S.seed };
    }
    items.push(py);
    if (py.light) lights.push(py.light);
    /* VFX-1: its afterimages, the same model at its older places, dithered and brighter in its own colours (the
       low-poly shader's look, walk/prop-look.js; a voxel recipe's emission), casting no shadow */
    for (const g of smearGhosts(battleStage.coin.trail, battleStage.t, battleSmearCount(), battleStage.V)) {
      const it = pyramidItem({ ...battleStage.coin, ...g.s, glow: 0 }, T);
      if (!it) continue;
      it.fade = g.fade;
      it.glow = g.glow;
      it.lk = smearLook(g.glow);
      it.light = null;
      it.ghost = true;
      items.push(it);
    }
  }
  /* VFX-4: the impact frame now (battle-stage.js impactFx), its hit point in the walk scene (walk-view-gl.js projects
     it for the grade pass) */
  const IS = battleImpact();
  let impact = null;
  if (IS) {
    const I = IS.I,
      [ix, iz] = T(I.P.x, I.P.z);
    impact = { p: [ix, battle3d.gy + I.P.y, iz], mode: IS.mode, age: IS.age, n: I.lines, seed: I.seed, warm: I.warm };
  }
  const d = battleStage.dof;
  return {
    parts,
    cam: battle3d.yaw ? battle3dTurnedCam() : battleStage.V,
    L: battleStage.L,
    foc: FOCAL_LENGTH,
    off: O,
    gy: battle3d.gy,
    items,
    ribbon,
    impact,
    hide: battle3d.hide,
    lights,
    focus: d.zf,
    blur: reducedMotion ? 0 : clamp(d.ap / 1.35, 0, 1) * 0.8,
    center: [actionCenter.x + O[0], actionCenter.z + O[1]],
  };
}
/* WA-7: the battle camera turned with the battle (walk/camera.js battleCamera adds battle3d.off to its place) */
function battle3dTurnedCam() {
  const V = battleStage.V,
    C = battle3d.cam || (battle3d.cam = {}),
    [x, z] = battleTurnPoint(V.x, V.z, battle3d.yaw, actionCenter, [0, 0]);
  return Object.assign(C, V, { x, z, yaw: V.yaw + battle3d.yaw });
}
/* ================= RF-2: THE THROWN PYRAMID =================
   battleStage.coin (battle-stage.js pyramidArc and the catch) says where it is and how it lies:
   - in the air (C.fly): it tumbles about a tilted axis through its middle (C.tum radians, C.ax the axis);
   - on the ground: it stands point up, rocked on one edge of its base by C.rot (the wobbles: + one way, - the other);
   - C.tip: it landed balanced on its point (the critical catch).
   Its recipe (art/coins/<id>.json, tools/build-pyramids.py) stands PYRAMID_LIFT up, so the model is put that much
   lower. C.y is its middle's height in the battle, the ground at 0 (as the particles'); on the ground that is
   PYRAMID_REST. The sizes are battle-stage.js's PYRAMID_* (its catch animation uses them too). */
const pyramidModelPath = kind => `coins/${kind}.json`;
function pyramidItem(C, T) {
  const [x, z] = T(C.x, C.z),
    k = PYRAMID_SCALE,
    mid = PYRAMID_LIFT + PYRAMID_HIGH / 2;
  let y, spin;
  if (C.fly) {
    /* the middle follows the arc; the model's own middle is mid above its base point */
    y = battle3d.gy + C.y - mid * k;
    spin = { a: C.ax || [0.6, 0.48, 0.64], an: C.tum || 0, c: [0, mid, 0] };
  } else {
    y = Math.max(standingHeightAt(x, z), battle3d.gy + C.y - PYRAMID_REST) - PYRAMID_LIFT * k;
    if (C.tip) spin = { a: [1, 0, 0], an: Math.PI + (C.rot || 0) * 0.5, c: [0, mid, 0] };
    else if (C.rot) {
      /* rocks on the base edge on the side it leans to */
      const h = PYRAMID_SIDE / 2;
      spin = { a: [0, 0, 1], an: C.rot, c: [C.rot > 0 ? -h : h, PYRAMID_LIFT, 0] };
    }
  }
  const it = pyramidWorldItem(C.kind, x, y, z, spin, C.sz);
  if (!it) return null;
  C.in3d = battleStage.t;
  /* the capstone glows a little; any pyramid glows as it seals */
  const glow = C.glow || 0;
  if (C.kind === 'capstone' || glow > 0.05)
    it.light = { p: [x, y + 0.4, z - 0.3], r: 1.6 + glow * 1.6, c: [0.5 + glow, 0.55 + glow, 0.75 + glow * 0.6] };
  return it;
}
/* VFX-2: a thrown pyramid's ribbon as the ribbon pass takes it (two vertices a point: the walk scene's place, the
   side, the erosion), or null when there is none (Reduced motion, the lowest quality, landed and eroded away) */
function ribbonVertices(C, T) {
  const V = battleStage.V,
    R = smearRibbon(C.trail, battleStage.t, battleRibbonCells(), V, C.arc ? C : null);
  const col = ribbonColour(C.kind);
  if (R.length < 2 || !col) return null;
  const E = ribbonEdges(R, V, C.rax),
    v = [];
  for (let i = 0; i < E.length; i++)
    for (let s = 0; s < 2; s++) {
      const [x, z] = T(E[i][s][0], E[i][s][2]);
      v.push(x, battle3d.gy + E[i][s][1], z, s ? 1 : -1, R[i].e);
    }
  return { v, col: ribbonTone(col), core: RIBBON_CORE };
}
/* VFX-2: a pyramid's own colour for its ribbon (its recipe's first layer); the mail move's coin takes the gold
   pyramid's. null while the recipe isn't loaded (no ribbon for that moment) */
function ribbonColour(kind) {
  const k = PYRAMIDS && PYRAMIDS[kind] ? kind : 'gold_pyramid',
    rec = PYRAMIDS && PYRAMIDS[k] ? loadPropModelRecipe(pyramidModelPath(k)) : null,
    col = rec && rec.layers && rec.layers[0] && rec.layers[0].col;
  return typeof col === 'string' && col[0] === '#' ? col : null;
}
/* VFX-1: an afterimage's look (walk/prop-look.js's shape): its colours' value times 1 + glow, a little more
   saturated, nothing else changed; one per glow, made once */
const SMEAR_LOOKS = new Map();
function smearLook(glow) {
  let L = SMEAR_LOOKS.get(glow);
  if (!L)
    SMEAR_LOOKS.set(
      glow,
      (L = {
        key: 'smear' + glow,
        hsv: [0, glow * 0.25, glow, 1],
        wear: [0, 0, 0, 0],
        tint: [1, 1, 1, 0],
        mask: [0, 0],
        size: 1,
        rot: 0,
        lean: 0,
      })
    );
  return L;
}
/* a catch pyramid's model as a world item, in the walk scene's metres: y its base point (the recipe's own lift
   included), spin its turn (setItemSpin in prop-models.js); null while it can't be drawn (3D props off, the GPU
   lost, its recipe not loaded yet). The opening's throws use it too (cutscene/opening.js) */
export function pyramidWorldItem(kind, x, y, z, spin, size = 1) {
  if (typeof propModelsOn !== 'function' || !propModelsOn() || typeof PYRAMIDS === 'undefined' || !PYRAMIDS[kind])
    return null;
  const path = pyramidModelPath(kind),
    rec = loadPropModelRecipe(path);
  if (!rec || !(rec.layers || []).length) return null;
  return {
    k: 'pyramid',
    /* its icon: never drawn (a model item), but the renderer sorts and keys items by their picture */
    im: pyramidCanvas(kind, 32),
    vox: rec,
    voxPath: path,
    p: { x, z, s: PYRAMID_SCALE * size, rot: PYRAMID_YAW },
    x,
    y,
    z,
    w: 16,
    h: 16,
    mpp: 0.03,
    ox: -8,
    oy: -16,
    flip: 1,
    fade: 1,
    spin,
    light: null,
  };
}
