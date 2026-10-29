'use strict';
/* ================= THE SKY TRAIN SETS DOWN AT THE HALT (assets track AS-2) =================
   A run's take-off (run.js runTakeOffGo) ends on its landing, at its sky train halt (logic/halt.js): once the landing
   is in the walk view, behind the loading screen, the run's train (parked at the halt in the landing's own scene)
   hangs over the halt's track; when the loading screen lifts it comes straight down onto the rails and you step off,
   across the platform between the benches and down its steps to where the walk stands you (airship.js standByMast).
   These are the last two beats of the ride home at Skyline Station ("down" and "off", logic/train-path.js
   TRAIN_HOME), in the halt's frame: its platform is laid out as the station's (tools/build-halt.py). Filmed through
   the walk view's director hook (walkView.director), as train-ride.js films the station; the train is the scene's
   parked placement, moved each frame and put back after. A tap skips it; a battle, a room or another place ends it.
   Reduced motion, no halt or no train: no ride. haltArrival.on is the signal the checks wait on; the debug log gets
   one 'scene' line a ride (the train's key and the ms, never a name). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { runLoad } from './hooks.js';
import { clamp } from './util.js';
import {
  TRAIN_HOME,
  TRAIN_PLATFORM,
  trainBoardPath,
  trainEase,
  trainEye,
  trainFrame,
  trainHomeAt,
  trainPlace,
  trainWalkAt,
} from './logic/train-path.js';
import { haltOf, haltTear } from './logic/halt.js';
import { activeBattle, reducedMotion, saveData, uiState } from './game-state.js';
import { personWalkFrames } from './person-art.js';
import { walkData, walkView } from './walk-view.js';
import { walkRenderer } from './walk/walk-state.js';
import { standingHeightAt } from './walk/heights.js';
import { personItem } from './walk/frame-items.js';
/* eslint-disable no-func-assign */
expose({
  HALT_DOWN_AT: [() => HALT_DOWN_AT],
  HALT_RIDE_MS: [() => HALT_RIDE_MS],
  HALT_WAIT_MS: [() => HALT_WAIT_MS],
  haltArrival: [() => haltArrival],
  haltArrive: [() => haltArrive, v => (haltArrive = v)],
  haltArriveCaption: [() => haltArriveCaption, v => (haltArriveCaption = v)],
  haltArriveEnd: [() => haltArriveEnd, v => (haltArriveEnd = v)],
  haltArriveFilm: [() => haltArriveFilm, v => (haltArriveFilm = v)],
  haltArriveFrame: [() => haltArriveFrame, v => (haltArriveFrame = v)],
  haltArriveGuard: [() => haltArriveGuard, v => (haltArriveGuard = v)],
  haltArriveSkip: [() => haltArriveSkip, v => (haltArriveSkip = v)],
  haltShot: [() => haltShot, v => (haltShot = v)],
  haltTakenOver: [() => haltTakenOver, v => (haltTakenOver = v)],
  haltWorld: [() => haltWorld, v => (haltWorld = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** where the way home's "down" beat starts (logic/train-path.js trainHomeAt), and the arrival's whole length (ms) */
const HALT_DOWN_AT = TRAIN_HOME.open + TRAIN_HOME.out + TRAIN_HOME.turn,
  HALT_RIDE_MS = TRAIN_HOME.down + TRAIN_HOME.off;
/** how long the arrival waits for the landing's walk view to come up (ms) */
const HALT_WAIT_MS = 30000;
/** the arrival under way: `on` from the take-off until it ends, W once it is filming, t0 when its clock started (the
 * loading screen gone; 0 until then) */
export const haltArrival = {
  on: false,
  key: '',
  t0: 0,
  t: 0,
  skipped: false,
  /** @type {number | null} a moment held still (ms into the arrival: the pictures tool) */
  hold: null,
  /** @type {any} */
  W: null,
  guard: 0,
  hide: new Set(),
  /** @type {any[]} */
  items: [],
  /** @type {any[]} */
  lights: [],
};

/** the landing's halt in the walk view, with the train parked at it: its frame (logic/train-path.js), level and the
 * point the train's way would start from; null while the view isn't the landing's */
function haltWorld() {
  const sc = walkView.sc;
  if (!walkView.ready || !walkView.cv || !sc || !sc.props) return null;
  const h = haltOf(sc, walkData().sc.props),
    train = h && sc.props.find((/** @type {any} */ p) => p.parked);
  if (!h || !train) return null;
  const y0 = standingHeightAt(h.x, h.z),
    F = trainFrame(h, y0);
  return { sc, h, F, y0, tear: haltTear(F), train };
}

/** a shot from the halt's metres (u along its front, w back from it, h over its level) at a point [x, height, z] */
function haltShot(/** @type {any} */ W, /** @type {number[]} */ eye, /** @type {number[]} */ tgt, fov = 54) {
  return { eye: trainEye(W.F, eye[0], eye[1], eye[2]), tgt, fov, hazeK: 1.4 };
}

/** something else took over: a battle, a sheet, a room, another tab, another place in the view, the run walking no
 * more (its payout, a battle, home) */
function haltTakenOver() {
  const W = haltArrival.W;
  return (
    (typeof activeBattle !== 'undefined' && !!activeBattle) ||
    !!walkView.battle ||
    !!uiState.modal ||
    uiState.tab !== 'walk' ||
    !!uiState.inside ||
    !saveData.run ||
    saveData.run.at.phase !== 'walk' ||
    !W ||
    walkView.sc !== W.sc
  );
}

/** what the walk view draws each frame of the arrival (walkView.director.frame) */
function haltArriveFrame() {
  const A = haltArrival,
    W = A.W;
  if (!A.on || !W) return null;
  if (haltTakenOver()) return (haltArriveEnd(true), null);
  const now = performance.now();
  /* the clock waits for the loading screen to lift (run-loading.js), a little after it starts to fade */
  if (!A.t0 && !(typeof runLoad !== 'undefined' && runLoad.on)) A.t0 = now + 250;
  const t = (A.t = A.hold != null ? A.hold : A.t0 ? Math.max(0, now - A.t0) : 0),
    B = trainHomeAt(W.F, W.tear, HALT_DOWN_AT + t),
    at = B.at;
  if (B.beat === 'gone') return (haltArriveEnd(false), null);
  const q = trainPlace(at, W.y0);
  Object.assign(W.train, { x: q.x, z: q.z, rot: q.rot, lift: q.lift, tilt: q.tilt, y: W.y0 });
  const items = A.items,
    lights = A.lights;
  items.length = 0;
  lights.length = 0;
  /** @type {any} */
  let look;
  if (B.beat === 'down') {
    /* the rockets' light under its tail, dimming as it settles */
    const k = 1 - 0.5 * trainEase.inOut(B.k);
    lights.push({ p: [at.x - at.dx * 6, at.z - at.dz * 6, at.h + 1.1], r: 5 + 3 * k, c: [2.4 * k, 1.3 * k, 0.45 * k] });
    look = haltShot(W, [-10, -12, 2.4], [at.x, at.h + 1.2, at.z]);
  } else {
    /* you step off, across the platform between the benches and down its steps to where the walk stands you */
    const k = clamp(B.k / 0.85, 0, 1),
      path = trainBoardPath(W.F, W.me).reverse(),
      fr = personWalkFrames('me'),
      set = fr.down,
      im = k < 1 ? (set.cyc ? set.cyc[Math.floor(t / 110) % 6] : set[1 + (Math.floor(t / 150) % 2)]) : set[0],
      [x, z, h] = trainWalkAt(path, k),
      ground = standingHeightAt(x, z);
    items.push(personItem('actor', im, x, z, walkData().sc, { y: h > 0.01 ? Math.max(ground, W.y0 + h) : ground }));
    look = haltShot(W, [-4, -4.6, 2], trainEye(W.F, TRAIN_PLATFORM.gap, 1.2, 1.3), 52);
  }
  return {
    look,
    items,
    lights,
    parts: [],
    hide: A.hide,
    focus: Math.hypot(look.tgt[0] - look.eye[0], look.tgt[1] - look.eye[1], look.tgt[2] - look.eye[2]),
    blur: 0.12,
    center: [look.tgt[0], look.tgt[2]],
    cut: 2.6,
    hazeK: look.hazeK || 1,
  };
}

/** the arrival starts filming: the train lifted to where its way down begins, the director set */
function haltArriveFilm(/** @type {any} */ W) {
  const A = haltArrival;
  A.W = W;
  W.me = walkView.pl ? [walkView.pl.x, walkView.pl.z] : null;
  W.train.moving = 1;
  if (typeof walkRenderer !== 'undefined') walkRenderer.itemGen = (walkRenderer.itemGen || 0) + 1;
  walkView.director = { frame: haltArriveFrame };
  document.body.classList.add('train-ride');
  haltArriveCaption(true);
  haltArriveGuard();
}

/** the walk view's frames come slowly on a slow phone and not at all while it isn't drawn: a timer ends the arrival
 * once its time is up all the same (not while the pictures tool holds a moment) */
function haltArriveGuard() {
  const A = haltArrival;
  clearTimeout(A.guard);
  A.guard = setTimeout(function check() {
    if (!A.on || !A.W) return;
    const now = performance.now();
    if (haltTakenOver()) return haltArriveEnd(true);
    if (A.hold != null || !A.t0 || now - A.t0 < HALT_RIDE_MS + 1000) return void (A.guard = setTimeout(check, 500));
    haltArriveEnd(false);
  }, 500);
}

/** the arrival ends (played out, or skipped: skip true): the train still at the platform, its log line */
function haltArriveEnd(/** @type {boolean} */ skip) {
  const A = haltArrival;
  if (!A.on) return;
  clearTimeout(A.guard);
  const W = A.W;
  A.on = false;
  A.skipped = !!skip;
  if (walkView.director && walkView.director.frame === haltArriveFrame) walkView.director = null;
  haltArriveCaption(false);
  if (!W) return;
  if (typeof walkRenderer !== 'undefined') {
    walkRenderer.bt = null;
    walkRenderer.focus = null;
  }
  document.body.classList.remove('train-ride');
  const q = trainPlace(trainHomeAt(W.F, W.tear, Infinity).at, W.y0);
  Object.assign(W.train, { x: q.x, z: q.z, rot: q.rot, lift: 0, tilt: q.tilt });
  delete W.train.moving;
  delete W.train.y;
  if (typeof walkRenderer !== 'undefined') walkRenderer.itemGen = (walkRenderer.itemGen || 0) + 1;
  A.W = null;
  if (typeof debugLog !== 'undefined')
    debugLog.add(
      'scene',
      `train arrival ${A.key} ${A.t0 ? Math.round(performance.now() - A.t0) : 0} ms${skip ? ' (skipped)' : ''}`
    );
}

/** "Tap to skip" over the arrival @param {boolean} on */
function haltArriveCaption(on) {
  const old = document.getElementById('haltcap');
  if (old) old.remove();
  if (!on) return;
  const c = document.createElement('div');
  c.id = 'haltcap';
  c.className = 'train-cap glass';
  c.textContent = 'Tap to skip';
  document.body.appendChild(c);
}

/** the run's sky train sets down at the landing's halt (run.js runTakeOffGo, behind the landing's loading screen): it
 * waits for the landing's walk view (30 s at most), then films; nothing with reduced motion
 * @param {string} key the run's train (logic/halt.js haltTrainKey) */
export function haltArrive(key) {
  if (haltArrival.on) haltArriveEnd(true);
  if (reducedMotion) return;
  const t0 = performance.now(),
    A = haltArrival;
  Object.assign(A, { on: true, key, t0: 0, t: 0, W: null, skipped: false, hold: null });
  const go = () => {
    if (!A.on || A.W) return;
    const W = haltWorld();
    if (W) return void haltArriveFilm(W);
    if (saveData.run && performance.now() - t0 < HALT_WAIT_MS) return void setTimeout(go, 150);
    A.on = false;
  };
  go();
}
/** skip the arrival (a tap, the checks) */
export function haltArriveSkip() {
  if (haltArrival.on) haltArriveEnd(true);
}

/* a tap skips the arrival; once something else has taken over (a sheet, a battle) the arrival just ends and the tap
   goes where it was meant to (a tap on a sheet over the page always does) */
document.addEventListener(
  'click',
  ev => {
    if (!haltArrival.on || !haltArrival.W) return;
    const t = /** @type {any} */ (ev.target);
    if (haltTakenOver() || (t && t.closest && t.closest('#ov'))) return void haltArriveEnd(true);
    ev.stopPropagation();
    ev.preventDefault();
    haltArriveSkip();
  },
  true
);
