'use strict';
/* ================= THE SKY TRAIN'S RIDE (hub track HB-8) =================
   A run leaves from Skyline Station on its region's sky train (regions.json themes.<id>.train, the Greenbelt
   Sunrunner when the run has no region): the train glides in, you board, the camera follows it up the sky rail, the
   portal's tear opens and the train flies in, then a white-out (the run's loading screen comes up behind it, as the
   carriage's inside: train-carriage.js). Coming home it comes back out of the tear and down the rail to the station,
   gold-trimmed after a won run (and the tear gold), battered and smoking after a lost one, and you step off.
   Filmed in the hub's own walk view through its director hook (walkView.director: the camera, the people, the props
   hidden; cutscene/director.js does the same for the story), the train a placement moved along its way each frame
   (logic/train-path.js). A tap skips the ride (never the loading). Reduced motion: a short white fade, no ride. No hub
   walk view to film in (the debug menu elsewhere, a test page): no ride either. trainRide.on is the signal the checks
   wait on; the debug log gets one 'scene' line a ride (the train's key and the ms, never a name). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { mapIdAt } from './hooks.js';
import { clamp } from './util.js';
import { gameData } from './game-data.js';
import { TRAIN_RIDE, trainGlide, trainPathAt, trainPlace, trainRoute, trainRouteBack } from './logic/train-path.js';
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
  easeIn: [() => easeIn],
  easeInOut: [() => easeInOut],
  easeOut: [() => easeOut],
  placeTrain: [() => placeTrain, v => (placeTrain = v)],
  portalBack: [() => portalBack, v => (portalBack = v)],
  portalLook: [() => portalLook, v => (portalLook = v)],
  trainName: [() => trainName, v => (trainName = v)],
  trainOfRun: [() => trainOfRun, v => (trainOfRun = v)],
  trainParkHome: [() => trainParkHome, v => (trainParkHome = v)],
  trainProp: [() => trainProp, v => (trainProp = v)],
  trainRide: [() => trainRide],
  trainRideCaption: [() => trainRideCaption, v => (trainRideCaption = v)],
  trainRideDepart: [() => trainRideDepart, v => (trainRideDepart = v)],
  trainRideEnd: [() => trainRideEnd, v => (trainRideEnd = v)],
  trainRideFrame: [() => trainRideFrame, v => (trainRideFrame = v)],
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
};

/** the beats (ms): the departure and the way home */
const DEPART = { glide: 2600, board: 1300, climb: 3800, open: 700, enter: 700 },
  HOME = { open: 900, out: 800, down: 3800, off: 1300 },
  VEIL_MS = 450;
const easeIn = (/** @type {number} */ k) => k * k,
  easeOut = (/** @type {number} */ k) => 1 - (1 - k) * (1 - k),
  easeInOut = (/** @type {number} */ k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

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

/** where to film: the hub's walk view up with Skyline Station, its rail and the portal in it; null when it isn't */
function trainRideWorld() {
  const sc = walkView.sc;
  if (!walkView.ready || !walkView.cv || !sc || !sc.props) return null;
  const st = sc.props.find((/** @type {any} */ p) => p.act === 'station'),
    hub = typeof mapById === 'function' ? mapById(mapIdAt(0)) : null,
    L = (hub && hub.landmarks) || sc.landmarks;
  if (!st || !L || !Array.isArray(L.rail) || L.rail.length < 2 || !L.portal) return null;
  const R = trainRoute(L.rail, L.portal, st.x + TRAIN_RIDE.stop),
    stop = R.pts[0],
    y0 = L.rail[0][2] - TRAIN_RIDE.railTop;
  return {
    sc,
    st,
    R,
    B: trainRouteBack(R),
    stop,
    y0,
    lip: R.at[R.pts.length - 2],
    tear: L.portal,
    portal: sc.props.find((/** @type {any} */ p) => p.k === 'sky_portal') || null,
  };
}

/** the white veil over the page (z above the loading screen): on, or fading out @param {boolean} on @param {number} ms */
export function trainVeil(on, ms = VEIL_MS) {
  let el = /** @type {HTMLElement | null} */ (document.getElementById('trainveil'));
  if (!on) {
    if (!el) return;
    const v = el;
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
  requestAnimationFrame(() => (v.style.opacity = '1'));
}

/** the train's placement in the scene (one per ride, put in the walk view's props), moved each frame */
function trainProp(W, key, v) {
  for (let i = W.sc.props.length - 1; i >= 0; i--) if (W.sc.props[i].trainRide) W.sc.props.splice(i, 1);
  const p = { k: key, x: W.stop[0], z: W.stop[1], y: W.y0, lift: 0, moving: 1, trainRide: 1, ...(v ? { v } : {}) };
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

/** a camera following the train: from behind it (its heading), out to its seaward side and above @param {any} at
 * @param {number} y0 the station's level (the camera never lower than a little over it) */
function chaseShot(at, y0) {
  const T = [at.x, at.h, at.z];
  return {
    eye: [T[0] - at.dx * 20, Math.max(y0 + 2.5, T[1] + 6), T[2] + 16],
    tgt: [T[0] + at.dx * 4, T[1] + 1.2, T[2] - 1],
    fov: 50,
    hazeK: 1.8,
  };
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
    p = W.train;
  items.length = 0;
  lights.length = 0;
  /** @type {any} */
  let look;
  const stop = W.stop,
    h0 = stop[2],
    rz = stop[1];
  const portalCam = {
    eye: [W.tear[0] - 27, W.tear[2] - 3, rz + 22],
    tgt: [W.tear[0] - 2, W.tear[2] + 0.5, rz],
    fov: 48,
    hazeK: 1.8,
  };
  if (R.kind === 'depart') {
    const D = DEPART;
    let s = t;
    if (s < D.glide) {
      /* from the sea side: it comes in from the west over the town and settles on the track bed */
      const at = trainGlide(stop, s / D.glide);
      placeTrain(p, at, W.y0);
      look = {
        eye: [stop[0] + 2, h0 + 7.5, rz + 9],
        tgt: [at.x * 0.6 + stop[0] * 0.4, (at.h + h0) / 2 + 1, rz - 1],
        fov: 54,
      };
    } else if ((s -= D.glide) < D.board) {
      placeTrain(p, trainPathAt(W.R, 0), W.y0);
      const k = clamp(s / (D.board * 0.75), 0, 1),
        a = [stop[0] + 1.5, rz - TRAIN_RIDE.half - 2.6],
        b = [stop[0] + 1.5, rz - TRAIN_RIDE.half - 0.4];
      if (k < 1) items.push(trainRidePerson(a, b, k, 'up', C0, t));
      look = { eye: [stop[0] - 7, h0 + 3.4, rz - 9], tgt: [stop[0] + 1, h0 + 1.4, rz - 1.5], fov: 50 };
    } else if ((s -= D.board) < D.climb) {
      const at = trainPathAt(W.R, W.lip * easeIn(s / D.climb));
      placeTrain(p, at, W.y0);
      look = chaseShot(at, W.y0);
    } else if ((s -= D.climb) < D.open) {
      const k = s / D.open;
      placeTrain(p, trainPathAt(W.R, W.lip), W.y0);
      portalLook(W, 1 + 0.35 * easeInOut(k), 0);
      lights.push({ p: [W.tear[0], W.tear[2], W.tear[1]], r: 9, c: [0.6 + k, 0.9 + k, 1.6 + k] });
      look = portalCam;
    } else if ((s -= D.open) < D.enter) {
      const k = s / D.enter;
      placeTrain(p, trainPathAt(W.R, W.lip + (W.R.len - W.lip) * easeIn(k)), W.y0, 1 - 0.92 * easeIn(k));
      lights.push({ p: [W.tear[0], W.tear[2], W.tear[1]], r: 12, c: [2, 2, 2.4] });
      look = portalCam;
    } else return (trainRideEnd(false), null);
  } else {
    const H = HOME;
    let s = t;
    if (s < H.open) {
      const k = s / H.open;
      portalLook(W, 1 + 0.35 * easeInOut(k), R.won ? 1 : 0);
      W.train.s = 0.01;
      placeTrain(p, trainPathAt(W.B, 0), W.y0, 0.01);
      lights.push({ p: [W.tear[0], W.tear[2], W.tear[1]], r: 9, c: [1 + k, 1 + k * 0.8, 1.4] });
      look = portalCam;
    } else if ((s -= H.open) < H.out) {
      const k = s / H.out,
        back = W.R.len - W.lip;
      placeTrain(p, trainPathAt(W.B, back * easeOut(k)), W.y0, 0.08 + 0.92 * easeOut(k));
      portalLook(W, 1.35 - 0.35 * k, R.won ? 1 : 0);
      look = portalCam;
    } else if ((s -= H.out) < H.down) {
      const back = W.R.len - W.lip,
        at = trainPathAt(W.B, back + (W.B.len - back) * easeOut(s / H.down));
      placeTrain(p, at, W.y0);
      portalBack(W);
      look = chaseShot(at, W.y0);
    } else if ((s -= H.down) < H.off) {
      placeTrain(p, trainPathAt(W.B, W.B.len), W.y0);
      const k = clamp(s / (H.off * 0.8), 0, 1),
        a = [stop[0] - 1.5, rz - TRAIN_RIDE.half - 0.4],
        to = W.roam ? [W.roam.x, W.roam.z] : [stop[0] - 1.5, rz - TRAIN_RIDE.half - 2.6];
      items.push(trainRidePerson(a, to, k, 'down', C0, t));
      look = { eye: [stop[0] - 7, h0 + 3.4, rz - 10], tgt: [stop[0] - 1, h0 + 1.2, rz - 1.8], fov: 50 };
    } else return (trainRideEnd(false), null);
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
    /* the shots out over the sea see further than a walk: the far rail and the tear stand clear of the haze (not the
       level ones over the town: the far sea would show the world's curve) */
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
      trainVeil(false, 400);
      setTimeout(() => trainRideEnd(false), 420);
    }
    return;
  }
  W.roam = uiState.roam && uiState.roam.id === mapIdAt(0) ? uiState.roam : null;
  W.train = trainProp(W, key, kind === 'home' ? (o.won ? 1 : 2) : 0);
  walkView.director = { frame: trainRideFrame };
  trainRideCaption(true);
  if (kind === 'home') trainVeil(false, 600);
}

/** the train home standing at the platform in its look (v), once the hub's walk view is up to put it in (it can come
 * up after the ride has given up waiting for it: a slow phone; 30 s at most) @param {string} key @param {number} v
 * @param {number} t0 */
function trainParkHome(key, v, t0) {
  const P = trainRideWorld();
  if (P) placeTrain(trainProp(P, key, v), trainPathAt(P.B, P.B.len), P.y0);
  else if (performance.now() - t0 < 30000) setTimeout(() => trainParkHome(key, v, t0), 300);
}

/** the ride ends (played out, or skipped: skip true): the departure behind the white veil, the way home with the train
 * standing at the station; its log line, then the caller's next step */
function trainRideEnd(skip) {
  const R = trainRide;
  if (!R.on) return;
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
      placeTrain(W.train, trainPathAt(W.B, W.B.len), W.y0);
      delete W.train.moving;
      if (skip) trainVeil(false, 200);
    }
    if (typeof walkRenderer !== 'undefined') walkRenderer.itemGen = (walkRenderer.itemGen || 0) + 1;
  }
  R.W = null;
  if (typeof debugLog !== 'undefined')
    debugLog.add(
      'scene',
      `train ride ${R.kind === 'depart' ? 'departure' : 'home'} ${R.key} ${ms} ms${skip ? ' (skipped)' : ''}`
    );
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
/** come home from a run: out of the tear and down the rail to the station (gold after a win, battered after a loss),
 * you step off where the walk stands you (uiState.roam: standByMast); done() once you stand there. It waits (behind
 * the white veil, `on` already) for the hub's walk view to be up, 30 s at most (a slow phone) @param {string} key
 * @param {boolean} won @param {() => void} done */
export function trainRideHome(key, won, done) {
  const t0 = performance.now();
  Object.assign(trainRide, { on: true, kind: 'home', key, W: null, done: null });
  const go = () => {
    if (!trainRide.on || trainRide.W) return;
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
