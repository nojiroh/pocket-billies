'use strict';
/* ================= BATTLE STAGE =================
   Directs a battle on the 3D engine (battle-3d.js draws the scene where you stand, the billionaires and the trainers):
   the timeline, the camera, particles and move effects, drawn on this canvas over the scene. A fixed 224×168 "frame"
   (where the two billionaires stand) is placed in the space the HUD leaves free. phase 06-3: the painted stage
   (ground, walls, far land, painted props, clouds, foregrounds) is gone; a battle stage is now a name, indoors or not
   and its ambient particles (game/data/battleStages.json).
   The camera is directed (pushes and pans with the action, intro dollies, a pull-back on faints), drifts in a slow orbit while idle,
   and is guarded so the two billionaires never leave the free frame. Reduced motion keeps it on the home shot. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import {
  BATTLE_STAGES,
  HIT_EFFECTS_BY_TYPE,
  TYPE_COLORS,
  activeBattle,
  battle3dLayout,
  battle3dStart,
  battle3dStop,
  battleAnimPlay,
  battleFlashGate,
  battleFreeArea,
  battleLayoutChanged,
  fighter,
  hudHit,
  hudPop,
  maxHp,
  platesTick,
  provide,
  reducedMotion,
  ribbonColour,
  robotGemDef,
  robotIdsFromSp,
  robotPartDef,
  saveData,
  soundEffect,
} from './hooks.js';
import { $, clamp, random } from './util.js';
import { graftLookSplit } from './logic/graft-art.js';
import {
  LUNGE_GHOSTS,
  RIBBON_CORE,
  impactAt,
  impactFrame,
  impactLength,
  lungeDash,
  lungeGhostCount,
  lungeLean,
  lungeLeanOn,
  lungeRibbonHalf,
  ribbonCells,
  ribbonEdges,
  ribbonTone,
  smearCount,
  smearGhosts,
  smearHistory,
  smearRecord,
  smearRibbon,
  smearStretch,
  throwArcEase,
} from './logic/smear.js';
import { frameCount, frameScheduler, frameStop, frameTask, userFps } from './frame-scheduler.js';
import { artImg, iconCanvas, makeCanvas, pyramidCanvas, whiteCopy } from './art.js';
import { ROBOT_PART_BONES, robotArmCanvas, robotLegsCanvas, robotTorsoCanvas } from './robot-art.js';
import { personBattleFrames, personBattlePose, wardrobeData } from './person-art.js';
import { drawRig, rigFrame, rigFrameKey, rigParts } from './skeleton-rig.js';
/* eslint-disable no-func-assign */
expose({
  ACTOR_RIG_SCALES: [() => ACTOR_RIG_SCALES],
  AREAS: [() => AREAS],
  BATTLE_STAGE_ART: [() => BATTLE_STAGE_ART],
  BAYER4: [() => BAYER4],
  BURST_BUDGET: [() => BURST_BUDGET],
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
  MONEY_ICON: [() => MONEY_ICON],
  PARTICLE_BUDGET: [() => PARTICLE_BUDGET],
  PULL_BACK_CAMERA: [() => PULL_BACK_CAMERA],
  PYRAMID_HIGH: [() => PYRAMID_HIGH],
  PYRAMID_LIFT: [() => PYRAMID_LIFT],
  PYRAMID_REST: [() => PYRAMID_REST],
  PYRAMID_SCALE: [() => PYRAMID_SCALE],
  PYRAMID_SIDE: [() => PYRAMID_SIDE],
  PYRAMID_YAW: [() => PYRAMID_YAW],
  RIBBON_DITHER: [() => RIBBON_DITHER],
  SOFT_BLUR_PAD: [() => SOFT_BLUR_PAD],
  SPIN_AXIS: [() => SPIN_AXIS],
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
  addParticle: [() => addParticle, v => (addParticle = v)],
  afterImpact: [() => afterImpact, v => (afterImpact = v)],
  ambientSpawning: [() => ambientSpawning, v => (ambientSpawning = v)],
  battleImpact: [() => battleImpact, v => (battleImpact = v)],
  battleLunge: [() => battleLunge, v => (battleLunge = v)],
  battleLungeGhosts: [() => battleLungeGhosts, v => (battleLungeGhosts = v)],
  battleLungeLean: [() => battleLungeLean, v => (battleLungeLean = v)],
  battleLungeRecord: [() => battleLungeRecord, v => (battleLungeRecord = v)],
  battleLungeRibbon: [() => battleLungeRibbon, v => (battleLungeRibbon = v)],
  battleQuality: [() => battleQuality],
  battleRibbonCells: [() => battleRibbonCells, v => (battleRibbonCells = v)],
  battleSmearCount: [() => battleSmearCount, v => (battleSmearCount = v)],
  battleStage: [() => battleStage],
  battleStageCatch: [() => battleStageCatch, v => (battleStageCatch = v)],
  battleStageChromaticFlash: [() => battleStageChromaticFlash, v => (battleStageChromaticFlash = v)],
  battleStageDraw: [() => battleStageDraw, v => (battleStageDraw = v)],
  battleStageDrawEffects: [() => battleStageDrawEffects, v => (battleStageDrawEffects = v)],
  battleStageFlash: [() => battleStageFlash, v => (battleStageFlash = v)],
  battleStageFlush: [() => battleStageFlush, v => (battleStageFlush = v)],
  battleStageFocus: [() => battleStageFocus, v => (battleStageFocus = v)],
  battleStageFormat: [() => battleStageFormat, v => (battleStageFormat = v)],
  battleStageFrame: [() => battleStageFrame, v => (battleStageFrame = v)],
  battleStageJoin3d: [() => battleStageJoin3d, v => (battleStageJoin3d = v)],
  battleStageKit: [() => battleStageKit],
  battleStageLayout: [() => battleStageLayout, v => (battleStageLayout = v)],
  battleStagePlay: [() => battleStagePlay, v => (battleStagePlay = v)],
  battleStagePrepare: [() => battleStagePrepare, v => (battleStagePrepare = v)],
  battleStageProject: [() => battleStageProject],
  battleStageProjectWith: [() => battleStageProjectWith, v => (battleStageProjectWith = v)],
  battleStageResize: [() => battleStageResize, v => setBattleStageResize(v)],
  battleStageResolutionScale: [() => battleStageResolutionScale, v => (battleStageResolutionScale = v)],
  battleStageRingPhase: [() => battleStageRingPhase],
  battleStageSelect: [() => battleStageSelect, v => (battleStageSelect = v)],
  battleStageStart: [() => battleStageStart, v => setBattleStageStart(v)],
  battleStageStop: [() => battleStageStop, v => ((battleStageStop = v), provide({ battleStageStop }))],
  battleStageTargets: [() => battleStageTargets, v => (battleStageTargets = v)],
  battleStageToCss: [() => battleStageToCss, v => (battleStageToCss = v)],
  battleStretch: [() => battleStretch, v => (battleStretch = v)],
  blinkActor: [() => blinkActor, v => (blinkActor = v)],
  blurAt: [() => blurAt, v => (blurAt = v)],
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
  catchSound: [() => catchSound],
  drawForegrounds: [() => drawForegrounds, v => (drawForegrounds = v)],
  drawList: [() => drawList],
  drawListLength: [() => drawListLength, v => (drawListLength = v)],
  drawParticles: [() => drawParticles, v => (drawParticles = v)],
  drawPixelRing: [() => drawPixelRing, v => (drawPixelRing = v)],
  drawRibbon2d: [() => drawRibbon2d, v => (drawRibbon2d = v)],
  drawSelectionRing: [() => drawSelectionRing, v => (drawSelectionRing = v)],
  drawShadow: [() => drawShadow, v => (drawShadow = v)],
  dueEvents: [() => dueEvents],
  formatFocus: [() => formatFocus],
  groundRing: [() => groundRing, v => (groundRing = v)],
  handheld: [() => handheld, v => (handheld = v)],
  hitFx: [() => hitFx, v => (hitFx = v)],
  hitStop: [() => hitStop, v => (hitStop = v)],
  hitWeight: [() => hitWeight, v => (hitWeight = v)],
  homeCamera: [() => homeCamera],
  impactFx: [() => impactFx, v => (impactFx = v)],
  lungeKind: [() => lungeKind, v => (lungeKind = v)],
  newActorState: [() => newActorState],
  particleSprite: [() => particleSprite, v => (particleSprite = v)],
  punch: [() => punch, v => (punch = v)],
  pyramidArc: [() => pyramidArc, v => (pyramidArc = v)],
  ribbonDither: [() => ribbonDither, v => (ribbonDither = v)],
  rigStats: [() => rigStats],
  ringFx: [() => ringFx, v => (ringFx = v)],
  robotPartPicture: [() => robotPartPicture, v => (robotPartPicture = v)],
  scheduleAt: [() => scheduleAt, v => (scheduleAt = v)],
  setActorAction: [() => setActorAction, v => (setActorAction = v)],
  setTrainerAction: [() => setTrainerAction, v => (setTrainerAction = v)],
  shrinkForSoftBlur: [() => shrinkForSoftBlur, v => (shrinkForSoftBlur = v)],
  softDraw: [() => softDraw, v => (softDraw = v)],
  spawnAmbientParticles: [() => spawnAmbientParticles, v => (spawnAmbientParticles = v)],
  throwOrigin: [() => throwOrigin],
  trainerBattleFrame: [() => trainerBattleFrame, v => (trainerBattleFrame = v)],
  trainerMetersPerPixel: [() => trainerMetersPerPixel],
  tween: [() => tween, v => (tween = v)],
  typeSprite: [() => typeSprite],
});
/* eslint-enable no-func-assign */
provide({ battleStageStop, buzz });
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
export const AREAS = BATTLE_STAGES;
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
  /* VFX-5: a lunge now (battleLunge: its window t0..t1 on the stage clock, its way on screen, a dash's colour) and
     its places on the smear grid */
  lunge: null,
  trail: null,
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
  /* water track WA-7: the scene's water in view (battle space, set by battle-3d.js) and the fighters standing in it */
  wet: /** @type {{x: number, z: number}[]} */ ([]),
  wetFeet: /** @type {number[]} */ ([]),
  wetT: 0,
  F: null,
  floorKey: '',
  q: { lvl: 0, since: 0, lowT: 0, highT: 0 },
  /* VFX-4: the impact frame playing (impactFx), or null */
  impact: /** @type {any} */ (null),
  stT: 0,
  speed: 1,
  /* phase 06-3: the camera holds still while the player chooses (battle.js floatTick) */
  calm: false,
};
const BATTLE_STAGE_ART = {};
/* phase 06-3: the painted stage is gone, so a stage needs no art of its own; kept as the start-up step battles await */
export async function battleStagePrepare(area) {
  area = AREAS[area] ? area : 'grass';
  return (BATTLE_STAGE_ART[area] = BATTLE_STAGE_ART[area] || { props: [], clouds: [] });
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
  if (battleStage.gl && typeof battle3dLayout === 'function') battle3dLayout();
}
export function battleStageStart(area) {
  battleStage.area = AREAS[area] ? area : 'grass';
  const A = AREAS[battleStage.area];
  battleStage.cv = $('#cvWorld');
  battleStage.fgc = $('#cvFg');
  battleStage.props = [];
  battleStage.leafy = [];
  battleStage.glint = [];
  battleStage.clouds = [];
  battleStage.wet = [];
  battleStage.wetFeet = [];
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
  battleStage.impact = null;
  battleStage.shk = 0;
  battleStage.hold = 0;
  battleStage.focusK = null;
  battleStage.q.since = performance.now();
  battleStage.gl = typeof battle3dStart === 'function' && battle3dStart();
  document.body.classList.toggle('battle-3d', !!battleStage.gl);
  /* phase 06-3: no painted stage. When the 3D scene isn't ready yet (the map still loading, a room opening), the battle
     waits behind its wipe and joins it as soon as it is (battleStageFrame) */
  battleStage.waitT = battleStage.gl ? 0 : performance.now();
  battleStageResize();
  battleStageFocus('wide', true);
  if (battleStage.gl) drawForegrounds();
  if (!battleStage.on) {
    battleStage.on = true;
    frameTask('scene', battleStageFrame);
  }
}
/* the battle waits for the 3D scene; this joins it once it's there (and says so in the debug log if it takes long) */
function battleStageJoin3d() {
  if (typeof battle3dStart !== 'function' || !battle3dStart()) {
    const w = performance.now() - battleStage.waitT;
    if (w > 8000 && !battleStage.waitLogged && typeof debugLog !== 'undefined') {
      battleStage.waitLogged = true;
      debugLog.add('battle', 'still waiting for the 3D scene after 8 s');
    }
    return;
  }
  battleStage.gl = true;
  battleStage.waitT = 0;
  document.body.classList.add('battle-3d');
  battleStageResize();
  battleStageFocus('wide', true);
  drawForegrounds();
}
export function battleStageStop() {
  battleStage.on = false;
  frameStop('scene');
  if (battleStage.gl && typeof battle3dStop === 'function') battle3dStop();
  battleStage.gl = false;
  battleStage.waitT = 0;
  battleStage.waitLogged = false;
  battleStage.calm = false;
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
/* skip to the end of whatever is still playing (a tap, or the next line). Camera, lens and zoom glide to where they were headed instead of cutting there */
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
  /* VFX-5: a lunge cut short has no smears: its places would jump to the end */
  for (const s of battleStage.s) {
    s.lunge = null;
    s.trail = null;
  }
  glide.forEach((m, o) => {
    for (const p in m) tween(o, p, m[p], 170, 'out');
  });
  const ev = battleStage.evs.sort((a, b) => a.t - b.t);
  battleStage.evs = [];
  /* VFX-8: a runner's step (battle-anim-run.js) does what its skip says (its end framing, the hit's numbers, or
     nothing: pictures and sounds still to come are dropped); any other event still runs at once */
  ev.forEach(e => ('onSkip' in e ? e.onSkip && e.onSkip() : e.fn()));
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
/* VFX-8: who: the Billie a flash belongs to, which gets a sprite flash instead when the limiter holds the full-screen
   one back (battle-anim-run.js battleFlashGate: at most 3 in any second, 333 ms apart, no saturated red) */
function battleStageFlash(col, a, dur, who) {
  if (typeof battleFlashGate === 'function' && !battleFlashGate(col, a, dur, who)) return;
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
    const R = rigParts(s.sp, ACTOR_RIG_SCALES[i], s.coat, s.graft);
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
  if (dt > 0) battleLungeRecord(t);
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
  let amb = 0;
  for (let i = 0; i < n; i++) if (P[i].amb) amb++;
  if (dt > 0 && !reducedMotion && amb < PARTICLE_BUDGET[battleQuality()] / 4) {
    ambientSpawning = true;
    try {
      spawnAmbientParticles(dt);
    } finally {
      ambientSpawning = false;
    }
  }
  battleStage.shk = Math.max(0, battleStage.shk - dt * 0.02);
  if (!battleStage.gl && battleStage.waitT) battleStageJoin3d();
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
/* ambient life: motes, drips, falling leaves, glints, status fizz */
const LEAF_COLORS = ['#6FAE3F', '#9CC850', '#D7B447', '#4E8A3A'];
function spawnAmbientParticles(dt) {
  const A = AREAS[battleStage.area];
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
  /* WA-7: the water in view catches the light in hard pixels; a fighter standing in water sends out rings */
  if (battleStage.wet.length && random() < dt / 260) {
    const p = battleStage.wet[Math.floor(random() * battleStage.wet.length)];
    addParticle({
      x: p.x + random() - 0.5,
      y: 0.04,
      z: p.z + random() - 0.5,
      life: 600,
      spr: 'spark',
      k: 0.45,
      glow: 1,
      twinkle: 1,
    });
  }
  battleStage.wetT += dt;
  if (battleStage.wetT > 900) {
    battleStage.wetT = 0;
    for (const i of battleStage.wetFeet)
      if (battleStage.s[i] && battleStage.s[i].show) groundRing(i, undefined, 0.9, 800);
  }
  battleStage.stT += dt;
  if (battleStage.stT > 700) {
    battleStage.stT = 0;
    for (let i = 0; i < battleStage.s.length; i++) {
      const sd = battleStage.s[i];
      if (!sd.show || !sd.st || sd.a < 0.5) continue;
      const T = actorTop(i);
      const sp = sd.st === 'par' ? 'bolt' : sd.st === 'slp' ? 'zz' : sd.st === 'brn' ? 'flame' : 'spark';
      addParticle({
        x: T.x + (random() - 0.5) * 0.6,
        y: T.y + 0.2,
        z: T.z,
        vx: (random() - 0.5) * 0.3,
        vy: sd.st === 'par' ? -0.6 : 0.7,
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
        R = sd.sp ? rigParts(sd.sp, ACTOR_RIG_SCALES[i], sd.coat, sd.graft) : null,
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
}
/* VFX-1: how many afterimages a thrown pyramid leaves (none under Reduced motion, fewer as the quality drops) */
export function battleSmearCount() {
  return smearCount(!!reducedMotion, battleStage.q.lvl);
}
/* VFX-3: its stretch now (logic/smear.js smearStretch), or null: off where the afterimages are */
export function battleStretch(C) {
  return C && C.arc ? smearStretch(C.trail, battleStage.t, battleSmearCount() > 0, battleStage.V) : null;
}
/* VFX-2: how many places its ribbon runs along (none where the afterimages are off, fewer at level 2) */
export function battleRibbonCells() {
  return ribbonCells(!!reducedMotion, battleStage.q.lvl);
}
/* VFX-5: an attack's lunge, the step Part 2's runner reuses (its "lunge" and "dash"): Billie i moves dx stage px
   toward the foe (dy up; dur ms, eased, after delay), then back home (backDur ms, from backAt); the same tweens a
   lunge always had, so it takes no more time. While it runs its places are kept on the 24 fps grid
   (battleLungeRecord) for its lean, its afterimages and, with dash, a ribbon in col ('#rrggbb'). Returns when it is
   home (ms) */
function battleLunge(i, o) {
  const s = battleStage.s[i];
  if (!s) return 0;
  const { dx, dy = 0, dur, ease = 'out', delay = 0, backDur, backAt, dash = false, col = null } = o;
  tween(s, 'ox', dx, dur, ease, delay);
  if (dy) tween(s, 'oy', dy, dur, ease, delay);
  tween(s, 'ox', 0, backDur, 'out', backAt);
  if (dy) tween(s, 'oy', 0, backDur, 'out', backAt);
  const V0 = actorPositions[1].x - actorPositions[0].x,
    t = battleStage.t;
  s.lunge = { t0: t + delay, t1: t + backAt + backDur, fwd: Math.sign(dx * V0) || 1, dash: !!dash, col };
  s.trail = smearHistory();
  return backAt + backDur;
}
/* VFX-5: a move's lunge kind: a dash (logic/smear.js LUNGE_DASH) leaves a ribbon in its type's colour */
function lungeKind(mid, type) {
  const c = lungeDash(mid) && TYPE_COLORS[type] && TYPE_COLORS[type][0];
  return typeof c === 'string' && c[0] === '#' ? { dash: true, col: c } : {};
}
/* VFX-5: keeps each lunging Billie's place on the smear grid (the battle's frame, after its tweens) */
function battleLungeRecord(t) {
  for (let i = 0; i < battleStage.s.length; i++) {
    const s = battleStage.s[i],
      U = s.lunge;
    if (!U || !s.trail || t < U.t0 || t > U.t1) continue;
    const w = actorWorldPoint(i);
    if (smearRecord(s.trail, t, { x: w.x, y: w.y, z: w.z }))
      s.trail.list[0].lean = lungeLean(s.trail, t, actorMetersPerPixel[i], true, U.fwd);
  }
}
/* VFX-5: Billie i's lean now (the sprite shader's uShear), 0 when it isn't lunging or the smears are off */
export function battleLungeLean(i) {
  const s = battleStage.s[i];
  if (!s || !s.lunge) return 0;
  const on = lungeLeanOn(!!reducedMotion, battleStage.q.lvl);
  return lungeLean(s.trail, battleStage.t, actorMetersPerPixel[i], on, s.lunge.fwd);
}
/* VFX-5: its afterimages now (logic/smear.js smearGhosts with a lunge's looks): places in battle metres, each with its
   lean, fade and glow */
export function battleLungeGhosts(i) {
  const s = battleStage.s[i];
  if (!s || !s.trail) return [];
  return smearGhosts(
    s.trail,
    battleStage.t,
    lungeGhostCount(!!reducedMotion, battleStage.q.lvl),
    battleStage.V,
    LUNGE_GHOSTS
  );
}
/* VFX-5: a dash's ribbon now, at the Billie's middle (points in battle metres, logic/smear.js smearRibbon), with its
   colour; null when it isn't a dash, or the ribbon is off or gone */
export function battleLungeRibbon(i) {
  const s = battleStage.s[i],
    U = s && s.lunge;
  if (!U || !U.dash || !U.col || !s.trail) return null;
  const t = battleStage.t,
    w = actorWorldPoint(i),
    c = actorCenter(i),
    yc = c.y - w.y,
    head = t >= U.t0 && t <= U.t1 ? w : null,
    R = smearRibbon(s.trail, t, battleRibbonCells(), battleStage.V, head, lungeRibbonHalf(yc * 2));
  if (R.length < 2) return null;
  for (const p of R) p.y += yc;
  return { R, col: U.col };
}
/* VFX-2: a thrown pyramid's ribbon on the 2D canvas, while its model can't be drawn: each span a flat four-sided
   piece in its colour with the white core inside, eroded by a 4x4 dither pattern (one a colour and step, made once) */
const RIBBON_DITHER = new Map(),
  BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function ribbonDither(c, col, e) {
  const key = col + e;
  let P = RIBBON_DITHER.get(key);
  if (!P) {
    const cv = makeCanvas(4, 4),
      x = cv.getContext('2d');
    x.fillStyle = col;
    for (let i = 0; i < 16; i++) if ((BAYER4[i] + 0.5) / 16 >= e) x.fillRect(i % 4, i >> 2, 1, 1);
    RIBBON_DITHER.set(key, (P = c.createPattern(cv, 'repeat')));
  }
  return P;
}
function drawRibbon2d(c, R, E, col) {
  const Q = E.map(e => [battleStageProject(...e[0]), battleStageProject(...e[1])]),
    piece = (a, b, k) => {
      const m = (p, q) => [(p.x + q.x) / 2, (p.y + q.y) / 2],
        ma = m(a[0], a[1]),
        mb = m(b[0], b[1]),
        at = (M, p, s) => [Math.round(M[0] + (p.x - M[0]) * s), Math.round(M[1] + (p.y - M[1]) * s)];
      c.beginPath();
      c.moveTo(...at(ma, a[0], k));
      c.lineTo(...at(ma, a[1], k));
      c.lineTo(...at(mb, b[1], k));
      c.lineTo(...at(mb, b[0], k));
      c.closePath();
      c.fill();
    };
  for (let i = 0; i + 1 < R.length; i++) {
    const a = Q[i],
      b = Q[i + 1],
      e = Math.max(R[i].e, R[i + 1].e);
    if (!a[0] || !a[1] || !b[0] || !b[1] || e >= 1) continue;
    c.fillStyle = ribbonDither(c, col, e);
    piece(a, b, 1);
    c.fillStyle = ribbonDither(c, 'white', e);
    piece(a, b, RIBBON_CORE);
  }
}
/* adaptive quality: drop render detail if frames run long, restore when there's headroom */
function adaptBattleStageQuality(work) {
  const Q = battleStage.q,
    now = performance.now(),
    target = Math.min(userFps(), frameScheduler.hz || 60),
    budget = 1000 / target,
    fps = frameScheduler.meter.fps;
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
      R = s.sp ? rigParts(s.sp, ACTOR_RIG_SCALES[i], s.coat, s.graft) : null,
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
    /* phase 06-3: calm while the player chooses (the battle cards float in the scene and should hold still) */
    !reducedMotion &&
    !busy &&
    !battleStage.calm &&
    battleStage.t - battleStage.camT > 650 &&
    battleStage.s[0].show &&
    battleStage.s[1].show
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
/* depth blur at half resolution, laid over the sharp ground with a per-row opacity that eases in smoothly:
   rows in focus stay crisp pixel art, rows out of focus fade into a soft copy. The soft copy is two box passes each way (≈ gaussian)
   with fractional, per-row radii (box edges are weighted, so the radius grows continuously instead of in whole-pixel steps, which
   is what made bands and blocks). Near rows also get a little extra blur in proportion to how magnified the ground texture is there,
   so its texels don't read as blocks. */
const GROUND_BLUR_SCALE = 0.42;
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
/* phase 20 R3: what the rigs cost, summed until the diagnostics read and clear it: calls that got to a rig, the
   canvases redrawn (each one an upload for the 3D stage), their bytes and the processor's time drawing them */
export const rigStats = { calls: 0, redraws: 0, bytes: 0, ms: 0 };
/* one billionaire's current frame, drawn into its buffer (the 2D stage draws the buffer; the 3D stage uploads it) */
export function actorBuffer(i) {
  const s = battleStage.s[i];
  if (!s.show || !s.sp || s.a <= 0.01 || s.sc <= 0.01) return null;
  if (battleStage.t < s.blinkUntil && Math.floor(battleStage.t / 60) % 2) return null;
  const k = ACTOR_RIG_SCALES[i],
    R = rigParts(s.sp, k, s.coat, s.graft),
    view = actorTeam(i) === 0 ? 'back' : 'front',
    buf = battleStage.buf[i] || (battleStage.buf[i] = makeCanvas(10, 10));
  if (!R) return null;
  const t0 = performance.now();
  rigStats.calls++;
  const a = s.act,
    tau = a ? battleStage.t - a.t0 : 0,
    ak = a && (a.k === 'faint' || tau < a.dur) ? a.k : null,
    t16 = Math.floor(battleStage.t / 16) * 16;
  /* phase 20 R3: the same rig, pose, face, build, faint parts as the last frame drawn here is the same
     picture: the canvas stays, its counter too, so nothing is uploaded again */
  const key =
    rigFrameKey(R, ak, tau, t16, s.seed) +
    `|${view}|${s.build ? JSON.stringify(s.build) : ''}|${s.dim ? s.dim.join() : ''}`;
  if (buf.__R === R && buf.__key === key && buf.width === R.BW && buf.height === R.BH) {
    rigStats.ms += performance.now() - t0;
    return { s, k, R, P: buf.__P, ak, buf };
  }
  if (buf.width !== R.BW || buf.height !== R.BH) {
    buf.width = R.BW;
    buf.height = R.BH;
  }
  const bx = buf.getContext('2d');
  bx.imageSmoothingEnabled = false;
  bx.setTransform(1, 0, 0, 1, 0, 0);
  bx.clearRect(0, 0, buf.width, buf.height);
  const P = rigFrame(R, ak, tau, t16, s.seed);
  if (s.build) P.build = s.build;
  if (s.dim) P.dim = s.dim;
  /* VFX-9: the white and dark flashes are laid on by the GPU (battle-3d.js battle3dHit, walk/sprites.js uHit) */
  drawRig(bx, R, P, view);
  buf.__v = (buf.__v || 0) + 1;
  buf.__R = R;
  buf.__key = key;
  buf.__P = P;
  rigStats.redraws++;
  rigStats.bytes += buf.width * buf.height * 4;
  rigStats.ms += performance.now() - t0;
  return { s, k, R, P, ak, buf };
}
/* the trainers: you from behind (left), the rival facing you (right); they throw coins and cheer */
export const trainerMetersPerPixel = i =>
  (i === 0 ? 1.42 : 1.7) / ((typeof wardrobeData === 'function' && wardrobeData() && wardrobeData().figure) || 74);
export function trainerBattleFrame(i) {
  const T = battleStage.tr[i];
  if (!T || !T.who) return null;
  const view = i === 0 ? 'back' : 'front';
  if (T.act && battleStage.t - T.t0 < T.dur && typeof personBattlePose === 'function')
    return personBattlePose(T.who, view, T.act, (battleStage.t - T.t0) / T.dur, battleStage.t - T.t0);
  const fr = personBattleFrames(T.who, view);
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
    /* VFX-9: drawn in the 3D world instead (walk/battle-fx.js), all but a bot's dropped part (a picture) */
    if (battleStage.gl && !p.img) return;
    const q = battleStageProject(p.x, p.y, p.z);
    if (q) L.push([q, p]);
  });
  L.sort((a, b) => b[0].z - a[0].z);
  L.forEach(([q, p]) => {
    let fade = p.fade === false ? 1 : 1 - p.age / p.life;
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
    } else if (p.img) {
      /* RL-14: a picture (a bot's dropped part), turning as it falls */
      const kk = Math.max(0.5, Math.round(k * 2) / 4),
        w = Math.round((p.img.naturalWidth || p.img.width) * kk),
        h = Math.round((p.img.naturalHeight || p.img.height) * kk);
      c.save();
      c.translate(Math.round(q.x), Math.round(q.y));
      c.rotate((p.rot || 0) + ((p.vr || 0) * Math.min(p.age, 700)) / 1000);
      c.drawImage(p.img, -Math.round(w / 2), -Math.round(h / 2), w, h);
      c.restore();
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
    } else {
      c.fillStyle = p.col;
      const sz = Math.max(1, Math.round((p.size || 2) * k * 0.6));
      c.fillRect(Math.round(q.x), Math.round(q.y), sz, sz);
    }
    c.globalCompositeOperation = 'source-over';
  });
  c.globalAlpha = 1;
}
/* foreground: the area's grass or railings, split to the two edges of the open stage and blurred like a near lens element */
export function drawForegrounds() {
  /* phase 06-3: on the 3D stage the foreground canvas stays clear (the painted stage's foregrounds are gone) */
  const c = battleStage.fx;
  if (!c || battleStage.fgKey === 'gl') return;
  battleStage.fgKey = 'gl';
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, battleStage.fgc.width, battleStage.fgc.height);
}
const drawList = [];
let drawListLength = 0;
function battleStageDraw() {
  /* phase 06-3: the 3D engine (battle-3d.js) draws the scene, the billionaires and the trainers; this canvas only keeps
     the effects (the painted stage is gone) */
  const c = battleStage.cx,
    R = battleStage.L.R;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, battleStage.cv.width, battleStage.cv.height);
  if (!battleStage.gl) return;
  c.setTransform(R, 0, 0, R, 0, 0);
  c.imageSmoothingEnabled = false;
  /* VFX-4: while the impact frame's two-tone shows, this canvas (above the toned picture) stays clear */
  const I = battleStage.impact;
  if (I && performance.now() - I.t0 < impactLength(I)) return;
  battleStageDrawEffects(c);
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
    R = s && s.sp ? rigParts(s.sp, ACTOR_RIG_SCALES[i], s.coat, s.graft) : null,
    hw = R ? (R.geo.hw * actorMetersPerPixel[i] * (s.big || 1) * (s.fs || 1) * 0.8) / R.k : 0.5;
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
  /* RF-2: the thrown pyramid's flat icon, while battle-3d.js can't draw its model (3D props off, the GPU lost) */
  if (battleStage.coin && battleStage.coin.show && !(battleStage.t - (battleStage.coin.in3d ?? -1e9) < 120)) {
    const C = battleStage.coin,
      q = battleStageProject(C.x, C.y, C.z);
    if (q) {
      /* the mail move's coin: the money icon (not a catch item) */
      const cc = C.kind === MONEY_ICON ? iconCanvas('coin', 3) : pyramidCanvas(C.kind, 16),
        k = clamp((q.s / 30) * (C.k || 1), 0.6, 4);
      /* VFX-2: its ribbon under everything (as walk/effects.js ribbonPass draws it) */
      const RB = smearRibbon(C.trail, battleStage.t, battleRibbonCells(), battleStage.V, C.arc ? C : null),
        rc = ribbonColour(C.kind);
      if (RB.length > 1 && rc)
        drawRibbon2d(
          c,
          RB,
          ribbonEdges(RB, battleStage.V, C.rax),
          `rgb(${ribbonTone(rc).map(v => Math.round(v * 255))})`
        );
      /* VFX-1: its afterimages, oldest first (under the newer ones), at whole pixels like the icon */
      const G = smearGhosts(C.trail, battleStage.t, battleSmearCount(), battleStage.V);
      for (let i = G.length - 1; i >= 0; i--) {
        const g = G[i],
          gq = battleStageProject(g.s.x, g.s.y, g.s.z);
        if (!gq) continue;
        c.save();
        c.translate(Math.round(gq.x), Math.round(gq.y));
        c.rotate(g.s.rot || 0);
        c.globalAlpha = g.fade;
        c.drawImage(cc, -8 * k, -8 * k, 16 * k, 16 * k);
        c.globalAlpha = g.fade * Math.min(1, g.glow);
        c.drawImage(whiteCopy(cc), -8 * k, -8 * k, 16 * k, 16 * k);
        c.restore();
      }
      c.globalAlpha = 1;
      c.save();
      c.translate(Math.round(q.x), Math.round(q.y));
      /* VFX-3: on its fastest cells, drawn longer back along its drag (its front edge stays put) */
      const S = battleStretch(C),
        sq = S && battleStageProject(C.x + S.d[0], C.y + S.d[1], C.z + S.d[2]);
      if (sq) {
        const dx = sq.x - q.x,
          dy = sq.y - q.y,
          l = Math.hypot(dx, dy),
          a = Math.atan2(dy, dx);
        c.rotate(a);
        c.translate(l / 2, 0);
        c.scale(1 + l / (16 * k), 1);
        c.rotate(-a);
      }
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
/* VFX-9: the budgets (docs/phases/vfx-track.md "Budgets"): particles alive in the one pool at quality 0-3, a burst's
   most, and the ambient ones at most a quarter of the pool. A move's particle over the budget takes an ambient one's
   place (the oldest), else it isn't made; an ambient one over its share isn't made */
const PARTICLE_BUDGET = [256, 160, 96, 48],
  BURST_BUDGET = [24, 16, 10, 6];
const battleQuality = () => clamp(battleStage.q.lvl | 0, 0, 3);
let ambientSpawning = false;
function addParticle(o) {
  const P = battleStage.parts;
  if (P.length >= PARTICLE_BUDGET[battleQuality()]) {
    if (ambientSpawning) return;
    const j = P.findIndex(p => p.amb);
    if (j < 0) return;
    P.splice(j, 1);
  }
  const p = Object.assign({ vx: 0, vy: 0, vz: 0, ax: 0, ay: 0, az: 0, age: 0, life: 600, layer: 2 }, o);
  if (ambientSpawning) p.amb = 1;
  P.push(p);
}
const HIT_SPRITES_BY_TYPE = HIT_EFFECTS_BY_TYPE;
const GLOWING_PARTICLES = { spark: 1, star: 1, bolt: 1, bit: 1, gem: 1, pow: 1, up: 1 };
const typeSprite = (t, i) => {
  const l = HIT_SPRITES_BY_TYPE[t] || HIT_SPRITES_BY_TYPE.None;
  return l[i % l.length];
};
function burst(P, t, n = 10, sp = 2.2, k = 1) {
  n = Math.min(n, BURST_BUDGET[battleQuality()]);
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
/* VFX-4: the impact frame (logic/smear.js impactFrame; drawn by the grade pass, engine/post-effects.js): a cell or two
   of two-tone with radial lines from P, on a catch's pyramid, the mail move's coin and a crit (whose speed lines,
   2D-canvas lines before VFX-4, follow it). Timed on real time, so it plays through the hit-stop. Returns the frame */
function impactFx(P, kind) {
  const F = impactFrame(kind, !!reducedMotion, battleStage.q.lvl);
  battleStage.impact = F ? { ...F, P: { x: P.x, y: P.y, z: P.z }, t0: performance.now(), seed: random() } : null;
  return F;
}
/* what it shows now (battle-3d.js passes it to the post pass), or null once over */
export function battleImpact() {
  const I = battleStage.impact,
    s = I && impactAt(I, performance.now() - I.t0);
  if (!s) battleStage.impact = null;
  return s ? { ...s, I } : null;
}
/* a flash (or the chromatic flash) that would wash the two-tone out waits until it is over */
function afterImpact(F, fn) {
  const ms = impactLength(F);
  if (ms > 0) setTimeout(fn, ms);
  else fn();
}
function blinkActor(i, ms = 380) {
  battleStage.s[i].blinkUntil = battleStage.t + ms;
}
/* v34: how hard a hit lands follows how much it took: a scratch barely nudges the camera, a hit that takes most of a
   fighter's HP shakes it, stops time a little longer and knocks the target further back */
function hitWeight(ti, an) {
  try {
    const m = typeof fighter === 'function' ? fighter(ti) : null;
    if (!m || !an || !an.dmg) return 0.3;
    return clamp(an.dmg / Math.max(1, maxHp(m)), 0, 1);
  } catch (e) {
    return 0.3;
  }
}
/* imp: an impact frame already started for this hit (the mail move's coin); a crit starts its own */
function hitFx(ti, an, imp0 = null) {
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
  const imp = imp0 || (an.crit ? impactFx(T, 'crit') : null);
  if (an.te > 1) {
    battleStage.shk = 8;
    afterImpact(imp, () => {
      battleStageFlash('#FFFFFF', 0.55, 260, ti);
      battleStageChromaticFlash(180);
    });
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
    afterImpact(imp, () => battleStageFlash('#FFF2A8', 0.6, 300, ti));
    hitStop(90);
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
/* RF-2: a pyramid (a catch item's id: its model or its icon) or the mail move's coin (MONEY_ICON) flies an arc. A
   pyramid tumbles about a tilted axis (C.ax, C.tum; faster with spin) while C.fly; battle-3d.js pyramidItem draws it */
const MONEY_ICON = '$coin',
  SPIN_AXIS = [0.35, 0.3, 0.89];
function pyramidArc(from, to, dur, kind, onLand, spin) {
  const C = {
    kind,
    x: from.x,
    y: from.y,
    z: from.z,
    show: true,
    rot: 0,
    k: 1.6,
    glow: 0,
    fly: true,
    tum: 0,
    ax: spin ? SPIN_AXIS : [0.62, 0.45, 0.64],
    tip: false,
    /* VFX-1: its places on the smear grid, for the afterimages and (VFX-2) the ribbon (logic/smear.js); arc: still
       on its arc (the ribbon reaches it), rax: a spin throw's tumble axis, which its ribbon twists about (C.ax changes
       on the catch's hit, the ribbon's doesn't) */
    trail: smearHistory(),
    arc: true,
    rax: spin ? SPIN_AXIS : null,
  };
  battleStage.coin = C;
  const t0 = battleStage.t;
  const step = () => {
    const k = Math.min(1, (battleStage.t - t0) / dur),
      /* VFX-1: fast from the hand, a hang at the top, fast into the hit; the same path and time */
      u = throwArcEase(k);
    C.x = from.x + (to.x - from.x) * u;
    C.z = from.z + (to.z - from.z) * u;
    C.y = from.y + (to.y - from.y) * u + Math.sin(u * Math.PI) * 1.6;
    C.rot = k * Math.PI * (spin ? 6 : 3);
    C.tum = k * Math.PI * (spin ? 7 : 4);
    /* VFX-3: k too, its pace there says whether the cell is stretched */
    if (k < 1) smearRecord(C.trail, battleStage.t, { x: C.x, y: C.y, z: C.z, rot: C.rot, tum: C.tum, k });
    if (k < 1) scheduleAt(8, step);
    else {
      C.arc = false;
      C.rot = 0;
      onLand && onLand(C);
    }
  };
  step();
  return C;
}
const PULL_BACK_CAMERA = { x: 0.15, y: 1.82, z: -0.75, yaw: 0, hz: -3 };
/** RL-14b: a robot part's picture: its own (art.img, loaded), or the placeholder robot-art.js draws from its shape
 * and colour (a torso's with the gem's colour on its chest, or a slot's as given) */
function robotPartPicture(P, slot, gemColor) {
  const im = P.art && P.art.img ? artImg(P.art.img) : null;
  if (im && im.complete && im.naturalWidth) return im;
  if (P.art && P.art.img) return null;
  const kind = slot === 'torso' || slot === 'legs' ? slot : P.slot;
  return kind === 'torso'
    ? robotTorsoCanvas(P, gemColor || P.art.color)
    : kind === 'legs'
      ? robotLegsCanvas(P)
      : robotArmCanvas(P);
}
const throwOrigin = () => ({ x: battleStage.V.x - 0.9, y: battleStage.V.y - 0.6, z: battleStage.V.z + 0.6 });
export function battleStagePlay(an, ev) {
  battleStageFlush();
  /* phase 17: a robot's broken parts are drawn faint from the moment they break */
  if (ev && ev.s)
    ev.s.forEach((sn, i) => {
      if (sn && battleStage.s[i] && battleStage.s[i].sp === sn.sp)
        battleStage.s[i].dim = sn.bot && sn.bot.brk.length ? sn.bot.brk.flatMap(q => ROBOT_PART_BONES[q] || []) : null;
    });
  const s0 = battleStage.s[0],
    s1 = battleStage.s[1];
  const syncSide = i => {
    const sn = ev && ev.s[i];
    if (sn && battleStage.s[i]) {
      battleStage.s[i].sp = sn.sp;
      battleStage.s[i].build = sn.build || null;
      battleStage.s[i].coat = sn.coat || null;
      battleStage.s[i].graft = sn.graft || null;
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
      pyramidArc(from, to, 380, 'pyramid', C => {
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
    /* RL-14b: a boss's join intro (bosses.json, battle-engine.js startTrainer): its four bots fly in from four sides,
       lock together in a flash, and it stands at Alpha scale. Tapping on skips it (battleStageFlush) */
    case 'join': {
      const i = an.si,
        s = battleStage.s[i];
      syncSide(i);
      Object.assign(s, { show: false, ox: 0, oy: 0, sc: 0, a: 1, white: 1, dark: 0, act: null });
      const T = battleStage.tr[actorTeam(i)];
      if (T.show) {
        tween(T, 'x', 140, 320, 'in');
        scheduleAt(330, () => {
          T.show = false;
        });
      }
      battleStageFocus('foe');
      camAt(i, 0.3, 0.08, 0.012, 400);
      const c = actorCenter(i),
        ids = robotIdsFromSp(s.sp),
        /* its glow (bosses.json), else the gem's colour */
        G = ids && robotGemDef(ids.gem),
        glow = an.glow || (G && G.color),
        LOCK = 1300;
      /* where each bot comes from: the leader from above, the arm-bots from the sides, the leg-bot from the front */
      const FROM = { torso: [0, 2.4, -0.6], armL: [-2.8, 0.6, 0.2], armR: [2.8, 0.6, 0.2], legs: [0, -0.4, 2.2] };
      if (ids && !reducedMotion)
        Object.entries(FROM).forEach(([k, d], n) => {
          const P = robotPartDef(ids[k]),
            im = P && robotPartPicture(P, k, G && G.color);
          if (!im) return;
          const at = n * 140,
            life = LOCK - at;
          scheduleAt(at, () =>
            addParticle({
              img: im,
              x: c.x + d[0],
              y: c.y + d[1],
              z: c.z + d[2],
              vx: (-d[0] * 1000) / life,
              vy: (-d[1] * 1000) / life,
              vz: (-d[2] * 1000) / life,
              life,
              fade: false,
              rot: 0,
              vr: k === 'armL' ? 2 : k === 'armR' ? -2 : 0,
              k: 2.4,
            })
          );
          scheduleAt(at, () => groundRing(i, glow, 1.2 + n * 0.4, 500));
        });
      battleStage.shk = 3;
      scheduleAt(LOCK, () => {
        battleStageFlash(glow, 0.7, 520);
        battleStage.shk = 10;
        handheld(900, 1.4);
        s.show = true;
        tween(s, 'sc', 1, 340, 'back');
        tween(s, 'white', 0, 420, 'lin', 120);
        setActorAction(i, 'enter', 800);
        ringFx(c, glow, 0.2, 2.6, 800);
        groundRing(i, glow, 3.4, 900);
        burst(c, 'Steel', 18, 2.8, 1.2);
        if (typeof buzz === 'function') buzz([30, 60, 30, 60, 80]);
      });
      camHome(600, LOCK + 300);
      scheduleAt(LOCK + 900, () => battleStageFocus('wide'));
      return { dur: LOCK + 900, hit: 0 };
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
    case 'move':
      /* VFX-8: played from the data (battleAnims.json) by battle-anim-run.js */
      return battleAnimPlay(an, ev);
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
      if (an.fx === 'stones') burst(T, 'Ground', 7, 1.6, kk);
      if (an.fx === 'brn')
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
        pyramidArc({ x: T.x + 3, y: 4, z: T.z + 2 }, T, 380, MONEY_ICON, C => {
          C.show = false;
          hitFx(an.si, { te: an.te, t: 'Retail' }, impactFx(T, 'coin'));
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
        sp = an.st === 'par' ? 'bolt' : an.st === 'slp' ? 'zz' : 'flame';
      setActorAction(an.si, 'dizzy', 800);
      for (let i = 0; i < 8; i++)
        scheduleAt(i * 60, () =>
          addParticle({
            x: T.x + (random() - 0.5) * 1.2,
            y: T.y + 0.9,
            z: T.z,
            vx: (random() - 0.5) * 0.8,
            vy: an.st === 'par' ? -1.6 : 1.4,
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
      /* RL-14b: a boss's phase without a shield (bosses.json) lights none */
      if (s && an.shield !== false) s.shield = 1;
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
    /* phase 17: a robot part breaks: sparks fly off it and it shudders */
    case 'break': {
      const T = actorCenter(an.si);
      setActorAction(an.si, 'hurt', 600);
      for (let i = 0; i < 16; i++) {
        const a = random() * 6.283;
        addParticle({
          x: T.x + (an.part === 'armL' ? -0.3 : an.part === 'armR' ? 0.3 : 0),
          y: an.part === 'legs' ? 0.25 : T.y,
          z: T.z,
          vx: Math.cos(a) * 2.2,
          vy: 1.2 + random() * 2.4,
          vz: Math.sin(a) * 1.2,
          ay: -6,
          life: 520 + random() * 300,
          spr: 'spark',
          k: 0.8,
          glow: 1,
        });
      }
      /* RL-14: the broken part drops off: its picture falls from the bot, tumbles and bounces on the ground as it
         fades (the rig keeps the limb faint) */
      /* SP-5: a Billie's broken Augment drops off the same way (its part from the look code) */
      const S = battleStage.s[an.si],
        ids = S && robotIdsFromSp(S.sp),
        aug = S && !ids ? graftLookSplit(S.graft).aug : null,
        P = ids ? robotPartDef(ids[an.part]) : aug ? robotPartDef(aug[an.part === 'legs' ? 'back' : 'front']) : null,
        /* RL-14b: a part with no picture of its own (the Voltron's) drops its placeholder */
        im = P ? robotPartPicture(P) : null;
      if (im && !reducedMotion) {
        const side = an.part === 'armL' ? -1 : an.part === 'armR' ? 1 : random() < 0.5 ? -1 : 1;
        addParticle({
          img: im,
          x: T.x + side * 0.3,
          y: an.part === 'legs' ? 0.3 : T.y,
          z: T.z,
          vx: side * 1.3,
          vy: 2.2,
          vz: 0.3,
          ay: -9,
          floor: true,
          life: 1500,
          rot: 0,
          vr: side * 6,
          k: 1,
        });
      }
      battleStageFlash('#FFE7A0', 0.35, 220);
      if (typeof buzz === 'function') buzz([20, 40, 60]);
      return { dur: 700, hit: 1 };
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
/* RF-2: the thrown pyramid's size and how it lies on the ground (its model: battle-3d.js pyramidItem; its recipe stands
   PYRAMID_LIFT up, tools/build-pyramids.py). PYRAMID_REST: its middle's height when it stands on the ground */
export const PYRAMID_LIFT = 0.02,
  PYRAMID_HIGH = 0.3,
  PYRAMID_SIDE = 0.34,
  PYRAMID_SCALE = 1.6,
  PYRAMID_REST = (PYRAMID_HIGH / 2) * PYRAMID_SCALE,
  PYRAMID_YAW = 32;
/* RF-2: the catch: the pyramid flies tumbling, the Billie goes into it, it rights itself as it drops and lands point up
   (res.edge, the critical catch: on its point), rocks on a base edge once a wobble (res.w), then seals (light climbs
   its edges to the tip, a glow, stars) or the Billie breaks out */
/* RF-2: the catch's sounds (sound.js): the throw, the landing, a wobble each way, the seal or the pop out */
const catchSound = k => typeof soundEffect === 'function' && soundEffect(k);
export function battleStageCatch(kind, res, spin, done) {
  battleStageFlush();
  const s1 = battleStage.s[1],
    o = actorCenter(1),
    w = actorWorldPoint(1),
    land = { x: w.x, y: PYRAMID_REST, z: w.z };
  camAt(1, 0.5, 0.18, 0.02, 320);
  battleStageFocus('foe');
  catchSound('throw');
  pyramidArc(
    throwOrigin(),
    { x: o.x, y: o.y, z: o.z },
    480,
    kind,
    C => {
      afterImpact(impactFx(C, 'catch'), () => battleStageFlash('#FFFFFF', 0.55, 280));
      ringFx(C, '#FFFFFF', 0.1, 1);
      tween(s1, 'white', 1, 120, 'lin');
      tween(s1, 'sc', 0, 220, 'in', 120);
      buzz(15);
      /* under the flash it turns to a small lean on one axis, and rights itself (or turns over) as it drops */
      C.ax = [1, 0, 0];
      C.tum = res.edge ? 0.5 : 0.7;
      scheduleAt(360, () => {
        s1.show = false;
        tween(C, 'y', land.y, 300, 'in');
        tween(C, 'tum', res.edge ? Math.PI : 0, 300, 'out');
        scheduleAt(300, () => {
          C.fly = false;
          C.tip = !!res.edge;
          catchSound('pyramidLand');
          battleStage.shk = 1.5;
          groundRing(1, '#FFFFFF', 1, 300);
          tween(C, 'y', land.y + 0.12, 110, 'out');
          tween(C, 'y', land.y, 120, 'in', 110);
        });
        let t = 760;
        for (let k = 0; k < res.w; k++) {
          scheduleAt(t, () => {
            tween(battleStage.css, 'z', 0.06 + k * 0.03, 200, 'out');
            tween(C, 'rot', -0.32, 150, 'out');
            tween(C, 'rot', 0.32, 240, 'io', 150);
            tween(C, 'rot', 0, 140, 'in', 390);
            catchSound('wobble');
            scheduleAt(390, () => catchSound('wobble'));
            buzz(8);
          });
          t += 820;
        }
        scheduleAt(t, () => {
          tween(battleStage.css, 'z', 0, 300, 'io');
          if (res.caught) {
            /* the seal: sparks climb the four edges to the point, then it glows and the stars fly */
            catchSound('seal');
            const hk = PYRAMID_SIDE * PYRAMID_SCALE * 0.7,
              top = { x: C.x, y: C.y + (PYRAMID_HIGH * PYRAMID_SCALE) / 2, z: C.z };
            for (let i = 0; i < 4 && !C.tip; i++) {
              const a = ((45 + 90 * i + PYRAMID_YAW) * Math.PI) / 180,
                b = { x: C.x + Math.cos(a) * hk, y: 0.03, z: C.z + Math.sin(a) * hk };
              addParticle({
                ...b,
                vx: (top.x - b.x) / 0.32,
                vy: (top.y - b.y) / 0.32,
                vz: (top.z - b.z) / 0.32,
                life: 320,
                spr: 'spark',
                glow: 1,
              });
            }
            scheduleAt(C.tip ? 0 : 320, () => {
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
            });
            scheduleAt(C.tip ? 900 : 1220, () => done(true));
          } else {
            battleStageFlash('#FFFFFF', 0.6, 300);
            ringFx(C, '#FFFFFF', 0.1, 1.1);
            catchSound('pop');
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
/* VFX-8: what the move runner (battle-anim-run.js) plays its steps with */
export const battleStageKit = {
  tween,
  flush: battleStageFlush,
  setActorAction,
  camTo,
  handheld,
  addParticle,
  ringFx,
  groundRing,
  hitFx,
  blinkActor,
  typeSprite,
  battleLunge,
  lungeKind,
  actorTeam,
  GLOWING_PARTICLES,
};
