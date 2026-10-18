'use strict';
/* ================= BATTLE STAGE =================
   A perspective ground cast on the inside of a sphere, billboard props, rigged billboards and 3D particles.
   The stage fills the whole screen. A fixed 224×168 "frame" (where the two billionaires stand) is placed in the
   space the HUD leaves free, and the world simply continues around it.
   Depth of field is computed in the canvas: the ground is blurred per row by its distance from the focus plane,
   sprites and props by their depth. Nothing full-screen is blurred by CSS, which keeps 120 FPS realistic.
   Ground, walls, far land, props, clouds and foregrounds come from art/battle/*.png; props can also be scene props (art/scene/props).
   The camera is directed (pushes and pans with the action, intro dollies, a pull-back on faints), drifts in a slow orbit while idle,
   and is guarded so the two billionaires never leave the free frame. Reduced motion keeps it on the home shot. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import {
  A,
  BACKDROPS,
  GD,
  MOVES,
  TC,
  TYPEFX,
  activeBattle,
  battleFreeArea,
  battleGLLayout,
  battleGLStart,
  battleGLStop,
  battleLayoutChanged,
  hudHit,
  hudPop,
  maxHp,
  platesTick,
  provide,
  reducedMotion,
  saveData,
  stopWalkView,
  walkView,
} from './hooks.js';
import { $, clamp, random } from './util.js';
import { FRAME, frameCount, frameStop, frameTask, userFps } from './frame-scheduler.js';
import {
  ART_CACHE,
  artLoad,
  artPixels,
  bayerThreshold,
  coinCanvas,
  hexToRgb,
  iconCanvas,
  makeCanvas,
  mixRgb,
  packPixel,
  whiteCopy,
} from './art.js';
import { WD, humanFrames, humanPose } from './person-art.js';
import { drawRig, rigFrame, rigParts, rigTint } from './skeleton-rig.js';
/* eslint-disable no-func-assign */
expose({
  ACTOR_RIG_SCALES: [() => ACTOR_RIG_SCALES],
  AREAS: [() => AREAS],
  BATTLE_STAGE_ART: [() => BATTLE_STAGE_ART],
  CAMERA_KEYS: [() => CAMERA_KEYS],
  CANVAS_FILTER_WORKS: [() => CANVAS_FILTER_WORKS],
  CLOSE_UP_CAMERAS: [() => CLOSE_UP_CAMERAS],
  EASE: [() => EASE],
  FOCAL_LENGTH: [() => FOCAL_LENGTH],
  FORMATIONS: [() => FORMATIONS],
  FORMATION_SCALES: [() => FORMATION_SCALES],
  GLOWING_PARTICLES: [() => GLOWING_PARTICLES],
  GROUND_BLUR_SCALE: [() => GROUND_BLUR_SCALE],
  GROUND_CENTER_X: [() => GROUND_CENTER_X],
  GROUND_CENTER_Z: [() => GROUND_CENTER_Z],
  GROUND_MAX_DEPTH: [() => GROUND_MAX_DEPTH],
  GROUND_SPHERE_RADIUS: [() => GROUND_SPHERE_RADIUS],
  GROUND_TEXTURE_PX_PER_METER: [() => GROUND_TEXTURE_PX_PER_METER],
  GROUND_TEXTURE_SIZE: [() => GROUND_TEXTURE_SIZE],
  HIT_SPRITES_BY_TYPE: [() => HIT_SPRITES_BY_TYPE],
  HORIZON_IN_FRAME: [() => HORIZON_IN_FRAME],
  LEAF_COLORS: [() => LEAF_COLORS],
  PROP_SWAY: [() => PROP_SWAY],
  PULL_BACK_CAMERA: [() => PULL_BACK_CAMERA],
  SOFT_BLUR_PAD: [() => SOFT_BLUR_PAD],
  SPRITE_BLUR_SCALE: [() => SPRITE_BLUR_SCALE],
  STAGE_FRAME_HEIGHT: [() => STAGE_FRAME_HEIGHT],
  STAGE_FRAME_WIDTH: [() => STAGE_FRAME_WIDTH],
  actionCenter: [() => actionCenter],
  actorBuffer: [() => actorBuffer, v => (actorBuffer = v)],
  actorCenter: [() => actorCenter, v => (actorCenter = v)],
  actorMetersPerPixel: [() => actorMetersPerPixel],
  actorPositions: [() => actorPositions],
  actorTeam: [() => actorTeam],
  actorTop: [() => actorTop, v => (actorTop = v)],
  actorWorldPoint: [() => actorWorldPoint, v => (actorWorldPoint = v)],
  adaptBattleStageQuality: [() => adaptBattleStageQuality, v => (adaptBattleStageQuality = v)],
  addDrawItem: [() => addDrawItem, v => (addDrawItem = v)],
  addParticle: [() => addParticle, v => (addParticle = v)],
  artKey: [() => artKey],
  battleStage: [() => battleStage],
  battleStageArtFiles: [() => battleStageArtFiles, v => (battleStageArtFiles = v)],
  battleStageCatch: [() => battleStageCatch, v => (battleStageCatch = v)],
  battleStageChromaticFlash: [() => battleStageChromaticFlash, v => (battleStageChromaticFlash = v)],
  battleStageDraw: [() => battleStageDraw, v => (battleStageDraw = v)],
  battleStageDrawEffects: [() => battleStageDrawEffects, v => (battleStageDrawEffects = v)],
  battleStageFlash: [() => battleStageFlash, v => (battleStageFlash = v)],
  battleStageFlush: [() => battleStageFlush, v => (battleStageFlush = v)],
  battleStageFocus: [() => battleStageFocus, v => (battleStageFocus = v)],
  battleStageFormat: [() => battleStageFormat, v => (battleStageFormat = v)],
  battleStageFrame: [() => battleStageFrame, v => (battleStageFrame = v)],
  battleStageLayout: [() => battleStageLayout, v => (battleStageLayout = v)],
  battleStagePlay: [() => battleStagePlay, v => (battleStagePlay = v)],
  battleStagePrepare: [() => battleStagePrepare, v => (battleStagePrepare = v)],
  battleStageProject: [() => battleStageProject],
  battleStageProjectInto: [() => battleStageProjectInto, v => (battleStageProjectInto = v)],
  battleStageProjectWith: [() => battleStageProjectWith, v => (battleStageProjectWith = v)],
  battleStageResize: [() => battleStageResize, v => setBattleStageResize(v)],
  battleStageResolutionScale: [() => battleStageResolutionScale, v => (battleStageResolutionScale = v)],
  battleStageRingPhase: [() => battleStageRingPhase],
  battleStageSelect: [() => battleStageSelect, v => (battleStageSelect = v)],
  battleStageStart: [() => battleStageStart, v => setBattleStageStart(v)],
  battleStageStop: [() => battleStageStop, v => (battleStageStop = v)],
  battleStageTargets: [() => battleStageTargets, v => (battleStageTargets = v)],
  battleStageToCss: [() => battleStageToCss, v => (battleStageToCss = v)],
  blinkActor: [() => blinkActor, v => (blinkActor = v)],
  blurAt: [() => blurAt, v => (blurAt = v)],
  blurFloorByDepth: [() => blurFloorByDepth, v => (blurFloorByDepth = v)],
  boxBlurColumns: [() => boxBlurColumns, v => (boxBlurColumns = v)],
  boxBlurRows: [() => boxBlurRows, v => (boxBlurRows = v)],
  burst: [() => burst, v => (burst = v)],
  buzz: [() => buzz, v => ((buzz = v), provide({ buzz }))],
  camApply: [() => camApply, v => (camApply = v)],
  camAt: [() => camAt],
  camBusy: [() => camBusy],
  camHome: [() => camHome, v => (camHome = v)],
  camTo: [() => camTo, v => (camTo = v)],
  camUpdate: [() => camUpdate, v => (camUpdate = v)],
  cameraGuardPose: [() => cameraGuardPose],
  cameraOverflow: [() => cameraOverflow, v => (cameraOverflow = v)],
  castFloor: [() => castFloor, v => (castFloor = v)],
  cloudShadows: [() => cloudShadows, v => (cloudShadows = v)],
  coinArc: [() => coinArc, v => (coinArc = v)],
  drawActor: [() => drawActor, v => (drawActor = v)],
  drawBillboard: [() => drawBillboard, v => (drawBillboard = v)],
  drawForegrounds: [() => drawForegrounds, v => (drawForegrounds = v)],
  drawList: [() => drawList],
  drawListLength: [() => drawListLength, v => (drawListLength = v)],
  drawParticles: [() => drawParticles, v => (drawParticles = v)],
  drawPixelRing: [() => drawPixelRing, v => (drawPixelRing = v)],
  drawProp: [() => drawProp, v => (drawProp = v)],
  drawSelectionRing: [() => drawSelectionRing, v => (drawSelectionRing = v)],
  drawShadow: [() => drawShadow, v => (drawShadow = v)],
  drawTrainer: [() => drawTrainer, v => (drawTrainer = v)],
  dueEvents: [() => dueEvents],
  floorBuffers: [() => floorBuffers, v => (floorBuffers = v)],
  floorKey: [() => floorKey, v => (floorKey = v)],
  floorLowFrom: [() => floorLowFrom, v => (floorLowFrom = v)],
  floorUpdate: [() => floorUpdate, v => (floorUpdate = v)],
  formatFocus: [() => formatFocus],
  groundRing: [() => groundRing, v => (groundRing = v)],
  handheld: [() => handheld, v => (handheld = v)],
  hitFx: [() => hitFx, v => (hitFx = v)],
  hitStop: [() => hitStop, v => (hitStop = v)],
  hitWeight: [() => hitWeight, v => (hitWeight = v)],
  homeCamera: [() => homeCamera],
  lightShafts: [() => lightShafts, v => (lightShafts = v)],
  newActorState: [() => newActorState],
  particleSprite: [() => particleSprite, v => (particleSprite = v)],
  propDef: [() => propDef, v => (propDef = v)],
  punch: [() => punch, v => (punch = v)],
  ringFx: [() => ringFx, v => (ringFx = v)],
  scheduleAt: [() => scheduleAt, v => (scheduleAt = v)],
  setActorAction: [() => setActorAction, v => (setActorAction = v)],
  setTrainerAction: [() => setTrainerAction, v => (setTrainerAction = v)],
  shrinkForSoftBlur: [() => shrinkForSoftBlur, v => (shrinkForSoftBlur = v)],
  softDraw: [() => softDraw, v => (softDraw = v)],
  spawnAmbientParticles: [() => spawnAmbientParticles, v => (spawnAmbientParticles = v)],
  speedLines: [() => speedLines, v => (speedLines = v)],
  throwOrigin: [() => throwOrigin],
  trainerBattleFrame: [() => trainerBattleFrame, v => (trainerBattleFrame = v)],
  trainerMetersPerPixel: [() => trainerMetersPerPixel],
  tween: [() => tween, v => (tween = v)],
  typeSprite: [() => typeSprite],
});
/* eslint-enable no-func-assign */
provide({ buzz });
export function setBattleStageResize(v) {
  battleStageResize = v; // eslint-disable-line no-func-assign
  provide({ battleStageResize });
}
export function setBattleStageStart(v) {
  battleStageStart = v; // eslint-disable-line no-func-assign
  provide({ battleStageStart });
}
/* to-module: end */
export const STAGE_FRAME_WIDTH = 224,
  STAGE_FRAME_HEIGHT = 168,
  FOCAL_LENGTH = 170,
  GROUND_SPHERE_RADIUS = 300,
  GROUND_MAX_DEPTH = 330,
  HORIZON_IN_FRAME = 51;
export const actorPositions = [
    { x: -0.88, z: 2.6 },
    { x: 1.72, z: 5.7 },
  ],
  ACTOR_RIG_SCALES = [1.4, 1, 1.4, 1, 1.4],
  actorMetersPerPixel = actorPositions.map(p => p.z / FOCAL_LENGTH);
/* v33: actors 0..4 (0 yours, 1 theirs, 2 your second, 3 their second, 4 your third). Where each stands, per battle format.
   Yours stay staggered in front so their backs don't hide each other; an Alpha stands back and alone. */
const actorTeam = i => (i === 1 || i === 3 ? 1 : 0);
const FORMATIONS = {
  single: [
    { x: -0.88, z: 2.6 },
    { x: 1.72, z: 5.7 },
  ],
  double: [
    { x: -1.62, z: 2.8 },
    { x: 1.0, z: 6.2 },
    { x: -0.12, z: 2.45 },
    { x: 2.55, z: 5.45 },
  ],
  alpha: [
    { x: -1.05, z: 2.45 },
    { x: 2.15, z: 6.5 },
    { x: -2.45, z: 3.05 },
    { x: 4, z: 9 },
    { x: 0.3, z: 3.15 },
  ],
};
const FORMATION_SCALES = { single: [1, 1], double: [0.86, 1, 0.86, 1], alpha: [0.8, 1, 0.8, 1, 0.8] };
function battleStageFormat(f) {
  const L = FORMATIONS[f] || FORMATIONS.single;
  actorPositions.length = 0;
  actorMetersPerPixel.length = 0;
  L.forEach((p, i) => {
    actorPositions[i] = { x: p.x, z: p.z };
    actorMetersPerPixel[i] = p.z / FOCAL_LENGTH;
  });
  battleStage.s = actorPositions.map((p, i) =>
    Object.assign(newActorState(), { fs: (FORMATION_SCALES[f] || FORMATION_SCALES.single)[i] || 1 })
  );
  battleStage.buf = actorPositions.map(() => makeCanvas(10, 10));
  battleStage.fmt = f || 'single';
  formatFocus.wide.zf = f === 'alpha' ? 5.2 : f === 'double' ? 4.6 : 4.3;
  Object.assign(
    homeCamera,
    { single: { x: 0, y: 1.6, z: 0 }, double: { x: 0.15, y: 1.82, z: -0.85 }, alpha: { x: 0.05, y: 1.95, z: -1.15 } }[
      battleStage.fmt
    ] || { x: 0, y: 1.6, z: 0 }
  );
  actionCenter.x = (actorPositions[0].x + actorPositions[1].x) / 2;
  actionCenter.z = (actorPositions[0].z + actorPositions[1].z) / 2;
  formatFocus.foe.zf = actorPositions[1].z;
  formatFocus.me.zf = actorPositions[0].z;
  battleStage.sel = null;
  battleStage.tg = null;
}
const homeCamera = { x: 0, y: 1.6, z: 0, yaw: 0, hz: 0 };
const CLOSE_UP_CAMERAS = [
  { x: -0.5, y: 1.78, z: -0.55, yaw: -0.11, hz: -8 },
  { x: 0.8, y: 1.4, z: 1.1, yaw: 0.09, hz: 8 },
];
export const AREAS = BACKDROPS;
const GROUND_CENTER_X = 0.55,
  GROUND_CENTER_Z = 3.9,
  GROUND_TEXTURE_SIZE = 512,
  GROUND_TEXTURE_PX_PER_METER = 16;
/* ---------- scene state ---------- */
export const EASE = {
  lin: t => t,
  out: t => 1 - (1 - t) * (1 - t),
  in: t => t * t,
  io: t => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
  out3: t => 1 - Math.pow(1 - t, 3),
  back: t => {
    const c = 1.7;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
};
const newActorState = () => ({
  sp: null,
  gold: false,
  show: false,
  ox: 0,
  oy: 0,
  sc: 1,
  a: 1,
  white: 0,
  dark: 0,
  blinkUntil: 0,
  seed: random() * 6,
  act: null,
  st: null,
  big: 1,
  boss: false,
});
export const battleStage = {
  on: false,
  t: 0,
  last: 0,
  hold: 0,
  area: 'grass',
  u: 2,
  L: null,
  cv: null,
  cx: null,
  fgc: null,
  fx: null,
  near: null,
  far: null,
  wall: null,
  fg: null,
  props: [],
  clouds: [],
  buf: [null, null],
  small: null,
  skyC: null,
  fogC: null,
  cam: Object.assign({}, homeCamera),
  V: Object.assign({}, homeCamera),
  drift: { w: 0, tq: -1, x: 0, y: 0, z: 0, yaw: 0, hz: 0 },
  hand: { a: 0 },
  camT: 0,
  css: { r: 0, z: 0 },
  shk: 0,
  focusK: null,
  dof: { zf: 4.2, ap: 0.6 },
  tws: [],
  evs: [],
  parts: [],
  oil: false,
  ring: null,
  coin: null,
  s: [newActorState(), newActorState()],
  tr: [
    { who: null, show: false, x: 0, a: 1 },
    { who: null, show: false, x: 0, a: 1 },
  ],
  el: {},
  leafy: [],
  glint: [],
  F: null,
  floorKey: '',
  q: { lvl: 0, since: 0, lowT: 0, highT: 0 },
  stT: 0,
  goldT: 0,
  speed: 1,
};
export const BATTLE_STAGE_ART = {};
const artKey = area => (AREAS[area] && AREAS[area].art) || area;
/* a prop kind is either a battle prop (art/battle/props, 30 px per meter) or one of the scene props of the walking world
   (GD.scenery.props, art/scene/props, 34 px per meter). Foliage sways a little in the wind. */
const PROP_SWAY = { tree: 0.3, bush: 0.2, flowers: 0.5, cactus: 0 };
function propDef(kind) {
  const M = ARTMAN.battle.props[kind];
  if (M)
    return {
      src: `battle/props/${kind}.png`,
      ox: M.ox,
      oy: M.oy,
      h: M.h,
      flat: M.flat,
      k: 1,
      sway: PROP_SWAY[kind] || 0,
      shadow: null,
    };
  const G = typeof GD !== 'undefined' && GD.scenery && GD.scenery.props ? GD.scenery.props[kind] : null;
  if (!G || !G.img) return null;
  return {
    src: G.img,
    ox: G.ox,
    oy: G.oy,
    h: 0,
    flat: G.flat,
    k: 30 / ((GD.scenery && GD.scenery.ppu) || 34),
    sway: G.sway || 0,
    shadow: G.shadow == null ? null : G.shadow,
  };
}
export function battleStageArtFiles(area) {
  const A = AREAS[area],
    k = artKey(area),
    M = ARTMAN.battle,
    L = [`battle/${k}_ground.png`, `battle/${k}_foreground.png`];
  if (A.wall) L.push(`battle/${A.wall}_walls.png`);
  if (A.far) L.push(`battle/far_${A.far}.png`);
  ((M.areas[k] || {}).props || []).forEach(p => {
    const d = propDef(p.kind);
    if (d) L.push(d.src);
  });
  if (!A.indoor) M.clouds.forEach((c, i) => L.push(`battle/cloud_${i}.png`));
  return [...new Set(L)];
}
/* load (once) everything a stage needs; pixel arrays for ground, far land and walls */
export async function battleStagePrepare(area) {
  area = AREAS[area] ? area : 'grass';
  if (BATTLE_STAGE_ART[area]) return BATTLE_STAGE_ART[area];
  const A = AREAS[area],
    k = artKey(area);
  await artLoad(battleStageArtFiles(area));
  const near = await artPixels(`battle/${k}_ground.png`),
    far = A.far ? await artPixels(`battle/far_${A.far}.png`) : null,
    wall = A.wall ? await artPixels(`battle/${A.wall}_walls.png`) : null;
  const M = ARTMAN.battle,
    mk = (p, o) => {
      const im = ART_CACHE.img[p];
      return { c: im, ox: o.ox, oy: o.oy, W: im.naturalWidth, H: im.naturalHeight };
    };
  const props = [];
  ((M.areas[k] || {}).props || []).forEach((p, n) => {
    const d = propDef(p.kind);
    if (!d) return;
    const img = mk(d.src, d);
    if (!img.W || !img.H) return;
    const h = d.h || (img.H * d.k) / 30;
    props.push({
      kind: p.kind,
      x: p.x,
      z: p.z,
      h,
      flat: d.flat,
      k: d.k,
      sway: d.sway,
      ph: (n * 2.39996) % (Math.PI * 2),
      sh: d.flat ? 0 : d.shadow != null ? d.shadow * 0.6 : 0.45 * Math.min(2, h * 0.5),
      img,
      soft: {},
    });
  });
  const clouds = A.indoor ? [] : M.clouds.map((o, i) => mk(`battle/cloud_${i}.png`, o));
  return (BATTLE_STAGE_ART[area] = { near, far, wall, fg: ART_CACHE.img[`battle/${k}_foreground.png`], props, clouds });
}
/* ---------- layout: where the frame goes, how big a stage pixel is ---------- */
function battleStageResolutionScale() {
  return battleStage.q.lvl >= 2 ? 1 : 2;
}
function battleStageLayout() {
  const el = $('#battle');
  if (!el) return null;
  const vw = el.clientWidth,
    vh = el.clientHeight,
    lay = el.dataset.layout;
  const free = battleFreeArea(vw, vh, lay); /* {x,y,w,h} in CSS px, left by the HUD */
  let u = Math.min(free.w / STAGE_FRAME_WIDTH, free.h / STAGE_FRAME_HEIGHT);
  if (u > 3) u = 3 + (u - 3) * 0.55;
  /* big screens show more world around the action instead of ever bigger pixels */ u = clamp(u, 1.35, 5.2);
  const fw = STAGE_FRAME_WIDTH * u,
    fh = STAGE_FRAME_HEIGHT * u,
    fx = free.x + (free.w - fw) / 2,
    fy = free.y + Math.max(0, (free.h - fh) * (lay === 'landscape' ? 0.5 : 0.42));
  const M = 14,
    LW = Math.ceil(vw / u) + 2 * M,
    LH = Math.ceil(vh / u) + 2 * M,
    R = battleStageResolutionScale();
  return {
    vw,
    vh,
    u,
    M,
    LW,
    LH,
    R,
    cx: M + (fx + fw / 2) / u,
    h0: M + fy / u + HORIZON_IN_FRAME,
    fx,
    fy,
    fw,
    fh,
    free,
    lay,
    ox: fx + fw / 2,
    oy: fy + fh * 0.6,
    ver: (battleStage.L ? battleStage.L.ver : 0) + 1,
  };
}
export function battleStageResize() {
  if (!battleStage.cv) return;
  const L = battleStageLayout();
  if (!L) return;
  battleStage.L = L;
  battleStage.u = L.u;
  const R = L.R;
  for (const c of [battleStage.cv, battleStage.fgc]) {
    c.width = L.LW * R;
    c.height = L.LH * R;
    c.style.width = L.LW * L.u + 'px';
    c.style.height = L.LH * L.u + 'px';
    c.style.left = -L.M * L.u + 'px';
    c.style.top = -L.M * L.u + 'px';
  }
  battleStage.cx = battleStage.cv.getContext('2d');
  battleStage.fx = battleStage.fgc.getContext('2d');
  const st = $('#stage');
  if (st) {
    st.style.setProperty('--u', L.u + 'px');
    st.style.setProperty('--fx', L.fx + 'px');
    st.style.setProperty('--fy', L.fy + 'px');
    st.style.setProperty('--fw', L.fw + 'px');
    st.style.setProperty('--fh', L.fh + 'px');
  }
  battleStage.el = { w: $('#camWorld'), fg: $('#camFg'), bl: $('#bloom') };
  for (const e of [battleStage.el.w, battleStage.el.fg])
    if (e) e.style.transformOrigin = `${L.ox.toFixed(1)}px ${L.oy.toFixed(1)}px`;
  battleStage.F = null;
  battleStage.floorKey = '';
  battleStage.camKey = '';
  battleStage.fgKey = '';
  if (typeof battleLayoutChanged === 'function') battleLayoutChanged(L);
  if (battleStage.gl && typeof battleGLLayout === 'function') battleGLLayout();
}
export function battleStageStart(area) {
  battleStage.area = AREAS[area] ? area : 'grass';
  const A = AREAS[battleStage.area],
    G = BATTLE_STAGE_ART[battleStage.area];
  battleStage.cv = $('#cvWorld');
  battleStage.fgc = $('#cvFg');
  battleStage.near = G.near;
  battleStage.far = G.far;
  battleStage.wall = G.wall;
  battleStage.fg = G.fg;
  battleStage.skyC = A.sky.map(hexToRgb);
  battleStage.fogC = hexToRgb(A.fog);
  battleStage.props = G.props;
  battleStage.leafy = A.indoor ? [] : G.props.filter(p => /tree|mushroom_giant/.test(p.kind) && p.z < 24);
  battleStage.glint = G.props.filter(p => /crystal|fountain/.test(p.kind));
  battleStage.clouds = G.clouds.map((img, i) => ({
    img,
    soft: {},
    x: -14 + i * 6 + random() * 4,
    y: 7 + random() * 5,
    z: 10 + i * 7 + random() * 5,
    v: 0.12 + random() * 0.12,
  }));
  battleStage.small = makeCanvas(10, 10);
  battleStageFormat((typeof activeBattle !== 'undefined' && activeBattle && activeBattle.fmt) || 'single');
  battleStage.tr = [
    { who: null, show: false, x: 0, a: 1 },
    { who: null, show: false, x: 0, a: 1 },
  ];
  battleStage.tws = [];
  battleStage.evs = [];
  battleStage.parts = [];
  battleStage.cam = Object.assign({}, homeCamera);
  Object.assign(battleStage.V, homeCamera);
  Object.assign(battleStage.drift, { w: 0, tq: -1, x: 0, y: 0, z: 0, yaw: 0, hz: 0 });
  battleStage.hand.a = 0;
  battleStage.camT = 0;
  battleStage.css = { r: 0, z: 0 };
  battleStage.oil = false;
  battleStage.ring = null;
  battleStage.coin = null;
  battleStage.shk = 0;
  battleStage.hold = 0;
  battleStage.focusK = null;
  battleStage.q.since = performance.now();
  battleStage.gl = typeof battleGLStart === 'function' && battleGLStart();
  document.body.classList.toggle('battle-3d', !!battleStage.gl);
  if (
    !battleStage.gl &&
    typeof walkView !== 'undefined' &&
    walkView.cv &&
    typeof activeBattle !== 'undefined' &&
    activeBattle
  ) {
    const cv = walkView.cv;
    stopWalkView();
    cv.hidden = true;
  }
  battleStageResize();
  battleStageFocus('wide', true);
  if (battleStage.gl) drawForegrounds();
  if (!battleStage.on) {
    battleStage.on = true;
    frameTask('scene', battleStageFrame);
  }
}
export function battleStageStop() {
  battleStage.on = false;
  frameStop('scene');
  if (battleStage.gl && typeof battleGLStop === 'function') battleGLStop();
  battleStage.gl = false;
  document.body.classList.remove('battle-3d');
}
function tween(o, p, to, dur, ease = 'out', delay = 0) {
  battleStage.tws.push({
    o,
    p,
    to,
    dur: Math.max(1, dur),
    ease: EASE[ease] || EASE.out,
    st: battleStage.t + delay,
    from: null,
  });
}
function scheduleAt(ms, fn) {
  battleStage.evs.push({ t: battleStage.t + ms, fn });
}
/* skip to the end of whatever is still playing. Camera, lens and zoom glide to where they were headed instead of cutting there */
function battleStageFlush() {
  const glide = new Map(),
    G = [battleStage.cam, battleStage.css, battleStage.dof, battleStage.hand];
  battleStage.tws
    .sort((a, b) => a.st + a.dur - b.st - b.dur)
    .forEach(w => {
      if (G.includes(w.o) && !reducedMotion) {
        let m = glide.get(w.o);
        if (!m) glide.set(w.o, (m = {}));
        m[w.p] = w.to;
      } else w.o[w.p] = w.to;
    });
  battleStage.tws = [];
  glide.forEach((m, o) => {
    for (const p in m) tween(o, p, m[p], 170, 'out');
  });
  const ev = battleStage.evs.sort((a, b) => a.t - b.t);
  battleStage.evs = [];
  ev.forEach(e => e.fn());
}
function setActorAction(i, k, dur = 1000) {
  battleStage.s[i].act = { k, t0: battleStage.t, dur };
}
/* depth of field: focus distance and aperture, eased like a real focus pull */
const formatFocus = {
  wide: { zf: 4.3, ap: 0.55 },
  foe: { zf: actorPositions[1].z, ap: 1.35 },
  me: { zf: actorPositions[0].z, ap: 1.35 },
  none: { zf: 4, ap: 0 },
};
export function battleStageFocus(f, now) {
  if (battleStage.focusK === f && !now) return;
  battleStage.focusK = f;
  const F = formatFocus[f] || formatFocus.none,
    ap = reducedMotion ? 0 : F.ap;
  if (now) {
    battleStage.dof.zf = F.zf;
    battleStage.dof.ap = ap;
    return;
  }
  tween(battleStage.dof, 'zf', F.zf, 380, 'io');
  tween(battleStage.dof, 'ap', ap, 380, 'io');
}
const SPRITE_BLUR_SCALE = 4.6;
function blurAt(z) {
  const d = battleStage.dof;
  if (d.ap <= 0 || battleStage.q.lvl >= 3) return 0;
  return Math.min(4, d.ap * SPRITE_BLUR_SCALE * Math.abs(1 / Math.max(0.3, z) - 1 / d.zf));
}
function battleStageFlash(col, a, dur) {
  const f = $('#flash');
  if (!f) return;
  f.style.transition = 'none';
  f.style.background = col;
  f.style.opacity = a;
  void f.offsetWidth;
  f.style.transition = `opacity ${dur}ms ease-out`;
  f.style.opacity = 0;
}
function battleStageChromaticFlash(ms = 160) {
  const w = $('#camWorld');
  if (!w || reducedMotion) return;
  w.classList.add('ca');
  setTimeout(() => w.classList.remove('ca'), ms);
}
function hitStop(ms) {
  if (!reducedMotion) battleStage.hold = performance.now() + ms;
}
export function buzz(p) {
  try {
    if ((saveData.preferences || {}).haptics !== false && navigator.vibrate) navigator.vibrate(p);
  } catch (e) {}
}
/* ---------- projection ---------- */
const battleStageProject = (X, Y, Z) => battleStageProjectWith(battleStage.V, X, Y, Z);
/* stage point to CSS pixels inside #battle (for HUD pop-ups) */
export function battleStageToCss(P) {
  if (!battleStage.L) return null;
  const q = battleStageProject(P.x, P.y, P.z);
  if (!q) return null;
  const L = battleStage.L,
    z = 1 + battleStage.css.z,
    cx = L.ox,
    cy = L.oy,
    x = (q.x - L.M) * L.u,
    y = (q.y - L.M) * L.u;
  return { x: cx + (x - cx) * z, y: cy + (y - cy) * z };
}
export function actorWorldPoint(i) {
  const s = battleStage.s[i] || newActorState(),
    p = actorPositions[i] || actorPositions[actorTeam(i)],
    V = [actorPositions[1].x - actorPositions[0].x, actorPositions[1].z - actorPositions[0].z],
    L = Math.hypot(V[0], V[1]),
    u = actorMetersPerPixel[i];
  return { x: p.x + (s.ox * u * V[0]) / L, z: p.z + (s.ox * u * V[1]) / L, y: -s.oy * u };
}
export function actorCenter(i) {
  const w = actorWorldPoint(i),
    s = battleStage.s[i];
  let h = 1.4;
  if (s && s.sp) {
    const R = rigParts(s.sp, s.gold, ACTOR_RIG_SCALES[i]);
    if (R) h = ((R.geo.base - R.geo.mid) * actorMetersPerPixel[i] * s.sc * (s.big || 1) * (s.fs || 1)) / R.k;
  }
  return { x: w.x, y: w.y + h, z: w.z };
}
export function actorTop(i) {
  const c = actorCenter(i),
    w = actorWorldPoint(i);
  return { x: c.x, y: w.y + (c.y - w.y) * (actorTeam(i) === 0 ? 1.55 : 1.9), z: c.z };
}
/* ---------- frame ---------- */
const dueEvents = [];
function battleStageFrame(ts, rawDt) {
  if (!battleStage.on) return;
  const w0 = performance.now();
  let dt = clamp(rawDt, 0, 50) * battleStage.speed;
  if (ts < battleStage.hold) dt = 0;
  battleStage.t += dt;
  const t = battleStage.t;
  /* tweens, timed events and particles are updated in place: no arrays are made per frame */
  const T = battleStage.tws;
  let n = 0;
  for (let i = 0; i < T.length; i++) {
    const w = T[i];
    let keep = true;
    if (t >= w.st) {
      if (w.from === null) w.from = w.o[w.p];
      const k = Math.min(1, (t - w.st) / w.dur);
      w.o[w.p] = w.from + (w.to - w.from) * w.ease(k);
      keep = k < 1;
    }
    if (keep) T[n++] = w;
  }
  T.length = n;
  const E = battleStage.evs;
  n = 0;
  for (let i = 0; i < E.length; i++) {
    const e = E[i];
    if (e.t <= t) dueEvents.push(e);
    else E[n++] = e;
  }
  E.length = n;
  for (let i = 0; i < dueEvents.length; i++) dueEvents[i].fn();
  dueEvents.length = 0;
  const s = dt / 1000,
    P = battleStage.parts;
  n = 0;
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    p.age += dt;
    if (p.age >= p.life) continue;
    p.vx += p.ax * s;
    p.vy += p.ay * s;
    p.vz += p.az * s;
    p.x += p.vx * s;
    p.y += p.vy * s;
    p.z += p.vz * s;
    if (p.floor && p.y < 0) {
      p.y = 0;
      p.vy *= -0.35;
      p.vx *= 0.6;
      p.vz *= 0.6;
    }
    P[n++] = p;
  }
  P.length = n;
  for (const c of battleStage.clouds) {
    c.x += c.v * s;
    if (c.x > 18) c.x = -18;
  }
  if (dt > 0 && !reducedMotion) spawnAmbientParticles(dt);
  battleStage.shk = Math.max(0, battleStage.shk - dt * 0.02);
  if (battleStage.cv && battleStage.cv.isConnected) {
    camUpdate(dt);
    battleStageDraw();
    camApply();
    if (typeof platesTick === 'function') platesTick();
  } else {
    battleStageStop();
    return;
  }
  const work = performance.now() - w0;
  frameCount(work);
  adaptBattleStageQuality(work);
}
/* ambient life: motes, drips, falling leaves, glints, status fizz, gold sparkle */
const LEAF_COLORS = ['#6FAE3F', '#9CC850', '#D7B447', '#4E8A3A'];
function spawnAmbientParticles(dt) {
  const A = AREAS[battleStage.area];
  if (battleStage.parts.length > 220) return;
  if (battleStage.oil && random() < dt / 18)
    addParticle({
      x: GROUND_CENTER_X - 7 + random() * 3,
      y: 0.1 + random() * 2.6,
      z: GROUND_CENTER_Z + (random() - 0.3) * 7,
      vx: 6 + random() * 4,
      vy: (random() - 0.4) * 0.6,
      life: 1500,
      col: random() < 0.5 ? '#E8CF96' : '#C9A866',
      size: 1,
    });
  if (random() < dt / 150) {
    const am = A.amb,
      x = GROUND_CENTER_X + (random() - 0.5) * 12,
      z = GROUND_CENTER_Z + random() * 9 - 1.5;
    if (am === 'pollen' || am === 'spore')
      addParticle({
        x,
        y: 0.3 + random() * 2.5,
        z,
        vx: 0.3 + random() * 0.3,
        vy: 0.1,
        life: 4200,
        col: am === 'pollen' ? '#FFF2A8' : '#B8F0C8',
        glow: 1,
        size: 1,
      });
    else if (am === 'drip') {
      if (random() < 0.5) addParticle({ x, y: 4.2, z, vy: -6, life: 900, col: '#6A5446', size: 1 });
    } else if (am === 'sand')
      addParticle({ x: x - 5, y: 0.2 + random() * 2, z, vx: 2.5 + random(), life: 3000, col: '#F2D2A0', size: 1 });
    else if (am !== 'none')
      addParticle({ x, y: 0.5 + random() * 3, z, vy: 0.1, life: 3000, col: '#FFFFFF', glow: 1, size: 1, twinkle: 1 });
  }
  /* leaves let go of the trees now and then; crystals and fountains catch the light */
  if (battleStage.leafy.length && random() < dt / 650) {
    const p = battleStage.leafy[Math.floor(random() * battleStage.leafy.length)],
      y = p.h * (0.45 + random() * 0.4);
    addParticle({
      x: p.x + (random() - 0.5) * p.h * 0.4,
      y,
      z: p.z + (random() - 0.5) * 0.6,
      vx: 0.35 + random() * 0.5,
      vy: -0.25,
      ax: 0.05,
      ay: -0.08,
      vz: -0.1,
      life: 2600 + y * 500,
      col: LEAF_COLORS[Math.floor(random() * LEAF_COLORS.length)],
      size: 1 + (random() < 0.4 ? 1 : 0),
      floor: 1,
    });
  }
  if (battleStage.glint.length && random() < dt / 420) {
    const p = battleStage.glint[Math.floor(random() * battleStage.glint.length)];
    addParticle({
      x: p.x + (random() - 0.5) * p.h * 0.5,
      y: p.h * (0.3 + random() * 0.6),
      z: p.z,
      life: 700,
      spr: 'spark',
      k: 0.6,
      glow: 1,
      twinkle: 1,
    });
  }
  battleStage.stT += dt;
  if (battleStage.stT > 700) {
    battleStage.stT = 0;
    for (let i = 0; i < battleStage.s.length; i++) {
      const sd = battleStage.s[i];
      if (!sd.show || !sd.st || sd.a < 0.5) continue;
      const T = actorTop(i);
      const sp = sd.st === 'aud' ? 'bolt' : sd.st === 'sub' ? 'zz' : sd.st === 'scn' ? 'flame' : 'spark';
      addParticle({
        x: T.x + (random() - 0.5) * 0.6,
        y: T.y + 0.2,
        z: T.z,
        vx: (random() - 0.5) * 0.3,
        vy: sd.st === 'aud' ? -0.6 : 0.7,
        life: 900,
        spr: sp,
        k: 0.9,
      });
    }
  }
  for (let i = 0; i < battleStage.s.length; i++) {
    const sd = battleStage.s[i];
    if (sd.boss && sd.show && sd.a > 0.5 && random() < dt / 90) {
      const w = actorWorldPoint(i),
        R = sd.sp ? rigParts(sd.sp, sd.gold, ACTOR_RIG_SCALES[i]) : null,
        hw = R ? (R.geo.hw * actorMetersPerPixel[i] * sd.big * (sd.fs || 1)) / R.k : 1,
        a = random() * 6.283;
      addParticle({
        x: w.x + Math.cos(a) * hw,
        y: 0.1 + random() * 0.4,
        z: w.z + Math.sin(a) * hw * 0.6,
        vx: Math.cos(a) * 0.15,
        vy: 0.9 + random() * 0.8,
        life: 1300,
        col: random() < 0.5 ? '#FF5A7A' : '#B03CFF',
        glow: 1,
        size: 2,
      });
    }
  }
  battleStage.goldT += dt;
  if (battleStage.goldT > 260) {
    battleStage.goldT = 0;
    for (let i = 0; i < battleStage.s.length; i++) {
      const sd = battleStage.s[i];
      if (!sd.show || !sd.gold || sd.a < 0.5) continue;
      const c = actorCenter(i);
      addParticle({
        x: c.x + (random() - 0.5) * 1.4,
        y: c.y + (random() - 0.4) * 1.6,
        z: c.z,
        vy: 0.3,
        life: 700,
        spr: 'spark',
        k: 0.8,
        glow: 1,
        twinkle: 1,
      });
    }
  }
}
/* adaptive quality: drop render detail if frames run long, restore when there's headroom */
function adaptBattleStageQuality(work) {
  const Q = battleStage.q,
    now = performance.now(),
    target = Math.min(userFps(), FRAME.hz || 60),
    budget = 1000 / target,
    fps = FRAME.meter.fps;
  if (now - Q.since < 1500 || !fps || battleStage.lockQ) return;
  const slow = fps < target * 0.82 || work > budget * 0.85,
    fast = fps >= target * 0.95 && work < budget * 0.32;
  Q.lowT = slow ? Q.lowT + 1 : 0;
  Q.highT = fast ? Q.highT + 1 : 0;
  if (Q.lowT > Math.max(20, target * 0.6) && Q.lvl < 3) {
    Q.lvl++;
    Q.lowT = 0;
    Q.since = now;
    Q.dropped = (Q.dropped || 0) + 1;
    if (Q.lvl === 2) battleStageResize();
    battleStage.floorKey = '';
  } else if (Q.highT > target * 6 && Q.lvl > 0 && (Q.dropped || 0) < 4) {
    Q.lvl--;
    Q.highT = 0;
    Q.since = now;
    if (Q.lvl === 1) battleStageResize();
    battleStage.floorKey = '';
  }
}
/* the 2D part of the camera: zoom punches, roll, shake and a handheld wobble, applied as CSS transforms (no re-render needed).
   The near foreground layer moves a little more than the world, which reads as parallax. */
function camApply() {
  const t = battleStage.t,
    L = battleStage.L,
    u = L.u,
    el = battleStage.el,
    still = reducedMotion;
  let sx = 0,
    sy = 0;
  if (battleStage.shk > 0.3 && !still) {
    sx = (random() - 0.5) * battleStage.shk;
    sy = (random() - 0.5) * battleStage.shk;
  }
  const ha = still ? 0 : battleStage.hand.a;
  if (ha > 0.01) {
    sx += ha * (Math.sin(t * 0.0113) * 1.1 + Math.sin(t * 0.0271 + 1.7) * 0.55);
    sy += ha * (Math.sin(t * 0.0097 + 0.6) * 0.8 + Math.sin(t * 0.0233 + 2.9) * 0.45);
  }
  const breathe = still ? 0 : 0.006 * Math.sin(t / 3100),
    z = 1 + (still ? 0 : battleStage.css.z) + breathe,
    r = still ? 0 : battleStage.css.r + 0.004 * Math.sin(t / 4700) + ha * 0.0035 * Math.sin(t * 0.0079 + 0.3);
  const V = battleStage.V,
    key =
      z.toFixed(4) + r.toFixed(4) + sx.toFixed(2) + sy.toFixed(2) + V.yaw.toFixed(4) + V.x.toFixed(3) + V.hz.toFixed(2);
  if (key === battleStage.camKey) return;
  battleStage.camKey = key;
  if (el.w)
    el.w.style.transform = `scale(${z.toFixed(4)}) rotate(${r.toFixed(4)}rad) translate(${(-sx * u).toFixed(2)}px,${(-sy * u).toFixed(2)}px)`;
  if (el.fg) {
    const zz = 1 + (z - 1) * 1.3;
    el.fg.style.transform = `scale(${zz.toFixed(4)}) rotate(${(r * 1.2).toFixed(4)}rad) translate(${((-sx * 1.4 - V.yaw * 260 - V.x * 30) * u).toFixed(2)}px,${(-sy * 1.4 * u).toFixed(2)}px)`;
  }
  if (el.bl) el.bl.style.transform = `translate(${(-V.yaw * 300 * u).toFixed(1)}px,${(V.hz * u * 0.5).toFixed(1)}px)`;
}
/* ---------- camera life ----------
   battleStage.cam is the directed camera (camTo/camAt/camHome tween it); battleStage.V is the one rendered: the directed camera plus a slow idle orbit
   around the middle of the action while nothing happens. A guard keeps both billionaires inside the free frame. */
export const CAMERA_KEYS = ['x', 'y', 'z', 'yaw', 'hz'],
  actionCenter = {
    x: (actorPositions[0].x + actorPositions[1].x) / 2,
    z: (actorPositions[0].z + actorPositions[1].z) / 2,
  };
function battleStageProjectWith(C, X, Y, Z) {
  const L = battleStage.L,
    cs = Math.cos(C.yaw),
    sn = Math.sin(C.yaw),
    dx = X - C.x,
    dz = Z - C.z,
    lx = dx * cs - dz * sn,
    lz = dx * sn + dz * cs;
  if (lz < 0.25) return null;
  return {
    x: L.cx + (FOCAL_LENGTH * lx) / lz,
    y: L.h0 + C.hz - (FOCAL_LENGTH * (Y - C.y + (lz * lz) / (2 * GROUND_SPHERE_RADIUS))) / lz,
    z: lz,
    s: FOCAL_LENGTH / lz,
  };
}
/* how far (stage px) the shown billionaires' sprites stick out of the free area for camera C (10% grace) */
function cameraOverflow(C) {
  const L = battleStage.L,
    fr = L.free,
    x0 = L.M + fr.x / L.u + 2,
    x1 = L.M + (fr.x + fr.w) / L.u - 2,
    y0 = L.M + fr.y / L.u,
    y1 = L.M + (fr.y + fr.h) / L.u + 10;
  if (C.y < 0.45 || Math.abs(C.yaw) > 0.8) return 1e9;
  let o = 0;
  for (let i = 0; i < battleStage.s.length; i++) {
    const s = battleStage.s[i];
    if (!s.show || s.a < 0.3) continue;
    const w = actorWorldPoint(i),
      c = actorCenter(i),
      R = s.sp ? rigParts(s.sp, s.gold, ACTOR_RIG_SCALES[i]) : null,
      hw = R
        ? (Math.max(R.geo.hw, (R.geo.base - R.geo.top) * 0.5) *
            actorMetersPerPixel[i] *
            s.sc *
            (s.big || 1) *
            (s.fs || 1)) /
          2
        : 0.6;
    const g = battleStageProjectWith(C, w.x, 0, w.z),
      m = battleStageProjectWith(C, c.x, c.y, c.z);
    if (!g || !m) return 1e9;
    const half = hw * m.s,
      top = 2 * m.y - g.y,
      tol = (g.y - top) * 0.1;
    o +=
      Math.max(0, x0 - tol - (m.x - half)) +
      Math.max(0, m.x + half - x1 - tol) +
      Math.max(0, y0 - tol - top) +
      Math.max(0, g.y - y1 - tol);
  }
  return o;
}
const camBusy = () => {
  for (const w of battleStage.tws) if (w.o === battleStage.cam) return true;
  return false;
};
function camUpdate(dt) {
  const C = battleStage.cam,
    V = battleStage.V,
    D = battleStage.drift,
    busy = camBusy();
  if (busy) battleStage.camT = battleStage.t;
  const want =
    !reducedMotion && !busy && battleStage.t - battleStage.camT > 650 && battleStage.s[0].show && battleStage.s[1].show
      ? 1
      : 0;
  D.w += (want - D.w) * Math.min(1, dt / (want > D.w ? 1600 : 260));
  if (D.w < 0.002 && !want) D.w = 0;
  /* the slow orbit only advances in 50 ms steps while the directed camera rests, so the ground is re-cast ~20×/s instead of every frame */
  const q = Math.floor(battleStage.t / 50);
  if (busy || q !== D.tq) {
    D.tq = q;
    const ts = q * 0.05,
      k = D.w;
    const dx = 0.34 * Math.sin(ts * 0.37) + 0.08 * Math.sin(ts * 0.83 + 1.1);
    D.x = dx * k;
    D.yaw = (-dx / actionCenter.z) * 0.82 * k;
    D.z = 0.24 * Math.sin(ts * 0.23 + 1.3) * k;
    D.y = 0.07 * Math.sin(ts * 0.29 + 0.4) * k;
    D.hz = 1.4 * Math.sin(ts * 0.19 + 2.1) * k;
    for (const p of CAMERA_KEYS) V[p] = C[p] + D[p];
    /* guard: never frame the billionaires worse than the home shot does. First the orbit gives way, then a directed push stops short */
    const lim = cameraOverflow(homeCamera) + 0.5;
    if (cameraOverflow(V) > lim && cameraOverflow(C) <= lim) {
      let lo = 0,
        hi = 1;
      for (let it = 0; it < 5; it++) {
        const m = (lo + hi) / 2;
        for (const p of CAMERA_KEYS) V[p] = C[p] + D[p] * m;
        if (cameraOverflow(V) <= lim) lo = m;
        else hi = m;
      }
      for (const p of CAMERA_KEYS) V[p] = C[p] + D[p] * lo;
    } else if (cameraOverflow(V) > lim) {
      let lo = 0,
        hi = 1;
      for (const p of CAMERA_KEYS) cameraGuardPose[p] = V[p];
      for (let it = 0; it < 6; it++) {
        const m = (lo + hi) / 2;
        for (const p of CAMERA_KEYS) V[p] = cameraGuardPose[p] + (homeCamera[p] - cameraGuardPose[p]) * m;
        if (cameraOverflow(V) <= lim) hi = m;
        else lo = m;
      }
      for (const p of CAMERA_KEYS) V[p] = cameraGuardPose[p] + (homeCamera[p] - cameraGuardPose[p]) * hi;
    }
  }
}
const cameraGuardPose = { x: 0, y: 0, z: 0, yaw: 0, hz: 0 };
function camTo(c, d = 260, e = 'io', delay = 0) {
  if (reducedMotion) {
    scheduleAt(delay, () => {
      for (const k in c) if (k in battleStage.cam) battleStage.cam[k] = c[k];
    });
    return;
  }
  for (const k in c) if (k in battleStage.cam) tween(battleStage.cam, k, c[k], d, e, delay);
}
/* handheld feel for big moves: the wobble fades in fast and settles out */
function handheld(ms, amt = 1) {
  if (reducedMotion) return;
  tween(battleStage.hand, 'a', amt, 90, 'out');
  tween(battleStage.hand, 'a', 0, 420, 'io', Math.max(0, ms - 200));
}
/* a quick zoom punch (and optional roll kick) from the CSS layer */
function punch(z, ms = 260, roll = 0) {
  if (reducedMotion) return;
  tween(battleStage.css, 'z', z, 60, 'out');
  tween(battleStage.css, 'z', 0, ms, 'io', 70);
  if (roll) {
    tween(battleStage.css, 'r', battleStage.css.r + roll, 60, 'out');
    tween(battleStage.css, 'r', 0, ms + 80, 'io', 70);
  }
}
/* ---------- the ground: cast once per camera/focus change ---------- */
function floorBuffers() {
  const L = battleStage.L,
    W = L.LW,
    H = L.LH;
  if (battleStage.F && battleStage.F.W === W && battleStage.F.H === H) return battleStage.F;
  const W2 = Math.ceil(W / 2),
    H2 = Math.ceil(H / 2);
  const mk = (w, h) => {
    const c = makeCanvas(w, h),
      x = c.getContext('2d');
    return { c, x, img: x.createImageData(w, h) };
  };
  return (battleStage.F = {
    W,
    H,
    W2,
    H2,
    base: mk(W, H),
    soft: mk(W2, H2),
    rowZ: new Float32Array(H),
    rad: new Float32Array(H),
    rh: new Float32Array(H2),
    rr: new Float32Array(H2),
    rp: new Float32Array((W2 + 1) * 3),
    half: new Float32Array(W2 * H2 * 3),
    tmp: new Float32Array(W2 * H2 * 3),
    pre: new Float32Array(W2 * (H2 + 1) * 3),
    blurred: false,
  });
}
/* rows hidden behind the frosted dock are cast at half width: the glass blurs them anyway */
function floorLowFrom() {
  const L = battleStage.L;
  if (L.lay !== 'portrait') return 1e9;
  const d = $('#dock');
  if (!d) return 1e9;
  const b = $('#battle').getBoundingClientRect(),
    top = d.getBoundingClientRect().top - b.top;
  return Math.floor(L.M + top / L.u) + 6;
}
function castFloor() {
  const L = battleStage.L,
    F = floorBuffers(),
    W = F.W,
    H = F.H,
    C = battleStage.V,
    A = AREAS[battleStage.area],
    cs = Math.cos(C.yaw),
    sn = Math.sin(C.yaw),
    h = L.h0 + C.hz,
    cy = Math.max(0.2, C.y),
    cx = L.cx;
  const out = new Uint32Array(F.base.img.data.buffer),
    NT = battleStage.near,
    FT = battleStage.far,
    WT = battleStage.wall,
    fog = battleStage.fogC,
    skyC = battleStage.skyC,
    fogD = A.fogD || 70,
    indoor = !!A.indoor,
    rowZ = F.rowZ,
    low = battleStage.lowFrom || 1e9;
  let colLz = null;
  if (indoor) {
    colLz = new Float32Array(W);
    const RW = 12.5;
    for (let i = 0; i < W; i++) {
      const a = (i + 0.5 - cx) / FOCAL_LENGTH,
        dx = a * cs + sn,
        dz = -a * sn + cs,
        ox = C.x - GROUND_CENTER_X,
        oz = C.z - (GROUND_CENTER_Z + 2),
        bq = 2 * (ox * dx + oz * dz),
        aq = dx * dx + dz * dz,
        cq = ox * ox + oz * oz - RW * RW,
        disc = bq * bq - 4 * aq * cq;
      colLz[i] = disc > 0 ? (-bq + Math.sqrt(disc)) / (2 * aq) : 99;
    }
  }
  const wallMid = indoor ? colLz[Math.max(0, Math.min(W - 1, Math.round(cx)))] : 0,
    floorDark = packPixel(20, 16, 30);
  for (let j = 0; j < H; j++) {
    const v = (j + 0.5 - h) / FOCAL_LENGTH;
    const lz = indoor
      ? v > 0
        ? cy / v
        : 1e9
      : GROUND_SPHERE_RADIUS * (-v + Math.sqrt(v * v + (2 * cy) / GROUND_SPHERE_RADIUS));
    const row = j * W;
    if (!indoor && (lz > GROUND_MAX_DEPTH || !(lz > 0))) {
      const tt = clamp((h - j) / (h + 10), 0, 1),
        c = mixRgb(mixRgb(fog, skyC[1], Math.min(1, tt * 1.6)), skyC[0], Math.max(0, tt * 1.6 - 0.6)),
        pc = packPixel(c[0], c[1], c[2]);
      out.fill(pc, row, row + W);
      rowZ[j] = 400;
      continue;
    }
    rowZ[j] = indoor && (lz > wallMid || v <= 0) ? wallMid : lz;
    const fogk = indoor ? 0 : 1 - Math.exp(-lz / fogD),
      k1 = 1 - fogk,
      fr = fog[0] * fogk,
      fg = fog[1] * fogk,
      fb = fog[2] * fogk,
      useFog = fogk > 0.01;
    /* texture coordinates step linearly across a row */
    const st = lz / FOCAL_LENGTH,
      X0 = C.x + (0.5 - cx) * st * cs + lz * sn,
      Z0 = C.z - (0.5 - cx) * st * sn + lz * cs,
      dX = st * cs,
      dZ = -st * sn,
      step = j >= low ? 2 : 1;
    const nearOn = lz < 26 || !FT,
      farOn = FT && lz > 16,
      farAll = lz >= 26,
      farT = (lz - 16) / 10;
    let U = (X0 - GROUND_CENTER_X) * GROUND_TEXTURE_PX_PER_METER + 256,
      V = (Z0 - GROUND_CENTER_Z) * GROUND_TEXTURE_PX_PER_METER + 256,
      FU = X0 * 0.5,
      FV = Z0 * 0.5;
    const dU = dX * GROUND_TEXTURE_PX_PER_METER * step,
      dV = dZ * GROUND_TEXTURE_PX_PER_METER * step,
      dFU = dX * 0.5 * step,
      dFV = dZ * 0.5 * step;
    for (let i = 0; i < W; i += step, U += dU, V += dV, FU += dFU, FV += dFV) {
      if (indoor) {
        const wl = colLz[i];
        if (lz > wl || v <= 0) {
          const top = h - (FOCAL_LENGTH * (4.2 - cy)) / wl,
            bot = h + (FOCAL_LENGTH * cy) / wl;
          let pc;
          if (j >= top && j <= bot) {
            const X = C.x + ((i + 0.5 - cx) / FOCAL_LENGTH) * wl * cs + wl * sn,
              Z = C.z - ((i + 0.5 - cx) / FOCAL_LENGTH) * wl * sn + wl * cs,
              ang = Math.atan2(Z - (GROUND_CENTER_Z + 2), X - GROUND_CENTER_X),
              u = ((Math.floor((ang / (Math.PI * 2) + 0.5) * 1024 * 1.5) % 1024) + 1024) % 1024,
              vv = Math.floor(((j - top) / (bot - top)) * 63);
            pc = WT ? WT[vv * 1024 + u] : packPixel(60, 50, 80);
          } else if (j < top) {
            const g = clamp((top - j) / 60, 0, 1),
              c = mixRgb(skyC[2], skyC[0], g);
            const sk = ((i >> 3) + (j >> 3)) % 5 === 0 && g > 0.2 ? mixRgb(c, [150, 170, 230], 0.35) : c;
            pc = packPixel(sk[0], sk[1], sk[2]);
          } else pc = floorDark;
          out[row + i] = pc;
          if (step === 2 && i + 1 < W) out[row + i + 1] = pc;
          continue;
        }
      }
      let pc = 0;
      if (nearOn) pc = NT[(Math.floor(V) & 511) * GROUND_TEXTURE_SIZE + (Math.floor(U) & 511)];
      if (farOn && (farAll || bayerThreshold(i, j) < farT))
        pc = FT[(Math.floor(FV) & 255) * 256 + (Math.floor(FU) & 255)];
      if (useFog)
        pc =
          (255 << 24) |
          (((((pc >> 16) & 255) * k1 + fb) & 255) << 16) |
          (((((pc >> 8) & 255) * k1 + fg) & 255) << 8) |
          (((pc & 255) * k1 + fr) & 255);
      else pc |= 0xff000000;
      out[row + i] = pc;
      if (step === 2 && i + 1 < W) out[row + i + 1] = pc;
    }
  }
  F.base.x.putImageData(F.base.img, 0, 0);
}
/* depth blur at half resolution, laid over the sharp ground with a per-row opacity that eases in smoothly:
   rows in focus stay crisp pixel art, rows out of focus fade into a soft copy. The soft copy is two box passes each way (≈ gaussian)
   with fractional, per-row radii (box edges are weighted, so the radius grows continuously instead of in whole-pixel steps, which
   is what made bands and blocks). Near rows also get a little extra blur in proportion to how magnified the ground texture is there,
   so its texels don't read as blocks. */
const GROUND_BLUR_SCALE = 0.42;
function blurFloorByDepth() {
  const F = battleStage.F,
    W = F.W,
    H = F.H,
    W2 = F.W2,
    H2 = F.H2,
    src = F.base.img.data,
    rad = F.rad,
    half = F.half,
    tmp = F.tmp,
    pre = F.pre,
    rh = F.rh,
    rr = F.rr,
    rp = F.rp,
    d = battleStage.dof;
  let any = false;
  for (let j = 0; j < H; j++) {
    const z = F.rowZ[j];
    let r = blurAt(z);
    if (r > 0 && z < d.zf && z < actorPositions[0].z) {
      const mag = FOCAL_LENGTH / Math.max(0.3, z) / GROUND_TEXTURE_PX_PER_METER;
      r = Math.max(
        r,
        Math.min(3.2, mag * 0.32 * clamp((actorPositions[0].z - z) / 1.2, 0, 1) * Math.min(1, d.ap / 0.5))
      );
    }
    rad[j] = r;
    if (r >= 0.3) any = true;
  }
  F.blurred = any;
  if (!any) return;
  for (let j = 0; j < H2; j++) {
    const ja = Math.min(H - 1, 2 * j),
      jb = Math.min(H - 1, 2 * j + 1);
    rh[j] = Math.max(rad[ja], rad[jb]);
    const sg = rh[j] * GROUND_BLUR_SCALE * 0.5;
    rr[j] = (Math.sqrt(6 * sg * sg + 1) - 1) / 2;
    for (let i = 0; i < W2; i++) {
      const ia = Math.min(W - 1, 2 * i),
        ib = Math.min(W - 1, 2 * i + 1),
        a = (ja * W + ia) * 4,
        b = (ja * W + ib) * 4,
        c = (jb * W + ia) * 4,
        e = (jb * W + ib) * 4,
        o = (j * W2 + i) * 3;
      half[o] = (src[a] + src[b] + src[c] + src[e]) * 0.25;
      half[o + 1] = (src[a + 1] + src[b + 1] + src[c + 1] + src[e + 1]) * 0.25;
      half[o + 2] = (src[a + 2] + src[b + 2] + src[c + 2] + src[e + 2]) * 0.25;
    }
  }
  boxBlurRows(half, tmp, W2, H2, rr, rp);
  boxBlurRows(tmp, half, W2, H2, rr, rp);
  boxBlurColumns(half, tmp, W2, H2, rr, pre);
  boxBlurColumns(tmp, half, W2, H2, rr, pre);
  const soft = F.soft.img.data;
  for (let j = 0; j < H2; j++) {
    const t = clamp((rh[j] - 0.3) / 0.9, 0, 1),
      al = Math.round(t * t * (3 - 2 * t) * 255);
    for (let i = 0; i < W2; i++) {
      const o = (j * W2 + i) * 4,
        q = (j * W2 + i) * 3;
      soft[o + 3] = al;
      if (!al) continue;
      soft[o] = half[q];
      soft[o + 1] = half[q + 1];
      soft[o + 2] = half[q + 2];
    }
  }
  F.soft.x.putImageData(F.soft.img, 0, 0);
}
/* one horizontal box pass with a fractional radius per row (edges clamp to the border pixel) */
function boxBlurRows(S, D, W, H, rr, rp) {
  for (let j = 0; j < H; j++) {
    const r = rr[j],
      row = j * W * 3;
    if (r < 0.05) {
      for (let k = row; k < row + W * 3; k++) D[k] = S[k];
      continue;
    }
    rp[0] = rp[1] = rp[2] = 0;
    for (let i = 0, o = 0, s = row; i < W; i++, o += 3, s += 3) {
      rp[o + 3] = rp[o] + S[s];
      rp[o + 4] = rp[o + 1] + S[s + 1];
      rp[o + 5] = rp[o + 2] + S[s + 2];
    }
    const fl = Math.floor(-r),
      fa = -r - fl,
      n = 1 / (2 * r + 1),
      last = row + (W - 1) * 3,
      end = W * 3,
      s0 = S[row],
      s1 = S[row + 1],
      s2 = S[row + 2],
      l0 = S[last],
      l1 = S[last + 1],
      l2 = S[last + 2];
    for (let i = 0; i < W; i++) {
      const ka = i + fl,
        b = i + 1 + r,
        kb = Math.floor(b),
        gb = b - kb,
        o = row + i * 3;
      let A0, A1, A2, B0, B1, B2;
      if (ka < 0) {
        const a = ka + fa;
        A0 = a * s0;
        A1 = a * s1;
        A2 = a * s2;
      } else {
        const q = ka * 3,
          s = row + q;
        A0 = rp[q] + fa * S[s];
        A1 = rp[q + 1] + fa * S[s + 1];
        A2 = rp[q + 2] + fa * S[s + 2];
      }
      if (kb >= W) {
        const e = b - W;
        B0 = rp[end] + e * l0;
        B1 = rp[end + 1] + e * l1;
        B2 = rp[end + 2] + e * l2;
      } else {
        const q = kb * 3,
          s = row + q;
        B0 = rp[q] + gb * S[s];
        B1 = rp[q + 1] + gb * S[s + 1];
        B2 = rp[q + 2] + gb * S[s + 2];
      }
      D[o] = (B0 - A0) * n;
      D[o + 1] = (B1 - A1) * n;
      D[o + 2] = (B2 - A2) * n;
    }
  }
}
/* one vertical box pass; the radius belongs to the destination row */
function boxBlurColumns(S, D, W, H, rr, pre) {
  const RW = W * 3;
  for (let i = 0; i < RW; i++) pre[i] = 0;
  for (let j = 0; j < H; j++) {
    const a = j * RW,
      b = a + RW;
    for (let k = 0; k < RW; k++) pre[b + k] = pre[a + k] + S[a + k];
  }
  const lastRow = (H - 1) * RW,
    endRow = H * RW;
  for (let j = 0; j < H; j++) {
    const r = rr[j],
      o = j * RW;
    if (r < 0.05) {
      for (let k = 0; k < RW; k++) D[o + k] = S[o + k];
      continue;
    }
    const a = j - r,
      b = j + 1 + r,
      ka = Math.floor(a),
      fa = a - ka,
      kb = Math.floor(b),
      fb = b - kb,
      n = 1 / (2 * r + 1),
      pa = ka * RW,
      pb = kb * RW,
      lowA = ka < 0,
      highB = kb >= H,
      eb = b - H;
    for (let k = 0; k < RW; k++) {
      const A = lowA ? a * S[k] : pre[pa + k] + fa * S[pa + k],
        Bv = highB ? pre[endRow + k] + eb * S[lastRow + k] : pre[pb + k] + fb * S[pb + k];
      D[o + k] = (Bv - A) * n;
    }
  }
}
function floorKey() {
  const C = battleStage.V,
    d = battleStage.dof,
    L = battleStage.L;
  return (
    [C.x, C.y, C.z, C.yaw, C.hz].map(v => v.toFixed(4)).join(',') +
    '|' +
    d.zf.toFixed(2) +
    ',' +
    d.ap.toFixed(2) +
    '|' +
    L.ver +
    '|' +
    battleStage.q.lvl
  );
}
function floorUpdate() {
  const k = floorKey();
  if (k === battleStage.floorKey && battleStage.F) return false;
  battleStage.floorKey = k;
  battleStage.lowFrom = floorLowFrom();
  castFloor();
  if (battleStage.q.lvl < 1) blurFloorByDepth();
  else battleStage.F.blurred = false;
  drawForegrounds();
  return true;
}
/* ---------- drawing helpers ---------- */
function drawShadow(c, X, Z, r, a) {
  const p = battleStageProject(X, 0, Z);
  if (!p) return;
  const w = Math.max(2, r * p.s),
    hh = Math.max(1.5, w * clamp(battleStage.V.y / p.z, 0.18, 0.55));
  const ring = (k, al) => {
    c.fillStyle = `rgba(14,8,28,${al.toFixed(3)})`;
    const H = hh * k,
      Wd = w * k;
    for (let j = -Math.ceil(H); j <= Math.ceil(H); j++) {
      const half = Math.round(Wd * Math.sqrt(Math.max(0, 1 - (j / H) ** 2)));
      if (half > 0) c.fillRect(Math.round(p.x - half), Math.round(p.y + j), half * 2, 1);
    }
  };
  ring(1.35, a * 0.45);
  ring(1, a * 0.7);
  ring(0.55, a * 0.6);
}
/* draw an image with depth blur: shrink it with smoothing into a scratch canvas that has a transparent margin, then stretch it back
   over a rect grown by the same margin. The margin is what lets the soft edge fall off into transparency (without it the blurred copy
   ends in a hard line at the sprite's box). Static art passes a `slot` that keeps its shrunk copy while size and blur don't change. */
const SOFT_BLUR_PAD = 3,
  CANVAS_FILTER_WORKS = (() => {
    try {
      const x = makeCanvas(1, 1).getContext('2d');
      x.filter = 'blur(1px)';
      return x.filter === 'blur(1px)';
    } catch (e) {
      return false;
    }
  })();
function shrinkForSoftBlur(sm, img, sw, sh) {
  const P = SOFT_BLUR_PAD,
    x = sm.getContext('2d'),
    cw = sw + 2 * P,
    ch = sh + 2 * P;
  if (sm.width < cw + 1 || sm.height < ch + 1) {
    sm.width = Math.max(sm.width, cw + 1);
    sm.height = Math.max(sm.height, ch + 1);
  } else x.clearRect(0, 0, cw + 1, ch + 1);
  /* a touch of gaussian on the shrunk copy hides the bilinear "mosaic" when it is stretched back up (where the browser can filter) */
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'medium';
  if (CANVAS_FILTER_WORKS) x.filter = 'blur(.7px)';
  x.drawImage(img, P, P, sw, sh);
  if (CANVAS_FILTER_WORKS) x.filter = 'none';
}
function softDraw(c, img, x, y, w, h, blur, slot) {
  if (blur < 0.5 || w < 2 || h < 2) {
    c.drawImage(img, x, y, w, h);
    return;
  }
  const f = 1 / (1 + blur * 0.7),
    sw = Math.max(1, Math.round(w * f)),
    sh = Math.max(1, Math.round(h * f)),
    P = SOFT_BLUR_PAD;
  let sm = battleStage.small;
  if (slot) {
    sm = slot.c || (slot.c = makeCanvas(sw + 2 * P + 1, sh + 2 * P + 1));
    if (slot.img !== img || slot.sw !== sw || slot.sh !== sh) {
      shrinkForSoftBlur(sm, img, sw, sh);
      slot.img = img;
      slot.sw = sw;
      slot.sh = sh;
    }
  } else shrinkForSoftBlur(sm, img, sw, sh);
  const kx = w / sw,
    ky = h / sh,
    prev = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = true;
  c.drawImage(sm, 0, 0, sw + 2 * P, sh + 2 * P, x - P * kx, y - P * ky, (sw + 2 * P) * kx, (sh + 2 * P) * ky);
  c.imageSmoothingEnabled = prev;
}
/* one billionaire's current frame, drawn into its buffer (the 2D stage draws the buffer; the 3D stage uploads it) */
export function actorBuffer(i) {
  const s = battleStage.s[i];
  if (!s.show || !s.sp || s.a <= 0.01 || s.sc <= 0.01) return null;
  if (battleStage.t < s.blinkUntil && Math.floor(battleStage.t / 60) % 2) return null;
  const k = ACTOR_RIG_SCALES[i],
    R = rigParts(s.sp, s.gold, k),
    view = actorTeam(i) === 0 ? 'back' : 'front',
    buf = battleStage.buf[i] || (battleStage.buf[i] = makeCanvas(10, 10));
  if (!R) return null;
  if (buf.width !== R.BW || buf.height !== R.BH) {
    buf.width = R.BW;
    buf.height = R.BH;
  }
  const bx = buf.getContext('2d');
  bx.imageSmoothingEnabled = false;
  bx.setTransform(1, 0, 0, 1, 0, 0);
  bx.clearRect(0, 0, buf.width, buf.height);
  const a = s.act,
    tau = a ? battleStage.t - a.t0 : 0,
    ak = a && (a.k === 'faint' || tau < a.dur) ? a.k : null;
  const P = rigFrame(R, ak, tau, Math.floor(battleStage.t / 16) * 16, s.seed);
  drawRig(bx, R, P, view);
  rigTint(bx, buf.width, buf.height, '#FFFFFF', s.white);
  rigTint(bx, buf.width, buf.height, '#0C0A16', s.dark);
  buf.__v = (buf.__v || 0) + 1;
  return { s, k, R, P, ak, buf };
}
function drawActor(c, i) {
  const B = actorBuffer(i);
  if (!B) return;
  const { s, k, R, P, ak, buf } = B;
  const w = actorWorldPoint(i),
    p = battleStageProject(w.x, w.y, w.z);
  if (!p) return;
  const sc = (p.s * actorMetersPerPixel[i] * s.sc * (s.big || 1) * (s.fs || 1)) / R.k,
    lift = Math.max(0, -P.y) + Math.max(0, -s.oy);
  if (s.a > 0.5 && ak !== 'faint')
    drawShadow(
      c,
      w.x,
      w.z,
      (R.geo.hw * actorMetersPerPixel[i] * 0.8) / R.k,
      0.34 * (1 - Math.min(0.6, (lift + R.geo.lift / (k * 2)) / 60))
    );
  const x = Math.round(p.x - R.geo.cx * sc),
    y = Math.round(p.y - R.geo.base * sc),
    W = Math.round(R.BW * sc),
    H = Math.round(R.BH * sc),
    bl = blurAt(p.z);
  if (AREAS[battleStage.area].indoor && s.a > 0.5 && ak !== 'faint') {
    const gy = Math.round(battleStageProject(w.x, 0, w.z).y);
    c.save();
    c.globalAlpha = s.a * 0.14;
    c.translate(0, gy * 2);
    c.scale(1, -1);
    c.drawImage(buf, x, y, W, H);
    c.restore();
  }
  c.globalAlpha = s.a;
  softDraw(c, buf, x, y, W, H, bl);
  c.globalAlpha = 1;
}
/* the trainers: you from behind (left), the rival facing you (right); they throw coins and cheer */
export const trainerMetersPerPixel = i =>
  (i === 0 ? 1.42 : 1.7) / ((typeof WD === 'function' && WD() && WD().figure) || 74);
export function trainerBattleFrame(i) {
  const T = battleStage.tr[i];
  if (!T || !T.who) return null;
  const view = i === 0 ? 'back' : 'front';
  if (T.act && battleStage.t - T.t0 < T.dur && typeof humanPose === 'function')
    return humanPose(T.who, view, T.act, (battleStage.t - T.t0) / T.dur, battleStage.t - T.t0);
  const fr = humanFrames(T.who, view);
  return fr[Math.floor(battleStage.t / 700) % 2];
}
function setTrainerAction(i, act, dur) {
  const T = battleStage.tr[i];
  if (T) {
    T.act = act;
    T.t0 = battleStage.t;
    T.dur = dur;
  }
}
function drawTrainer(c, i) {
  const T = battleStage.tr[i];
  if (!T.show || !T.who || T.a <= 0) return;
  const f = trainerBattleFrame(i);
  if (!f) return;
  const X = actorPositions[i].x + (i === 0 ? -1.15 : 1.25) + T.x * actorMetersPerPixel[i],
    Z = actorPositions[i].z + (i === 0 ? 0.25 : 0.4),
    p = battleStageProject(X, 0, Z);
  if (!p) return;
  const sc = p.s * trainerMetersPerPixel(i),
    w = f.width * sc,
    h = f.height * sc,
    ax = (f.ax ?? f.width / 2) * sc,
    ay = (f.ay ?? f.height) * sc;
  drawShadow(c, X, Z, i === 0 ? 0.5 : 0.35, 0.22);
  c.globalAlpha = T.a;
  softDraw(c, f, Math.round(p.x - ax), Math.round(p.y - ay), Math.round(w), Math.round(h), blurAt(p.z));
  c.globalAlpha = 1;
}
function drawBillboard(c, img, X, Y, Z, wk, al, slot) {
  const p = battleStageProject(X, Y, Z);
  if (!p) return;
  const sc = (p.s / 30) * wk;
  if (sc > 8) return;
  c.globalAlpha = al == null ? 1 : al;
  softDraw(
    c,
    img.c,
    Math.round(p.x + img.ox * sc),
    Math.round(p.y + img.oy * sc),
    Math.max(1, Math.round(img.W * sc)),
    Math.max(1, Math.round(img.H * sc)),
    blurAt(p.z),
    slot
  );
  c.globalAlpha = 1;
}
/* a prop billboard (already projected into p.q this frame); foliage leans with the wind around its base */
function drawProp(c, p) {
  const q = p.q,
    sc = (q.s / 30) * p.k,
    I = p.img;
  if (sc > 8) return;
  const x = Math.round(q.x + I.ox * sc),
    y = Math.round(q.y + I.oy * sc),
    w = Math.max(1, Math.round(I.W * sc)),
    h = Math.max(1, Math.round(I.H * sc)),
    L = battleStage.L;
  if (x > L.LW || x + w < 0 || y > L.LH || y + h < 0) return;
  if (p.sh > 0 && q.z < 34) drawShadow(c, p.x, p.z, p.sh, 0.2);
  const sw =
    p.sway && !reducedMotion
      ? p.sway * 0.05 * (Math.sin(battleStage.t / 1300 + p.ph) * 0.7 + Math.sin(battleStage.t / 530 + p.ph * 1.7) * 0.3)
      : 0;
  if (Math.abs(sw) * h < 0.35) {
    softDraw(c, I.c, x, y, w, h, blurAt(q.z), p.soft);
    return;
  }
  c.save();
  c.translate(q.x, q.y);
  c.transform(1, 0, -sw, 1, 0, 0);
  c.translate(-q.x, -q.y);
  softDraw(c, I.c, x, y, w, h, blurAt(q.z), p.soft);
  c.restore();
}
function drawPixelRing(c, cx, cy, rx, ry, col, th = 1) {
  c.fillStyle = col;
  const n = Math.max(24, Math.round((rx + ry) * 2));
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    for (let q = 0; q < th; q++)
      c.fillRect(Math.round(cx + Math.cos(a) * (rx - q)), Math.round(cy + Math.sin(a) * (ry - q)), 1, 1);
  }
}
export function particleSprite(key) {
  return iconCanvas(key);
}
function drawParticles(c, layer) {
  const L = [];
  battleStage.parts.forEach(p => {
    if ((p.layer || 2) !== layer) return;
    const q = battleStageProject(p.x, p.y, p.z);
    if (q) L.push([q, p]);
  });
  L.sort((a, b) => b[0].z - a[0].z);
  L.forEach(([q, p]) => {
    if (battleStage.gl && p.spr) return;
    /* drawn in the 3D world instead */ let fade = p.fade === false ? 1 : 1 - p.age / p.life;
    if (p.twinkle) fade *= 0.5 + 0.5 * Math.sin(p.age / 120);
    c.globalAlpha = Math.max(0, Math.min(1, fade));
    if (p.glow) c.globalCompositeOperation = 'lighter';
    const k = clamp((q.s / 30) * (p.k || 1), 0.5, 5);
    if (p.ring) {
      const r = ((p.r0 + (p.r1 - p.r0) * EASE.out(p.age / p.life)) * q.s) / 30;
      drawPixelRing(
        c,
        q.x,
        q.y,
        r,
        p.ground ? r * clamp(battleStage.V.y / q.z, 0.2, 0.6) : r,
        p.col,
        p.ground ? 2 : Math.max(1, Math.round(k))
      );
    } else if (p.spr) {
      const s = particleSprite(p.spr),
        kk = Math.max(1, Math.round(k * 2) / 2);
      c.drawImage(
        s,
        Math.round(q.x - (s.width * kk) / 2),
        Math.round(q.y - (s.height * kk) / 2),
        Math.round(s.width * kk),
        Math.round(s.height * kk)
      );
    } else if (p.beam) {
      const q2 = battleStageProject(p.x2, p.y2, p.z2);
      if (q2) {
        c.strokeStyle = p.col;
        c.lineWidth = Math.max(1, p.w * k);
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(q.x, q.y);
        c.lineTo(q2.x, q2.y);
        c.stroke();
        c.strokeStyle = '#FFFFFF';
        c.lineWidth = Math.max(1, p.w * k * 0.35);
        c.stroke();
      }
    } else if (p.lines) {
      const n = p.n || 18,
        a0 = p.age / p.life;
      c.strokeStyle = p.col;
      c.lineWidth = 1;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + p.seed,
          r0 = (14 + a0 * 26) * k,
          r1 = r0 + (22 + ((i * 37) % 17)) * k;
        c.beginPath();
        c.moveTo(q.x + Math.cos(a) * r0, q.y + Math.sin(a) * r0 * 0.8);
        c.lineTo(q.x + Math.cos(a) * r1, q.y + Math.sin(a) * r1 * 0.8);
        c.stroke();
      }
    } else {
      c.fillStyle = p.col;
      const sz = Math.max(1, Math.round((p.size || 2) * k * 0.6));
      c.fillRect(Math.round(q.x), Math.round(q.y), sz, sz);
    }
    c.globalCompositeOperation = 'source-over';
  });
  c.globalAlpha = 1;
}
/* soft cloud shadows sliding across the ground (drawn over the cached floor, so the floor needn't be recast) */
function cloudShadows(c) {
  if (AREAS[battleStage.area].indoor) return;
  c.save();
  c.fillStyle = 'rgba(30,16,60,.16)';
  for (const cl of battleStage.clouds) {
    const p = battleStageProject(cl.x, 0, cl.z);
    if (!p || p.z > 70) continue;
    const r = 2.6 * p.s,
      ry = r * clamp(battleStage.V.y / p.z, 0.12, 0.55);
    if (r < 1) continue;
    c.globalAlpha = clamp(1 - p.z / 70, 0, 1);
    c.beginPath();
    c.ellipse(p.x, p.y, r, ry, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}
function lightShafts(c) {
  if (AREAS[battleStage.area].indoor) return;
  const L = battleStage.L,
    t = battleStage.t,
    bot = L.h0 + 20;
  const g = c.createLinearGradient(0, 0, 0, bot);
  g.addColorStop(0, 'rgba(255,246,214,.55)');
  g.addColorStop(1, 'rgba(255,246,214,0)');
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = g;
  const n = Math.max(4, Math.round(L.LW / 60));
  for (let k = 0; k < n; k++) {
    const x = L.LW * (0.08 + k / n) - battleStage.V.yaw * 300 + Math.sin(t / 3000 + k) * 6;
    c.globalAlpha = 0.14 + 0.06 * Math.sin(t / 1700 + k * 2);
    c.beginPath();
    c.moveTo(x - 6, 0);
    c.lineTo(x + 8, 0);
    c.lineTo(x + 30, bot);
    c.lineTo(x + 4, bot);
    c.fill();
  }
  c.restore();
}
/* foreground: the area's grass or railings, split to the two edges of the open stage and blurred like a near lens element */
export function drawForegrounds() {
  const c = battleStage.fx,
    L = battleStage.L;
  if (!c) return;
  if (battleStage.gl) {
    if (battleStage.fgKey !== 'gl') {
      battleStage.fgKey = 'gl';
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, battleStage.fgc.width, battleStage.fgc.height);
    }
    return;
  }
  const R = L.R,
    bl = blurAt(1.05),
    key = L.ver + '|' + bl.toFixed(2) + '|' + R;
  if (key === battleStage.fgKey) return;
  battleStage.fgKey = key;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, battleStage.fgc.width, battleStage.fgc.height);
  if (!battleStage.fg || !battleStage.fg.naturalWidth) return;
  c.setTransform(R, 0, 0, R, 0, 0);
  c.imageSmoothingEnabled = false;
  /* the art stands on the screen's bottom edge. When a full-width dock covers the bottom (phones in portrait) it stands just under the
    dock's top edge instead, and its bottom row is repeated down behind the dock, so the grass never ends in a hard line */
  const dk = $('#dock'),
    bb = $('#battle'),
    dr = dk && bb ? dk.getBoundingClientRect() : null,
    br = bb ? bb.getBoundingClientRect() : null,
    full = !!dr && L.lay === 'portrait' && dr.left - br.left <= 4 && dr.right - br.left >= L.vw - 4;
  const im = battleStage.fg,
    W = im.naturalWidth,
    H = im.naturalHeight,
    hw = Math.floor(W / 2),
    fr = L.free,
    bot = full ? L.M + (fr.y + fr.h) / L.u + 8 : L.M + L.vh / L.u + 4,
    yb = Math.round(bot - H),
    ext = full ? Math.max(0, Math.ceil(L.M + L.vh / L.u + 10 - bot)) : 0,
    left = Math.round(L.M + fr.x / L.u - 16),
    right = Math.round(L.M + (fr.x + fr.w) / L.u + 16 - hw);
  if (!battleStage.fgP || battleStage.fgP.ver !== L.ver || battleStage.fgP.im !== im) {
    const mk = sx => {
      const t = makeCanvas(hw, H + ext),
        x = t.getContext('2d');
      x.drawImage(im, sx, 0, hw, H, 0, 0, hw, H);
      if (ext) x.drawImage(im, sx, H - 1, hw, 1, 0, H, hw, ext);
      return t;
    };
    battleStage.fgP = { ver: L.ver, im, a: mk(0), b: mk(hw), sa: {}, sb: {} };
  }
  const P = battleStage.fgP;
  softDraw(c, P.a, left, yb, hw, H + ext, bl, P.sa);
  softDraw(c, P.b, right, yb, hw, H + ext, bl, P.sb);
}
const drawList = [];
let drawListLength = 0;
function addDrawItem(z, k, o, i) {
  let it = drawList[drawListLength];
  if (!it) it = drawList[drawListLength] = { z: 0, k: 0, o: null, i: 0 };
  it.z = z;
  it.k = k;
  it.o = o;
  it.i = i;
  drawListLength++;
}
function battleStageProjectInto(o, C, X, Y, Z) {
  const L = battleStage.L,
    cs = Math.cos(C.yaw),
    sn = Math.sin(C.yaw),
    dx = X - C.x,
    dz = Z - C.z,
    lx = dx * cs - dz * sn,
    lz = dx * sn + dz * cs;
  if (lz < 0.25) return false;
  o.x = L.cx + (FOCAL_LENGTH * lx) / lz;
  o.y = L.h0 + C.hz - (FOCAL_LENGTH * (Y - C.y + (lz * lz) / (2 * GROUND_SPHERE_RADIUS))) / lz;
  o.z = lz;
  o.s = FOCAL_LENGTH / lz;
  return true;
}
function battleStageDraw() {
  const c = battleStage.cx,
    L = battleStage.L,
    R = L.R;
  /* on the 3D engine (battle-3d.js) the scene, the billionaires and the trainers are drawn there; this canvas only keeps the effects */
  if (battleStage.gl) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, battleStage.cv.width, battleStage.cv.height);
    c.setTransform(R, 0, 0, R, 0, 0);
    c.imageSmoothingEnabled = false;
    battleStageDrawEffects(c);
    return;
  }
  floorUpdate();
  const F = battleStage.F;
  c.setTransform(R, 0, 0, R, 0, 0);
  c.imageSmoothingEnabled = false;
  c.drawImage(F.base.c, 0, 0);
  if (F.blurred) {
    c.imageSmoothingEnabled = true;
    c.drawImage(F.soft.c, 0, 0, F.W2, F.H2, 0, 0, F.W2 * 2, F.H2 * 2);
    c.imageSmoothingEnabled = false;
  }
  cloudShadows(c);
  lightShafts(c);
  /* draw list: pooled records, insertion-sorted far to near (the order barely changes between frames, so this is ~linear) */
  drawListLength = 0;
  const V = battleStage.V;
  for (const p of battleStage.props) {
    if (battleStageProjectInto(p.q || (p.q = { x: 0, y: 0, z: 0, s: 0 }), V, p.x, 0, p.z)) addDrawItem(p.q.z, 0, p, 0);
  }
  for (const cl of battleStage.clouds) {
    const q = battleStageProject(cl.x, cl.y, cl.z);
    if (q) addDrawItem(q.z + 1000, 1, cl, 0);
  }
  for (let i = battleStage.s.length - 1; i >= 0; i--) {
    const w = actorWorldPoint(i),
      q = battleStageProject(w.x, 0, w.z);
    if (q) addDrawItem(q.z - 0.01, 2, null, i);
    const T = battleStage.tr[i];
    if (i < 2 && T.show) {
      const q2 = battleStageProject(actorPositions[i].x, 0, actorPositions[i].z + (i === 0 ? 0.25 : 0.4));
      if (q2) addDrawItem(q2.z + 0.02, 3, null, i);
    }
  }
  for (let i = 1; i < drawListLength; i++) {
    const it = drawList[i];
    let j = i - 1;
    while (j >= 0 && drawList[j].z < it.z) {
      drawList[j + 1] = drawList[j];
      j--;
    }
    drawList[j + 1] = it;
  }
  let partsDrawn = false;
  for (let n = 0; n < drawListLength; n++) {
    const it = drawList[n];
    if (!partsDrawn && it.z < actorPositions[1].z + 0.5) {
      drawParticles(c, 0);
      partsDrawn = true;
    }
    if (it.k === 0) drawProp(c, it.o);
    else if (it.k === 1) {
      const cl = it.o;
      drawBillboard(c, cl.img, cl.x, cl.y, cl.z, 2, 0.92, cl.soft);
    } else if (it.k === 2) drawActor(c, it.i);
    else drawTrainer(c, it.i);
  }
  if (!partsDrawn) drawParticles(c, 0);
  battleStageDrawEffects(c, 1);
}
/* v33: the fighter choosing stands in a gold ring; while aiming, the foes you can pick pulse */
export function battleStageSelect(k) {
  battleStage.sel = k;
}
export function battleStageTargets(L) {
  battleStage.tg = L && L.length ? L.slice() : null;
}
function drawSelectionRing(c, i, col, pulse) {
  const w = actorWorldPoint(i),
    g = battleStageProject(w.x, 0, w.z);
  if (!g) return;
  const s = battleStage.s[i],
    R = s && s.sp ? rigParts(s.sp, s.gold, ACTOR_RIG_SCALES[i]) : null,
    hw = R ? (R.geo.hw * actorMetersPerPixel[i] * (s.big || 1) * (s.fs || 1) * 0.8) / R.k2 : 0.5;
  const r = Math.max(6, hw * g.s * (1 + 0.06 * Math.sin(battleStage.t / 180) * pulse)),
    ry = r * clamp(battleStage.V.y / g.z, 0.2, 0.6);
  c.globalAlpha = 0.85;
  drawPixelRing(c, g.x, g.y, r, ry, col, 2);
  c.globalAlpha = 0.35;
  drawPixelRing(c, g.x, g.y, r + 3, ry + 2, col, 1);
  c.globalAlpha = 1;
}
function battleStageDrawEffects(c, skip0) {
  if (!skip0) drawParticles(c, 0);
  if (battleStage.sel != null && battleStage.s[battleStage.sel] && battleStage.s[battleStage.sel].show)
    drawSelectionRing(c, battleStage.sel, '#F4C542', 1);
  if (battleStage.tg)
    for (const k of battleStage.tg)
      if (battleStage.s[k] && battleStage.s[k].show) {
        drawSelectionRing(c, k, Math.floor(battleStage.t / 220) % 2 ? '#FF6B6B' : '#FFFFFF', 3);
        const T = actorTop(k),
          q = battleStageProject(T.x, T.y + 0.35 + 0.08 * Math.sin(battleStage.t / 140), T.z);
        if (q) {
          c.fillStyle = '#FF6B6B';
          const z = Math.max(3, Math.round((q.s / 30) * 4));
          for (let r = 0; r < z; r++)
            c.fillRect(Math.round(q.x - z + r), Math.round(q.y + r), Math.max(1, (z - r) * 2), 1);
        }
      }
  if (battleStage.coin && battleStage.coin.show) {
    const C = battleStage.coin,
      q = battleStageProject(C.x, C.y, C.z);
    if (q) {
      const cc = coinCanvas(C.kind, 16),
        k = clamp((q.s / 30) * (C.k || 1), 0.6, 4);
      c.save();
      c.translate(Math.round(q.x), Math.round(q.y));
      c.rotate(C.rot || 0);
      c.drawImage(cc, -8 * k, -8 * k, 16 * k, 16 * k);
      if (C.glow > 0) {
        c.globalAlpha = C.glow;
        c.drawImage(whiteCopy(cc), -8 * k, -8 * k, 16 * k, 16 * k);
      }
      c.restore();
      c.globalAlpha = 1;
    }
  }
  if (battleStage.ring) {
    const ph = battleStageRingPhase(),
      o = actorCenter(1),
      q = battleStageProject(o.x, o.y, o.z);
    if (q) {
      const r = (1.15 - ph * 0.8) * q.s;
      const col = ph > 0.62 ? '#5DFF8A' : ph > 0.35 ? '#F4C542' : '#F2F2F2';
      drawPixelRing(c, q.x, q.y, r, r, col, 2);
      c.globalAlpha = 0.35;
      drawPixelRing(c, q.x, q.y, r + 3, r + 3, ph > 0.62 ? '#5DFF8A' : '#FFFFFF', 1);
      c.globalAlpha = 1;
      const g = battleStageProject(o.x, 0, o.z);
      if (g) {
        c.globalAlpha = 0.5;
        drawPixelRing(c, g.x, g.y, r * 0.9, r * 0.9 * clamp(battleStage.V.y / g.z, 0.2, 0.6), col, 1);
        c.globalAlpha = 1;
      }
    }
  }
  drawParticles(c, 1);
  drawParticles(c, 2);
}
export const battleStageRingPhase = () =>
  battleStage.ring ? ((battleStage.t - battleStage.ring.t0) % 1300) / 1300 : 0;
/* ---------- effects (world space, y up) ---------- */
function addParticle(o) {
  battleStage.parts.push(Object.assign({ vx: 0, vy: 0, vz: 0, ax: 0, ay: 0, az: 0, age: 0, life: 600, layer: 2 }, o));
}
const HIT_SPRITES_BY_TYPE = TYPEFX;
const GLOWING_PARTICLES = { spark: 1, star: 1, bolt: 1, bit: 1, gem: 1, pow: 1, up: 1 };
const typeSprite = (t, i) => {
  const l = HIT_SPRITES_BY_TYPE[t] || HIT_SPRITES_BY_TYPE.None;
  return l[i % l.length];
};
function burst(P, t, n = 10, sp = 2.2, k = 1) {
  for (let i = 0; i < n; i++) {
    const a = random() * Math.PI * 2,
      b = (random() - 0.3) * Math.PI * 0.6,
      v = sp * (0.5 + random()),
      key = typeSprite(t, i);
    addParticle({
      x: P.x,
      y: P.y,
      z: P.z,
      vx: Math.cos(a) * Math.cos(b) * v,
      vy: Math.sin(b) * v + 1.2,
      vz: Math.sin(a) * Math.cos(b) * v,
      ay: -5,
      life: 460 + random() * 300,
      spr: key,
      k,
      glow: GLOWING_PARTICLES[key],
    });
  }
}
function ringFx(P, col = '#FFFFFF', r0 = 0.15, r1 = 1.1, life = 380) {
  addParticle({ x: P.x, y: P.y, z: P.z, ring: 1, r0: r0 * 30, r1: r1 * 30, col, life });
}
function groundRing(i, col = '#FFFFFF', r1 = 1.6, life = 520) {
  const w = actorWorldPoint(i);
  addParticle({ x: w.x, y: 0.02, z: w.z, ring: 1, ground: 1, r0: 6, r1: r1 * 30, col, life, layer: 2 });
}
function speedLines(P, col = 'rgba(255,255,255,.85)') {
  if (reducedMotion) return;
  addParticle({ x: P.x, y: P.y, z: P.z, lines: 1, col, life: 260, n: 22, seed: random() * 6 });
}
function blinkActor(i, ms = 380) {
  battleStage.s[i].blinkUntil = battleStage.t + ms;
}
/* v34: how hard a hit lands follows how much it took: a scratch barely nudges the camera, a hit that takes most of a
   fighter's HP shakes it, stops time a little longer and knocks the target further back */
function hitWeight(ti, an) {
  try {
    const m = typeof A === 'function' ? A(ti) : null;
    if (!m || !an || !an.dmg) return 0.3;
    return clamp(an.dmg / Math.max(1, maxHp(m)), 0, 1);
  } catch (e) {
    return 0.3;
  }
}
function hitFx(ti, an) {
  const T = actorCenter(ti),
    s = battleStage.s[ti],
    ts = actorTeam(ti),
    w = hitWeight(ti, an),
    kb = 4 + w * 9;
  setActorAction(ti, 'hurt', 650);
  tween(s, 'ox', ts === 1 ? kb : -kb, 60);
  tween(s, 'ox', 0, 200 + w * 160, 'out', 60);
  if (an.te <= 1 && !an.crit) {
    battleStage.shk = Math.max(battleStage.shk, 1.4 + w * 6);
    hitStop(20 + w * 70);
    if (w > 0.45) punch(0.03 + w * 0.04, 240, ts === 1 ? 0.008 : -0.008);
  }
  if (an.te > 1) {
    battleStage.shk = 8;
    battleStageFlash('#FFFFFF', 0.55, 260);
    battleStageChromaticFlash(180);
    hitStop(80);
    ringFx(T, '#FFFFFF', 0.2, 1.6);
    groundRing(ti, '#FFFFFF', 2.2);
    punch(0.06, 260);
    buzz(ts === 0 ? [18, 30, 18] : 12);
  } else {
    groundRing(ti, '#FFFFFF', 1.2 + w * 1.2, 380);
    if (ts === 0) buzz(w > 0.45 ? [14, 20, 14] : 10);
  }
  if (an.crit) {
    battleStageFlash('#FFF2A8', 0.6, 300);
    hitStop(90);
    speedLines(T);
    punch(an.te > 1 ? 0.12 : 0.09, 320, ts === 1 ? 0.014 : -0.014);
  }
  if (an.crit || an.te > 1) handheld(520, an.crit && an.te > 1 ? 1.3 : 1);
  burst(T, an.t || 'None', an.te > 1 ? 16 : 10, an.te > 1 ? 3.2 : 2.2, 1);
  if (typeof hudHit === 'function') hudHit(ti, an);
}
export function camHome(d = 420, delay = 0) {
  camTo(homeCamera, d, 'io', delay);
  if (!reducedMotion) tween(battleStage.css, 'r', 0, d, 'io', delay);
}
/* push in toward a side. Under reduced motion the camera stays on the wide shot */
export const camAt = (i, amt = 0.45, z = 0.14, rr = 0, d = 260, e = 'io') => {
  if (reducedMotion) return;
  const F = CLOSE_UP_CAMERAS[actorTeam(i)],
    k = clamp(amt * 2.1, 0, 1),
    c = {};
  for (const key in homeCamera) c[key] = homeCamera[key] + (F[key] - homeCamera[key]) * k;
  const w = actorWorldPoint(i),
    dx = w.x - c.x,
    dz = w.z - c.z,
    L = Math.hypot(dx, dz),
    dd = Math.min(L * 0.45, z * 5);
  c.x += (dx / L) * dd;
  c.z += (dz / L) * dd;
  camTo(c, d, e);
  tween(battleStage.css, 'r', rr, d, e);
};
function coinArc(from, to, dur, kind, onLand, spin) {
  const C = { kind, x: from.x, y: from.y, z: from.z, show: true, rot: 0, k: 1.6, glow: 0 };
  battleStage.coin = C;
  const t0 = battleStage.t;
  const step = () => {
    const k = Math.min(1, (battleStage.t - t0) / dur);
    C.x = from.x + (to.x - from.x) * k;
    C.z = from.z + (to.z - from.z) * k;
    C.y = from.y + (to.y - from.y) * k + Math.sin(k * Math.PI) * 1.6;
    C.rot = k * Math.PI * (spin ? 6 : 3);
    if (k < 1) scheduleAt(8, step);
    else {
      C.rot = 0;
      onLand && onLand(C);
    }
  };
  step();
  return C;
}
const PULL_BACK_CAMERA = { x: 0.15, y: 1.82, z: -0.75, yaw: 0, hz: -3 };
const throwOrigin = () => ({ x: battleStage.V.x - 0.9, y: battleStage.V.y - 0.6, z: battleStage.V.z + 0.6 });
export function battleStagePlay(an, ev) {
  battleStageFlush();
  const s0 = battleStage.s[0],
    s1 = battleStage.s[1];
  const syncSide = i => {
    const sn = ev && ev.s[i];
    if (sn && battleStage.s[i]) {
      battleStage.s[i].sp = sn.sp;
      battleStage.s[i].gold = sn.gold;
      battleStage.s[i].st = sn.st;
      battleStage.s[i].boss = !!sn.boss;
      battleStage.s[i].big = sn.boss ? 1.6 : sn.alpha ? 1.12 : 1;
    }
  };
  switch (an.k) {
    case 'wild': {
      syncSide(1);
      Object.assign(s1, { show: true, ox: 0, dark: 1, a: 1, sc: 1, white: 0 });
      battleStage.tr[0] = { who: 'me', show: true, x: 0, a: 1 };
      if (an.alpha) {
        battleStage.shk = 7;
        scheduleAt(650, () => {
          battleStageFlash('#5A1030', 0.45, 600);
          battleStage.shk = 9;
          handheld(900, 1.4);
          for (let i = 0; i < 26; i++) {
            const a = random() * 6.283,
              c = actorCenter(1);
            addParticle({
              x: c.x + Math.cos(a) * 0.6,
              y: 0.2,
              z: c.z + Math.sin(a) * 0.4,
              vx: Math.cos(a) * 2.4,
              vy: 1.5 + random() * 2,
              vz: Math.sin(a) * 1.6,
              ay: -3,
              life: 900,
              spr: 'spark',
              k: 1.2,
              glow: 1,
            });
          }
          groundRing(1, '#FF5A7A', 3.4, 900);
        });
        if (typeof buzz === 'function') buzz([30, 60, 30, 60, 80]);
      }
      if (!reducedMotion) {
        Object.assign(battleStage.cam, { x: 3.2, y: 1.05, z: 2.6, yaw: -0.56, hz: 13 });
        battleStage.css.r = -0.028;
        camTo({ x: 2.7, y: 1.12, z: 2.85, yaw: -0.47, hz: 12 }, 650, 'out');
        camHome(1150, 600);
      }
      battleStageFocus('foe', true);
      tween(s1, 'dark', 0, 380, 'lin', 700);
      scheduleAt(700, () => {
        setActorAction(1, 'enter', 700);
        ringFx(actorCenter(1), '#FFFFFF', 0.1, 0.9);
        groundRing(1, '#FFFFFF', 1.8);
      });
      scheduleAt(1250, () => battleStageFocus('wide'));
      return { dur: 1250, hit: 0 };
    }
    case 'trainerIn': {
      battleStage.tr[1] = { who: an.who, show: true, x: 120, a: 1 };
      battleStage.tr[0] = { who: 'me', show: true, x: -120, a: 1 };
      tween(battleStage.tr[1], 'x', 0, 560, 'out3');
      tween(battleStage.tr[0], 'x', 0, 560, 'out3');
      if (!reducedMotion) {
        Object.assign(battleStage.cam, { x: -2.6, y: 1.9, z: -0.8, yaw: 0.5, hz: -6 });
        battleStage.css.r = 0.02;
        camTo({ x: -2.25, y: 1.85, z: -0.6, yaw: 0.42, hz: -5 }, 420, 'out');
        camHome(1000, 320);
      }
      battleStageFocus('me', true);
      scheduleAt(450, () => battleStageFocus('foe'));
      scheduleAt(1200, () => battleStageFocus('wide'));
      return { dur: 1150, hit: 0 };
    }
    case 'enter': {
      const i = an.si,
        s = battleStage.s[i];
      syncSide(i);
      Object.assign(s, { show: false, ox: 0, oy: 0, sc: 0, a: 1, white: 1, dark: 0, act: null });
      const si = actorTeam(i),
        T = battleStage.tr[si];
      if (T.show) {
        setTrainerAction(si, 'throw', 520);
        tween(T, 'x', si === 0 ? -140 : 140, 320, 'in', 180);
        scheduleAt(510, () => {
          T.show = false;
        });
      }
      if (!an.quiet) {
        battleStageFocus(si === 0 ? 'me' : 'foe');
        camAt(i, 0.35, 0.1, si === 0 ? -0.012 : 0.012, 300);
      }
      const w = actorWorldPoint(i),
        from = si === 0 ? throwOrigin() : { x: w.x + 2.4, y: 2.2, z: w.z + 1.6 },
        to = { x: w.x, y: 0.4, z: w.z };
      coinArc(from, to, 380, 'penny', C => {
        C.show = false;
        s.show = true;
        const c = actorCenter(i);
        ringFx(c, '#FFFFFF', 0.1, si === 0 ? 1.3 : 1);
        groundRing(i, '#FFFFFF', 2);
        burst(c, 'Dynasty', 10, 2, 1);
        battleStageFlash('#FFFFFF', 0.25, 200);
        tween(s, 'sc', 1, 300, 'back');
        tween(s, 'white', 0, 320, 'lin', 120);
        setActorAction(i, 'enter', 700);
      });
      camHome(520, 560);
      scheduleAt(950, () => battleStageFocus('wide'));
      return { dur: 900, hit: 0 };
    }
    case 'recall': {
      const s = battleStage.s[an.si];
      setActorAction(an.si, 'block', 500);
      tween(s, 'white', 1, 160, 'lin', 120);
      tween(s, 'sc', 0, 220, 'in', 260);
      scheduleAt(500, () => {
        s.show = false;
        s.sc = 1;
        s.white = 0;
      });
      return { dur: 540, hit: 0 };
    }
    case 'faint': {
      const i = an.si,
        s = battleStage.s[i],
        si = actorTeam(i);
      setActorAction(i, 'faint', 99999);
      battleStageFocus(si === 0 ? 'me' : 'foe');
      camAt(i, 0.3, 0.08, si === 0 ? 0.02 : -0.02, 500);
      if (!reducedMotion) camTo(PULL_BACK_CAMERA, 520, 'io', 480);
      tween(s, 'oy', 10, 500, 'in', 450);
      tween(s, 'a', 0, 420, 'in', 560);
      scheduleAt(700, () => groundRing(i, '#C8C0E0', 1.6, 500));
      scheduleAt(1000, () => {
        s.show = false;
        s.oy = 0;
        s.a = 1;
        s.act = null;
      });
      battleStage.shk = 2.5;
      if (si === 0) buzz(40);
      camHome(650, 1050);
      scheduleAt(1100, () => battleStageFocus('wide'));
      return { dur: 1050, hit: 0 };
    }
    case 'move': {
      const si = an.si,
        ti = an.ti ?? 1 - si,
        ss = actorTeam(si),
        M = MOVES[an.mid],
        me = battleStage.s[si],
        dir = ss === 0 ? 1 : -1;
      an.t = M.t;
      const A = actorCenter(si),
        T = actorCenter(ti),
        kk = 1;
      battleStageFocus(ss === 0 ? 'me' : 'foe');
      camAt(si, 0.32, 0.08, ss === 0 ? -0.012 : 0.012, 200);
      if ((M.p || 0) >= 80 && !an.miss && !an.blocked && !an.protect) handheld(M.c === 'H' ? 700 : 950, 0.8);
      /* on the 3D stage a big move gets a camera sweep: low behind the attacker, then across to the target */
      if (battleStage.gl && !reducedMotion && (M.p || 0) >= 80 && !an.miss && !an.blocked && !an.protect) {
        const m = ss === 0 ? 1 : -1;
        camTo({ x: -0.7 * m, y: 1.05, z: 0.5, yaw: 0.16 * m, hz: 5 }, 300, 'out3');
        camTo({ x: 0.9 * m, y: 1.35, z: 1.3, yaw: -0.1 * m, hz: -3 }, 420, 'io', 420);
      }
      const ak = an.protect ? 'block' : M.c === 'H' ? 'attack' : M.c === 'S' ? 'cast' : an.self ? 'buff' : 'cast';
      setActorAction(si, ak, ak === 'attack' ? 620 : 800);
      const toT = (d = 180) => {
        battleStageFocus(actorTeam(ti) === 0 ? 'me' : 'foe');
        camAt(ti, 0.45, 0.15, actorTeam(ti) === 1 ? 0.022 : -0.022, d, 'out3');
      };
      if (an.miss) {
        if (M.c === 'H') {
          tween(me, 'ox', dir * 22, 110);
          tween(me, 'ox', 0, 160, 'out', 120);
        } else
          for (let i = 0; i < 6; i++)
            scheduleAt(i * 45, () =>
              addParticle({
                x: A.x,
                y: A.y,
                z: A.z,
                vx: (T.x - A.x) * 3.2 + (random() - 0.5),
                vy: (T.y - A.y) * 3.2 + 1.5,
                vz: (T.z - A.z) * 3.2 + 1.2,
                life: 380,
                spr: typeSprite(M.t, i),
                k: kk,
              })
            );
        const ts = battleStage.s[ti];
        scheduleAt(150, () => {
          toT();
          tween(ts, 'ox', ts.ox - dir * 18, 100);
          tween(ts, 'ox', 0, 180, 'out', 160);
          if (typeof hudPop === 'function') hudPop(ti, 'Miss', 'miss');
        });
        camHome(420, 560);
        scheduleAt(900, () => battleStageFocus('wide'));
        return { dur: 760, hit: 999 };
      }
      if (an.protect) {
        scheduleAt(140, () => {
          ringFx(A, '#8FD8FF', 0.3, 1.1, 600);
          ringFx(A, '#FFFFFF', 0.1, 0.8, 450);
          groundRing(si, '#8FD8FF', 1.8, 600);
        });
        camHome(400, 500);
        scheduleAt(800, () => battleStageFocus('wide'));
        return { dur: 700, hit: 0 };
      }
      if (an.blocked) {
        scheduleAt(170, () => {
          toT();
          ringFx(T, '#8FD8FF', 0.4, 0.9, 420);
          setActorAction(ti, 'block', 500);
          if (typeof hudPop === 'function') hudPop(ti, 'Hedged', 'miss');
        });
        camHome(400, 520);
        scheduleAt(900, () => battleStageFocus('wide'));
        return { dur: 740, hit: 999 };
      }
      if (M.c === 'H') {
        tween(me, 'ox', dir * 30, 120, 'in', 100);
        tween(me, 'oy', -4, 120, 'in', 100);
        tween(me, 'ox', 0, 200, 'out', 240);
        tween(me, 'oy', 0, 200, 'out', 240);
        scheduleAt(120, () => {
          for (let i = 0; i < 5; i++)
            addParticle({
              x: A.x,
              y: 0.15,
              z: A.z,
              vx: (random() - 0.5) * 1.2,
              vy: 0.6 + random() * 0.6,
              vz: (random() - 0.5) * 1.2,
              life: 420,
              col: '#E8DCC8',
              size: 2,
              floor: 1,
            });
        });
        scheduleAt(200, () => {
          toT(140);
          if (an.dmg) hitFx(ti, an);
        });
        camHome(460, 620);
        scheduleAt(1050, () => battleStageFocus('wide'));
        return { dur: 880, hit: 200 };
      }
      if (M.c === 'S') {
        const n = 9,
          beamy = M.t === 'Electric' || M.t === 'Psychic' || M.t === 'Water';
        scheduleAt(140, () => {
          ringFx(A, TC[M.t][0], 0.15, 0.8, 300);
          groundRing(si, TC[M.t][0], 1.4, 420);
        });
        if (beamy)
          scheduleAt(200, () =>
            addParticle({
              x: A.x,
              y: A.y,
              z: A.z,
              x2: T.x,
              y2: T.y,
              z2: T.z,
              beam: 1,
              col: TC[M.t][0],
              w: 3,
              life: 420,
              glow: 1,
            })
          );
        for (let i = 0; i < n; i++)
          scheduleAt(160 + i * 34, () => {
            const v = 1 / 0.32,
              key = typeSprite(M.t, i);
            addParticle({
              x: A.x + (random() - 0.5) * 0.2,
              y: A.y + (random() - 0.5) * 0.2,
              z: A.z,
              vx: (T.x - A.x) * v,
              vy: (T.y - A.y) * v + 2.4,
              vz: (T.z - A.z) * v,
              ay: -15,
              life: 320,
              spr: key,
              k: 1.2,
              fade: false,
              glow: GLOWING_PARTICLES[key],
            });
          });
        scheduleAt(330, () => toT(220));
        if (an.dmg) scheduleAt(500, () => hitFx(ti, an));
        camHome(480, 820);
        scheduleAt(1250, () => battleStageFocus('wide'));
        return { dur: 1060, hit: 500 };
      }
      const tgt = an.self ? si : ti,
        Pp = an.self ? A : T,
        tk = 1;
      if (!an.self) scheduleAt(260, () => toT(240));
      for (let i = 0; i < 10; i++)
        scheduleAt(200 + i * 48, () => {
          const a = (i / 10) * Math.PI * 2,
            key = typeSprite(M.t, i);
          addParticle({
            x: Pp.x + Math.cos(a) * 0.8,
            y: Pp.y + Math.sin(a * 2) * 0.3,
            z: Pp.z + Math.sin(a) * 0.8,
            vx: -Math.cos(a) * 1.2,
            vy: 0.8,
            vz: -Math.sin(a) * 1.2,
            life: 440,
            spr: key,
            k: tk,
            glow: GLOWING_PARTICLES[key],
          });
        });
      scheduleAt(600, () => {
        ringFx(Pp, TC[M.t][0], 0.2, 1.1, 420);
        groundRing(tgt, TC[M.t][0], 1.6);
        if (!an.self) {
          blinkActor(tgt, 240);
          setActorAction(tgt, 'dizzy', 700);
        }
      });
      camHome(460, 800);
      scheduleAt(1250, () => battleStageFocus('wide'));
      return { dur: 1000, hit: 600 };
    }
    case 'hurt': {
      const T = actorCenter(an.si),
        kk = 1;
      setActorAction(an.si, 'hurt', 600);
      blinkActor(an.si, 360);
      battleStage.shk = 2.5;
      if (an.dmg && typeof hudPop === 'function') scheduleAt(60, () => hudPop(an.si, '−' + an.dmg, 'dmg'));
      if (an.fx === 'oil')
        for (let i = 0; i < 7; i++)
          addParticle({
            x: T.x - 0.8 + random() * 0.4,
            y: 0.2 + random() * 0.9,
            z: T.z + (random() - 0.5) * 0.5,
            vx: 4 + random() * 2,
            vy: 0.4,
            life: 520,
            spr: 'pebble',
            k: kk,
          });
      if (an.fx === 'rent') burst(T, 'Ground', 7, 1.6, kk);
      if (an.fx === 'scn')
        for (let i = 0; i < 4; i++)
          scheduleAt(i * 70, () =>
            addParticle({
              x: T.x + (random() - 0.5) * 0.8,
              y: T.y + 0.6,
              z: T.z,
              vy: 1,
              life: 520,
              spr: 'flame',
              k: kk,
            })
          );
      if (an.fx === 'mail') {
        battleStageFocus(actorTeam(an.si) === 0 ? 'me' : 'foe');
        coinArc({ x: T.x + 3, y: 4, z: T.z + 2 }, T, 380, 'gold', C => {
          C.show = false;
          hitFx(an.si, { te: an.te, t: 'Retail' });
        });
        scheduleAt(1000, () => battleStageFocus('wide'));
        return { dur: 900, hit: 400 };
      }
      return { dur: 560, hit: 80 };
    }
    case 'heal': {
      const T = actorCenter(an.si),
        kk = 1;
      setActorAction(an.si, 'cheer', 700);
      for (let i = 0; i < 12; i++)
        scheduleAt(i * 45, () =>
          addParticle({
            x: T.x + (random() - 0.5) * 1.2,
            y: 0.2,
            z: T.z + (random() - 0.5) * 0.6,
            vy: 2 + random(),
            life: 650,
            spr: i % 3 ? 'plus' : 'spark',
            k: kk,
            glow: i % 3 ? 0 : 1,
          })
        );
      if (an.amt && typeof hudPop === 'function') scheduleAt(120, () => hudPop(an.si, '+' + an.amt, 'heal'));
      groundRing(an.si, '#5DFF8A', 1.5, 600);
      tween(battleStage.s[an.si], 'white', 0.35, 150);
      tween(battleStage.s[an.si], 'white', 0, 260, 'lin', 160);
      return { dur: 720, hit: 200 };
    }
    case 'stat': {
      const T = actorCenter(an.si),
        kk = 1;
      setActorAction(an.si, an.up ? 'buff' : 'dizzy', 700);
      for (let i = 0; i < 9; i++)
        scheduleAt(i * 55, () =>
          addParticle({
            x: T.x + (random() - 0.5) * 1.4,
            y: an.up ? 0.2 : T.y + 0.8,
            z: T.z + (random() - 0.5) * 0.6,
            vy: an.up ? 2.6 : -2.6,
            life: 540,
            spr: an.up ? 'up' : 'down',
            k: kk,
            glow: an.up ? 1 : 0,
          })
        );
      if (an.up) groundRing(an.si, '#8FD8FF', 1.6, 520);
      tween(battleStage.s[an.si], 'white', 0.3, 120);
      tween(battleStage.s[an.si], 'white', 0, 240, 'lin', 140);
      return { dur: 680, hit: 0 };
    }
    case 'status': {
      const T = actorCenter(an.si),
        kk = 1,
        sp = an.st === 'aud' ? 'bolt' : an.st === 'sub' ? 'zz' : 'flame';
      setActorAction(an.si, 'dizzy', 800);
      for (let i = 0; i < 8; i++)
        scheduleAt(i * 60, () =>
          addParticle({
            x: T.x + (random() - 0.5) * 1.2,
            y: T.y + 0.9,
            z: T.z,
            vx: (random() - 0.5) * 0.8,
            vy: an.st === 'aud' ? -1.6 : 1.4,
            life: 620,
            spr: sp,
            k: kk,
          })
        );
      battleStage.s[an.si].st = an.st;
      blinkActor(an.si, 300);
      return { dur: 700, hit: 0 };
    }
    case 'hype': {
      const T = actorCenter(an.si),
        kk = 1;
      setActorAction(an.si, 'dizzy', 800);
      for (let i = 0; i < 7; i++)
        scheduleAt(i * 60, () => {
          const a = (i / 7) * Math.PI * 2;
          addParticle({
            x: T.x + Math.cos(a) * 0.5,
            y: T.y + 0.8,
            z: T.z + Math.sin(a) * 0.5,
            vx: -Math.sin(a) * 0.8,
            vz: Math.cos(a) * 0.8,
            vy: 0.4,
            life: 520,
            spr: 'star',
            k: kk,
            glow: 1,
          });
        });
      return { dur: 640, hit: 0 };
    }
    case 'cry': {
      const s = battleStage.s[an.si];
      setActorAction(an.si, 'smug', 900);
      camAt(an.si, 0.3, 0.1, actorTeam(an.si) === 1 ? 0.012 : -0.012, 260);
      battleStageFocus(actorTeam(an.si) === 0 ? 'me' : 'foe');
      tween(s, 'oy', -7, 110, 'out');
      tween(s, 'oy', 0, 140, 'in', 110);
      tween(s, 'oy', -5, 100, 'out', 260);
      tween(s, 'oy', 0, 130, 'in', 360);
      scheduleAt(120, () => groundRing(an.si, '#FFFFFF', 1.2, 380));
      camHome(400, 520);
      scheduleAt(800, () => battleStageFocus('wide'));
      return { dur: 700, hit: 0 };
    }
    case 'market': {
      battleStage.oil = true;
      for (let i = 0; i < 40; i++)
        addParticle({
          x: GROUND_CENTER_X - 8 + random() * 4,
          y: 0.1 + random() * 3,
          z: GROUND_CENTER_Z + (random() - 0.4) * 7,
          vx: 8 + random() * 5,
          vy: (random() - 0.3) * 0.8,
          life: 1300,
          col: random() < 0.5 ? '#E8CF96' : '#C9A866',
          size: 1 + (random() < 0.3 ? 1 : 0),
        });
      battleStageFlash('#C8A060', 0.35, 500);
      battleStage.shk = 3;
      return { dur: 760, hit: 0 };
    }
    case 'marketEnd': {
      battleStage.oil = false;
      return { dur: 200, hit: 0 };
    }
    case 'alphaPhase': {
      const T = actorCenter(an.si),
        s = battleStage.s[an.si];
      setActorAction(an.si, 'buff', 900);
      battleStageFocus(actorTeam(an.si) === 0 ? 'me' : 'foe');
      battleStageFlash('#FFD860', 0.5, 420);
      battleStage.shk = 7;
      handheld(800, 1.2);
      if (s) s.shield = 1;
      ringFx(T, '#FFD860', 0.3, 2.2, 700);
      groundRing(an.si, '#FFD860', 2.6, 800);
      for (let i = 0; i < 24; i++)
        scheduleAt(i * 25, () => {
          const a = (i / 24) * Math.PI * 2;
          addParticle({
            x: T.x + Math.cos(a) * 1.1,
            y: 0.2 + random() * 1.4,
            z: T.z + Math.sin(a) * 0.6,
            vy: 1.4,
            life: 700,
            spr: 'spark',
            k: 1,
            glow: 1,
          });
        });
      buzz([20, 40, 20]);
      scheduleAt(1100, () => battleStageFocus('wide'));
      return { dur: 1200, hit: 0 };
    }
    case 'block': {
      const T = actorCenter(an.si);
      ringFx(T, '#FFD860', 0.25, 1.4, 380);
      return { dur: 300, hit: 0 };
    }
    case 'caught': {
      const C = battleStage.coin;
      if (C) {
        for (let i = 0; i < 10; i++)
          addParticle({ x: C.x, y: C.y, z: C.z, vx: (i - 4.5) * 0.5, vy: 3, ay: -6, life: 720, spr: 'spark', glow: 1 });
        tween(C, 'glow', 0.8, 120);
        tween(C, 'glow', 0, 300, 'lin', 140);
      }
      buzz([10, 40, 10, 40, 30]);
      return { dur: 720, hit: 0 };
    }
    case 'lvl': {
      const li = an.si ?? 0;
      if (!battleStage.s[li] || !battleStage.s[li].show) return { dur: 0, hit: 0 };
      const T = actorCenter(li);
      setActorAction(li, 'cheer', 900);
      battleStageFocus('me');
      camAt(li, 0.3, 0.08, -0.012, 300);
      ringFx(T, '#F4C542', 0.2, 1.5, 520);
      groundRing(li, '#F4C542', 2, 600);
      for (let i = 0; i < 10; i++)
        addParticle({
          x: T.x + (random() - 0.5) * 1.4,
          y: 0.2,
          z: T.z + (random() - 0.5) * 0.5,
          vy: 2.6,
          life: 620,
          spr: 'spark',
          k: 1,
          glow: 1,
        });
      if (typeof hudPop === 'function') hudPop(li, 'Level up', 'lvl');
      camHome(400, 500);
      scheduleAt(900, () => battleStageFocus('wide'));
      return { dur: 700, hit: 0 };
    }
    case 'run': {
      battleStage.s.forEach((s, i) => {
        if (actorTeam(i) === 0) {
          tween(s, 'a', 0, 300, 'in');
          tween(s, 'ox', -30, 300, 'in');
        }
      });
      return { dur: 420, hit: 0 };
    }
  }
  return { dur: 0, hit: 0 };
}
export function battleStageCatch(kind, res, spin, done) {
  battleStageFlush();
  const s1 = battleStage.s[1],
    o = actorCenter(1),
    w = actorWorldPoint(1),
    land = { x: w.x, y: 0.25, z: w.z };
  camAt(1, 0.5, 0.18, 0.02, 320);
  battleStageFocus('foe');
  coinArc(
    throwOrigin(),
    { x: o.x, y: o.y, z: o.z },
    480,
    kind,
    C => {
      battleStageFlash('#FFFFFF', 0.55, 280);
      ringFx(C, '#FFFFFF', 0.1, 1);
      tween(s1, 'white', 1, 120, 'lin');
      tween(s1, 'sc', 0, 220, 'in', 120);
      buzz(15);
      scheduleAt(360, () => {
        s1.show = false;
        tween(C, 'y', land.y, 300, 'in');
        scheduleAt(300, () => {
          battleStage.shk = 1.5;
          groundRing(1, '#FFFFFF', 1, 300);
          tween(C, 'y', land.y + 0.25, 110, 'out');
          tween(C, 'y', land.y, 120, 'in', 110);
        });
        let t = 760;
        for (let k = 0; k < res.w; k++) {
          scheduleAt(t, () => {
            tween(battleStage.css, 'z', 0.06 + k * 0.03, 200, 'out');
            tween(C, 'rot', -0.42, 150, 'out');
            tween(C, 'rot', 0.42, 240, 'io', 150);
            tween(C, 'rot', 0, 140, 'in', 390);
            buzz(8);
          });
          t += 820;
        }
        scheduleAt(t, () => {
          tween(battleStage.css, 'z', 0, 300, 'io');
          if (res.caught) {
            C.glow = 0;
            for (let i = 0; i < 12; i++)
              addParticle({
                x: C.x,
                y: C.y,
                z: C.z,
                vx: (random() - 0.5) * 3,
                vy: 2 + random() * 2,
                vz: (random() - 0.5) * 2,
                ay: -5,
                life: 720,
                spr: 'star',
                glow: 1,
              });
            tween(C, 'glow', 0.9, 100);
            tween(C, 'glow', 0, 300, 'lin', 120);
            battleStageFlash('#FFF2A8', 0.3, 400);
            scheduleAt(900, () => done(true));
          } else {
            battleStageFlash('#FFFFFF', 0.6, 300);
            ringFx(C, '#FFFFFF', 0.1, 1.1);
            C.show = false;
            s1.show = true;
            s1.sc = 0;
            s1.white = 1;
            tween(s1, 'sc', 1, 220, 'back');
            tween(s1, 'white', 0, 260, 'lin', 80);
            setActorAction(1, 'smug', 800);
            camHome(400, 200);
            scheduleAt(700, () => battleStageFocus('wide'));
            scheduleAt(620, () => done(false));
          }
        });
      });
    },
    spin
  );
}
