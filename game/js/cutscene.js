'use strict';
/* ================= THE OPENING CUTSCENE =================
   Starts with New game on the title screen. v47: first the fall (opening-fall.js): the surface, the crust, the inner sky.
   Then Sundown, filmed with the walk-scene engine (walk-view-gl.js walkView.director hook): you wake in the dust outside
   Professor Hazel's lab, seen through your own eyes, and she comes running. You can't remember your name, so you
   make yourself up in the dressing room; she tells you about billionaires and throws three coins that pop open into
   the starters. Pick one, and her other student Blake runs in, takes the one that beats yours and battles you on the
   spot (opening-fall.js battleTutor, story.js storyAfterRival).
   If the cutscene can't run or stops, the older step-by-step intro in ui.js runs instead. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import {
  fallPlay,
  landing,
  landingBurst,
  landingFrame,
  mapIdAt,
  openingFall,
  provide,
  render,
  startGame,
  typeBadgeHTML,
  updateNav,
} from './hooks.js';
import { $, clamp } from './util.js';
import {
  LOCATIONS,
  RULES,
  SPECIES,
  START_NODE,
  TRAINERS,
  TYPES,
  locationFullName,
  typeEffectiveness,
} from './game-data.js';
import { formatNumber, maxHp } from './logic/rules.js';
import { FAST_SKIPS, FAST_SKIP_MS, HAZEL, fillLine, hotTake, speedWatch } from './logic/hazel.js';
import { escapeHtml, reducedMotion, uiState } from './game-state.js';
import { userFps } from './frame-scheduler.js';
import { artLoad, makeCanvas } from './art.js';
import { LOOK_PRESETS, cleanLook, lookOf, personBattlePose, personWalkFrames } from './person-art.js';
import { dressingRoom, openDressingRoom, saveDressingLook } from './dressing-room.js';
import { drawRig, rigFrame, rigParts, rigPreload, rigTint } from './skeleton-rig.js';
import { buzz, particleSprite } from './battle-stage.js';
import {
  artImage,
  directionOf,
  imageReady,
  mapById,
  prepareMap,
  stopWalkView,
  walkData,
  walkView,
  worldToScreen,
} from './walk-view.js';
import { gpuState, webgl2Supported } from './engine/webgl.js';
import { walkRenderer } from './walk/walk-state.js';
import { standingHeightAt } from './walk/heights.js';
import { mountWalkView, personItem } from './walk-view-gl.js';
import { seamlessRoamView } from './seamless-world.js';
import { music, soundEffect } from './sound.js';
import { talkBox, talkHide, talkLine } from './talk.js';
/* eslint-disable no-func-assign */
expose({
  CUTSCENE_SPOTS: [() => CUTSCENE_SPOTS],
  blakeArrives: [() => blakeArrives, v => (blakeArrives = v)],
  blakeFirstBillie: [() => blakeFirstBillie, v => (blakeFirstBillie = v)],
  chooseStarter: [() => chooseStarter, v => (chooseStarter = v)],
  cutscene: [() => cutscene],
  cutsceneAbort: [() => cutsceneAbort, v => (cutsceneAbort = v)],
  cutsceneAct: [() => cutsceneAct, v => (cutsceneAct = v)],
  cutsceneActor: [() => cutsceneActor, v => (cutsceneActor = v)],
  cutsceneBlink: [() => cutsceneBlink, v => (cutsceneBlink = v)],
  cutsceneCameraNow: [() => cutsceneCameraNow, v => (cutsceneCameraNow = v)],
  cutsceneCaption: [() => cutsceneCaption, v => (cutsceneCaption = v)],
  cutsceneEase: [() => cutsceneEase],
  cutsceneEnd: [() => cutsceneEnd, v => (cutsceneEnd = v)],
  cutsceneFlush: [() => cutsceneFlush, v => (cutsceneFlush = v)],
  cutsceneFrame: [() => cutsceneFrame, v => (cutsceneFrame = v)],
  cutsceneHTML: [() => cutsceneHTML, v => (cutsceneHTML = v)],
  cutsceneHideDialogue: [() => cutsceneHideDialogue, v => (cutsceneHideDialogue = v)],
  cutsceneMapId: [() => cutsceneMapId, v => (cutsceneMapId = v)],
  cutsceneNow: [() => cutsceneNow],
  cutscenePersonItem: [() => cutscenePersonItem, v => (cutscenePersonItem = v)],
  cutscenePortraitTick: [() => cutscenePortraitTick, v => (cutscenePortraitTick = v)],
  cutsceneSay: [() => cutsceneSay, v => (cutsceneSay = v)],
  cutsceneScript: [() => cutsceneScript, v => (cutsceneScript = v)],
  cutsceneShot: [() => cutsceneShot, v => (cutsceneShot = v)],
  cutsceneSparkle: [() => cutsceneSparkle, v => (cutsceneSparkle = v)],
  cutsceneStart: [() => cutsceneStart, v => setCutsceneStart(v)],
  cutsceneStartName: [() => cutsceneStartName],
  cutsceneStarterItem: [() => cutsceneStarterItem, v => (cutsceneStarterItem = v)],
  cutsceneTap: [() => cutsceneTap, v => (cutsceneTap = v)],
  cutsceneTeardown: [() => cutsceneTeardown, v => (cutsceneTeardown = v)],
  cutsceneWait: [() => cutsceneWait, v => (cutsceneWait = v)],
  cutsceneWalk: [() => cutsceneWalk, v => (cutsceneWalk = v)],
  cutsceneWanted: [() => cutsceneWanted, v => (cutsceneWanted = v)],
  fightLog: [() => fightLog, v => (fightLog = v)],
  fightPlate: [() => fightPlate, v => (fightPlate = v)],
  hazelFight: [() => hazelFight, v => (hazelFight = v)],
  hazelHotTake: [() => hazelHotTake, v => (hazelHotTake = v)],
  placeCutsceneSpots: [() => placeCutsceneSpots, v => (placeCutsceneSpots = v)],
  skipCutscene: [() => skipCutscene, v => (skipCutscene = v)],
  starterPickerFocus: [() => starterPickerFocus, v => (starterPickerFocus = v)],
  starterPickerHTML: [() => starterPickerHTML, v => (starterPickerHTML = v)],
  starterPickerSelect: [() => starterPickerSelect, v => (starterPickerSelect = v)],
});
/* eslint-enable no-func-assign */
export function setCutsceneStart(v) {
  cutsceneStart = v; // eslint-disable-line no-func-assign
  provide({ cutsceneStart });
}
/* to-module: end */
export const cutscene = {
  on: false,
  run: 0,
  skip: false,
  waits: [],
  cam: null,
  actors: {},
  stars: [],
  coins: [],
  fx: [],
  lights: [],
  items: [],
  parts: [],
  hide: null,
  sel: 0,
  choosing: false,
  say: null,
  por: { who: null, expr: null, t: 0 },
  flashes: [],
  center: [10.1, 12.3],
  ui: null,
};
provide({ cutscene }); /* to-module */
const CUTSCENE_SPOTS = {
  door: [7.4, 15.4],
  hazel: [9.3, 13.25],
  me: [11.05, 12.95],
  meFrom: [14.6, 12.4],
  stars: [
    [8.8, 11.55],
    [10.15, 11.2],
    [11.5, 11.55],
  ],
  blake: [12.55, 12.7],
  blakeFrom: [16.4, 12.1],
};
export const cutsceneNow = () => performance.now();
/* v46: where the opening scene is filmed: in front of the lab's door, wherever the lab stands in Sundown */
function placeCutsceneSpots(sc) {
  let o = [0, 0];
  cutscene.dy = 0;
  const C0 = walkData().sc,
    L = ((sc && sc.props) || []).find(p => p.act === 'lab');
  if (L) {
    const M = C0.props[L.k] || {},
      dx = (((M.door && M.door.x) || 0) / (C0.ppu || 34)) * (L.s || 1) * (L.f ? -1 : 1);
    o = [L.x + dx - CUTSCENE_SPOTS.door[0], L.z - CUTSCENE_SPOTS.door[1]];
    /* alpha 0.4: the shots were framed for a lab on ground half a metre up (Marigold Town's); they rise and fall with the ground at the door */
    if (typeof standingHeightAt === 'function') cutscene.dy = standingHeightAt(L.x + dx, L.z - 0.6) - 0.5;
  }
  cutscene.o = o;
  const sh = p => [p[0] + o[0], p[1] + o[1]];
  cutscene.A = {
    door: sh(CUTSCENE_SPOTS.door),
    hazel: sh(CUTSCENE_SPOTS.hazel),
    me: sh(CUTSCENE_SPOTS.me),
    meFrom: sh(CUTSCENE_SPOTS.meFrom),
    stars: CUTSCENE_SPOTS.stars.map(sh),
    blake: sh(CUTSCENE_SPOTS.blake),
    blakeFrom: sh(CUTSCENE_SPOTS.blakeFrom),
  };
  cutscene.center = sh([10.1, 12.3]);
  return o;
}
const cutsceneEase = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
/* v47b: the opening (and the title behind it) is filmed in the same view of Sundown the game then walks in: the town
   with the first stretch of each road. So nothing is built again between the title, the opening, Blake's battle
   and your first steps (it was a pause of most of a second as the battle began) */
export function cutsceneMapId() {
  const id = mapIdAt(START_NODE);
  try {
    const v = typeof seamlessRoamView === 'function' ? seamlessRoamView(START_NODE, null) : null;
    if (v && v.id && mapById(v.id)) return v.id;
  } catch (e) {
    console.error(e);
  }
  return id;
}
export function cutsceneWanted() {
  return (
    typeof webgl2Supported === 'function' &&
    !gpuState.fail &&
    webgl2Supported() &&
    typeof mapIdAt === 'function' &&
    !!mapById(mapIdAt(START_NODE))
  );
}
/* alpha 0.4: the start's name, for the opening's caption (Copperleaf Town) */
export const cutsceneStartName = () =>
  typeof locationFullName === 'function' && LOCATIONS[START_NODE]
    ? locationFullName(LOCATIONS[START_NODE])
    : 'the Hollow Earth';

/* ---------- timing helpers: everything resolves at once while skipping ---------- */
export function cutsceneWait(ms) {
  if (cutscene.skip || !cutscene.on) return Promise.resolve();
  return new Promise(r => {
    const id = setTimeout(done, ms);
    function done() {
      clearTimeout(id);
      cutscene.waits = cutscene.waits.filter(f => f !== done);
      r();
    }
    cutscene.waits.push(done);
  });
}
export function cutsceneFlush() {
  const w = cutscene.waits.slice();
  cutscene.waits = [];
  w.forEach(f => f());
  if (talkBox.cur && cutscene.on) talkBox.cur.done();
}
function skipCutscene() {
  if (!cutscene.on || cutscene.choosing || cutscene.dressing) return;
  cutscene.skip = true;
  cutsceneFlush();
}
/* ---------- the camera: eye, target, field of view and a width that must stay in frame (phones) ---------- */
function cutsceneCameraNow() {
  const c = cutscene.cam;
  if (!c) return null;
  const k = c.dur && !cutscene.skip && !reducedMotion ? cutsceneEase(clamp((cutsceneNow() - c.t0) / c.dur, 0, 1)) : 1,
    L = (a, b) => a.map((v, i) => v + (b[i] - v) * k);
  return {
    eye: L(c.a.eye, c.b.eye),
    tgt: L(c.a.tgt, c.b.tgt),
    fov: c.a.fov + (c.b.fov - c.a.fov) * k,
    w: (c.a.w || 0) + ((c.b.w || 0) - (c.a.w || 0)) * k,
  };
}
export function cutsceneShot(K, ms = 0) {
  K = Object.assign({ fov: 40, w: 0 }, K);
  /* v46: the shots were framed for the lab's door at CUTSCENE_SPOTS.door; they move with the lab (placeCutsceneSpots) */ if (
    !K.abs &&
    cutscene.o
  ) {
    const o = cutscene.o,
      dy = cutscene.dy || 0;
    K.eye = [K.eye[0] + o[0], K.eye[1] + dy, K.eye[2] + o[1]];
    K.tgt = [K.tgt[0] + o[0], K.tgt[1] + dy, K.tgt[2] + o[1]];
  }
  const a = cutsceneCameraNow() || K;
  cutscene.cam = { a, b: K, t0: cutsceneNow(), dur: ms };
  return cutsceneWait(ms);
}
/* ---------- actors ---------- */
export function cutsceneActor(id, who, at, dir) {
  cutscene.actors[id] = { id, who, x: at[0], z: at[1], dir: dir || 'down', walk: null, act: null, actT: 0 };
  return cutscene.actors[id];
}
export function cutsceneWalk(id, to, ms) {
  const a = cutscene.actors[id];
  a.walk = { x0: a.x, z0: a.z, x1: to[0], z1: to[1], t0: cutsceneNow(), dur: ms };
  a.dir = directionOf(to[0] - a.x, to[1] - a.z);
  return cutsceneWait(ms);
}
function cutsceneAct(id, act, ms) {
  const a = cutscene.actors[id];
  a.act = act;
  a.actT = cutsceneNow();
  return cutsceneWait(ms || 0).then(() => {
    if (ms) a.act = null;
  });
}
function cutscenePersonItem(a, t, C0) {
  let im;
  const now = cutsceneNow();
  if (a.walk) {
    const k = cutscene.skip || reducedMotion ? 1 : clamp((now - a.walk.t0) / a.walk.dur, 0, 1);
    a.x = a.walk.x0 + (a.walk.x1 - a.walk.x0) * k;
    a.z = a.walk.z0 + (a.walk.z1 - a.walk.z0) * k;
    if (k >= 1) a.walk = null;
  }
  if (a.walk) {
    const set = personWalkFrames(a.who)[a.dir] || personWalkFrames(a.who).down;
    im = set.cyc ? set.cyc[Math.floor(t / 110) % 6] : set[1 + (Math.floor(t / 150) % 2)];
  } else if (a.act === 'throw') im = personBattlePose(a.who, 'front', 'throw', clamp((now - a.actT) / 700, 0, 1));
  else if (a.act === 'cheer' || a.act === 'react') im = personBattlePose(a.who, 'front', a.act, 0, now - a.actT);
  else im = (personWalkFrames(a.who)[a.dir] || personWalkFrames(a.who).down)[0];
  return personItem('actor', im, a.x, a.z, C0, {});
}
/* the starter billionaires, drawn with their rigs every frame */
function cutsceneStarterItem(s, t) {
  const R = rigParts(s.sp, false, 1);
  if (!R) return null;
  if (!s.buf) s.buf = makeCanvas(R.BW, R.BH);
  const b = s.buf;
  if (b.width !== R.BW || b.height !== R.BH) {
    b.width = R.BW;
    b.height = R.BH;
  }
  const x = b.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, b.width, b.height);
  const tau = cutsceneNow() - s.actT,
    ak = s.act && tau < 1200 ? s.act : null;
  drawRig(x, R, rigFrame(R, ak, tau, Math.floor(t / 16) * 16, s.seed), 'front');
  if (s.white > 0) rigTint(x, b.width, b.height, '#FFFFFF', s.white);
  b.__v = (b.__v || 0) + 1;
  const G = R.geo,
    pop = s.pop >= 1 ? 1 : s.pop <= 0 ? 0 : 1 + Math.sin(s.pop * Math.PI) * 0.25 - (1 - s.pop) * 0.9,
    mpp = (0.88 / (G.base - G.top)) * Math.max(0.01, pop),
    y = standingHeightAt(s.x, s.z) + (s.hop || 0);
  return {
    k: 'rig',
    im: b,
    x: s.x,
    z: s.z,
    y,
    mpp,
    ox: -G.cx,
    oy: -G.base,
    w: R.BW,
    h: R.BH,
    flip: s.flip,
    shear: 0,
    sh: pop > 0.3 ? Math.max(0.25, G.hw * mpp) : 0,
    aoR: Math.max(0.25, G.hw * mpp * 0.9),
    fade: clamp(s.a, 0, 1),
    person: 1,
  };
}
/* ---------- what the engine draws: walkView.director.frame ---------- */
export function cutsceneFrame() {
  if (!cutscene.on) return null;
  const t = walkView.t,
    C0 = walkData().sc,
    items = cutscene.items,
    parts = cutscene.parts,
    lights = cutscene.lights,
    now = cutsceneNow();
  items.length = 0;
  parts.length = 0;
  lights.length = 0;
  for (const a of Object.values(cutscene.actors)) if (!a.hidden) items.push(cutscenePersonItem(a, t, C0));
  const drawn = cutscene.foe ? [...cutscene.stars, cutscene.foe] : cutscene.stars;
  drawn.forEach((s, i) => {
    if (s.popT) {
      s.pop = cutscene.skip ? 1 : clamp((now - s.popT) / 420, 0, 1);
      s.white = Math.max(0, 1 - (now - s.popT) / 300);
    }
    if (s.leave) {
      const k = clamp((now - s.leave) / 500, 0, 1);
      s.a = 1 - k;
      s.hop = Math.sin(k * Math.PI) * 0.4;
    }
    if (s.pop > 0 && s.a > 0) {
      const it = cutsceneStarterItem(s, t);
      if (it) items.push(it);
    }
    if (cutscene.choosing && s !== cutscene.foe && i === cutscene.sel)
      lights.push({ p: [s.x, 0.35 + standingHeightAt(s.x, s.z), s.z - 0.2], r: 1.7, c: [0.55, 0.48, 0.3] });
  });
  const coin = artImage('coins/penny_32.png');
  for (const c of cutscene.coins) {
    const k = cutscene.skip ? 1 : clamp((now - c.t0) / c.dur, 0, 1);
    if (k >= 1) {
      if (!c.landed) {
        c.landed = 1;
        c.onLand();
      }
      continue;
    }
    const x = c.a[0] + (c.b[0] - c.a[0]) * k,
      z = c.a[2] + (c.b[2] - c.a[2]) * k,
      y = c.a[1] + (c.b[1] - c.a[1]) * k + Math.sin(k * Math.PI) * 1.25,
      sp = Math.abs(Math.cos(k * 14));
    if (imageReady(coin)) parts.push({ im: coin, x, y, z, w: 0.24 * Math.max(0.15, sp), h: 0.24, a: 1, glow: false });
    lights.push({ p: [x, y, z], r: 1.1, c: [0.5, 0.4, 0.12] });
  }
  const spark = typeof particleSprite === 'function' ? particleSprite('sparkle') : null;
  cutscene.fx = cutscene.fx.filter(f => now - f.t0 < f.life);
  for (const f of cutscene.fx) {
    const k = (now - f.t0) / f.life;
    if (spark && spark.width > 1)
      parts.push({
        im: spark,
        x: f.x + f.vx * k,
        y: f.y + f.vy * k - 0.5 * k * k,
        z: f.z + f.vz * k,
        w: 0.18 * (1 - k * 0.5),
        h: 0.18 * (1 - k * 0.5),
        a: 1 - k,
        glow: true,
      });
  }
  cutscene.flashes = cutscene.flashes.filter(f => now - f.t0 < 500);
  for (const f of cutscene.flashes) {
    const k = 1 - (now - f.t0) / 500;
    lights.push({ p: f.p, r: 2.6, c: [1.4 * k, 1.2 * k, 0.7 * k] });
  }
  if (typeof landingFrame === 'function') landingFrame(now, parts);
  const K = cutsceneCameraNow() || { eye: [17, 14, -6], tgt: [17, 0, 12], fov: 42, w: 0 },
    sway = reducedMotion ? 0 : 1,
    look = {
      eye: [K.eye[0] + Math.sin(now / 2300) * 0.04 * sway, K.eye[1] + Math.sin(now / 1700) * 0.025 * sway, K.eye[2]],
      tgt: K.tgt,
      fov: K.fov,
      w: K.w,
    };
  const fd = Math.hypot(K.tgt[0] - K.eye[0], K.tgt[1] - K.eye[1], K.tgt[2] - K.eye[2]);
  cutscenePortraitTick(now);
  return {
    look,
    items,
    lights,
    parts,
    hide: cutscene.hide,
    focus: fd,
    blur: fd < 6 ? 0.45 : 0.2,
    center: [K.tgt[0], K.tgt[2]],
    cut: 2.6,
  };
}
function cutsceneSparkle(p, n = 10) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random();
    cutscene.fx.push({
      x: p[0],
      y: p[1],
      z: p[2],
      vx: Math.cos(a) * 0.7,
      vy: 0.6 + Math.random() * 0.6,
      vz: Math.sin(a) * 0.4,
      t0: cutsceneNow(),
      life: 500 + Math.random() * 300,
    });
  }
}

/* ---------- the overlay: letterbox, caption, dialogue, starter picker ---------- */
function cutsceneHTML() {
  return `<div class="cs-bars" aria-hidden="true"><i></i><i></i></div>
 <div class="cs-cap" id="csCap" aria-live="polite"><small></small><b></b></div>
 <button class="cs-skip pb small quiet" data-a="cs-skip">Skip ›</button>
 <div class="cs-pick px" id="csPick" hidden></div>
 <div class="cs-fight" id="csFight" hidden></div>
 <div class="cs-bubble" id="csBubble" role="status" hidden></div>
 <div class="cs-fade" id="csFade"></div>`;
}
export function cutsceneCaption(sub, title, ms = 3200) {
  const c = $('#csCap');
  if (!c || cutscene.skip) return;
  c.querySelector('small').textContent = sub;
  c.querySelector('b').textContent = title;
  c.classList.add('on');
  setTimeout(() => c.classList.remove('on'), ms);
}
/* one line of dialogue in the shared dialogue box (talk.js) */
export function cutsceneSay(who, text, expr) {
  if (cutscene.skip || !cutscene.on) return Promise.resolve();
  const pr = talkLine(who, text, expr, { cs: true });
  cutscene.say = talkBox.cur;
  cutscene.sayT = performance.now();
  return pr.then(() => {
    if (cutscene.say && !cutscene.say.typing) cutscene.say = null;
    /* phase 06-2b: skipped several lines fast? Hazel says something about it, once */
    const q = cutscene.quip;
    cutscene.quip = null;
    if (q && !cutscene.skip && cutscene.on) return cutsceneSay('gini', q, 'surprised');
  });
}
export function cutsceneHideDialogue() {
  talkHide();
  cutscene.say = null;
}
/* v47: waking up: the picture starts blurred and bright and sharpens; the letterbox closes like eyelids to blink */
function cutsceneBlink() {
  if (cutscene.skip || reducedMotion || !cutscene.on) return Promise.resolve();
  document.body.classList.add('cs-blink');
  return cutsceneWait(170).then(() => {
    document.body.classList.remove('cs-blink');
    return cutsceneWait(240);
  });
}
function cutscenePortraitTick() {}
function cutsceneTap(ev) {
  if (!cutscene.on) return;
  if (ev && ev.target.closest && ev.target.closest('button,input,.cs-pick,.cs-fight')) return;
  if (talkBox.cur) {
    /* phase 06-2b: a tap that cuts a line short counts towards Hazel's "too fast" comment */
    if (talkBox.cur.typing && cutscene.skipWatch && !cutscene.quip)
      cutscene.quip = cutscene.skipWatch.record(performance.now() - (cutscene.sayT || 0));
    talkBox.cur.tap();
  }
}

/* ---------- the starter picker ---------- */
/* phase 06-2: the pick card on the new look: arrows either side of the name, dots for where you are, the blurb in the
   reading font, what it beats and what beats it as type pills, one gold button (css/units.css "starter pick") */
function starterPickerHTML() {
  const pk = cutscene.pickList,
    l = pk[cutscene.sel],
    s = SPECIES[l + '0'],
    t = s.types[0],
    st = TYPES.filter(x => typeEffectiveness(t, [x]) > 1),
    wk = TYPES.filter(x => typeEffectiveness(x, [t]) > 1),
    pills = L => (L.length ? L.map(typeBadgeHTML).join('') : '<span class="pk-none">nothing in particular</span>');
  return `<div class="pk-top"><button class="pk-arrow" data-a="cs-prev" aria-label="Previous starter">‹</button><div class="pk-name"><b>${escapeHtml(s.name)}</b><span class="pk-types">${typeBadgeHTML(t)}</span></div><button class="pk-arrow" data-a="cs-next" aria-label="Next starter">›</button></div>
 <div class="pk-dots" role="img" aria-label="${cutscene.sel + 1} of ${pk.length}">${pk.map((_, i) => `<i class="${i === cutscene.sel ? 'on' : ''}"></i>`).join('')}</div>
 <p class="pk-blurb">${escapeHtml(s.blurb)}</p>
 <div class="pk-match"><div><span class="pk-k">Strong against</span><span class="pk-ts">${pills(st)}</span></div><div><span class="pk-k">Weak to</span><span class="pk-ts">${pills(wk)}</span></div></div>
 <p class="pk-note">${escapeHtml(HAZEL.pickNote)}</p>
 ${cutscene.confirm ? `<div class="pk-acts"><button class="pb quiet" data-a="cs-no">Not yet</button><button class="pb gold" data-a="cs-yes">Yes, ${escapeHtml(s.name)}!</button></div>` : `<button class="pb gold wide pk-go" data-a="cs-choose">Choose ${escapeHtml(s.name)}</button>`}`;
}
function starterPickerFocus() {
  const s = cutscene.stars[cutscene.sel];
  if (!s) return;
  s.act = 'cheer';
  s.actT = cutsceneNow();
  cutsceneShot(
    {
      eye: [s.x * 0.6 + (10.15 + (cutscene.o || [0, 0])[0]) * 0.4 + 0.1, 1.35 + (cutscene.dy || 0), s.z - 3.6],
      tgt: [s.x, 0.55 + (cutscene.dy || 0), s.z + 0.2],
      fov: 36,
      w: 2.6,
      abs: 1,
    },
    650
  );
  const p = $('#csPick');
  if (p) p.innerHTML = starterPickerHTML();
}
function chooseStarter() {
  return new Promise(res => {
    cutscene.choosing = true;
    cutscene.confirm = false;
    cutscene.pickRes = res;
    const p = $('#csPick');
    p.hidden = false;
    document.body.classList.add('cs-choosing');
    starterPickerFocus();
    if (cutscene.test)
      setTimeout(() => {
        starterPickerSelect(1);
        setTimeout(() => {
          if (cutscene.pickRes) {
            const r = cutscene.pickRes;
            cutscene.pickRes = null;
            r(cutscene.pickList[cutscene.sel]);
          }
        }, 900);
      }, 900);
  });
}
function starterPickerSelect(d) {
  if (!cutscene.choosing) return;
  cutscene.sel = (cutscene.sel + d + cutscene.pickList.length) % cutscene.pickList.length;
  cutscene.confirm = false;
  starterPickerFocus();
}

/* ---------- the script ---------- */
/* opts.quick (phase 16 test boot, js/test-boot.js): no fall, and the dressing room keeps a random look on its own,
   so the game opens on Hazel's scene and goes on to the coins and the starter pick */
export async function cutsceneStart(opts) {
  if (cutscene.on) return;
  const id = cutsceneMapId();
  cutscene.on = true;
  cutscene.quick = !!(opts && opts.quick);
  cutscene.run++;
  const run = cutscene.run;
  cutscene.skip = false;
  cutscene.actors = {};
  cutscene.stars = [];
  cutscene.coins = [];
  cutscene.fx = [];
  cutscene.flashes = [];
  cutscene.cam = null;
  cutscene.sel = 1;
  cutscene.choosing = false;
  cutscene.hide = null;
  cutscene.rival = false;
  /* phase 06-2b: Blake's first Billie (Hazel's fight), how often each starter's hot take was asked, the "too fast"
     watch for skipped lines and a comment waiting to be said */
  cutscene.foe = null;
  cutscene.takes = {};
  cutscene.skipWatch = speedWatch(FAST_SKIP_MS, FAST_SKIPS, HAZEL.tooFastSkips);
  cutscene.quip = null;
  if (typeof landing !== 'undefined') landing.bits = [];
  cutscene.pickList = RULES.start.starters.filter(l => SPECIES[l + '0']);
  let el = $('#cs');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cs';
    el.className = 'cs';
    document.body.appendChild(el);
  }
  el.innerHTML = cutsceneHTML();
  el.hidden = false;
  document.body.classList.add('in-cs');
  $('#app').innerHTML = '';
  updateNav(false);
  const pre = Promise.all([
    rigPreload(cutscene.pickList.map(l => [l + '0', false, 1])),
    artLoad(['coins/penny_32.png']),
    prepareMap(id),
  ]).catch(() => {});
  /* v47: the fall, from the surface down to Sundown (opening-fall.js); it ends on a white screen */
  if (typeof fallPlay === 'function' && !cutscene.test && !cutscene.quick) {
    try {
      await fallPlay(run);
    } catch (e) {
      console.error(e);
      const f = $('#csFade');
      if (f) f.classList.add('on');
    }
  } else {
    const f = $('#csFade');
    if (f) f.classList.add('on');
  }
  if (!cutscene.skip && !cutscene.test)
    document.body.classList.add('cs-dazed'); /* blurred already while the screen is white */
  if (!cutscene.on || cutscene.run !== run) return;
  await pre;
  if (!cutscene.on || cutscene.run !== run) return;
  let cv = $('#dio');
  if (!cv) {
    cv = document.createElement('canvas');
    cv.id = 'dio';
    document.body.prepend(cv);
  }
  cv.hidden = false;
  cv.setAttribute('aria-label', 'Opening scene in ' + cutsceneStartName());
  walkView.director = { frame: cutsceneFrame };
  await mountWalkView(cv, id, {
    state: () => ({ who: null, npcs: [], enc: [], mode: 'line' }),
    keys: () => false,
    active: () => false,
    onPick: () => {},
    cap: () => (document.hidden ? 1 : dressingRoom.on ? 4 : Math.min(60, userFps())),
  });
  if (!cutscene.on || cutscene.run !== run) return;
  if (!walkRenderer.on || !walkView.ready || !walkView.cv) {
    cutsceneAbort();
    return;
  }
  cv = walkView.cv;
  cv.classList.add('in');
  const sc = walkView.sc,
    C0 = walkData().sc,
    o = placeCutsceneSpots(sc);
  const eyes = [
    [12.6, 6.2],
    [10.5, 8.4],
    [10.4, 8.0],
    [10.15, 7.3],
  ].map(e => [e[0] + o[0], e[1] + o[1]]);
  /* out of the way while filming: what stands where it all happens, on Blake's way in, or right in front of a camera */
  const seg = (x, z, a, b) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      k = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz), 0, 1);
    return Math.hypot(x - a[0] - dx * k, z - a[1] - dz * k);
  };
  cutscene.hide = new Set(
    (sc.props || []).filter(p => {
      const M = C0.props[p.k];
      return (
        M &&
        !M.flat &&
        ((p.x > 7.9 + o[0] && p.x < 12.9 + o[0] && p.z > 9.6 + o[1] && p.z < 13.9 + o[1]) ||
          seg(p.x, p.z, cutscene.A.blakeFrom, cutscene.A.blake) < 1.1 ||
          (!M.box && eyes.some(e => Math.hypot(p.x - e[0], p.z - e[1]) < 2.3)))
      );
    })
  );
  if (typeof debugLog !== 'undefined') debugLog.add('scene', 'opening cutscene');
  if (typeof music === 'function') music('hazel');
  /* the town's ground is laid and drawn before the white fades */
  const f0 = walkRenderer.frames,
    t0 = performance.now();
  while (
    cutscene.on &&
    cutscene.run === run &&
    !(walkRenderer.gtex && walkRenderer.frames >= f0 + 3) &&
    performance.now() - t0 < 15000
  )
    await new Promise(r => setTimeout(r, 120));
  try {
    await cutsceneScript(run);
  } catch (e) {
    console.error(e);
    if (typeof debugLog !== 'undefined') debugLog.add('error', 'cutscene: ' + (e.message || e));
    if (cutscene.on && cutscene.run === run) cutsceneAbort();
  }
}
async function cutsceneScript(run) {
  const alive = () => cutscene.on && cutscene.run === run,
    A = cutscene.A || CUTSCENE_SPOTS,
    O = cutscene.o || [0, 0],
    M = A.me,
    gy = standingHeightAt(M[0], M[1]),
    body = document.body,
    fade = $('#csFade');
  const pov = (h, tgt, fov, ms) =>
    cutsceneShot({ eye: [M[0] + 0.06, gy + h, M[1] - 0.32], tgt, fov, w: 1.3, abs: 1 }, ms);
  /* 1. you wake in the dust outside the lab, the papers that fell with you still coming down */
  pov(0.4, [M[0] + 2.4, gy + 3.9, M[1] + 5.4], 58);
  if (typeof landingBurst === 'function') landingBurst(M[0], M[1]);
  if (cutscene.skip) body.classList.remove('cs-dazed');
  if (fade) fade.classList.remove('on');
  setTimeout(() => {
    if (alive()) cutsceneCaption('The Hollow Earth', cutsceneStartName(), 3400);
  }, 1400);
  await cutsceneWait(1700);
  await cutsceneBlink();
  await cutsceneWait(420);
  await cutsceneBlink();
  if (!alive()) return;
  body.classList.add('cs-waking');
  body.classList.remove('cs-dazed');
  const dy = standingHeightAt(A.door[0], A.door[1]);
  pov(0.62, [A.door[0], dy + 1.25, A.door[1]], 52, 3200);
  await cutsceneWait(2600);
  if (!alive()) return;
  /* 2. the Professor comes running */
  const hy = standingHeightAt(A.hazel[0], A.hazel[1]);
  cutsceneActor('gini', 'gini', A.door, 'down');
  pov(0.78, [A.hazel[0], hy + 1.08, A.hazel[1]], 58, 1900);
  await cutsceneWalk('gini', A.hazel, 1500);
  cutscene.actors.gini.dir = 'down';
  if (!alive()) return;
  await cutsceneSay('gini', 'Oh! Another one! Are you all right? That was quite a landing.', 'surprised');
  await cutsceneSay(
    'gini',
    'You came down through the crust. Things do, now and then. Mostly furniture. You’re the first this week who can talk.'
  );
  await cutsceneSay('gini', 'Can you tell me your name?');
  if (!alive()) return;
  cutsceneHideDialogue();
  await cutsceneWait(1300);
  await cutsceneSay('gini', 'No? Nothing at all?', 'surprised');
  await cutsceneSay(
    'gini',
    'Classic fall-related amnesia. Very common down here. It usually comes back, a bit at a time.'
  );
  await cutsceneSay('gini', 'Let’s start with what we can see. Sit up, let me get a good look at you.', 'happy');
  if (!alive()) return;
  body.classList.remove('cs-dazed', 'cs-blink');
  /* 3. make yourself up (skipping stops here) */
  cutscene.skip = false;
  cutsceneHideDialogue();
  cutscene.dressing = true;
  body.classList.add('cs-dress');
  await new Promise(r => {
    openDressingRoom({
      mode: 'intro',
      noBack: true,
      look: uiState.trainerDraft || LOOK_PRESETS[Math.floor(Math.random() * LOOK_PRESETS.length)],
      done: r,
    });
    if (cutscene.test || cutscene.quick)
      setTimeout(() => {
        if (dressingRoom.on) saveDressingLook();
      }, 1500);
  });
  cutscene.dressing = false;
  body.classList.remove('cs-dress', 'cs-waking');
  if (!alive()) return;
  uiState.avatarDraft = cleanLook(uiState.trainerDraft || LOOK_PRESETS[0]);
  uiState.trainerDraft = uiState.avatarDraft;
  /* 4. on your feet */
  cutsceneActor('me', 'me', M, 'side');
  cutscene.actors.gini.dir = 'sideR';
  cutsceneShot({ eye: [10.4, 1.75, 8.0], tgt: [10.2, 1.05, 12.9], fov: 40, w: 3.8 });
  cutsceneAct('me', 'react', 900);
  if (!alive()) return;
  const nm = lookOf('me').name || 'Trainer';
  await cutsceneSay('gini', `${nm}? It suits you. If it isn’t your name, it is now.`, 'happy');
  await cutsceneSay('gini', 'I’m Professor Hazel. I study Billies, the most common wildlife here in the Hollow Earth.');
  await cutsceneSay(
    'gini',
    'Clones of the richest people up top. A lab backed them up and filled the gaps with animals, then shipped the results down here. They went wild.'
  );
  await cutsceneSay(
    'gini',
    'They live in the long grass, in caves and canyons, even in the malls. Walk, and they come to you. Tax them with a coin, train a team, earn badges from the arena leaders.'
  );
  await cutsceneSay(
    'gini',
    'Nobody should walk the Hollow Earth alone. Luckily for you, I have three of them right here.',
    'happy'
  );
  if (!alive()) return;
  cutsceneHideDialogue();
  /* 4b. phase 06-2b: Blake barges in before you have a Billie, and Hazel fights him herself */
  const T0 = TRAINERS.blake0,
    who = (T0 && T0.who) || 'chad';
  if (T0) {
    await blakeArrives(who, A);
    if (!alive()) return;
    await hazelFight(who, A);
    if (!alive()) return;
    for (const [w, t] of HAZEL.afterFight(who)) {
      await cutsceneSay(w, t);
      if (!alive()) return;
    }
    cutsceneHideDialogue();
    cutscene.actors.rival.dir = 'side';
  }
  /* 5. three coins, three billionaires */
  cutscene.actors.gini.dir = 'down';
  cutscene.actors.me.dir = 'down';
  cutsceneShot({ eye: [10.15, 1.5, 7.3], tgt: [10.15, 0.7, 11.9], fov: 40, w: 4.4 }, 900);
  await cutsceneWait(500);
  cutsceneAct('gini', 'throw', 900);
  await cutsceneWait(380);
  if (typeof soundEffect === 'function') soundEffect('throw');
  cutscene.pickList.forEach((l, i) => {
    const p = A.stars[i],
      s = {
        sp: l + '0',
        x: p[0],
        z: p[1],
        pop: 0,
        a: 1,
        act: null,
        actT: 0,
        seed: i * 1.7 + 0.4,
        flip: i === 0 ? -1 : 1,
        white: 0,
      };
    cutscene.stars.push(s);
    cutscene.coins.push({
      a: [cutscene.actors.gini.x + 0.2, standingHeightAt(A.hazel[0], A.hazel[1]) + 1.35, cutscene.actors.gini.z - 0.1],
      b: [p[0], standingHeightAt(p[0], p[1]) + 0.1, p[1]],
      t0: cutsceneNow() + i * 140,
      dur: 650,
      onLand() {
        const y = standingHeightAt(p[0], p[1]) + 0.3;
        s.popT = cutsceneNow();
        if (typeof soundEffect === 'function') soundEffect('pop');
        s.act = 'enter';
        s.actT = cutsceneNow();
        cutscene.flashes.push({ p: [p[0], y + 0.2, p[1]], t0: cutsceneNow() });
        if (!cutscene.skip) cutsceneSparkle([p[0], y, p[1]], 12);
        if (typeof buzz === 'function') buzz(8);
      },
    });
  });
  await cutsceneWait(1300);
  cutscene.coins.forEach(c => {
    if (!c.landed) {
      c.landed = 1;
      c.onLand();
    }
  });
  cutscene.coins = [];
  if (!alive()) return;
  await cutsceneSay(
    'gini',
    'Three Billies, three types. Each one beats one of the others. Take a good look before you choose!'
  );
  cutsceneHideDialogue();
  cutscene.skip = false;
  /* 6. pick one */
  const l = await chooseStarter();
  if (!alive()) return;
  cutscene.choosing = false;
  document.body.classList.remove('cs-choosing');
  $('#csPick').hidden = true;
  const si = cutscene.pickList.indexOf(l),
    star = cutscene.stars[si],
    sp = SPECIES[l + '0'];
  star.act = 'cheer';
  star.actT = cutsceneNow();
  cutscene.stars.forEach((s, i) => {
    if (i !== si) s.leave = cutsceneNow() + i * 90;
  });
  cutsceneShot(
    {
      eye: [10.4 + O[0], 1.45 + (cutscene.dy || 0), 8.0 + O[1]],
      tgt: [(star.x + A.me[0]) / 2, 0.85 + (cutscene.dy || 0), 12.2 + O[1]],
      fov: 40,
      w: 3.6,
      abs: 1,
    },
    900
  );
  cutsceneAct('me', 'cheer', 1300);
  await cutsceneWait(900);
  await cutsceneSay('gini', `${sp.name}! ${nm} and ${sp.name}. I like the sound of that.`, 'happy');
  if (!alive()) return;
  /* 7. phase 06-2b: Blake (already here since Hazel's fight) takes the one that beats yours and wants a battle */
  if (!T0) {
    await cutsceneSay(
      'gini',
      'Now go and explore! The road teaches more than any book. Come back and see me any time.',
      'happy'
    );
    if (!alive()) return;
    cutsceneHideDialogue();
    if (fade) fade.classList.add('on');
    await new Promise(r => setTimeout(r, reducedMotion ? 50 : 700));
    if (!alive()) return;
    cutsceneEnd(l);
    return;
  }
  const by = standingHeightAt(A.blake[0], A.blake[1]);
  cutsceneShot(
    {
      eye: [(A.hazel[0] + A.blake[0]) / 2, by + 1.9, A.me[1] - 5.2],
      tgt: [(A.hazel[0] + A.blake[0]) / 2, by + 1, A.me[1]],
      fov: 40,
      w: 5.9,
      abs: 1,
    },
    1100
  );
  if (typeof music === 'function') music('rival');
  cutscene.actors.me.dir = 'sideR';
  cutscene.actors.gini.dir = 'sideR';
  const rv = RULES.start.rival && RULES.start.rival[l],
    vars = {
      foe: cutscene.foeName || 'mine',
      counter: (rv && SPECIES[rv] && SPECIES[rv].name) || 'the one that beats yours',
      yours: sp.name,
    };
  for (const [w, t] of HAZEL.blakeTakes(who)) {
    await cutsceneSay(w, fillLine(t, vars));
    if (!alive()) return;
  }
  cutsceneHideDialogue();
  cutscene.rival = true;
  cutsceneAct('rival', 'cheer', 800);
  await cutsceneWait(700);
  if (fade) {
    fade.style.background = '#0B0912';
    fade.classList.add('on');
  }
  await new Promise(r => setTimeout(r, reducedMotion ? 50 : 600));
  if (!alive()) return;
  cutsceneEnd(l);
}
/* ---------- phase 06-2b: Blake arrives early, and Hazel fights him herself ---------- */
/* Blake runs in from the side and stands by Hazel */
async function blakeArrives(who, A) {
  cutsceneActor('rival', who, A.blakeFrom, 'side');
  const by = standingHeightAt(A.blake[0], A.blake[1]);
  cutsceneShot(
    {
      eye: [(A.hazel[0] + A.blake[0]) / 2, by + 1.9, A.me[1] - 5.2],
      tgt: [(A.hazel[0] + A.blake[0]) / 2, by + 1, A.me[1]],
      fov: 40,
      w: 5.9,
      abs: 1,
    },
    1100
  );
  if (typeof music === 'function') music('rival');
  const L = HAZEL.blakeArrives(who),
    walk = cutsceneWalk('rival', A.blake, 1500);
  cutscene.actors.me.dir = 'sideR';
  cutscene.actors.gini.dir = 'sideR';
  await cutsceneSay(L[0][0], L[0][1]);
  await walk;
  if (cutscene.actors.rival) cutscene.actors.rival.dir = 'side';
  for (const [w, t] of L.slice(1)) {
    if (!cutscene.on) return;
    await cutsceneSay(w, t);
  }
  cutsceneHideDialogue();
}
/* Blake's first Billie: Gildlet (the slug line's first form) when the game has it, else any common first form */
function blakeFirstBillie() {
  if (SPECIES.trump0) return 'trump0';
  const starters = RULES.start.starters || [];
  return Object.keys(SPECIES).find(k => SPECIES[k].stage === 0 && !starters.includes(SPECIES[k].line)) || null;
}
/* the fight's log line under the plates: waits for a tap (or goes at once when the opening is being skipped) */
function fightLog(text) {
  const box = $('#csFight'),
    t = box && box.querySelector('.csf-t');
  if (!t || cutscene.skip || !cutscene.on) return Promise.resolve();
  t.textContent = text;
  t.classList.remove('m-enter');
  void t.offsetWidth;
  t.classList.add('m-enter');
  const t0 = performance.now();
  return new Promise(res => {
    const done = () => {
      box.removeEventListener('click', onTap);
      clearInterval(poll);
      res();
    };
    const onTap = () => {
      /* a tap right away counts as skipping fast, like a line cut short */
      if (cutscene.skipWatch && !cutscene.quip) cutscene.quip = cutscene.skipWatch.record(performance.now() - t0);
      done();
    };
    box.addEventListener('click', onTap);
    /* the opening being skipped (the Skip button, the checks) or ended lets the fight go on */
    const poll = setInterval(() => {
      if (cutscene.skip || !cutscene.on) done();
    }, 150);
    if (cutscene.test) setTimeout(done, 300);
  });
}
function fightPlate(cls, name, lvl, hp, max) {
  return `<div class="csf-plate ${cls}"><div class="csf-top"><b>${escapeHtml(name)}</b><span class="tnum">${escapeHtml(lvl)}</span></div><span class="csf-hp"><i style="width:${max ? (hp / max) * 100 : 100}%"></i></span><small class="tnum">${formatNumber(hp)}/${formatNumber(max)}</small></div>`;
}
async function hazelFight(who, A) {
  const id = blakeFirstBillie(),
    box = $('#csFight');
  if (!id || !box) return;
  const F = HAZEL.fight,
    name = SPECIES[id].name,
    vars = { foe: name };
  cutscene.foeName = name;
  let max = 19;
  try {
    max = maxHp({ sp: id, lvl: 4 }) || max;
  } catch (e) {}
  /* Blake throws a coin and his Billie pops out between them */
  const p = A.stars[1],
    foe = { sp: id, x: p[0], z: p[1], pop: 0, a: 1, act: null, actT: 0, seed: 3.1, flip: -1, white: 0 };
  cutscene.foe = foe;
  cutsceneShot({ eye: [10.15, 1.5, 7.3], tgt: [10.15, 0.7, 11.9], fov: 40, w: 4.4 }, 900);
  if (cutscene.actors.rival) cutsceneAct('rival', 'throw', 900);
  if (typeof soundEffect === 'function') soundEffect('throw');
  cutscene.coins.push({
    a: [cutscene.actors.rival.x - 0.2, standingHeightAt(A.blake[0], A.blake[1]) + 1.35, cutscene.actors.rival.z - 0.1],
    b: [p[0], standingHeightAt(p[0], p[1]) + 0.1, p[1]],
    t0: cutsceneNow(),
    dur: 650,
    onLand() {
      foe.popT = cutsceneNow();
      foe.act = 'enter';
      foe.actT = cutsceneNow();
      if (typeof soundEffect === 'function') soundEffect('pop');
      if (!cutscene.skip) cutsceneSparkle([p[0], standingHeightAt(p[0], p[1]) + 0.3, p[1]], 10);
    },
  });
  await cutsceneWait(900);
  cutscene.coins.forEach(c => {
    if (!c.landed) {
      c.landed = 1;
      c.onLand();
    }
  });
  cutscene.coins = [];
  if (!cutscene.on) return;
  /* the battle plates: Hazel (absurd) against Blake's Billie, a move line, the log */
  box.innerHTML = `<div class="csf-plates">${fightPlate('me', 'Prof. Hazel', 'Lv ???', 9999, 9999)}${fightPlate('foe', name, 'Lv 4', max, max)}</div><div class="csf-moves" hidden>${F.moves.map((m, i) => `<span class="${i === 0 ? 'on' : ''}">${escapeHtml(m)}</span>`).join('')}</div><button class="csf-log" type="button"><span class="csf-t"></span><small>Tap to go on</small></button>`;
  box.hidden = false;
  document.body.classList.add('cs-fighting');
  await fightLog(F.start);
  await fightLog(fillLine(F.blakeGo, vars));
  foe.act = 'attack';
  foe.actT = cutsceneNow();
  await fightLog(fillLine(F.tackle, vars));
  const mv = box.querySelector('.csf-moves');
  if (mv) mv.hidden = false;
  cutsceneAct('gini', 'throw', 700);
  await fightLog(F.hit);
  if (mv) mv.hidden = true;
  /* one hit: the plate drains to zero, the Billie flashes white and goes */
  const fill = box.querySelector('.csf-plate.foe .csf-hp i'),
    num = box.querySelector('.csf-plate.foe small');
  if (fill) fill.style.width = '0%';
  if (num) num.textContent = `0/${formatNumber(max)}`;
  foe.white = 1;
  if (typeof soundEffect === 'function') soundEffect('hit');
  if (typeof buzz === 'function') buzz(20);
  await fightLog(F.effective);
  foe.leave = cutsceneNow();
  await fightLog(fillLine(F.faint, vars));
  box.hidden = true;
  box.innerHTML = '';
  document.body.classList.remove('cs-fighting');
  cutscene.foe = null;
}
/* during the pick: tap Hazel for a hot take about the starter you're looking at, in a bubble over her head */
function hazelHotTake() {
  const g = cutscene.actors.gini,
    b = $('#csBubble');
  if (!g || !b || !walkView.C || !walkView.cv) return;
  const line = cutscene.pickList[cutscene.sel],
    n = cutscene.takes[line] || 0;
  cutscene.takes[line] = n + 1;
  b.textContent = hotTake(line, n);
  const q = worldToScreen(walkView.C, g.x, 2.1 + standingHeightAt(g.x, g.z), g.z),
    r = walkView.cv.getBoundingClientRect();
  b.hidden = false;
  if (q) {
    /* over her head, but kept fully on screen */
    const half = b.offsetWidth / 2 + 16;
    b.style.left = clamp(r.left + (q.x / walkView.cv.width) * r.width, half, innerWidth - half) + 'px';
    b.style.top = Math.max(b.offsetHeight + 70, r.top + (q.y / walkView.cv.height) * r.height) + 'px';
  }
  b.classList.remove('m-pop');
  void b.offsetWidth;
  b.classList.add('m-pop');
  cutsceneAct('gini', 'react', 700);
  clearTimeout(b._t);
  b._t = setTimeout(() => (b.hidden = true), 3600);
}
export function cutsceneTeardown() {
  talkHide();
  cutscene.on = false;
  cutscene.run++;
  cutscene.skip = false;
  cutsceneFlush();
  cutscene.choosing = false;
  cutscene.dressing = false;
  walkView.director = null;
  walkRenderer.bt = null;
  walkRenderer.camT = null;
  walkRenderer.focus = null;
  const el = $('#cs');
  if (el) {
    el.hidden = true;
    el.innerHTML = '';
  }
  if (typeof openingFall !== 'undefined') {
    cancelAnimationFrame(openingFall.raf);
    if (openingFall.cv) {
      openingFall.cv.remove();
      openingFall.cv = null;
    }
  }
  if (typeof landing !== 'undefined') landing.bits = [];
  cutscene.foe = null;
  document.body.classList.remove(
    'in-cs',
    'cs-choosing',
    'cs-dress',
    'cs-falling',
    'cs-dazed',
    'cs-waking',
    'cs-blink',
    'cs-fighting'
  );
  if (walkView.cv) stopWalkView();
}
function cutsceneEnd(l) {
  if (cutscene.test) {
    cutscene.test = false;
    cutsceneTeardown();
    const d = cutscene.testDone;
    cutscene.testDone = null;
    if (d) d();
    return;
  }
  const rival = cutscene.rival;
  cutsceneTeardown();
  startGame(l, { rival });
}
/* the opening couldn't run (no 3D view) or broke: phase 06-2, a Try again screen (ui.js renderIntro); the old
   step-by-step intro is gone */
function cutsceneAbort() {
  cutsceneTeardown();
  uiState.openingFailed = 'stopped';
  render();
}

document.addEventListener('click', ev => {
  if (!cutscene.on) return;
  const el = ev.target.closest('[data-a]');
  const a = el && el.dataset.a;
  if (!a) {
    if (ev.target.closest('#cs')) cutsceneTap(ev);
    return;
  }
  switch (a) {
    case 'cs-skip':
      skipCutscene();
      break;
    case 'cs-prev':
      starterPickerSelect(-1);
      break;
    case 'cs-next':
      starterPickerSelect(1);
      break;
    case 'cs-choose':
      cutscene.confirm = true;
      $('#csPick').innerHTML = starterPickerHTML();
      break;
    case 'cs-no':
      cutscene.confirm = false;
      $('#csPick').innerHTML = starterPickerHTML();
      break;
    case 'cs-yes':
      if (cutscene.pickRes) {
        const r = cutscene.pickRes;
        cutscene.pickRes = null;
        r(cutscene.pickList[cutscene.sel]);
      }
      break;
  }
});
document.addEventListener('keydown', ev => {
  if (!cutscene.on || cutscene.dressing) return;
  if (ev.key === 'Escape') {
    skipCutscene();
    return;
  }
  if (cutscene.choosing) {
    if (ev.key === 'ArrowLeft') starterPickerSelect(-1);
    else if (ev.key === 'ArrowRight') starterPickerSelect(1);
    return;
  }
});
/* tapping a billionaire in the scene picks it */
document.addEventListener('pointerup', ev => {
  if (
    !cutscene.on ||
    !cutscene.choosing ||
    !walkView.C ||
    !walkView.cv ||
    (ev.target !== walkView.cv && ev.target.id !== 'dioui' && !ev.target.classList.contains('cs'))
  )
    return;
  const r = walkView.cv.getBoundingClientRect(),
    sx = ((ev.clientX - r.left) / r.width) * walkView.cv.width,
    sy = ((ev.clientY - r.top) / r.height) * walkView.cv.height;
  let best = -1,
    bd = 1e9;
  /* phase 06-2b: Hazel, nearer than any starter, gives a hot take */
  const g = cutscene.actors.gini,
    hq = g && worldToScreen(walkView.C, g.x, 1.0 + standingHeightAt(g.x, g.z), g.z),
    hd = hq ? Math.hypot(hq.x - sx, hq.y - sy) : 1e9;
  cutscene.stars.forEach((s, i) => {
    const q = worldToScreen(walkView.C, s.x, 0.45, s.z);
    if (!q) return;
    const d = Math.hypot(q.x - sx, q.y - sy);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  if (hd < bd && hd < walkView.cv.height * 0.16) {
    hazelHotTake();
    return;
  }
  if (best >= 0 && bd < walkView.cv.height * 0.18 && best !== cutscene.sel) {
    cutscene.sel = best;
    cutscene.confirm = false;
    starterPickerFocus();
  }
});
