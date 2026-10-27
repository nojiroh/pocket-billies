'use strict';
/* ================= THE SKY TRAIN'S RIDE (hub track HB-8, cutscenes track A) =================
   A run leaves from Skyline Station on its region's sky train (regions.json themes.<id>.train, the Greenbelt
   Sunrunner when the run has no region): filmed from the platform side (the station faces out to sea, where the hub's
   camera looks in at it), the train glides in along the track, you board, it rises straight up on its engines over
   the canopy, turns its nose to the portal floating out over the sea and shoots into it, the camera chasing it in;
   then a white-out (the run's loading screen comes up behind it, as the carriage's inside: train-carriage.js). Coming
   home it bursts out of the portal, flies across to the station, turns along the track and sets down, gold-trimmed
   after a won run (and the portal gold), battered and smoking after a lost one, and you step off down the platform's
   steps. Its way: logic/train-path.js. Filmed in the hub's own walk view through its director hook (walkView.director:
   the camera, the people, the props hidden; cutscene/director.js does the same for the story), the train a placement
   moved each frame. A tap skips the ride (never the loading). Reduced motion: a short white fade, no ride. No hub
   walk view to film in (the debug menu elsewhere, a test page): no ride either. trainRide.on is the signal the checks
   wait on; the debug log gets one 'scene' line a ride (the train's key and the ms, never a name). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { mapIdAt, showPendingWindows } from './hooks.js';
import { clamp } from './util.js';
import { gameData } from './game-data.js';
import {
  TRAIN_DEPART,
  TRAIN_HOME,
  TRAIN_RIDE,
  trainAt,
  trainDepartAt,
  trainEye,
  trainFrame,
  trainHomeAt,
  trainHover,
  trainPlace,
} from './logic/train-path.js';
import { reducedMotion, uiState } from './game-state.js';
import { personWalkFrames } from './person-art.js';
import { mapById, walkData, walkView } from './walk-view.js';
import { walkRenderer } from './walk/walk-state.js';
import { personItem } from './walk/frame-items.js';
import { soundEffect } from './sound.js';
/* eslint-disable no-func-assign */
expose({
  DEPART: [() => DEPART],
  HOME: [() => HOME],
  TRAIN_FALLBACK: [() => TRAIN_FALLBACK],
  VEIL_MS: [() => VEIL_MS],
  chaseShot: [() => chaseShot, v => (chaseShot = v)],
  easeInOut: [() => easeInOut],
  engineLight: [() => engineLight, v => (engineLight = v)],
  placeTrain: [() => placeTrain, v => (placeTrain = v)],
  portalBack: [() => portalBack, v => (portalBack = v)],
  portalLook: [() => portalLook, v => (portalLook = v)],
  shotAt: [() => shotAt, v => (shotAt = v)],
  trainCoverOff: [() => trainCoverOff, v => (trainCoverOff = v)],
  trainName: [() => trainName, v => (trainName = v)],
  trainOfRun: [() => trainOfRun, v => (trainOfRun = v)],
  trainParkHome: [() => trainParkHome, v => (trainParkHome = v)],
  trainProp: [() => trainProp, v => (trainProp = v)],
  trainRide: [() => trainRide],
  trainRideCaption: [() => trainRideCaption, v => (trainRideCaption = v)],
  trainRideDepart: [() => trainRideDepart, v => (trainRideDepart = v)],
  trainRideEnd: [() => trainRideEnd, v => (trainRideEnd = v)],
  trainRideFrame: [() => trainRideFrame, v => (trainRideFrame = v)],
  trainRideGuard: [() => trainRideGuard, v => (trainRideGuard = v)],
  trainRideHome: [() => trainRideHome, v => (trainRideHome = v)],
  trainRidePerson: [() => trainRidePerson, v => (trainRidePerson = v)],
  trainRideSkip: [() => trainRideSkip, v => (trainRideSkip = v)],
  trainRideStart: [() => trainRideStart, v => (trainRideStart = v)],
  trainRideWorld: [() => trainRideWorld, v => (trainRideWorld = v)],
  trainVeil: [() => trainVeil, v => (trainVeil = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the train when a run has no region (HB-7's answer) */
const TRAIN_FALLBACK = 'train_greenbelt';
/** the ride under way: `on` while it plays (the checks wait on it), which way, the train, the director's state */
export const trainRide = {
  on: false,
  kind: '',
  key: '',
  t0: 0,
  /** @type {number | null} the pictures tool's fixed moment (ms into the ride), else null */
  hold: null,
  /** @type {any} the timer that ends a ride whose frames stopped coming (trainRideGuard) */
  guard: 0,
  skipped: false,
  /** @type {any} */
  W: null,
  /** @type {(() => void) | null} */
  done: null,
  raf: 0,
  /** @type {any[]} */
  items: [],
  /** @type {any[]} */
  lights: [],
  hide: new Set(),
  /** @type {HTMLElement | null} the way home's loading screen while the ride waits for the hub (trainRideHome) */
  cover: null,
};

/** the beats (ms): the departure and the way home (logic/train-path.js) */
const DEPART = TRAIN_DEPART,
  HOME = TRAIN_HOME,
  VEIL_MS = 450;
const easeInOut = (/** @type {number} */ k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

/** a run's train (its catalogue key): its region's theme's, or the fallback @param {any} run */
export function trainOfRun(run) {
  const th = run && run.region && run.region.theme,
    T = th && gameData.regions && gameData.regions.themes ? gameData.regions.themes[th] : null,
    k = T && T.train && T.train.k;
  return k && walkData().sc.props[k] ? k : TRAIN_FALLBACK;
}
/** the train's name as the player reads it (regions.json, else the catalogue's) @param {string} key */
export function trainName(key) {
  const th = gameData.regions && gameData.regions.themes ? Object.values(gameData.regions.themes) : [],
    T = th.find(t => t && t.train && t.train.k === key);
  if (T) return T.train.name;
  const M = walkData().sc.props[key];
  return (M && M.name) || 'the sky train';
}

/** where to film: the hub's walk view up with Skyline Station, its track and the portal in it; null when it isn't.
 * F the station's frame (logic/train-path.js), y0 its level, tear the portal's middle */
function trainRideWorld() {
  const sc = walkView.sc;
  if (!walkView.ready || !walkView.cv || !sc || !sc.props) return null;
  const st = sc.props.find((/** @type {any} */ p) => p.act === 'station'),
    hub = typeof mapById === 'function' ? mapById(mapIdAt(0)) : null,
    L = (hub && hub.landmarks) || sc.landmarks;
  if (!st || !L || !Array.isArray(L.rail) || L.rail.length < 2 || !L.portal) return null;
  const y0 = L.rail[0][2] - TRAIN_RIDE.railTop,
    F = trainFrame(st, y0);
  return {
    sc,
    st,
    F,
    y0,
    tear: L.portal,
    H: trainHover(F, L.portal),
    portal: sc.props.find((/** @type {any} */ p) => p.k === 'sky_portal') || null,
  };
}

/** the white veil over the page (z above the loading screen): on, or fading out @param {boolean} on @param {number} ms */
export function trainVeil(on, ms = VEIL_MS) {
  let el = /** @type {HTMLElement | null} */ (document.getElementById('trainveil'));
  if (!on) {
    if (!el) return;
    const v = el;
    /* a veil just asked for (its fade-in waiting on a frame) is not to come back on over the fade-out */
    cancelAnimationFrame(/** @type {any} */ (v)._raf || 0);
    v.style.transition = `opacity ${ms}ms ease-out`;
    v.style.opacity = '0';
    setTimeout(() => v.remove(), ms + 50);
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.id = 'trainveil';
    el.className = 'train-veil';
    el.style.opacity = '0';
    document.body.appendChild(el);
  }
  const v = el;
  v.style.transition = `opacity ${ms}ms ease-in`;
  /** @type {any} */ (v)._raf = requestAnimationFrame(() => (v.style.opacity = '1'));
}

/** cutscenes track C: the way home's loading screen (run-loading.js runHomeScreen) fades off when the ride home can
 * start (or gives up); also when the ride stops before @param {number} ms */
function trainCoverOff(ms) {
  const el = trainRide.cover;
  trainRide.cover = null;
  trainVeil(false, Math.min(ms, 200));
  if (!el) return;
  if (!ms || reducedMotion) return void el.remove();
  el.style.transition = `opacity ${ms}ms ease-out`;
  el.style.opacity = '0';
  setTimeout(() => el.remove(), ms + 50);
}

/** the train's placement in the scene (one per ride, put in the walk view's props), moved each frame */
function trainProp(W, key, v) {
  for (let i = W.sc.props.length - 1; i >= 0; i--) if (W.sc.props[i].trainRide) W.sc.props.splice(i, 1);
  const p = { k: key, x: W.H.x, z: W.H.z, y: W.y0, lift: 0, moving: 1, trainRide: 1, ...(v ? { v } : {}) };
  W.sc.props.push(p);
  if (typeof walkRenderer !== 'undefined') walkRenderer.itemGen = (walkRenderer.itemGen || 0) + 1;
  return p;
}
function placeTrain(p, at, y0, s = 1) {
  const q = trainPlace(at, y0);
  Object.assign(p, { x: q.x, z: q.z, rot: q.rot, lift: q.lift, tilt: q.tilt, s });
}
/** the portal's tear: its size (1 as placed) and look (1 gold), kept on the ride to put back after */
function portalLook(W, s, v) {
  const P = W.portal;
  if (!P) return;
  if (!('_s' in W)) W._s = { s: P.s, v: P.v, moving: P.moving };
  P.s = s;
  P.moving = 1;
  if (v) P.v = v;
  else delete P.v;
}
function portalBack(W) {
  const P = W.portal,
    o = W._s;
  if (!P || !o) return;
  for (const k of ['s', 'v', 'moving']) {
    if (o[k] == null) delete P[k];
    else P[k] = o[k];
  }
}

/** a shot from the station's metres (u along its front, w back from it, h over its level) at a point [x, height, z]
 * @param {any} W @param {number[]} eye [u, w, h] @param {number[]} tgt [x, height, z] @param {number} fov */
function shotAt(W, eye, tgt, fov = 50) {
  return { eye: trainEye(W.F, eye[0], eye[1], eye[2]), tgt, fov, hazeK: 1.8 };
}
/** a shot following the train from behind it (the way it faces) and above, looking past it at the portal
 * @param {any} at @param {number[]} tear */
function chaseShot(at, tear) {
  return {
    eye: [at.x - at.dx * 15, at.h + 4.5, at.z - at.dz * 15],
    tgt: [tear[0], tear[2], tear[1]],
    fov: 52,
    hazeK: 1.8,
  };
}
/** the rockets' light under the train's tail (its middle 6 m back, 1.3 m up) while it flies @param {any} at
 * @param {number} k how bright, 0-1 */
function engineLight(at, k) {
  return { p: [at.x - at.dx * 6, at.z - at.dz * 6, at.h + 1.1], r: 5 + 3 * k, c: [2.4 * k, 1.3 * k, 0.45 * k] };
}

/** what the walk view draws each frame of the ride (walkView.director.frame), and the ride's clock */
function trainRideFrame() {
  const R = trainRide,
    W = R.W;
  if (!R.on || !W) return null;
  const now = performance.now(),
    t = R.hold != null ? R.hold : now - R.t0,
    items = R.items,
    lights = R.lights,
    C0 = walkData().sc,
    p = W.train,
    F = W.F,
    T = W.tear,
    stop = TRAIN_RIDE.stop,
    /* the portal close: from the hover's side of it, a little above */
    portalCam = {
      eye: [T[0] + (W.H.x - T[0]) * 0.72, T[2] + 1, T[1] + (W.H.z - T[1]) * 0.72 - 9],
      tgt: [T[0], T[2], T[1]],
      fov: 50,
      hazeK: 1.8,
    },
    tgtOf = (/** @type {any} */ at, up = 1.6) => [at.x, at.h + up, at.z];
  items.length = 0;
  lights.length = 0;
  /** @type {any} */
  let look;
  if (R.kind === 'depart') {
    const B = trainDepartAt(F, T, t),
      at = B.at;
    if (B.beat === 'gone') return (trainRideEnd(false), null);
    placeTrain(p, at, W.y0, B.s);
    if (B.beat === 'glide') {
      /* from the beach in front: it comes in along the track and settles behind the platform */
      look = shotAt(W, [9, -13, 4.5], [(at.x + W.H.x) / 2, (at.h + W.y0) / 2 + 1.5, (at.z + W.H.z) / 2], 54);
    } else if (B.beat === 'board') {
      /* you walk up the steps onto the platform and into the train */
      const k = clamp(B.k / 0.75, 0, 1),
        a = trainAt(F, stop + 1.5, -0.4),
        b = trainAt(F, stop + 1.5, TRAIN_RIDE.track - TRAIN_RIDE.half - 0.4);
      if (k < 1) items.push(trainRidePerson(a, b, k, 'up', C0, t));
      look = shotAt(W, [2.5, -8.5, 2.6], trainEye(F, stop + 0.5, 2.5, 1.6), 50);
    } else if (B.beat === 'lift') {
      /* straight up on its engines, over the canopy */
      lights.push(engineLight(at, 0.5 + 0.5 * B.k));
      look = shotAt(W, [8, -14, 1.8], tgtOf(at, 1.2), 54);
    } else if (B.beat === 'turn') {
      /* hovering, it turns its nose to the portal; the portal stirs */
      lights.push(engineLight(at, 1));
      portalLook(W, 1 + 0.15 * B.k, 0);
      look = shotAt(W, [-12, -14, 10], tgtOf(at, 1.5), 54);
    } else {
      /* into the portal: the camera chases it in */
      const k = B.k;
      portalLook(W, 1.15 + 0.25 * k, 0);
      lights.push(engineLight(at, 1));
      lights.push({ p: [T[0], T[1], T[2]], r: 9 + 4 * k, c: [0.8 + k, 1 + k, 1.6 + k] });
      look = chaseShot(at, T);
    }
  } else {
    const B = trainHomeAt(F, T, t),
      at = B.at;
    if (B.beat === 'gone') return (trainRideEnd(false), null);
    placeTrain(p, at, W.y0, B.s);
    if (B.beat === 'open') {
      portalLook(W, 1 + 0.35 * easeInOut(B.k), R.won ? 1 : 0);
      lights.push({ p: [T[0], T[1], T[2]], r: 9, c: [1 + B.k, 1 + B.k * 0.8, 1.4] });
      look = portalCam;
    } else if (B.beat === 'out') {
      /* out of the portal and across to the station, the camera turning to keep it */
      portalLook(W, 1.35 - 0.35 * B.k, R.won ? 1 : 0);
      lights.push(engineLight(at, 1));
      const k = easeInOut(B.k);
      look = {
        ...portalCam,
        tgt: [T[0] + (at.x - T[0]) * k, T[2] + (at.h + 1.5 - T[2]) * k, T[1] + (at.z - T[1]) * k],
      };
    } else if (B.beat === 'turn') {
      portalBack(W);
      lights.push(engineLight(at, 1));
      look = shotAt(W, [-12, -14, 10], tgtOf(at, 1.5), 54);
    } else if (B.beat === 'down') {
      lights.push(engineLight(at, 1 - 0.5 * B.k));
      look = shotAt(W, [8, -14, 2.2], tgtOf(at, 1.2), 54);
    } else {
      /* you step off, down the platform's steps */
      const k = clamp(B.k / 0.8, 0, 1),
        a = trainAt(F, stop + 1.5, TRAIN_RIDE.track - TRAIN_RIDE.half - 0.4),
        to = W.roam ? [W.roam.x, W.roam.z] : trainAt(F, stop + 1.5, -1.4);
      items.push(trainRidePerson(a, to, k, 'down', C0, t));
      look = shotAt(W, [2, -10, 2.8], trainEye(F, stop + 0.5, 1.2, 1.3), 50);
    }
  }
  return {
    look,
    items,
    lights,
    parts: [],
    hide: R.hide,
    focus: Math.hypot(look.tgt[0] - look.eye[0], look.tgt[1] - look.eye[1], look.tgt[2] - look.eye[2]),
    blur: 0.12,
    center: [look.tgt[0], look.tgt[2]],
    cut: 2.6,
    /* the shots out over the sea see further than a walk: the portal stands clear of the haze */
    hazeK: look.hazeK || 1,
  };
}
/** you on the platform, walking from a to b (k of the way) @param {number[]} a @param {number[]} b @param {number} k
 * @param {string} dir @param {any} C0 @param {number} t */
function trainRidePerson(a, b, k, dir, C0, t) {
  const fr = personWalkFrames('me'),
    set = fr[dir] || fr.down,
    im = k < 1 ? (set.cyc ? set.cyc[Math.floor(t / 110) % 6] : set[1 + (Math.floor(t / 150) % 2)]) : set[0];
  return personItem('actor', im, a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, C0, {});
}

/** a ride starts: in the hub's walk view, or straight to its end (no view, reduced motion)
 * @param {'depart' | 'home'} kind @param {string} key @param {any} o won (home), roam (home: where you stand after)
 * @param {() => void} done */
function trainRideStart(kind, key, o, done) {
  if (trainRide.on && trainRide.W) trainRideEnd(true);
  const W = reducedMotion ? null : trainRideWorld();
  Object.assign(trainRide, { on: true, kind, key, t0: performance.now(), skipped: false, W, done, won: !!o.won });
  document.body.classList.add('train-ride');
  if (!W) {
    /* reduced motion or nowhere to film: the short version */
    if (kind === 'depart') {
      trainVeil(true, 400);
      setTimeout(() => trainRideEnd(false), 420);
    } else {
      trainParkHome(key, o.won ? 1 : 2, performance.now());
      trainCoverOff(400);
      setTimeout(() => trainRideEnd(false), 420);
    }
    return;
  }
  W.roam = uiState.roam && uiState.roam.id === mapIdAt(0) ? uiState.roam : null;
  W.train = trainProp(W, key, kind === 'home' ? (o.won ? 1 : 2) : 0);
  walkView.director = { frame: trainRideFrame };
  trainRideGuard();
  trainRideCaption(true);
  if (kind === 'home') trainCoverOff(600);
}

/** the train home standing at the platform in its look (v), once the hub's walk view is up to put it in (it can come
 * up after the ride has given up waiting for it: a slow phone; 30 s at most) @param {string} key @param {number} v
 * @param {number} t0 */
function trainParkHome(key, v, t0) {
  const P = trainRideWorld();
  if (P) placeTrain(trainProp(P, key, v), trainHomeAt(P.F, P.tear, Infinity).at, P.y0);
  else if (performance.now() - t0 < 30000) setTimeout(() => trainParkHome(key, v, t0), 300);
}

/** the ride's clock runs in the walk view's frames, which come slowly on a slow phone and not at all while the view
 * isn't drawn: a timer ends it once its time is up all the same (not while the pictures tool holds a moment) */
function trainRideGuard() {
  const R = trainRide,
    B = R.kind === 'depart' ? DEPART : HOME,
    ms = Object.values(B).reduce((a, b) => a + b, 0);
  clearTimeout(R.guard);
  R.guard = setTimeout(function check() {
    if (!R.on || !R.W) return;
    if (R.hold != null || performance.now() - R.t0 < ms) return void (R.guard = setTimeout(check, 500));
    trainRideEnd(false);
  }, ms + 1000);
}

/** the ride ends (played out, or skipped: skip true): the departure behind the white veil, the way home with the train
 * standing at the station; its log line, then the caller's next step */
function trainRideEnd(skip) {
  const R = trainRide;
  if (!R.on) return;
  clearTimeout(R.guard);
  const W = R.W,
    ms = Math.round(performance.now() - R.t0);
  R.on = false;
  R.skipped = !!skip;
  if (walkView.director && walkView.director.frame === trainRideFrame) walkView.director = null;
  if (typeof walkRenderer !== 'undefined') {
    walkRenderer.bt = null;
    walkRenderer.focus = null;
  }
  trainRideCaption(false);
  document.body.classList.remove('train-ride');
  if (W) {
    portalBack(W);
    if (R.kind === 'depart') {
      /* gone through the portal: the train leaves the hub */
      W.sc.props = W.sc.props.filter((/** @type {any} */ q) => !q.trainRide);
      trainVeil(true, skip ? 200 : VEIL_MS);
      if (typeof soundEffect === 'function') soundEffect('throw');
    } else {
      /* home: it stays at the platform, still */
      placeTrain(W.train, trainHomeAt(W.F, W.tear, Infinity).at, W.y0);
      delete W.train.moving;
      if (skip) trainVeil(false, 200);
    }
    if (R.kind === 'home') trainCoverOff(0);
    if (typeof walkRenderer !== 'undefined') walkRenderer.itemGen = (walkRenderer.itemGen || 0) + 1;
  }
  R.W = null;
  if (typeof debugLog !== 'undefined')
    debugLog.add(
      'scene',
      `train ride ${R.kind === 'depart' ? 'departure' : 'home'} ${R.key} ${ms} ms${skip ? ' (skipped)' : ''}`
    );
  /* cutscenes track C: what waited for the ride home (an evolution: pending-windows.js) opens now, before the story's
     scene of the way home (story-stage.js storyPendingCheck waits for it) */
  if (R.kind === 'home' && typeof showPendingWindows === 'function') showPendingWindows();
  const f = R.done;
  R.done = null;
  /* the departure's next step once the veil is white */
  if (f) setTimeout(f, W && R.kind === 'depart' ? (skip ? 220 : VEIL_MS + 30) : 0);
}

/** "Tap to skip" over the ride @param {boolean} on */
function trainRideCaption(on) {
  const old = document.getElementById('traincap');
  if (old) old.remove();
  if (!on) return;
  const c = document.createElement('div');
  c.id = 'traincap';
  c.className = 'train-cap glass';
  c.textContent = 'Tap to skip';
  document.body.appendChild(c);
}

/** leave on a run: the train glides in, you board, up the rail and into the tear; done() once the veil is white
 * @param {string} key the train @param {() => void} done */
export function trainRideDepart(key, done) {
  trainRideStart('depart', key, {}, done);
}
/** come home from a run: out of the tear and down to the station (gold after a win, battered after a loss),
 * you step off where the walk stands you (uiState.roam: standByMast); done() once you stand there. It waits (behind
 * `cover`, the way home's loading screen, `on` already) for the hub's walk view to be up, 30 s at most (a slow
 * phone); the cover lifts as the ride starts, and whenever it stops @param {string} key @param {boolean} won
 * @param {() => void} done @param {HTMLElement | null} [cover] */
export function trainRideHome(key, won, done, cover = null) {
  const t0 = performance.now();
  if (trainRide.cover && trainRide.cover !== cover) trainRide.cover.remove();
  Object.assign(trainRide, { on: true, kind: 'home', key, W: null, done: null, cover });
  const go = () => {
    if (trainRide.W) return;
    if (!trainRide.on) return void trainCoverOff(0);
    if (!reducedMotion && !trainRideWorld() && performance.now() - t0 < 30000) return void setTimeout(go, 150);
    trainRideStart('home', key, { won }, done);
  };
  go();
}
/** skip the ride (a tap, the checks) */
export function trainRideSkip() {
  if (trainRide.on && trainRide.W) trainRideEnd(true);
}

document.addEventListener(
  'click',
  ev => {
    if (!trainRide.on || !trainRide.W) return;
    ev.stopPropagation();
    ev.preventDefault();
    trainRideSkip();
  },
  true
);
